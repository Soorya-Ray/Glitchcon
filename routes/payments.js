const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireEnv } = require('../config/stack');

const stripeSecretKey = process.env.NODE_ENV === 'test'
  ? (process.env.STRIPE_SECRET_KEY || 'sk_test_dummy')
  : requireEnv('STRIPE_SECRET_KEY');
const webhookSecret = process.env.NODE_ENV === 'test'
  ? (process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy')
  : requireEnv('STRIPE_WEBHOOK_SECRET');
const publishableKey = process.env.NODE_ENV === 'test'
  ? (process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy')
  : requireEnv('STRIPE_PUBLISHABLE_KEY');

const stripe = require('stripe')(stripeSecretKey);

module.exports = function (db, chaincode) {
    const router = express.Router();

    // Expose publishable Stripe config for web/mobile clients
    router.get('/config', async (req, res) => {
        res.json({
            success: true,
            data: {
                publishableKey
            }
        });
    });

    // Create Payment Intent
    router.post('/create-intent', authenticateToken, async (req, res) => {
        try {
            const { orderId, amount } = req.body;
            if (!orderId || !amount) {
                return res.status(400).json({ success: false, error: 'orderId and amount required' });
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(Number(amount) * 100),
                currency: 'inr',
                metadata: { orderId, customerId: req.user.id },
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never'
                },
            });

            res.json({
                success: true,
                data: {
                    paymentIntentId: paymentIntent.id,
                    clientSecret: paymentIntent.client_secret,
                    status: paymentIntent.status,
                    isSimulated: false
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Stripe Webhook handler - req.body should be Buffer from express.raw middleware
    router.post('/webhook', async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const orderId = paymentIntent.metadata.orderId;

            if (orderId) {
                try {
                    let currentOrder;
                    try {
                        currentOrder = chaincode.getOrderState(orderId);
                    } catch {
                        currentOrder = null;
                    }

                    if (currentOrder && currentOrder.status === 'CREATED') {
                        await chaincode.lockPayment(orderId, paymentIntent.id);
                        await db.query(
                            "UPDATE orders_metadata SET status = 'LOCKED' WHERE order_id = $1",
                            [orderId]
                        );
                    }
                } catch (err) {
                    console.error(`Failed to lock escrow via webhook for ${orderId}:`, err.message);
                }
            }
        }

        res.json({ received: true });
    });

    return router;
};
