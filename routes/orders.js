const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { requireEnv } = require('../config/stack');
const stripeSecretKey = process.env.NODE_ENV === 'test'
  ? (process.env.STRIPE_SECRET_KEY || 'sk_test_dummy')
  : requireEnv('STRIPE_SECRET_KEY');
const stripe = require('stripe')(stripeSecretKey);
const upload = multer({ storage: multer.memoryStorage() });

function proofUpload(req, res, next) {
  const type = req.headers['content-type'] || '';
  if (type.includes('multipart/form-data')) {
    return upload.single('image')(req, res, next);
  }
  return next();
}

function ensureDb(db) {
  if (!db || typeof db.query !== 'function') {
    throw new Error("Database object missing or invalid. Did you pass `db` correctly to the route handler?");
  }
}

function clampScore(value, min = 1, max = 5) {
  return Math.max(min, Math.min(max, value));
}

async function recalculateReputationScore(db, userId) {
  if (!userId) return;

  const repRes = await db.query(
    `SELECT successful_deliveries, disputes_against, disputes_won
     FROM reputation_scores
     WHERE user_id = $1`,
    [userId]
  );

  if (repRes.rowCount === 0) return;

  const row = repRes.rows[0];
  const successfulDeliveries = Number(row.successful_deliveries || 0);
  const disputesAgainst = Number(row.disputes_against || 0);
  const disputesWon = Number(row.disputes_won || 0);

  // Weighted score that rewards successful execution and dispute outcomes.
  const rawScore = 3 + (successfulDeliveries * 0.25) + (disputesWon * 0.35) - (disputesAgainst * 0.4);
  const nextScore = Number(clampScore(rawScore).toFixed(2));

  await db.query(
    `UPDATE reputation_scores
     SET score = $1
     WHERE user_id = $2`,
    [nextScore, userId]
  );
}

async function recalculateReputationScores(db, userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  for (const userId of uniqueIds) {
    await recalculateReputationScore(db, userId);
  }
}

module.exports = function (db, chaincode) {
  const router = express.Router();
  ensureDb(db);

  // Get all visible orders for current user
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const orders = chaincode.getOrdersByUser(req.user.id, req.user.role);
      res.json({ success: true, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get single order
  router.get('/:id', authenticateToken, async (req, res) => {
    try {
      const order = chaincode.getOrderState(req.params.id);
      res.json({ success: true, data: order });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  // Get order blockchain history
  router.get('/:id/history', authenticateToken, async (req, res) => {
    try {
      const history = chaincode.getOrderHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create new order (Customer only)
  router.post('/', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
      const { supplierId, amount, description, pickupAddress, deliveryAddress } = req.body;
      const createRequestId = req.headers['x-idempotency-key'] || req.body.requestId || null;

      if (!supplierId || !amount) {
        return res.status(400).json({ success: false, error: 'supplierId and amount are required' });
      }

      // Verify supplier exists
      const supRes = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'supplier'", [supplierId]);
      if (supRes.rowCount === 0) {
        return res.status(400).json({ success: false, error: 'Invalid supplier ID' });
      }

      if (createRequestId) {
        const dupRes = await db.query(
          `SELECT order_id
           FROM orders_metadata
           WHERE customer_id = $1 AND create_request_id = $2
           LIMIT 1`,
          [req.user.id, createRequestId]
        );
        if (dupRes.rowCount > 0) {
          const existingOrderId = dupRes.rows[0].order_id;
          const existingOrder = chaincode.getOrderState(existingOrderId);
          return res.status(200).json({
            success: true,
            data: existingOrder,
            idempotentReplay: true
          });
        }
      }

      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

      // Save to metadata DB
      await db.query(`
        INSERT INTO orders_metadata (order_id, customer_id, supplier_id, create_request_id, description, pickup_address, delivery_address, amount, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [orderId, req.user.id, supplierId, createRequestId, description, pickupAddress, deliveryAddress, amount, 'CREATED']);

      // Save to blockchain
      const result = await chaincode.createOrder({
        orderId,
        customerId: req.user.id,
        supplierId,
        amount,
        description,
        pickup: pickupAddress,
        delivery: deliveryAddress
      });

      // Update blockchain tx hash back to DB
      if (result.order.onChainTxHash) {
        await db.query(`UPDATE orders_metadata SET on_chain_tx_hash = $1 WHERE order_id = $2`, [result.order.onChainTxHash, orderId]);
      }

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      // If unique idempotency key race happens, return already-created order
      if (err && err.code === '23505') {
        const createRequestId = req.headers['x-idempotency-key'] || req.body.requestId || null;
        if (createRequestId) {
          const dupRes = await db.query(
            `SELECT order_id
             FROM orders_metadata
             WHERE customer_id = $1 AND create_request_id = $2
             LIMIT 1`,
            [req.user.id, createRequestId]
          );
          if (dupRes.rowCount > 0) {
            const existingOrder = chaincode.getOrderState(dupRes.rows[0].order_id);
            return res.status(200).json({
              success: true,
              data: existingOrder,
              idempotentReplay: true
            });
          }
        }
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Delete/cancel order before payment lock (Customer only)
  router.delete('/:id', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
      const order = chaincode.getOrderState(req.params.id);
      if (order.customerId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized to delete this order' });
      }
      if (order.status !== 'CREATED') {
        return res.status(400).json({
          success: false,
          error: `Only CREATED orders can be deleted. Current status: ${order.status}`
        });
      }

      const result = chaincode.deleteOrder(req.params.id, req.user.id);
      await db.query(`DELETE FROM orders_metadata WHERE order_id = $1 AND customer_id = $2`, [req.params.id, req.user.id]);

      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Pay and lock escrow (Customer only)
  router.post('/:id/pay', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
      const order = chaincode.getOrderState(req.params.id);
      if (order.customerId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized to pay for this order' });
      }

      const intentId = req.body.paymentIntentId;
      if (!intentId) {
        return res.status(400).json({ success: false, error: 'paymentIntentId is required' });
      }

      const intent = await stripe.paymentIntents.retrieve(intentId);
      if (intent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          error: `Payment intent must be succeeded before locking escrow. Current status: ${intent.status}`
        });
      }

      // Idempotent success path: webhook may have already locked this order.
      if (order.status === 'LOCKED') {
        if (!order.paymentRef || order.paymentRef === intentId) {
          return res.json({ success: true, data: order, alreadyLocked: true });
        }
        return res.status(409).json({
          success: false,
          error: `Order already locked with a different payment reference: ${order.paymentRef}`
        });
      }

      try {
        const result = await chaincode.lockPayment(req.params.id, intentId);
        await db.query(`UPDATE orders_metadata SET status = 'LOCKED' WHERE order_id = $1`, [req.params.id]);
        return res.json({ success: true, data: result.order });
      } catch (lockErr) {
        if (String(lockErr.message || '').includes('LOCKED') && String(lockErr.message || '').includes('→ LOCKED')) {
          const latestOrder = chaincode.getOrderState(req.params.id);
          if (latestOrder.status === 'LOCKED' && (!latestOrder.paymentRef || latestOrder.paymentRef === intentId)) {
            return res.json({ success: true, data: latestOrder, alreadyLocked: true });
          }
        }
        throw lockErr;
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Assign driver (Customer only)
  router.post('/:id/assign', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
      const order = chaincode.getOrderState(req.params.id);
      if (order.customerId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized to manage this order' });
      }

      const { driverId } = req.body;
      const dRes = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'driver'", [driverId]);
      if (dRes.rowCount === 0) {
        return res.status(400).json({ success: false, error: 'Invalid driver ID' });
      }

      const result = await chaincode.assignDriver(req.params.id, driverId);
      await db.query(`UPDATE orders_metadata SET status = 'IN_TRANSIT', driver_id = $1 WHERE order_id = $2`, [driverId, req.params.id]);

      res.json({ success: true, data: result.order });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get drivers list (Utility)
  router.get('/utils/drivers', authenticateToken, async (req, res) => {
    try {
      // Allow assigning drivers even if they aren't currently "active" (like simulation users)
      const dRes = await db.query("SELECT id, name FROM users WHERE role = 'driver'");
      console.log('--- DEBUG getDrivers rows ---', dRes.rows);
      res.json({ success: true, data: dRes.rows });
    } catch (err) {
      console.error('--- DEBUG getDrivers Error ---', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Submit delivery proof (Driver only)
  router.post('/:id/proof', authenticateToken, requireRole('driver'), proofUpload, async (req, res) => {
    try {
      const order = chaincode.getOrderState(req.params.id);
      if (order.driverId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized to submit proof for this order' });
      }

      const { gpsLat, gpsLng, notes } = req.body;
      let imagePath = null;
      if (req.file) {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'proofs');
        fs.mkdirSync(uploadDir, { recursive: true });
        const ext = path.extname(req.file.originalname || '') || '.jpg';
        const filename = `${req.params.id}-${Date.now()}${ext}`;
        const fullPath = path.join(uploadDir, filename);
        fs.writeFileSync(fullPath, req.file.buffer);
        imagePath = `/uploads/proofs/${filename}`;
      }
      const proofData = { gpsLat: parseFloat(gpsLat), gpsLng: parseFloat(gpsLng), notes, timestamp: new Date().toISOString() };

      const result = await chaincode.submitDeliveryProof(req.params.id, proofData);

      const proofHash = result.order.deliveryProof.hash;
      await db.query(`UPDATE orders_metadata SET status = 'PROOF_SUBMITTED' WHERE order_id = $1`, [req.params.id]);

      const proofId = `PRF-${Date.now()}`;
      await db.query(`
        INSERT INTO delivery_proofs (id, order_id, driver_id, gps_lat, gps_lng, notes, proof_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [proofId, req.params.id, req.user.id, gpsLat, gpsLng, notes, proofHash]);
      if (imagePath) {
        await db.query(`UPDATE delivery_proofs SET image_path = $1 WHERE id = $2`, [imagePath, proofId]);
      }

      res.json({ success: true, data: result.order });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Confirm delivery (Customer only)
  router.post('/:id/confirm', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
      const result = await chaincode.confirmDelivery(req.params.id, req.user.id);
      const order = result.order;

      await db.query(`UPDATE orders_metadata SET status = 'SETTLED' WHERE order_id = $1`, [req.params.id]);
      await db.query(`UPDATE reputation_scores SET successful_deliveries = successful_deliveries + 1 WHERE user_id IN ($1, $2)`, [order.supplierId, order.driverId]);
      await db.query(`UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`, [order.amount, order.supplierId]);
      await recalculateReputationScores(db, [order.supplierId, order.driverId]);

      res.json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Raise dispute (Customer or Supplier)
  router.post('/:id/dispute', authenticateToken, async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ success: false, error: 'Reason required' });

      const result = await chaincode.raiseDispute(req.params.id, reason);
      const order = result.order;

      await db.query(`UPDATE orders_metadata SET status = 'DISPUTED' WHERE order_id = $1`, [req.params.id]);
      await db.query(`UPDATE reputation_scores SET disputes_against = disputes_against + 1 WHERE user_id = $1`, [order.supplierId]);
      await recalculateReputationScores(db, [order.supplierId]);

      res.json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Resolve dispute (Admin only)
  router.post('/:id/resolve', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const { decision, amount } = req.body;
      const result = await chaincode.resolveDispute(req.params.id, decision, amount);
      const order = result.order;

      await db.query(`UPDATE orders_metadata SET status = 'RESOLVED' WHERE order_id = $1`, [req.params.id]);

      // Distribute funds
      if (order.resolution.supplierAmount > 0) {
        await db.query(`UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`, [order.resolution.supplierAmount, order.supplierId]);
      }
      if (order.resolution.refundAmount > 0) {
        await db.query(`UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`, [order.resolution.refundAmount, order.customerId]);
      }

      // Update reputation based on decision
      if (decision === 'REFUND') { // Customer won
        await db.query(`UPDATE reputation_scores SET disputes_won = disputes_won + 1 WHERE user_id = $1`, [order.customerId]);
        await recalculateReputationScores(db, [order.customerId, order.supplierId]);
      } else if (decision === 'RELEASE') { // Supplier won
        await db.query(`UPDATE reputation_scores SET disputes_won = disputes_won + 1 WHERE user_id = $1`, [order.supplierId]);
        await recalculateReputationScores(db, [order.supplierId, order.customerId]);
      } else if (decision === 'PARTIAL') {
        await recalculateReputationScores(db, [order.supplierId, order.customerId]);
      }

      res.json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
