# Allo Inventory — Reservation System

A multi-warehouse inventory and order-fulfillment platform with race-condition-safe reservation logic.

**Live URL:** allo-inventory-8wmh7qpnb-sow-s-projects1.vercel.app

---

## How to run locally

### 1. Clone and install

```bash
git clone https://github.com/sow0910/-allo-inventory
cd allo-inventory
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in `.env` with your Supabase and Upstash credentials:

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (URI, with `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase → Settings → Database → Connection string (URI, without pgbouncer) |
| `UPSTASH_REDIS_REST_URL` | Upstash → your database → REST API section |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → your database → REST API section |

### 3. Run migrations and seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How expiry works in production

Reservations expire via **lazy cleanup on read**. When any reservation endpoint is called, the server checks whether `expiresAt` has passed and automatically transitions the reservation to `RELEASED`, returning the stock to available.

This means no background worker is needed. The trade-off is that stock remains "stuck" in reserved state until someone reads the reservation. For a higher-volume system, a Vercel Cron job running every minute to sweep all expired `PENDING` reservations would be the right addition.

---

## How concurrency is handled

The `POST /api/reservations` endpoint uses a two-layer approach:

**Layer 1 — Redis distributed lock** (`SET NX PX`): Before touching the database, we acquire a short-lived lock keyed to `lock:stock:{productId}:{warehouseId}`. Only one request can hold this lock at a time. Any concurrent request gets a `409` immediately and is told to retry. The lock is always released in a `finally` block.

**Layer 2 — Postgres transaction**: Inside the lock, we check stock availability and increment the reserved count atomically in a single transaction. Even if two requests somehow bypass the Redis lock (e.g. Redis is temporarily unavailable), the database transaction ensures no double-booking — the check and the update are atomic.

---

## Idempotency

Both `POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header. If a client sends the same key twice (e.g. after a network timeout), the second request returns the original cached response from Redis without repeating any side effects. Keys are cached for the duration of the reservation TTL (10 minutes).

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List all products with available stock per warehouse |
| GET | `/api/warehouses` | List all warehouses |
| POST | `/api/reservations` | Reserve units — returns `409` if stock insufficient |
| POST | `/api/reservations/:id/confirm` | Confirm reservation — returns `410` if expired |
| POST | `/api/reservations/:id/release` | Release reservation early |
| GET | `/api/reservations/:id` | Get reservation details |

---

## Trade-offs and what I'd do differently with more time

- **No user authentication** — reservations are anonymous. In production, each reservation would be tied to a user session so users can only confirm/cancel their own reservations.
- **Quantity is fixed at 1 in the UI** — the API fully supports any quantity, but the frontend always sends `quantity: 1` for simplicity.
- **Lazy expiry only** — a Vercel Cron job sweeping expired reservations every minute would be more thorough for high-volume scenarios where reservations might not be read again after expiry.
- **No payment integration** — the "Confirm Purchase" button simulates a successful payment. In a real system this would trigger a payment provider (Razorpay, Stripe) and the confirmation would happen via a webhook callback.
- **No email notifications** — would add order confirmation emails via Resend.
