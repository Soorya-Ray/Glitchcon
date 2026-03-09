# Full Stack Migration Checklist

This project now runs in full-integration mode (no simulation fallbacks).

## Required Environment

Set all of the following before starting the backend:

- `JWT_SECRET`
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BLOCKCHAIN_RPC_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `BLOCKCHAIN_CONTRACT_ADDRESS`

Recommended for strict production behavior:
- `REQUIRE_BLOCKCHAIN_TX=true` (default if unset outside test mode)

## Backend Startup

```bash
npm install
npm run build:client
npm start
```

Server startup now fails fast if required env is missing.
Order state updates now also fail if blockchain transaction writes fail (strict mode).

## Stripe Webhook Setup

1. Expose backend publicly in dev (e.g. ngrok).
2. Configure Stripe webhook endpoint:
   - URL: `https://<your-host>/api/v1/payments/webhook`
   - Event: `payment_intent.succeeded`
3. Set returned webhook signing secret in `.env` as `STRIPE_WEBHOOK_SECRET`.

## Hardhat Setup (Local)

1. Start local chain: `npm run hardhat:node`
2. Deploy contract: `npm run hardhat:deploy:local`
3. Ensure `.env` includes:
   - `BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545`
   - `BLOCKCHAIN_PRIVATE_KEY=<deployer/private key>`
   - `BLOCKCHAIN_CONTRACT_ADDRESS=<deployed address>`

## Flutter Integration

Use `mobile/flutter_client` starter:

1. Authenticate with `/auth/login`.
2. Create order with `/orders`.
3. Request Stripe intent via `/payments/create-intent`.
4. Confirm payment in app with Stripe SDK.
5. Lock escrow with `/orders/:id/pay` using `paymentIntentId`.
