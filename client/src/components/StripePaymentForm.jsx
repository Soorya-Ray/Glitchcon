import { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

const CARD_STYLE = {
  style: {
    base: {
      color: '#0f172a',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontSize: '16px',
      '::placeholder': {
        color: '#64748b',
      },
    },
    invalid: {
      color: '#dc2626',
    },
  },
};

export default function StripePaymentForm({ clientSecret, onSuccess, onError, buttonLabel = 'Pay Now' }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const card = elements.getElement(CardElement);
      if (!card) throw new Error('Card input is not ready');

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card }
      });

      if (error) throw new Error(error.message || 'Payment confirmation failed');
      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment not completed. Current status: ${paymentIntent?.status || 'unknown'}`);
      }

      onSuccess(paymentIntent.id);
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stripe-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Card Details</label>
        <div className="stripe-card-wrap">
          <CardElement options={CARD_STYLE} />
        </div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={!stripe || submitting}>
        {submitting ? 'Processing...' : buttonLabel}
      </button>
      <div className="stripe-badge">🔐 Secured by Stripe</div>
    </form>
  );
}
