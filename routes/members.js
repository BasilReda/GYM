const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const QR_SECRET = 'gymdesk-qr-secret-2026';

function generateMemberCode(db) {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT member_code FROM members WHERE member_code LIKE ? ORDER BY id DESC LIMIT 1").get(`GDM-${year}-%`);
  let seq = 1;
  if (last) seq = parseInt(last.member_code.split('-')[2]) + 1;
  return `GDM-${year}-${String(seq).padStart(4, '0')}`;
}

function generateQrHash(memberCode) {
  return crypto.createHmac('sha256', QR_SECRET).update(memberCode).digest('hex').substring(0, 16);
}

function calcStatus(endDate) {
  if (!endDate) return 'active';
  const now = new Date();
  const end = new Date(endDate);
  const diff = Math.floor((end - now) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 7) return 'expiring_soon';
  return 'active';
}

// GET /api/members
router.get('/', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  const { search, status, plan_id } = req.query;
  let query = `
    SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price
    FROM members m
    LEFT JOIN subscription_plans p ON m.plan_id = p.id
    WHERE m.is_active = 1
  `;
  const params = [];
  if (search) {
    query += ` AND (m.name LIKE ? OR m.phone LIKE ? OR m.member_code LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) { query += ` AND m.status = ?`; params.push(status); }
  if (plan_id) { query += ` AND m.plan_id = ?`; params.push(plan_id); }
  query += ' ORDER BY m.id DESC';

  const members = db.prepare(query).all(...params);
  // Refresh statuses
  const update = db.prepare('UPDATE members SET status = ? WHERE id = ?');
  members.forEach(m => {
    const s = calcStatus(m.end_date);
    if (s !== m.status) { update.run(s, m.id); m.status = s; }
  });
  res.json(members);
});

// GET /api/members/:id
router.get('/:id', authenticateToken, requireRole('owner', 'manager', 'reception', 'trainer'), (req, res) => {
  const db = getDb();
  const member = db.prepare(`
    SELECT m.*, p.name as plan_name, p.duration_days, p.price as plan_price
    FROM members m LEFT JOIN subscription_plans p ON m.plan_id = p.id
    WHERE m.id = ? AND m.is_active = 1
  `).get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  res.json(member);
});

// POST /api/members
router.post('/', authenticateToken, requireRole('owner', 'manager', 'reception'), async (req, res) => {
  const db = getDb();
  const { name, phone, email, dob, emergency_contact, notes, plan_id, start_date, create_login, login_password } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  if (create_login && !email) return res.status(400).json({ error: 'Email is required to create a login account' });
  if (create_login && (!login_password || login_password.length < 8)) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const memberCode = generateMemberCode(db);
  const qrHash = generateQrHash(memberCode);

  let endDate = null, status = 'active';
  if (plan_id && start_date) {
    const plan = db.prepare('SELECT duration_days FROM subscription_plans WHERE id = ?').get(plan_id);
    if (plan) {
      const end = new Date(start_date);
      end.setDate(end.getDate() + plan.duration_days);
      endDate = end.toISOString().split('T')[0];
      status = calcStatus(endDate);
    }
  }

  // Optionally create a user account for the member
  let userId = null;
  if (create_login && email) {
    const bcrypt = require('bcryptjs');
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    const hash = bcrypt.hashSync(login_password, 12);
    userId = db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'member')`)
      .run(name, email.toLowerCase().trim(), hash).lastInsertRowid;
  }

  const result = db.prepare(`
    INSERT INTO members (member_code, name, phone, email, dob, emergency_contact, notes, plan_id, start_date, end_date, status, qr_hash, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(memberCode, name, phone, email || null, dob || null, emergency_contact || null, notes || null, plan_id || null, start_date || null, endDate, status, qrHash, userId);

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...member, login_created: !!userId });
});

// PUT /api/members/:id
router.put('/:id', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  const { name, phone, email, dob, emergency_contact, notes, plan_id, start_date, status } = req.body;
  const existing = db.prepare('SELECT * FROM members WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Member not found' });

  let endDate = existing.end_date;
  if (plan_id && start_date) {
    const plan = db.prepare('SELECT duration_days FROM subscription_plans WHERE id = ?').get(plan_id);
    if (plan) {
      const end = new Date(start_date);
      end.setDate(end.getDate() + plan.duration_days);
      endDate = end.toISOString().split('T')[0];
    }
  }
  const newStatus = status || calcStatus(endDate);

  db.prepare(`
    UPDATE members SET name=?, phone=?, email=?, dob=?, emergency_contact=?, notes=?, plan_id=?, start_date=?, end_date=?, status=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name || existing.name, phone || existing.phone, email !== undefined ? email : existing.email, dob !== undefined ? dob : existing.dob, emergency_contact !== undefined ? emergency_contact : existing.emergency_contact, notes !== undefined ? notes : existing.notes, plan_id !== undefined ? plan_id : existing.plan_id, start_date !== undefined ? start_date : existing.start_date, endDate, newStatus, req.params.id);

  res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id));
});

// DELETE /api/members/:id (soft delete)
router.delete('/:id', authenticateToken, requireRole('owner', 'manager', 'reception'), (req, res) => {
  const db = getDb();
  const member = db.prepare('SELECT id FROM members WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  db.prepare("UPDATE members SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// GET /api/members/:id/qr
router.get('/:id/qr', authenticateToken, async (req, res) => {
  const db = getDb();
  const member = db.prepare('SELECT member_code, qr_hash FROM members WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const qrData = JSON.stringify({ code: member.member_code, hash: member.qr_hash });
  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
  res.json({ qr: qrDataUrl, member_code: member.member_code });
});

// POST /api/members/:id/suspend
router.post('/:id/suspend', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  db.prepare("UPDATE members SET status='suspended', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// POST /api/members/:id/reactivate
router.post('/:id/reactivate', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const member = db.prepare('SELECT end_date FROM members WHERE id=?').get(req.params.id);
  const status = calcStatus(member?.end_date);
  db.prepare("UPDATE members SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.json({ success: true });
});

// Export hash verifier for attendance
module.exports = router;
module.exports.generateQrHash = generateQrHash;
module.exports.calcStatus = calcStatus;
