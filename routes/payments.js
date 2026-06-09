const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/payments
router.get('/', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  const { member_id, from, to } = req.query;
  let query = `
    SELECT p.*, m.name as member_name, m.member_code, pl.name as plan_name, u.name as recorded_by_name
    FROM payments p
    JOIN members m ON p.member_id = m.id
    LEFT JOIN subscription_plans pl ON p.plan_id = pl.id
    LEFT JOIN users u ON p.recorded_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (member_id) { query += ' AND p.member_id = ?'; params.push(member_id); }
  if (from) { query += ' AND p.payment_date >= ?'; params.push(from); }
  if (to) { query += ' AND p.payment_date <= ?'; params.push(to); }
  query += ' ORDER BY p.created_at DESC LIMIT 500';
  res.json(db.prepare(query).all(...params));
});

// GET /api/payments/overdue
router.get('/overdue', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  // Members expired more than 30 days ago with no recent payment
  const overdue = db.prepare(`
    SELECT m.*, p.name as plan_name,
      (SELECT MAX(py.payment_date) FROM payments py WHERE py.member_id = m.id) as last_payment
    FROM members m
    LEFT JOIN subscription_plans p ON m.plan_id = p.id
    WHERE m.is_active = 1 AND m.status = 'expired'
    AND (m.end_date IS NULL OR date(m.end_date) <= date('now', '-30 days'))
    ORDER BY m.end_date ASC
  `).all();
  res.json(overdue);
});

// POST /api/payments
router.post('/', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  const { member_id, amount, method = 'cash', payment_date, plan_id, notes } = req.body;
  if (!member_id || amount === undefined) return res.status(400).json({ error: 'member_id and amount are required' });

  const member = db.prepare('SELECT * FROM members WHERE id = ? AND is_active = 1').get(member_id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const date = payment_date || new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO payments (member_id, amount, method, payment_date, plan_id, notes, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(member_id, amount, method, date, plan_id || null, notes || null, req.user.id);

  // If plan_id provided, update member subscription dates
  if (plan_id) {
    const plan = db.prepare('SELECT duration_days FROM subscription_plans WHERE id = ?').get(plan_id);
    if (plan) {
      // Extend from current end_date or today, whichever is later
      const base = member.end_date && new Date(member.end_date) > new Date() ? new Date(member.end_date) : new Date(date);
      base.setDate(base.getDate() + plan.duration_days);
      const newEnd = base.toISOString().split('T')[0];
      const daysLeft = Math.floor((base - new Date()) / 86400000);
      let status = 'active';
      if (daysLeft <= 7) status = 'expiring_soon';
      db.prepare(`UPDATE members SET plan_id=?, start_date=COALESCE(start_date,?), end_date=?, status=?, updated_at=datetime('now') WHERE id=?`)
        .run(plan_id, date, newEnd, status, member_id);
    }
  }

  const payment = db.prepare(`
    SELECT p.*, m.name as member_name, pl.name as plan_name
    FROM payments p JOIN members m ON p.member_id=m.id LEFT JOIN subscription_plans pl ON p.plan_id=pl.id
    WHERE p.id=?
  `).get(result.lastInsertRowid);
  res.status(201).json(payment);
});

// GET /api/payments/summary
router.get('/summary', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as total, COUNT(*) as count
    FROM payments WHERE payment_date >= date('now', '-12 months')
    GROUP BY month ORDER BY month
  `).all();
  const thisMonth = db.prepare("SELECT SUM(amount) as total FROM payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')").get();
  const lastMonth = db.prepare("SELECT SUM(amount) as total FROM payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', date('now','-1 month'))").get();
  res.json({ monthly, this_month: thisMonth.total || 0, last_month: lastMonth.total || 0 });
});

module.exports = router;
