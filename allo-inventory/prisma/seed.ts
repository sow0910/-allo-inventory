import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.reservation.deleteMany()
  await prisma.stock.deleteMany()
  await prisma.product.deleteMany()
  await prisma.warehouse.deleteMany()

  const w1 = await prisma.warehouse.create({ data: { name: 'Mumbai Central', location: 'Mumbai, Maharashtra' } })
  const w2 = await prisma.warehouse.create({ data: { name: 'Delhi North', location: 'Delhi, NCR' } })
  const w3 = await prisma.warehouse.create({ data: { name: 'Bangalore Hub', location: 'Bangalore, Karnataka' } })

  await prisma.product.create({
    data: {
      name: 'Wireless Headphones',
      description: 'Premium noise-cancelling headphones with 30hr battery life',
      price: 2999,
      stocks: {
        create: [
          { warehouseId: w1.id, total: 10, reserved: 0 },
          { warehouseId: w2.id, total: 5, reserved: 0 },
          { warehouseId: w3.id, total: 3, reserved: 0 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'Smart Watch',
      description: 'Feature-packed smartwatch with health tracking and GPS',
      price: 4999,
      stocks: {
        create: [
          { warehouseId: w1.id, total: 8, reserved: 0 },
          { warehouseId: w2.id, total: 2, reserved: 0 },
          { warehouseId: w3.id, total: 6, reserved: 0 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'Mechanical Keyboard',
      description: 'Compact TKL mechanical keyboard with RGB backlight',
      price: 3499,
      stocks: {
        create: [
          { warehouseId: w1.id, total: 1, reserved: 0 },
          { warehouseId: w2.id, total: 4, reserved: 0 },
          { warehouseId: w3.id, total: 0, reserved: 0 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'USB-C Hub',
      description: '7-in-1 USB-C hub with HDMI, SD card, and fast charging',
      price: 1499,
      stocks: {
        create: [
          { warehouseId: w1.id, total: 15, reserved: 0 },
          { warehouseId: w2.id, total: 0, reserved: 0 },
          { warehouseId: w3.id, total: 7, reserved: 0 },
        ],
      },
    },
  })

  console.log('✅ Database seeded successfully!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
