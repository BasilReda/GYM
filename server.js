const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/members',       require('./routes/members'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/trainers',      require('./routes/trainers'));
app.use('/api/classes',       require('./routes/classes'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/portal',        require('./routes/member-portal'));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auto-seed on first run
const { getDb } = require('./db/database');
getDb(); // init schema

const db = getDb();
const count = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
if (count === 0) {
  console.log('First run — seeding database...');
  require('./db/seed');
}

app.listen(PORT, () => {
  console.log(`\n🏋️  GymDesk is running at http://localhost:${PORT}`);
  console.log(`\nDefault login:`);
  console.log(`  Owner:     owner@gymdesk.com     / Admin@123`);
  console.log(`  Manager:   manager@gymdesk.com   / Manager@123`);
  console.log(`  Reception: reception@gymdesk.com / Reception@123`);
  console.log(`  Trainer:   trainer@gymdesk.com   / Trainer@123\n`);
});
