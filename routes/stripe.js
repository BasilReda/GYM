/**
 * Stripe Payment Routes
 *
 * ENV variables required (add to docker-compose.yml):
 *   STRIPE_SECRET_KEY      — sk_test_... from dashboard.stripe.com
 *   STRIPE_PUBLISHABLE_KEY — pk_test_... from dashboard.stripe.com
 *   STRIPE_CURRENCY        — e.g. usd, eur, egp (default: usd)
 */

const express  = require('express');
const router   = express.Router();
const Stripe   = require('stripe');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const stripe   = Stripe(process.env.STRIPE_SECRET_KEY || '');
const CURRENCY = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();

// ── GET /api/stripe/config  — send publishable key to frontend ───────────────
router.get('/config', (req, res) => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.json({ publishableKey: key, currency: CURRENCY });
});

// ── POST /api/stripe/create-payment-intent ───────────────────────────────────
// Body: { plan_id, member_id? }
// Returns: { clientSecret, paymentIntentId, amount, currency }
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { plan_id, member_id } = req.body;

    if (!plan_id) return res.status(400).json({ error: 'plan_id is required' });

    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1').get(plan_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found or inactive' });

    let memberId = member_id;
    if (!memberId && req.user.role === 'member') {
      const m = db.prepare('SELECT id FROM members WHERE user_id = ? AND is_active = 1').get(req.user.id);
      if (!m) return res.status(404).json({ error: 'Member profile not found' });
      memberId = m.id;
    }
    if (!memberId) return res.status(400).json({ error: 'member_id is required' });

    const amount = parseFloat(plan.price);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: `Invalid plan price: ${plan.price}` });
    }

    // Stripe amounts are in smallest currency unit (cents for USD)
    const amountInt = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   amountInt,
      currency: CURRENCY,
      metadata: {
        plan_id:     String(plan_id),
        member_id:   String(memberId),
        recorded_by: String(req.user.id),
        plan_name:   plan.name,
      },
    });

    res.json({
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: CURRENCY,
    });
  } catch (err) {
    console.error('Stripe create-payment-intent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/record-payment ─────────────────────────────────────────
// Called by frontend after stripe.confirmCardPayment succeeds
// Body: { paymentIntentId }
router.post('/record-payment', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId is required' });

    // Verify payment with Stripe (never trust client-only confirmation)
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment not completed. Status: ${pi.status}` });
    }

    const { plan_id, member_id, recorded_by } = pi.metadata;
    const amount     = pi.amount / 100;
    const today      = new Date().toISOString().split('T')[0];
    const recordedBy = parseInt(recorded_by) || req.user.id;

    // Idempotency check
    const existing = db.prepare("SELECT id FROM payments WHERE notes LIKE ?").get(`%${paymentIntentId}%`);
    if (existing) return res.json({ success: true, message: 'Already processed', payment_id: existing.id });

    const member = db.prepare('SELECT * FROM members WHERE id = ? AND is_active = 1').get(parseInt(member_id));
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(parseInt(plan_id));
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Record payment
    const payResult = db.prepare(`
      INSERT INTO payments (member_id, amount, method, payment_date, plan_id, notes, recorded_by)
      VALUES (?, ?, 'card', ?, ?, ?, ?)
    `).run(parseInt(member_id), amount, today, parseInt(plan_id), `Stripe: ${paymentIntentId}`, recordedBy);

    // Extend subscription
    const base = member.end_date && new Date(member.end_date) > new Date()
      ? new Date(member.end_date)
      : new Date(today);
    base.setDate(base.getDate() + plan.duration_days);
    const newEnd   = base.toISOString().split('T')[0];
    const daysLeft = Math.floor((base - new Date()) / 86400000);
    const status   = daysLeft <= 7 ? 'expiring_soon' : 'active';

    db.prepare(`
      UPDATE members
      SET plan_id=?, start_date=COALESCE(start_date,?), end_date=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `).run(parseInt(plan_id), today, newEnd, status, parseInt(member_id));

    res.json({
      success:     true,
      message:     'Payment successful! Subscription renewed.',
      payment_id:  payResult.lastInsertRowid,
      new_end_date: newEnd,
      days_left:   daysLeft,
    });
  } catch (err) {
    console.error('Stripe record-payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
