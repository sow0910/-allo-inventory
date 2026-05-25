'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'

interface Reservation {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED'
  expiresAt: string
  quantity: number
  product: { name: string; price: number; description: string }
  warehouse: { name: string; location: string }
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const display = `${mins}:${secs.toString().padStart(2, '0')}`
  const urgent = secondsLeft < 60
  const expired = secondsLeft === 0

  if (expired) {
    return (
      <div className="mt-6 bg-red-50 rounded-xl p-4 text-center">
        <p className="text-sm text-red-500 mb-1">Reservation expired</p>
        <p className="text-3xl font-bold font-mono text-red-600">0:00</p>
      </div>
    )
  }

  return (
    <div className={`mt-6 rounded-xl p-4 text-center ${urgent ? 'bg-red-50' : 'bg-amber-50'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${urgent ? 'text-red-400' : 'text-amber-500'}`}>
        Time remaining to complete payment
      </p>
      <p className={`text-5xl font-bold font-mono ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
        {display}
      </p>
      {urgent && (
        <p className="text-xs text-red-500 mt-2">⚠️ Hurry! Your reservation is about to expire</p>
      )}
    </div>
  )
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`)
      const data = await res.json()
      setReservation(data)
    } catch {
      setError('Failed to load reservation')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchReservation()
  }, [fetchReservation])

  async function confirm() {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to confirm')
        if (res.status === 410) fetchReservation() // refresh to show expired state
        return
      }
      setReservation(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function cancel() {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to cancel')
        return
      }
      setReservation(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading reservation...</p>
        </div>
      </div>
    )
  }

  if (!reservation || 'error' in reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">Reservation not found</p>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:underline text-sm"
          >
            Back to products
          </button>
        </div>
      </div>
    )
  }

  const isPending = reservation.status === 'PENDING'
  const isConfirmed = reservation.status === 'CONFIRMED'
  const isReleased = reservation.status === 'RELEASED'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-6 py-4">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 text-sm hover:underline flex items-center gap-1"
          >
            ← Back to products
          </button>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Checkout</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Status banner */}
          <div
            className={`px-6 py-3 text-sm font-medium border-b ${
              isPending
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : isConfirmed
                ? 'bg-green-50 text-green-700 border-green-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}
          >
            {isPending && '⏳ Reservation pending — complete payment before time runs out'}
            {isConfirmed && '✅ Payment confirmed — your order has been placed!'}
            {isReleased && '❌ Reservation released — units returned to stock'}
          </div>

          <div className="p-6">
            {/* Product info */}
            <h2 className="text-xl font-semibold text-gray-900">{reservation.product.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{reservation.product.description}</p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Warehouse</p>
                <p className="text-sm font-semibold text-gray-800">{reservation.warehouse.name}</p>
                <p className="text-xs text-gray-400">{reservation.warehouse.location}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Quantity</p>
                <p className="text-sm font-semibold text-gray-800">{reservation.quantity} unit</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Total amount</p>
                <p className="text-lg font-bold text-gray-900">
                  ₹{(reservation.product.price * reservation.quantity).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Reservation ID</p>
                <p className="text-xs font-mono text-gray-600 break-all">{reservation.id.slice(0, 12)}...</p>
              </div>
            </div>

            {/* Countdown timer */}
            {isPending && <Countdown expiresAt={reservation.expiresAt} />}

            {/* Action buttons */}
            {isPending && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={confirm}
                  disabled={actionLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Processing...' : '✓ Confirm Purchase'}
                </button>
                <button
                  onClick={cancel}
                  disabled={actionLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {isConfirmed && (
              <button
                onClick={() => router.push('/')}
                className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Continue Shopping →
              </button>
            )}

            {isReleased && (
              <button
                onClick={() => router.push('/')}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Browse Products →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
