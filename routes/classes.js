const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/classes/types
router.get('/types', authenticateToken, (req, res) => {
  const db = getDb();
  const types = db.prepare(`
    SELECT ct.*, t.name as trainer_name FROM class_types ct
    LEFT JOIN trainers t ON ct.default_trainer_id = t.id
    WHERE ct.is_active = 1 ORDER BY ct.name
  `).all();
  res.json(types);
});

// POST /api/classes/types
router.post('/types', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const { name, description, capacity, duration_minutes, default_trainer_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare('INSERT INTO class_types (name, description, capacity, duration_minutes, default_trainer_id) VALUES (?,?,?,?,?)')
    .run(name, description||null, capacity||20, duration_minutes||60, default_trainer_id||null);
  res.status(201).json(db.prepare('SELECT * FROM class_types WHERE id=?').get(result.lastInsertRowid));
});

// GET /api/classes/sessions
router.get('/sessions', authenticateToken, (req, res) => {
  const db = getDb();
  const { from, to, trainer_id } = req.query;
  let query = `
    SELECT cs.*, ct.name as class_name, ct.capacity, t.name as trainer_name
    FROM class_sessions cs
    JOIN class_types ct ON cs.class_type_id = ct.id
    LEFT JOIN trainers t ON cs.trainer_id = t.id
    WHERE 1=1
  `;
  const params = [];
  if (from) { query += ' AND cs.session_date >= ?'; params.push(from); }
  if (to) { query += ' AND cs.session_date <= ?'; params.push(to); }
  if (trainer_id) { query += ' AND cs.trainer_id = ?'; params.push(trainer_id); }
  // Trainers only see their own sessions
  if (req.user.role === 'trainer') {
    const t = db.prepare('SELECT id FROM trainers WHERE user_id = ?').get(req.user.id);
    if (t) { query += ' AND cs.trainer_id = ?'; params.push(t.id); }
  }
  query += ' ORDER BY cs.session_date, cs.start_time';
  res.json(db.prepare(query).all(...params));
});

// POST /api/classes/sessions
router.post('/sessions', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const { class_type_id, trainer_id, room, session_date, start_time, end_time } = req.body;
  if (!class_type_id || !session_date || !start_time || !end_time) return res.status(400).json({ error: 'Missing required fields' });

  // Prevent trainer double-booking
  if (trainer_id) {
    const conflict = db.prepare(`
      SELECT id FROM class_sessions WHERE trainer_id=? AND session_date=? AND status != 'cancelled'
      AND ((start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))
    `).get(trainer_id, session_date, end_time, start_time, start_time, end_time);
    if (conflict) return res.status(409).json({ error: 'Trainer has a conflicting session at this time.' });
  }

  const result = db.prepare('INSERT INTO class_sessions (class_type_id, trainer_id, room, session_date, start_time, end_time) VALUES (?,?,?,?,?,?)')
    .run(class_type_id, trainer_id||null, room||null, session_date, start_time, end_time);
  res.status(201).json(db.prepare(`
    SELECT cs.*, ct.name as class_name, t.name as trainer_name FROM class_sessions cs
    JOIN class_types ct ON cs.class_type_id=ct.id LEFT JOIN trainers t ON cs.trainer_id=t.id WHERE cs.id=?
  `).get(result.lastInsertRowid));
});

// GET /api/classes/sessions/:id/attendance
router.get('/sessions/:id/attendance', authenticateToken, requireRole('owner', 'manager', 'reception', 'trainer'), (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ca.*, m.name as member_name, m.member_code FROM class_attendance ca
    JOIN members m ON ca.member_id = m.id WHERE ca.session_id = ?
  `).all(req.params.id);
  res.json(rows);
});

// POST /api/classes/sessions/:id/attendance
router.post('/sessions/:id/attendance', authenticateToken, requireRole('owner', 'manager', 'trainer'), (req, res) => {
  const db = getDb();
  const { member_id, status = 'present' } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  // Check session exists and not cancelled
  const session = db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status === 'cancelled') return res.status(400).json({ error: 'Cannot mark attendance for a cancelled session' });

  db.prepare('INSERT OR REPLACE INTO class_attendance (session_id, member_id, status) VALUES (?,?,?)').run(req.params.id, member_id, status);
  res.json({ success: true });
});

// PATCH /api/classes/sessions/:id/cancel
router.patch('/sessions/:id/cancel', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  db.prepare("UPDATE class_sessions SET status='cancelled' WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
