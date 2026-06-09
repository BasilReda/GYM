/**
 * PayPal Checkout Routes
 * Uses PayPal REST API v2 (no extra SDK needed — plain HTTP with node-fetch)
 *
 * ENV variables required (add to docker-compose.yml or .env):
 *   PAYPAL_CLIENT_ID     — sandbox client ID from developer.paypal.com
 *   PAYPAL_CLIENT_SECRET — sandbox secret from developer.paypal.com
 *   PAYPAL_MODE          — "sandbox" (testing) or "live" (production)
 */

const express = require('express');
const router  = express.Router();
const fetch   = require('node-fetch');
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const PAYPAL_MODE     = process.env.PAYPAL_MODE          || 'sandbox';
const CLIENT_ID       = process.env.PAYPAL_CLIENT_ID     || 'YOUR_SANDBOX_CLIENT_ID';
const CLIENT_SECRET   = process.env.PAYPAL_CLIENT_SECRET || 'YOUR_SANDBOX_CLIENT_SECRET';
const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY      || 'USD';
const BASE_URL        = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ─────────────────────────────────────────────
//  Helper: get PayPal access token
// ─────────────────────────────────────────────
async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ─────────────────────────────────────────────
//  GET /api/paypal/config  — expose client ID to frontend
// ─────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    clientId: CLIENT_ID,
    mode: PAYPAL_MODE,
    currency: PAYPAL_CURRENCY,
  });
});

// ─────────────────────────────────────────────
//  GET /api/paypal/test  — verify credentials work (dev only)
// ─────────────────────────────────────────────
router.get('/test', async (req, res) => {
  const info = {
    mode: PAYPAL_MODE,
    currency: PAYPAL_CURRENCY,
    client_id_prefix: CLIENT_ID.slice(0, 8) + '…',
    secret_prefix:    CLIENT_SECRET.slice(0, 8) + '…',
    same_value: CLIENT_ID === CLIENT_SECRET,
  };
  try {
    const token = await getAccessToken();
    info.auth = 'OK — access token obtained';

    // Try creating a minimal €1 order to catch merchant account issues
    const orderRes = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: PAYPAL_CURRENCY, value: '1.00' } }],
      }),
    });
    const orderData = await orderRes.json();
    if (orderRes.ok) {
      info.order_creation = 'OK — order created: ' + orderData.id;
    } else {
      info.order_creation = 'FAILED';
      info.paypal_error   = orderData;   // full PayPal error with details[]
    }
    res.json({ ok: orderRes.ok, ...info });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message, ...info });
  }
});

// In-memory store: orderID → { plan_id, member_id, recorded_by }
// Avoids putting metadata in PayPal's custom_id field (which can trigger validation errors)
const pendingOrders = new Map();

// ─────────────────────────────────────────────
//  POST /api/paypal/create-order
//  Body: { plan_id, member_id? }  (member_id only for admin flow)
//  Returns: { orderID }
// ─────────────────────────────────────────────
router.post('/create-order', authenticateToken, async (req, res) => {
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

    const accessToken = await getAccessToken();

    // Use the same minimal payload that the /test endpoint uses — no description,
    // reference_id, or custom_id fields that could trigger PayPal validation errors.
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: PAYPAL_CURRENCY,
          value: amount.toFixed(2),
        },
      }],
    };

    const orderRes = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.json();
      console.error('PayPal create-order error:', JSON.stringify(errBody));
      const detail = errBody.details?.[0];
      const msg = detail
        ? `${errBody.message} — issue: ${detail.issue}, field: ${detail.field || 'n/a'}`
        : (errBody.message || 'Failed to create PayPal order');
      return res.status(502).json({ error: msg });
    }

    const order = await orderRes.json();

    // Store metadata server-side so capture can look it up without relying on custom_id
    pendingOrders.set(order.id, {
      plan_id:     Number(plan_id),
      member_id:   Number(memberId),
      recorded_by: req.user.id,
    });

    res.json({ orderID: order.id });
  } catch (err) {
    console.error('PayPal create-order exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
//  POST /api/paypal/capture-order
//  Body: { orderID }
//  Captures payment and records it in the DB
// ─────────────────────────────────────────────
router.post('/capture-order', authenticateToken, async (req, res) => {
  try {
    const db  = getDb();
    const { orderID } = req.body;
    if (!orderID) return res.status(400).json({ error: 'orderID is required' });

    const accessToken = await getAccessToken();

    // Capture the payment
    const captureRes = await fetch(`${BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const capture = await captureRes.json();

    if (!captureRes.ok || capture.status !== 'COMPLETED') {
      console.error('PayPal capture error:', JSON.stringify(capture));
      const detail = capture.details?.[0];
      const issue  = detail?.issue || 'UNKNOWN';
      const desc   = detail?.description || capture.message || 'Payment capture failed';
      return res.status(502).json({ error: `[${issue}] ${desc}` });
    }

    // Look up metadata from server-side store (set during create-order)
    const meta = pendingOrders.get(orderID) || {};
    pendingOrders.delete(orderID);   // clean up

    const unit           = capture.purchase_units?.[0];
    const captureDetails = unit?.payments?.captures?.[0];

    const { plan_id, member_id, recorded_by } = meta;
    const amount      = parseFloat(captureDetails?.amount?.value || 0);
    const captureId   = captureDetails?.id;
    const today       = new Date().toISOString().split('T')[0];
    const recordedById = recorded_by || req.user.id;

    // Validate member & plan still exist
    const member = db.prepare('SELECT * FROM members WHERE id = ? AND is_active = 1').get(member_id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(plan_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Check for duplicate capture (idempotency)
    const existing = db.prepare("SELECT id FROM payments WHERE notes LIKE ?").get(`%${captureId}%`);
    if (existing) return res.json({ success: true, message: 'Already processed', payment_id: existing.id });

    // Insert payment record
    const payResult = db.prepare(`
      INSERT INTO payments (member_id, amount, method, payment_date, plan_id, notes, recorded_by)
      VALUES (?, ?, 'paypal', ?, ?, ?, ?)
    `).run(member_id, amount, today, plan_id, `PayPal capture: ${captureId}`, recordedById);

    // Extend subscription dates
    const base = member.end_date && new Date(member.end_date) > new Date()
      ? new Date(member.end_date)
      : new Date(today);
    base.setDate(base.getDate() + plan.duration_days);
    const newEnd = base.toISOString().split('T')[0];
    const daysLeft = Math.floor((base - new Date()) / 86400000);
    const status = daysLeft <= 7 ? 'expiring_soon' : 'active';

    db.prepare(`
      UPDATE members
      SET plan_id=?, start_date=COALESCE(start_date,?), end_date=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `).run(plan_id, today, newEnd, status, member_id);

    res.json({
      success: true,
      message: 'Payment successful! Subscription renewed.',
      payment_id: payResult.lastInsertRowid,
      new_end_date: newEnd,
      days_left: daysLeft,
      capture_id: captureId,
    });
  } catch (err) {
    console.error('PayPal capture-order exception:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
