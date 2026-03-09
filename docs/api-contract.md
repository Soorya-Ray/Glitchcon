# EscrowChain API Contract (v1)

This document defines the REST API contract for the EscrowChain backend, designed for both React and Flutter clients.

**Base URL**: `http://localhost:3000/api/v1` (or production domain)

## Standard Envelope

All responses utilize a standardized JSON envelope for consistent parsing in typed languages (Dart/Flutter, TypeScript).

**Success (2XX):**
```json
{
  "success": true,
  "data": { ... } // or an array [...]
}
```

**Error (4XX, 5XX):**
```json
{
  "success": false,
  "error": "Human readable error message"
}
```

## Authentication

Most routes are protected and require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1...
```

---

## 1. Auth & Users (`/auth`)

### `POST /auth/login`
**Body:** `{"username": "...", "password": "..."}`
**Response:** `data: { token, user: { id, username, name, role... } }`

### `POST /auth/register`
**Body:** `{"username": "...", "password": "...", "name": "...", "role": "customer|supplier|driver", "email": "..."}`
**Response:** `data: { token, user: { id... } }`

### `GET /auth/me`
*Requires Auth*
**Response:** `data: { id, username, role, wallet_balance, reputation: { score, successful_deliveries... } }`

---

## 2. Orders (`/orders`)

*Order Statuses: CREATED, LOCKED, IN_TRANSIT, PROOF_SUBMITTED, CONFIRMED, SETTLED, DISPUTED, RESOLVED*

### `GET /orders`
*Requires Auth*
**Description:** Gets all orders relevant to the current user.
**Response:** `data: [ { orderId, amount, status, customerId, supplierId... }, ... ]`

### `POST /orders`
*Requires Auth (Customer)*
**Body:** `{"supplierId": "USR-...", "amount": 5000, "description": "...", "pickupAddress": "...", "deliveryAddress": "..."}`
**Response:** `data: { orderId, status... }`

### `POST /orders/:id/pay`
*Requires Auth (Customer)*
**Body:** `{"paymentIntentId": "pi_123..."}`
**Description:** Locks funds in escrow only after Stripe confirms `payment_intent.status = succeeded`.
**Response:** `data: { status: "LOCKED", paymentRef: "..." }`

### `POST /orders/:id/assign`
*Requires Auth (Customer)*
**Body:** `{"driverId": "USR-..."}`
**Response:** `data: { status: "IN_TRANSIT", driverId: "..." }`

### `POST /orders/:id/proof`
*Requires Auth (Driver)*
**Body:** `{"gpsLat": 28.6, "gpsLng": 77.2, "notes": "..."}`
**Response:** `data: { status: "PROOF_SUBMITTED", deliveryProof: { hash... } }`

### `POST /orders/:id/confirm`
*Requires Auth (Customer)*
**Description:** Confirms delivery, settles payment to supplier, releases escrow.
**Response:** `data: { status: "SETTLED" }`

### `POST /orders/:id/dispute`
*Requires Auth*
**Body:** `{"reason": "Package damaged"}`
**Response:** `data: { status: "DISPUTED" }`

### `POST /orders/:id/resolve`
*Requires Auth (Admin)*
**Body:** `{"decision": "RELEASE|REFUND|PARTIAL", "amount": 2500}` (amount required if PARTIAL).
**Response:** `data: { status: "RESOLVED", resolution: { ... } }`

---

## 3. Blockchain & Explorers (`/blockchain`)

### `GET /blockchain/stats`
**Response:** `data: { totalBlocks, chainValid, latestTimestamp }`

### `GET /blockchain/chain`
**Response:** `data: { chain: [ { index, timestamp, hash, data: { status, orderId... } }... ] }`

### `GET /blockchain/tx/:txHash`
**Description:** Verifies a transaction receipt against the configured EVM RPC (Hardhat local by default).
**Response:** `data: { verified: true, status: "SUCCESS", confirmations: 5 }`

---

## 4. Payments (`/payments`)

### `GET /payments/config`
**Response:** `data: { publishableKey: "pk_..." }`
**Usage:** Used by React/Flutter clients to initialize Stripe SDK securely.

### `POST /payments/create-intent`
*Requires Auth*
**Body:** `{"orderId": "ORD-123", "amount": 5000}`
**Response:** `data: { paymentIntentId: "pi_...", clientSecret: "pi_secret_...", status: "requires_payment_method", isSimulated: false }`
**Usage:** Use this `clientSecret` with Stripe SDK in Flutter or React to confirm the payment intent, then call `/orders/:id/pay` with the same `paymentIntentId`.

### `POST /payments/webhook`
**Description:** Stripe webhook endpoint for payment event verification and async settlement hooks.
