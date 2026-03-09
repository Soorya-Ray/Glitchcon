const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, authenticateToken, requireRole } = require('../middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required' });
      }

      const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username]);
      if (userRes.rowCount === 0) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const user = userRes.rows[0];
      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      // Mark user as active
      await db.query("UPDATE users SET is_active = 1, last_active = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);

      const token = jwt.sign(
        { id: user.id, username: user.username, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email: user.email,
            wallet_balance: user.wallet_balance
          }
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Logout (mark user inactive)
  router.post('/logout', authenticateToken, async (req, res) => {
    try {
      await db.query('UPDATE users SET is_active = 0 WHERE id = $1', [req.user.id]);
      res.json({ success: true, data: { message: 'Logged out' } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Register
  router.post('/register', async (req, res) => {
    try {
      const { username, password, name, role, email, phone } = req.body;
      if (!username || !password || !name || !role) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const validRoles = ['customer', 'supplier', 'driver', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
      }

      const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rowCount > 0) {
        return res.status(409).json({ success: false, error: 'Username already exists' });
      }

      const id = `USR-${Date.now().toString(36).toUpperCase()}`;
      const hash = bcrypt.hashSync(password, 10);

      await db.query(`
        INSERT INTO users (id, username, password, name, role, email, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, username, hash, name, role, email || null, phone || null]);

      await db.query(`INSERT INTO reputation_scores (user_id) VALUES ($1)`, [id]);

      const token = jwt.sign(
        { id, username, name, role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({ success: true, data: { token, user: { id, username, name, role, email } } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get current user profile
  router.get('/me', authenticateToken, async (req, res) => {
    try {
      const userRes = await db.query('SELECT id, username, name, role, email, phone, wallet_balance, is_active, last_active, created_at FROM users WHERE id = $1', [req.user.id]);
      if (userRes.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' });

      const user = userRes.rows[0];
      await db.query("UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1", [req.user.id]);

      const repRes = await db.query('SELECT * FROM reputation_scores WHERE user_id = $1', [req.user.id]);
      res.json({ success: true, data: { ...user, reputation: repRes.rows[0] } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Public drivers list
  router.get('/drivers', async (req, res) => {
    try {
      const driversRes = await db.query(`
        SELECT u.id, u.name, u.role,
               r.successful_deliveries, r.disputes_against, r.disputes_won, r.score as reputation_score
        FROM users u
        LEFT JOIN reputation_scores r ON u.id = r.user_id
        WHERE u.role = 'driver'
        ORDER BY r.score DESC NULLS LAST, u.name ASC
      `);

      res.json({ success: true, data: driversRes.rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get all users (admin only)
  router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const usersRes = await db.query(`
        SELECT u.id, u.username, u.name, u.role, u.email, u.phone, u.wallet_balance, 
               u.is_active, u.last_active, u.created_at,
               r.successful_deliveries, r.disputes_against, r.disputes_won, r.score as reputation_score
        FROM users u
        LEFT JOIN reputation_scores r ON u.id = r.user_id
        ORDER BY u.created_at DESC
      `);

      const users = usersRes.rows;
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.is_active === 1).length;
      const adminCount = users.filter(u => u.role === 'admin').length;
      const roleBreakdown = {
        customer: users.filter(u => u.role === 'customer').length,
        supplier: users.filter(u => u.role === 'supplier').length,
        driver: users.filter(u => u.role === 'driver').length,
        admin: adminCount,
      };

      res.json({ success: true, data: { users, stats: { totalUsers, activeUsers, adminCount, roleBreakdown } } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get active users only (admin only)
  router.get('/users/active', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const usersRes = await db.query(`
        SELECT id, username, name, role, email, is_active, last_active 
        FROM users WHERE is_active = 1
        ORDER BY last_active DESC
      `);
      res.json({ success: true, data: usersRes.rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Promote user to admin (admin only)
  router.post('/users/:id/promote', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const targetId = req.params.id;
      const userRes = await db.query('SELECT id, name, role FROM users WHERE id = $1', [targetId]);
      if (userRes.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' });

      const user = userRes.rows[0];
      if (user.role === 'admin') return res.status(400).json({ success: false, error: 'User is already an admin' });

      await db.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', targetId]);
      res.json({ success: true, data: { message: `${user.name} has been promoted to admin`, userId: targetId, newRole: 'admin' } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Demote admin back to their original or given role (admin only)
  router.post('/users/:id/demote', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const targetId = req.params.id;
      const { newRole } = req.body;

      if (targetId === req.user.id) {
        return res.status(400).json({ success: false, error: 'Cannot demote yourself' });
      }

      const userRes = await db.query('SELECT id, name, role FROM users WHERE id = $1', [targetId]);
      if (userRes.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' });

      const user = userRes.rows[0];
      if (user.role !== 'admin') return res.status(400).json({ success: false, error: 'User is not an admin' });

      const validRoles = ['customer', 'supplier', 'driver'];
      const role = validRoles.includes(newRole) ? newRole : 'customer';

      await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, targetId]);
      res.json({ success: true, data: { message: `${user.name} has been changed to ${role}`, userId: targetId, newRole: role } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Delete user (admin only)
  router.delete('/users/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const targetId = req.params.id;
      if (targetId === req.user.id) {
        return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
      }

      const userRes = await db.query('SELECT id, name FROM users WHERE id = $1', [targetId]);
      if (userRes.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' });

      const user = userRes.rows[0];
      await db.query('DELETE FROM reputation_scores WHERE user_id = $1', [targetId]);
      await db.query('DELETE FROM delivery_proofs WHERE driver_id = $1', [targetId]);
      await db.query('DELETE FROM users WHERE id = $1', [targetId]);
      res.json({ success: true, data: { message: `${user.name} has been deleted` } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
