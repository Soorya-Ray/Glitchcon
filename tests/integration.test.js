const request = require('supertest');
const express = require('express');

// We test against the route files by mocking the DB and Chaincode
const db = {
    query: jest.fn()
};

const chaincode = {
    getOrdersByUser: jest.fn(),
    getOrderState: jest.fn(),
    createOrder: jest.fn(),
    lockPayment: jest.fn(),
    assignDriver: jest.fn(),
    submitDeliveryProof: jest.fn(),
    confirmDelivery: jest.fn()
};

const mockStripeRetrieve = jest.fn().mockResolvedValue({ status: 'succeeded' });
jest.mock('stripe', () => () => ({
    paymentIntents: {
        retrieve: mockStripeRetrieve
    }
}));

// Set up minimal express app with the routes
const app = express();
app.use(express.json());

// Mock Auth Middleware
jest.mock('../middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'USR-C001', role: 'customer' };
        next();
    },
    requireRole: (role) => (req, res, next) => {
        if (req.user.role === role) next();
        else res.status(403).json({ success: false, error: 'Unauthorized' });
    },
    JWT_SECRET: 'testsecret'
}));

const orderRoutes = require('../routes/orders')(db, chaincode);
app.use('/api/v1/orders', orderRoutes);

describe('Order Lifecycle Integration (Mocked)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStripeRetrieve.mockResolvedValue({ status: 'succeeded' });
    });

    it('creates an order successfully', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 }); // simulate supplier exists
        chaincode.createOrder.mockResolvedValueOnce({
            order: { orderId: 'ORD-TEST', status: 'CREATED', onChainTxHash: '0xabc' },
            block: {}
        });

        const res = await request(app)
            .post('/api/v1/orders')
            .send({
                supplierId: 'USR-S001',
                amount: 5000,
                description: 'Test order',
                pickupAddress: 'A',
                deliveryAddress: 'B'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.order.orderId).toBe('ORD-TEST');
    });

    it('pays for an order and locks escrow', async () => {
        chaincode.getOrderState.mockReturnValueOnce({ customerId: 'USR-C001', status: 'CREATED' });
        chaincode.lockPayment.mockResolvedValueOnce({
            order: { status: 'LOCKED', paymentRef: 'pi_test' },
            block: {}
        });

        const res = await request(app)
            .post('/api/v1/orders/ORD-TEST/pay')
            .send({ paymentIntentId: 'pi_test' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('LOCKED');
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE orders_metadata SET status = 'LOCKED'"),
            ['ORD-TEST']
        );
    });
});
