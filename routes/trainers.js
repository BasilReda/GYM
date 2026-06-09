const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/trainers
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM trainers WHERE is_active = 1 ORDER BY name').all());
});

// GET /api/trainers/:id
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT * FROM trainers WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Trainer not found' });
  res.json(t);
});

// POST /api/trainers
router.post('/', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const { name, specialization, phone, email, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare('INSERT INTO trainers (name, specialization, phone, email, bio) VALUES (?,?,?,?,?)').run(name, specialization || null, phone || null, email || null, bio || null);
  res.status(201).json(db.prepare('SELECT * FROM trainers WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/trainers/:id
router.put('/:id', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  const { name, specialization, phone, email, bio, is_active } = req.body;
  const t = db.prepare('SELECT * FROM trainers WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Trainer not found' });
  db.prepare('UPDATE trainers SET name=?,specialization=?,phone=?,email=?,bio=?,is_active=? WHERE id=?')
    .run(name??t.name, specialization??t.specialization, phone??t.phone, email??t.email, bio??t.bio, is_active??t.is_active, req.params.id);
  res.json(db.prepare('SELECT * FROM trainers WHERE id=?').get(req.params.id));
});

// DELETE /api/trainers/:id
router.delete('/:id', authenticateToken, requireRole('owner', 'manager'), (req, res) => {
  const db = getDb();
  db.prepare('UPDATE trainers SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
