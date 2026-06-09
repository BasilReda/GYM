const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

function seed() {
  const db = getDb();

  // Check if already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding database...');

  // Create default owner
  const ownerHash = bcrypt.hashSync('Admin@123', 12);
  const ownerId = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, language)
    VALUES (?, ?, ?, 'owner', 'en')
  `).run('Hassan (Owner)', 'owner@gymdesk.com', ownerHash).lastInsertRowid;

  // Create manager
  const managerHash = bcrypt.hashSync('Manager@123', 12);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, language)
    VALUES (?, ?, ?, 'manager', 'en')
  `).run('Omar (Manager)', 'manager@gymdesk.com', managerHash);

  // Create reception
  const receptionHash = bcrypt.hashSync('Reception@123', 12);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, language)
    VALUES (?, ?, ?, 'reception', 'en')
  `).run('Khaled (Reception)', 'reception@gymdesk.com', receptionHash);

  // Create trainer user
  const trainerHash = bcrypt.hashSync('Trainer@123', 12);
  const trainerUserId = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, language)
    VALUES (?, ?, ?, 'trainer', 'en')
  `).run('Layla (Trainer)', 'trainer@gymdesk.com', trainerHash).lastInsertRowid;

  // Create trainer profile
  const trainerId = db.prepare(`
    INSERT INTO trainers (user_id, name, specialization, phone, email, bio)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(trainerUserId, 'Layla Ahmed', 'CrossFit & Yoga', '0501234567', 'trainer@gymdesk.com', 'Certified CrossFit Level 2 trainer with 5 years experience.').lastInsertRowid;

  // Default subscription plans
  const planMonthly = db.prepare(`
    INSERT INTO subscription_plans (name, duration_days, price, description)
    VALUES (?, ?, ?, ?)
  `).run('Monthly', 30, 200, '30-day gym membership').lastInsertRowid;

  const planQuarterly = db.prepare(`
    INSERT INTO subscription_plans (name, duration_days, price, description)
    VALUES (?, ?, ?, ?)
  `).run('Quarterly', 90, 500, '90-day gym membership (save 17%)').lastInsertRowid;

  const planAnnual = db.prepare(`
    INSERT INTO subscription_plans (name, duration_days, price, description)
    VALUES (?, ?, ?, ?)
  `).run('Annual', 365, 1800, '365-day gym membership (save 25%)').lastInsertRowid;

  db.prepare(`
    INSERT INTO subscription_plans (name, duration_days, price, description)
    VALUES (?, ?, ?, ?)
  `).run('Free Trial', 3, 0, '3-day free trial membership');

  // Sample members
  const today = new Date();
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };

  function createMember(code, name, phone, planId, daysOffset) {
    const startDate = addDays(today, daysOffset - 30);
    const plan = db.prepare('SELECT duration_days FROM subscription_plans WHERE id = ?').get(planId);
    const endDate = addDays(new Date(startDate), plan.duration_days);
    const daysLeft = Math.floor((new Date(endDate) - today) / 86400000);
    let status = 'active';
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 7) status = 'expiring_soon';

    const crypto = require('crypto');
    const qrHash = crypto.createHmac('sha256', 'gymdesk-secret').update(code).digest('hex').substring(0, 16);

    return db.prepare(`
      INSERT INTO members (member_code, name, phone, plan_id, start_date, end_date, status, qr_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, name, phone, planId, startDate, endDate, status, qrHash).lastInsertRowid;
  }

  createMember('GDM-2026-0001', 'Sara Al-Rashid', '0551234501', planMonthly, 0);
  createMember('GDM-2026-0002', 'Ahmed Hassan', '0551234502', planQuarterly, -5);
  createMember('GDM-2026-0003', 'Fatima Noor', '0551234503', planAnnual, 10);
  createMember('GDM-2026-0004', 'Mohammed Ali', '0551234504', planMonthly, -35); // expired
  createMember('GDM-2026-0005', 'Noura Khalid', '0551234505', planMonthly, -24); // expiring soon

  // Default class types
  const crossfitId = db.prepare(`
    INSERT INTO class_types (name, description, capacity, duration_minutes, default_trainer_id)
    VALUES (?, ?, ?, ?, ?)
  `).run('CrossFit', 'High intensity functional training', 15, 60, trainerId).lastInsertRowid;

  db.prepare(`
    INSERT INTO class_types (name, description, capacity, duration_minutes, default_trainer_id)
    VALUES (?, ?, ?, ?, ?)
  `).run('Yoga', 'Flexibility and mindfulness', 20, 60, trainerId);

  db.prepare(`
    INSERT INTO class_types (name, description, capacity, duration_minutes, default_trainer_id)
    VALUES (?, ?, ?, ?, ?)
  `).run('Spinning', 'Indoor cycling cardio', 12, 45, trainerId);

  // Schedule some upcoming class sessions
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    db.prepare(`
      INSERT INTO class_sessions (class_type_id, trainer_id, room, session_date, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crossfitId, trainerId, 'Studio A', d, '07:00', '08:00');
  }

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Default accounts:');
  console.log('  Owner:     owner@gymdesk.com     / Admin@123');
  console.log('  Manager:   manager@gymdesk.com   / Manager@123');
  console.log('  Reception: reception@gymdesk.com / Reception@123');
  console.log('  Trainer:   trainer@gymdesk.com   / Trainer@123');
}

seed();
