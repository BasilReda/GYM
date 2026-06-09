const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/subscriptions
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const plans = db.prepare('SELECT * FROM subscription_plans ORDER BY duration_days').all();
  res.json(plans);
});

// POST /api/subscriptions
router.post('/', authenticateToken, requireRole('owner'), (req, res) => {
  const db = getDb();
  const { name, duration_days, price, description } = req.body;
  if (!name || !duration_days || price === undefined) return res.status(400).json({ error: 'name, duration_days and price are required' });
  const result = db.prepare('INSERT INTO subscription_plans (name, duration_days, price, description) VALUES (?,?,?,?)').run(name, duration_days, price, description || null);
  res.status(201).json(db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/subscriptions/:id
router.put('/:id', authenticateToken, requireRole('owner'), (req, res) => {
  const db = getDb();
  const { name, duration_days, price, description, is_active } = req.body;
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  db.prepare('UPDATE subscription_plans SET name=?, duration_days=?, price=?, description=?, is_active=? WHERE id=?')
    .run(name ?? plan.name, duration_days ?? plan.duration_days, price ?? plan.price, description !== undefined ? description : plan.description, is_active !== undefined ? is_active : plan.is_active, req.params.id);
  res.json(db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(req.params.id));
});

// DELETE /api/subscriptions/:id
router.delete('/:id', authenticateToken, requireRole('owner'), (req, res) => {
  const db = getDb();
  db.prepare('UPDATE subscription_plans SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
