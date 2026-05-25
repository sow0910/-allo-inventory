import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { z } from 'zod'

const ReserveSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int().positive(),
})

const RESERVATION_TTL = 10 * 60 // 10 minutes in seconds
const LOCK_TTL = 5000 // 5 seconds in ms

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('Idempotency-Key')

  // Idempotency check — return cached response if key seen before
  if (idempotencyKey) {
    const cached = await redis.get(`idempotency:reserve:${idempotencyKey}`)
    if (cached) return NextResponse.json(cached, { status: 200 })
  }

  const body = await req.json()
  const parsed = ReserveSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { productId, warehouseId, quantity } = parsed.data
  const lockKey = `lock:stock:${productId}:${warehouseId}`

  // Acquire distributed lock — only one reservation per product/warehouse at a time
  const lock = await redis.set(lockKey, '1', { px: LOCK_TTL, nx: true })

  if (!lock) {
    return NextResponse.json(
      { error: 'Another reservation is in progress. Please try again in a moment.' },
      { status: 409 }
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      })

      if (!stock) throw new Error('STOCK_NOT_FOUND')

      const available = stock.total - stock.reserved
      if (available < quantity) throw new Error('INSUFFICIENT_STOCK')

      // Atomically increment the reserved count
      await tx.stock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { increment: quantity } },
      })

      const expiresAt = new Date(Date.now() + RESERVATION_TTL * 1000)

      return tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt,
          idempotencyKey: idempotencyKey ?? undefined,
        },
        include: { product: true, warehouse: true },
      })
    })

    // Cache result for idempotency
    if (idempotencyKey) {
      await redis.set(`idempotency:reserve:${idempotencyKey}`, result, {
        ex: RESERVATION_TTL,
      })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'INSUFFICIENT_STOCK' || message === 'STOCK_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Not enough stock available for this product.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    // Always release the lock
    await redis.del(lockKey)
  }
}
