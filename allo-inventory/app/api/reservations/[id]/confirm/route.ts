import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const idempotencyKey = req.headers.get('Idempotency-Key')

  if (idempotencyKey) {
    const cached = await redis.get(`idempotency:confirm:${idempotencyKey}`)
    if (cached) return NextResponse.json(cached)
  }

  const reservation = await prisma.reservation.findUnique({ where: { id } })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  if (reservation.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Reservation is already ${reservation.status.toLowerCase()}` },
      { status: 400 }
    )
  }

  // Check expiry — return 410 Gone
  if (new Date() > reservation.expiresAt) {
    await prisma.$transaction([
      prisma.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      }),
      prisma.reservation.update({
        where: { id },
        data: { status: 'RELEASED' },
      }),
    ])
    return NextResponse.json(
      { error: 'Reservation has expired. Please start a new reservation.' },
      { status: 410 }
    )
  }

  const confirmed = await prisma.$transaction(async (tx) => {
    // Remove the hold AND decrement total (permanent sale)
    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        reserved: { decrement: reservation.quantity },
        total: { decrement: reservation.quantity },
      },
    })

    return tx.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { product: true, warehouse: true },
    })
  })

  if (idempotencyKey) {
    await redis.set(`idempotency:confirm:${idempotencyKey}`, confirmed, { ex: 3600 })
  }

  return NextResponse.json(confirmed)
}
