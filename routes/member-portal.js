const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes here require the 'member' role
// GET /api/portal/me  — member's own profile + subscription
router.get('/me', authenticateToken, requireRole('member'), (req, res) => {
  const db = getDb();
  const member = db.prepare(`
    SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price
    FROM members m
    LEFT JOIN subscription_plans p ON m.plan_id = p.id
    WHERE m.user_id = ? AND m.is_active = 1
  `).get(req.user.id);

  if (!member) return res.status(404).json({ error: 'Member profile not found' });

  // Refresh status
  let daysLeft = null;
  if (member.end_date) {
    daysLeft = Math.floor((new Date(member.end_date) - new Date()) / 86400000);
  }

  res.json({ ...member, days_left: daysLeft });
});

// GET /api/portal/attendance  — member's own check-in history
router.get('/attendance', authenticateToken, requireRole('member'), (req, res) => {
  const db = getDb();
  const member = db.prepare('SELECT id FROM members WHERE user_id = ? AND is_active = 1').get(req.user.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const rows = db.prepare(`
    SELECT check_in_time, method
    FROM attendance
    WHERE member_id = ?
    ORDER BY check_in_time DESC
    LIMIT 100
  `).all(member.id);

  // Stats
  const thisMonth = rows.filter(r => r.check_in_time.startsWith(new Date().toISOString().slice(0, 7))).length;
  const thisYear  = rows.filter(r => r.check_in_time.startsWith(new Date().getFullYear().toString())).length;

  // Last 30 days heatmap data
  const last30 = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last30[d.toISOString().split('T')[0]] = 0;
  }
  rows.forEach(r => {
    const d = r.check_in_time.split('T')[0];
    if (last30[d] !== undefined) last30[d]++;
  });

  res.json({ records: rows, this_month: thisMonth, this_year: thisYear, last_30: last30 });
});

// GET /api/portal/notifications  — member's unread notifications
router.get('/notifications', authenticateToken, requireRole('member'), (req, res) => {
  const db = getDb();
  const notes = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id);
  res.json(notes);
});

// POST /api/portal/checkin  — member self check-in
router.post('/checkin', authenticateToken, requireRole('member'), (req, res) => {
  const db = getDb();
  const member = db.prepare('SELECT * FROM members WHERE user_id = ? AND is_active = 1').get(req.user.id);
  if (!member) return res.status(404).json({ error: 'Member profile not found' });
  if (member.status === 'suspended') return res.status(403).json({ error: 'Account suspended. Contact management.' });

  if (member.end_date) {
    const daysLeft = Math.floor((new Date(member.end_date) - new Date()) / 86400000);
    if (daysLeft < -3) return res.status(403).json({ error: 'Membership expired. Please renew at the front desk.' });
  }

  const recent = db.prepare(`
    SELECT id FROM attendance WHERE member_id = ? AND check_in_time >= datetime('now', '-2 hours')
  `).get(member.id);
  if (recent) return res.status(409).json({ error: 'Already checked in recently.' });

  db.prepare('INSERT INTO attendance (member_id, method) VALUES (?, ?)').run(member.id, 'manual');
  res.json({ success: true, message: 'Check-in recorded!' });
});

module.exports = router;
