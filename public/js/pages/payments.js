Pages = window.Pages || {};

Pages.payments = {
  plans: [],

  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      this.plans = await API.getPlans();
      await this.renderList(container);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    }
  },

  async renderList(container) {
    const [payments, summary] = await Promise.all([
      API.getPayments(),
      API.getPaymentSummary().catch(() => ({ this_month: 0, last_month: 0 }))
    ]);
    container.innerHTML = `
      <div class="page-header">
        <h2>${t('payments.title')}</h2>
        <div class="btn-group">
          <button class="btn btn-primary" onclick="Pages.payments.openAddModal()">${t('payments.record_btn')}</button>
          <button class="btn btn-secondary" onclick="Pages.payments.openStripeModal()">💳 Charge via Stripe</button>
        </div>
      </div>
      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="stat-card gold">
          <div class="stat-label">${t('payments.this_month')}</div>
          <div class="stat-value" style="font-size:1.5rem">${fmtCurrency(summary.this_month)}</div>
        </div>
        <div class="stat-card teal">
          <div class="stat-label">${t('payments.last_month')}</div>
          <div class="stat-value" style="font-size:1.5rem">${fmtCurrency(summary.last_month)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('payments.total_txns')}</div>
          <div class="stat-value">${payments.length}</div>
        </div>
      </div>
      <div class="search-bar">
        <input type="date" id="pay-from" style="width:auto">
        <input type="date" id="pay-to" style="width:auto">
        <button class="btn btn-secondary btn-sm" onclick="Pages.payments.filterPayments()">${t('payments.filter')}</button>
        <button class="btn btn-ghost btn-sm" onclick="Pages.payments.showOverdue()">${t('payments.overdue_btn')}</button>
      </div>
      <div id="pay-table">${this.renderTable(payments)}</div>
    `;
  },

  renderTable(payments) {
    if (payments.length === 0) return `<div class="empty-state"><div class="empty-icon">💳</div><p>${t('payments.no_records')}</p></div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${t('payments.col.member')}</th>
              <th>${t('payments.col.id')}</th>
              <th>${t('payments.col.amount')}</th>
              <th>${t('payments.col.method')}</th>
              <th>${t('payments.col.plan')}</th>
              <th>${t('payments.col.date')}</th>
              <th>${t('payments.col.notes')}</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td style="font-weight:500;color:var(--text)">${escHtml(p.member_name)}</td>
                <td><code style="color:var(--accent);font-size:0.8rem">${escHtml(p.member_code)}</code></td>
                <td style="color:var(--success);font-weight:600">${fmtCurrency(p.amount)}</td>
                <td>${t('payment.method.'+p.method)||p.method}</td>
                <td>${escHtml(p.plan_name||'—')}</td>
                <td>${fmtDate(p.payment_date)}</td>
                <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis">${escHtml(p.notes||'—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async filterPayments() {
    const from = document.getElementById('pay-from')?.value;
    const to   = document.getElementById('pay-to')?.value;
    let qs = '?';
    if (from) qs += `from=${from}&`;
    if (to)   qs += `to=${to}&`;
    try {
      const payments = await API.getPayments(qs);
      document.getElementById('pay-table').innerHTML = this.renderTable(payments);
    } catch (err) { Toast.error(err.message); }
  },

  async showOverdue() {
    try {
      const overdue = await API.getOverdue();
      Modal.open(t('payments.overdue.title'),
        overdue.length === 0
          ? `<div class="empty-state"><div class="empty-icon">🎉</div><p>${t('payments.overdue.none')}</p></div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>${t('payments.overdue.col.name')}</th>
                <th>${t('payments.overdue.col.id')}</th>
                <th>${t('payments.overdue.col.phone')}</th>
                <th>${t('payments.overdue.col.expired')}</th>
                <th>${t('payments.overdue.col.last_payment')}</th>
              </tr></thead>
              <tbody>
                ${overdue.map(m => `<tr>
                  <td style="font-weight:500">${escHtml(m.name)}</td>
                  <td><code style="color:var(--accent);font-size:0.8rem">${escHtml(m.member_code)}</code></td>
                  <td>${escHtml(m.phone)}</td>
                  <td style="color:var(--danger)">${fmtDate(m.end_date)}</td>
                  <td>${fmtDate(m.last_payment)}</td>
                </tr>`).join('')}
              </tbody>
            </table></div>`
      );
    } catch (err) { Toast.error(err.message); }
  },

  async openAddModal() {
    const members = await API.getMembers().catch(() => []);
    const planOpts = this.plans.filter(p=>p.is_active).map(p =>
      `<option value="${p.id}">${escHtml(p.name)} (${fmtCurrency(p.price)})</option>`
    ).join('');
    const memberOpts = members.map(m =>
      `<option value="${m.id}">${escHtml(m.name)} — ${m.member_code}</option>`
    ).join('');

    Modal.open(t('payments.modal.record'), `
      <form id="new-pay-form">
        <div class="form-group"><label>${t('payments.form.member')}</label>
          <select name="member_id" required><option value="">${t('common.select_member')}</option>${memberOpts}</select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('payments.form.amount')}</label><input name="amount" type="number" min="0" step="0.01" required placeholder="200"></div>
          <div class="form-group"><label>${t('payments.form.method')}</label>
            <select name="method">
              <option value="cash">${t('payment.method.cash')}</option>
              <option value="card">${t('payment.method.card')}</option>
              <option value="bank_transfer">${t('payment.method.bank_transfer')}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('payments.form.date')}</label><input name="payment_date" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
          <div class="form-group"><label>${t('payments.form.renew')}</label><select name="plan_id"><option value="">${t('common.no_renewal')}</option>${planOpts}</select></div>
        </div>
        <div class="form-group"><label>${t('payments.form.notes')}</label><input name="notes" placeholder="${t('common.optional')}"></div>
        <div id="new-pay-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('payments.record_btn')}</button>
        </div>
      </form>
    `);
    document.getElementById('new-pay-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.plan_id) delete data.plan_id;
      try {
        await API.createPayment(data);
        Modal.close();
        Toast.success(t('payments.toast.recorded'));
        App.navigate('payments');
      } catch (err) {
        document.getElementById('new-pay-err').textContent = err.message;
        document.getElementById('new-pay-err').style.display = 'block';
      }
    };
  },

  _adminStripe: null,
  _adminCard:   null,

  async openStripeModal() {
    const members     = await API.getMembers().catch(() => []);
    const activePlans = this.plans.filter(p => p.is_active);

    Modal.open('💳 Charge via Stripe', `
      <div class="form-group">
        <label>Member</label>
        <select id="str-admin-member">
          <option value="">— Select member —</option>
          ${members.map(m => `<option value="${m.id}">${escHtml(m.name)} (${m.member_code})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Plan</label>
        <select id="str-admin-plan">
          <option value="">— Select plan —</option>
          ${activePlans.map(p => `<option value="${p.id}">${escHtml(p.name)} — $${parseFloat(p.price).toFixed(2)} / ${p.duration_days}d</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-top:1rem">
        <label>Card Details</label>
        <div id="str-admin-card-el" style="border:1px solid var(--border);border-radius:8px;padding:0.75rem;background:var(--bg);min-height:44px"></div>
        <div id="str-admin-card-err" style="color:#dc2626;font-size:0.8rem;margin-top:0.4rem"></div>
      </div>
      <button id="str-admin-pay-btn" onclick="Pages.payments._submitAdminPayment()"
        style="margin-top:0.5rem;width:100%;padding:0.75rem;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:600;font-size:0.9rem;cursor:pointer">
        Charge Now
      </button>
      <div id="str-admin-result" style="margin-top:0.75rem"></div>
    `, async () => {
      // Mount card element once when modal opens
      this._adminCard = null;
      try {
        const { stripe } = await StripeLoader.load();
        this._adminStripe = stripe;
        const elements = stripe.elements();
        this._adminCard = elements.create('card', {
          style: {
            base: { fontSize: '15px', color: '#1a2332', fontFamily: 'Inter, sans-serif', '::placeholder': { color: '#94a3b8' } },
            invalid: { color: '#dc2626' },
          },
        });
        this._adminCard.mount('#str-admin-card-el');
        this._adminCard.on('change', e => {
          const el = document.getElementById('str-admin-card-err');
          if (el) el.textContent = e.error ? e.error.message : '';
        });
      } catch (e) {
        const el = document.getElementById('str-admin-card-el');
        if (el) el.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
      }
    });
  },

  async _submitAdminPayment() {
    const memberId = parseInt(document.getElementById('str-admin-member')?.value);
    const planId   = parseInt(document.getElementById('str-admin-plan')?.value);
    const result   = document.getElementById('str-admin-result');
    const btn      = document.getElementById('str-admin-pay-btn');

    if (!memberId || !planId) {
      if (result) result.innerHTML = `<div class="alert alert-warning">Please select both a member and a plan.</div>`;
      return;
    }
    if (!this._adminStripe || !this._adminCard) {
      if (result) result.innerHTML = `<div class="alert alert-error">Card input not ready. Please close and reopen.</div>`;
      return;
    }

    btn.disabled = true; btn.textContent = 'Processing…';
    result.innerHTML = '';

    try {
      const { clientSecret, paymentIntentId } = await API.post('/stripe/create-payment-intent', {
        plan_id: planId, member_id: memberId,
      });

      const { error, paymentIntent } = await this._adminStripe.confirmCardPayment(clientSecret, {
        payment_method: { card: this._adminCard },
      });

      if (error) {
        result.innerHTML = `<div class="alert alert-error">${escHtml(error.message)}</div>`;
        btn.disabled = false; btn.textContent = 'Charge Now';
        return;
      }

      await API.post('/stripe/record-payment', { paymentIntentId: paymentIntent.id });
      result.innerHTML = `<div class="alert alert-success">✅ Payment successful! Subscription renewed.</div>`;
      setTimeout(() => { Modal.close(); App.navigate('payments'); }, 2000);
    } catch (err) {
      result.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Charge Now';
    }
  },
};
