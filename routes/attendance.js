const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { calcStatus } = require('./members');

const QR_SECRET = 'gymdesk-qr-secret-2026';
const GRACE_DAYS = 3;
const DUPLICATE_WINDOW_HOURS = 2;

function verifyQrHash(memberCode, hash) {
  const expected = crypto.createHmac('sha256', QR_SECRET).update(memberCode).digest('hex').substring(0, 16);
  return expected === hash;
}

function canCheckIn(member) {
  if (!member.is_active) return { ok: false, msg: 'Account suspended. Contact management.' };
  if (member.status === 'suspended') return { ok: false, msg: 'Account suspended. Contact management.' };
  if (member.end_date) {
    const daysLeft = Math.floor((new Date(member.end_date) - new Date()) / 86400000);
    if (daysLeft < -GRACE_DAYS) return { ok: false, msg: 'Membership expired. Please renew at the front desk.' };
  }
  return { ok: true };
}

// POST /api/attendance/checkin
router.post('/checkin', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  const { member_code, member_id, method = 'staff' } = req.body;

  let member;
  if (member_code) {
    member = db.prepare('SELECT * FROM members WHERE member_code = ? AND is_active = 1').get(member_code);
  } else if (member_id) {
    member = db.prepare('SELECT * FROM members WHERE id = ? AND is_active = 1').get(member_id);
  }
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const check = canCheckIn(member);
  if (!check.ok) return res.status(403).json({ error: check.msg });

  // Duplicate check: within DUPLICATE_WINDOW_HOURS
  const recent = db.prepare(`
    SELECT id FROM attendance
    WHERE member_id = ? AND check_in_time >= datetime('now', '-${DUPLICATE_WINDOW_HOURS} hours')
    ORDER BY check_in_time DESC LIMIT 1
  `).get(member.id);
  if (recent) return res.status(409).json({ error: 'Already checked in.', already_checked: true });

  const result = db.prepare(`
    INSERT INTO attendance (member_id, method, recorded_by) VALUES (?, ?, ?)
  `).run(member.id, method, req.user.id);

  res.json({ success: true, member_name: member.name, member_code: member.member_code, attendance_id: result.lastInsertRowid });
});

// POST /api/attendance/qr-checkin
router.post('/qr-checkin', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  const { qr_data } = req.body;
  let parsed;
  try { parsed = JSON.parse(qr_data); } catch { return res.status(400).json({ error: 'Invalid QR code format.' }); }

  const { code, hash } = parsed;
  if (!code || !hash || !verifyQrHash(code, hash)) return res.status(400).json({ error: 'Invalid or forged QR code.' });

  const member = db.prepare('SELECT * FROM members WHERE member_code = ? AND is_active = 1').get(code);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const check = canCheckIn(member);
  if (!check.ok) return res.status(403).json({ error: check.msg });

  const recent = db.prepare(`
    SELECT id FROM attendance WHERE member_id = ? AND check_in_time >= datetime('now', '-2 hours')
  `).get(member.id);
  if (recent) return res.status(409).json({ error: 'Already checked in.', already_checked: true });

  const result = db.prepare('INSERT INTO attendance (member_id, method, recorded_by) VALUES (?, ?, ?)').run(member.id, 'qr', req.user.id);
  res.json({ success: true, member_name: member.name, member_code: member.member_code, attendance_id: result.lastInsertRowid });
});

// GET /api/attendance
router.get('/', authenticateToken, requireRole('owner', 'manager', 'reception', 'trainer'), (req, res) => {
  const db = getDb();
  const { date, member_id, from, to } = req.query;
  let query = `
    SELECT a.*, m.name as member_name, m.member_code, u.name as recorded_by_name
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    LEFT JOIN users u ON a.recorded_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (date) { query += ' AND date(a.check_in_time) = ?'; params.push(date); }
  if (from) { query += ' AND date(a.check_in_time) >= ?'; params.push(from); }
  if (to) { query += ' AND date(a.check_in_time) <= ?'; params.push(to); }
  if (member_id) { query += ' AND a.member_id = ?'; params.push(member_id); }
  query += ' ORDER BY a.check_in_time DESC LIMIT 500';
  res.json(db.prepare(query).all(...params));
});

// GET /api/attendance/today-count
router.get('/today-count', authenticateToken, (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date(check_in_time) = date('now')").get();
  res.json({ count: row.count });
});

// GET /api/attendance/member/:id
router.get('/member/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.*, u.name as recorded_by_name FROM attendance a
    LEFT JOIN users u ON a.recorded_by = u.id
    WHERE a.member_id = ? ORDER BY a.check_in_time DESC
  `).all(req.params.id);
  res.json(rows);
});

module.exports = router;
