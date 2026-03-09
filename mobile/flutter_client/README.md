# Flutter Client Starter

This folder contains a lightweight Flutter networking starter for EscrowChain `/api/v1`.

## Setup

1. Create a Flutter app (if not already):
```bash
flutter create escrow_mobile
```
2. Copy `lib/services/api_client.dart` and model files from this folder into your Flutter app.
3. Add dependencies to `pubspec.yaml`:
```yaml
dependencies:
  dio: ^5.9.0
  flutter_secure_storage: ^9.2.2
```
4. Set your API base URL in `ApiClient` (emulator/device accessible host).

## Covered Flows

- Login / token persistence
- Current profile fetch
- List orders
- Create order
- Create Stripe payment intent
- Lock escrow with payment intent id
- Assign driver
- Submit delivery proof
- Confirm delivery
- Raise / resolve dispute

## Stripe in Flutter

Use `createPaymentIntent(orderId, amount)` to get `clientSecret` and `paymentIntentId`, then confirm payment with `flutter_stripe`. After payment succeeds, call `payOrder(orderId, paymentIntentId)`.
