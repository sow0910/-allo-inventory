'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Stock {
  warehouseId: string
  warehouseName: string
  warehouseLocation: string
  available: number
  total: number
  reserved: number
}

interface Product {
  id: string
  name: string
  description: string
  price: number
  stocks: Stock[]
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [])

  async function reserve(productId: string, warehouseId: string) {
    const key = `${productId}-${warehouseId}`
    setReserving(key)
    setError(null)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reserve. Please try again.')
        return
      }
      router.push(`/reservation/${data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setReserving(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Allo Inventory</h1>
            <p className="text-xs text-gray-400 mt-0.5">Multi-warehouse fulfillment platform</p>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
            {products.length} products
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-5">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{product.description}</p>
                  </div>
                  <span className="text-xl font-bold text-gray-900 ml-4">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                  Stock by warehouse
                </p>
                <div className="grid gap-2">
                  {product.stocks.map((stock) => (
                    <div
                      key={stock.warehouseId}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            stock.available > 3
                              ? 'bg-green-500'
                              : stock.available > 0
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{stock.warehouseName}</p>
                          <p className="text-xs text-gray-400">{stock.warehouseLocation}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${
                              stock.available > 0 ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {stock.available > 0 ? `${stock.available} left` : 'Out of stock'}
                          </p>
                          {stock.reserved > 0 && (
                            <p className="text-xs text-amber-500">{stock.reserved} reserved</p>
                          )}
                        </div>
                        <button
                          onClick={() => reserve(product.id, stock.warehouseId)}
                          disabled={
                            stock.available === 0 ||
                            reserving === `${product.id}-${stock.warehouseId}`
                          }
                          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {reserving === `${product.id}-${stock.warehouseId}`
                            ? 'Reserving...'
                            : 'Reserve'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
