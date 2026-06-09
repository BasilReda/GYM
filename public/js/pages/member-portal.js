Pages = window.Pages || {};

Pages.memberPortal = {
  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      const [profile, attData] = await Promise.all([
        API.get('/portal/me'),
        API.get('/portal/attendance'),
      ]);
      this.renderDashboard(container, profile, attData);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    }
  },

  renderDashboard(container, p, attData) {
    const daysLeft  = p.days_left;
    const totalDays = p.duration_days || 30;
    const usedDays  = totalDays - Math.max(daysLeft, 0);
    const pct       = Math.min(100, Math.max(0, Math.round((usedDays / totalDays) * 100)));

    const statusMeta = {
      active:        { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: t('member.status.active') },
      expiring_soon: { color: '#d97706', bg: '#fef9c3', border: '#fde68a', label: t('member.status.expiring_soon') },
      expired:       { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', label: t('member.status.expired') },
      suspended:     { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', label: t('member.status.suspended') },
    };
    const sm = statusMeta[p.status] || statusMeta.active;

    // Heatmap
    const last30      = attData.last_30 || {};
    const heatmapDays = Object.keys(last30).sort();
    const heatmap = heatmapDays.map(d => {
      const count   = last30[d];
      const bg      = count > 0 ? '#1a2332' : '#e2e8f0';
      const dayName = new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
      return `<div title="${dayName}: ${count}" style="width:18px;height:18px;border-radius:3px;background:${bg};flex-shrink:0"></div>`;
    }).join('');

    const daysLeftLabel = daysLeft !== null ? (daysLeft < 0 ? t('member.status.expired') : daysLeft + 'd') : '—';
    const canRenew = !p.status || p.status !== 'suspended';

    container.innerHTML = `
      <!-- GREETING -->
      <div style="margin-bottom:1.5rem">
        <h2 style="font-size:1.5rem;font-weight:700;color:var(--text);letter-spacing:-0.02em">
          ${t('portal.welcome')} ${escHtml(p.name.split(' ')[0])} 👋
        </h2>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.2rem">${p.member_code}</p>
      </div>

      <!-- SUBSCRIPTION CARD -->
      <div style="background:var(--accent);border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;position:relative;overflow:hidden;color:#fff">
        <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.05);pointer-events:none"></div>
        <div style="position:absolute;bottom:-20px;right:80px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.05);pointer-events:none"></div>

        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:1.5rem">
          <div>
            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.55);margin-bottom:0.3rem">${t('portal.plan')}</div>
            <div style="font-size:1.35rem;font-weight:700">${escHtml(p.plan_name || t('portal.no_plan'))}</div>
          </div>
          <span style="background:${sm.bg};color:${sm.color};border:1px solid ${sm.border};padding:0.3rem 0.9rem;border-radius:100px;font-size:0.75rem;font-weight:600;white-space:nowrap">
            ${sm.label}
          </span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem">
          <div>
            <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">${t('portal.start_date')}</div>
            <div style="font-weight:600;font-size:0.9rem">${fmtDate(p.start_date)}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">${t('portal.expires')}</div>
            <div style="font-weight:600;font-size:0.9rem">${fmtDate(p.end_date)}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">${t('portal.days_left')}</div>
            <div style="font-weight:700;font-size:1.2rem">${daysLeftLabel}</div>
          </div>
        </div>

        ${p.end_date ? `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:rgba(255,255,255,0.55);margin-bottom:0.4rem">
            <span>${t('portal.sub_used')}</span><span>${pct}%</span>
          </div>
          <div style="height:5px;background:rgba(255,255,255,0.15);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:rgba(255,255,255,0.7);border-radius:3px;transition:width 0.5s ease"></div>
          </div>
        </div>` : ''}

        ${p.status === 'expiring_soon' ? `
        <div style="margin-top:1rem;padding:0.65rem 1rem;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-size:0.82rem;color:rgba(255,255,255,0.9)">
          ⚠️ ${t('portal.expiring_warn_1')} <strong>${daysLeft} ${t('portal.expiring_warn_2')}</strong>. ${t('portal.expiring_warn_3')}
        </div>` : ''}
        ${p.status === 'expired' ? `
        <div style="margin-top:1rem;padding:0.65rem 1rem;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-size:0.82rem;color:rgba(255,255,255,0.9)">
          ❌ ${t('portal.expired_warn')}
        </div>` : ''}

        ${canRenew ? `
        <div style="margin-top:1.25rem">
          <button class="btn btn-sm"
            onclick="Pages.memberPortal.openRenewModal()"
            style="background:#fff;color:var(--accent);font-weight:600;border:none;padding:0.55rem 1.2rem;border-radius:8px;cursor:pointer;font-size:0.85rem">
            🔄 ${t('paypal.renew_title')}
          </button>
        </div>` : ''}
      </div>

      <!-- STATS ROW -->
      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="stat-card teal">
          <div class="stat-label">${t('portal.this_month')}</div>
          <div class="stat-value">${attData.this_month}</div>
          <div class="stat-sub">${t('portal.checkins')}</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-label">${t('portal.this_year')}</div>
          <div class="stat-value">${attData.this_year}</div>
          <div class="stat-sub">${t('portal.total_visits')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('portal.member_since')}</div>
          <div class="stat-value" style="font-size:1rem;padding-top:0.3rem">${fmtDate(p.created_at?.split('T')[0])}</div>
          <div class="stat-sub">${escHtml(p.member_code)}</div>
        </div>
      </div>

      <!-- HEATMAP -->
      <div class="card" style="margin-bottom:1.5rem">
        <h3 style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:1rem">${t('portal.heatmap_title')}</h3>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${heatmap}</div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;font-size:0.72rem;color:var(--text-muted)">
          <span>${t('portal.heatmap_less')}</span>
          <div style="width:12px;height:12px;border-radius:2px;background:#e2e8f0"></div>
          <div style="width:12px;height:12px;border-radius:2px;background:#1a2332"></div>
          <span>${t('portal.heatmap_more')}</span>
        </div>
      </div>

      <!-- RECENT CHECK-INS -->
      <div class="card">
        <h3 style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:1rem">${t('portal.recent_checkins')}</h3>
        ${attData.records.length === 0
          ? `<div class="empty-state" style="padding:1rem"><div class="empty-icon">🏃</div><p>${t('portal.no_checkins')}</p></div>`
          : `<div class="table-wrap" style="border:none;margin-bottom:0;box-shadow:none">
              <table>
                <thead><tr><th>${t('portal.col.datetime')}</th><th>${t('portal.col.method')}</th></tr></thead>
                <tbody>
                  ${attData.records.slice(0, 20).map(r => `
                    <tr>
                      <td>${fmtDateTime(r.check_in_time)}</td>
                      <td>${t('attendance.method.' + r.method) || r.method}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
  },

  // ─── Stripe Renewal Flow ──────────────────────────────
  _selectedPlanId: null,
  _stripeObj: null,
  _cardElement: null,

  async openRenewModal() {
    try {
      const plans  = await API.getPlans();
      const active = plans.filter(p => p.is_active);
      if (!active.length) { Toast.error('No active plans available.'); return; }

      Modal.open('💳 Renew Subscription', `
        <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1rem">1. Choose a plan:</p>
        <div style="display:grid;gap:0.6rem;margin-bottom:1.25rem">
          ${active.map(p => `
            <div class="stripe-plan-card" data-plan-id="${p.id}" onclick="Pages.memberPortal._selectPlan(${p.id})"
              style="border:2px solid var(--border);border-radius:12px;padding:0.9rem 1rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:border-color 0.15s,background 0.15s">
              <div>
                <div style="font-weight:600;color:var(--text)">${escHtml(p.name)}</div>
                <div style="font-size:0.8rem;color:var(--text-muted)">${p.duration_days} days</div>
              </div>
              <div style="font-size:1.2rem;font-weight:700;color:var(--accent)">$${parseFloat(p.price).toFixed(2)}</div>
            </div>
          `).join('')}
        </div>
        <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:0.5rem">2. Enter card details:</p>
        <div id="stripe-card-element" style="border:1px solid var(--border);border-radius:8px;padding:0.75rem;background:var(--bg);min-height:44px"></div>
        <div id="stripe-card-errors" style="color:#dc2626;font-size:0.8rem;margin-top:0.4rem"></div>
        <button id="stripe-pay-btn" onclick="Pages.memberPortal._submitPayment()"
          style="margin-top:1rem;width:100%;padding:0.75rem;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:600;font-size:0.9rem;cursor:pointer">
          Pay Now
        </button>
        <div id="stripe-result" style="margin-top:0.75rem"></div>
      `, async () => {
        // Mount card element once after modal DOM is ready
        this._selectedPlanId = null;
        this._cardElement = null;
        try {
          const { stripe } = await StripeLoader.load();
          this._stripeObj = stripe;
          const elements = stripe.elements();
          this._cardElement = elements.create('card', {
            style: {
              base: { fontSize: '15px', color: '#1a2332', fontFamily: 'Inter, sans-serif', '::placeholder': { color: '#94a3b8' } },
              invalid: { color: '#dc2626' },
            },
          });
          this._cardElement.mount('#stripe-card-element');
          this._cardElement.on('change', e => {
            const el = document.getElementById('stripe-card-errors');
            if (el) el.textContent = e.error ? e.error.message : '';
          });
        } catch (e) {
          const el = document.getElementById('stripe-card-element');
          if (el) el.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
        }
      });
    } catch (err) {
      Toast.error(err.message);
    }
  },

  _selectPlan(planId) {
    this._selectedPlanId = planId;
    document.querySelectorAll('.stripe-plan-card').forEach(el => {
      const sel = parseInt(el.dataset.planId) === planId;
      el.style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
      el.style.background  = sel ? 'rgba(26,35,50,0.05)' : '';
    });
  },

  async _submitPayment() {
    const result = document.getElementById('stripe-result');
    const btn    = document.getElementById('stripe-pay-btn');
    if (!this._selectedPlanId) {
      if (result) result.innerHTML = `<div class="alert alert-warning">Please select a plan first.</div>`;
      return;
    }
    if (!this._stripeObj || !this._cardElement) {
      if (result) result.innerHTML = `<div class="alert alert-error">Card input not ready. Please refresh.</div>`;
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Processing…';
    result.innerHTML = '';

    try {
      const { clientSecret, paymentIntentId } = await API.post('/stripe/create-payment-intent', {
        plan_id: this._selectedPlanId,
      });

      const { error, paymentIntent } = await this._stripeObj.confirmCardPayment(clientSecret, {
        payment_method: { card: this._cardElement },
      });

      if (error) {
        result.innerHTML = `<div class="alert alert-error">${escHtml(error.message)}</div>`;
        btn.disabled = false; btn.textContent = 'Pay Now';
        return;
      }

      await API.post('/stripe/record-payment', { paymentIntentId: paymentIntent.id });
      result.innerHTML = `<div class="alert alert-success">✅ Payment successful! Subscription renewed.</div>`;
      setTimeout(() => {
        Modal.close();
        App.navigate('my-membership');
      }, 2000);
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Pay Now';
    }
  },
};
