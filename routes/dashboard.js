const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();

  // Refresh member statuses first
  db.prepare(`UPDATE members SET status='expired' WHERE is_active=1 AND end_date IS NOT NULL AND date(end_date) < date('now','-3 days')`).run();
  db.prepare(`UPDATE members SET status='expiring_soon' WHERE is_active=1 AND date(end_date) >= date('now','-3 days') AND date(end_date) <= date('now','+7 days')`).run();
  db.prepare(`UPDATE members SET status='active' WHERE is_active=1 AND date(end_date) > date('now','+7 days')`).run();

  const totalActive = db.prepare("SELECT COUNT(*) as n FROM members WHERE is_active=1 AND status IN ('active','expiring_soon')").get().n;
  const expired = db.prepare("SELECT COUNT(*) as n FROM members WHERE is_active=1 AND status='expired'").get().n;
  const expiringSoon = db.prepare("SELECT COUNT(*) as n FROM members WHERE is_active=1 AND status='expiring_soon'").get().n;
  const todayCheckins = db.prepare("SELECT COUNT(*) as n FROM attendance WHERE date(check_in_time)=date('now')").get().n;
  const monthRevenue = db.prepare("SELECT COALESCE(SUM(amount),0) as n FROM payments WHERE strftime('%Y-%m',payment_date)=strftime('%Y-%m','now')").get().n;
  const totalMembers = db.prepare("SELECT COUNT(*) as n FROM members WHERE is_active=1").get().n;

  // Expiring in 7 days
  const expiringList = db.prepare(`
    SELECT id, name, member_code, phone, end_date,
      CAST(julianday(end_date) - julianday('now') AS INTEGER) as days_left
    FROM members WHERE is_active=1 AND status='expiring_soon'
    ORDER BY end_date ASC LIMIT 10
  `).all();

  // Monthly membership chart (last 6 months)
  const membershipChart = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as new_members
    FROM members WHERE created_at >= date('now','-6 months')
    GROUP BY month ORDER BY month
  `).all();

  // Monthly revenue chart (last 6 months)
  const revenueChart = db.prepare(`
    SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as revenue
    FROM payments WHERE payment_date >= date('now','-6 months')
    GROUP BY month ORDER BY month
  `).all();

  // Top 5 recent checkins
  const recentCheckins = db.prepare(`
    SELECT a.check_in_time, m.name, m.member_code, a.method
    FROM attendance a JOIN members m ON a.member_id=m.id
    ORDER BY a.check_in_time DESC LIMIT 5
  `).all();

  res.json({
    total_active: totalActive,
    total_members: totalMembers,
    expired,
    expiring_soon: expiringSoon,
    today_checkins: todayCheckins,
    month_revenue: monthRevenue,
    expiring_list: expiringList,
    membership_chart: membershipChart,
    revenue_chart: revenueChart,
    recent_checkins: recentCheckins
  });
});

// GET /api/dashboard/users (owner/manager only)
router.get('/users', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, is_active, language, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

// POST /api/dashboard/users
router.post('/users', authenticateToken, requireRole('owner'), (req, res) => {
  const bcrypt = require('bcryptjs');
  const db = getDb();
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
  const valid = ['owner','manager','reception','trainer','member'];
  if (!valid.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run(name, email, hash, role);
  res.status(201).json(db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id=?').get(result.lastInsertRowid));
});

// PATCH /api/dashboard/users/:id/toggle
router.patch('/users/:id/toggle', authenticateToken, requireRole('owner'), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET is_active=? WHERE id=?').run(user.is_active ? 0 : 1, req.params.id);
  res.json({ success: true, is_active: !user.is_active });
});

module.exports = router;
