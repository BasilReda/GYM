Pages = window.Pages || {};

Pages.members = {
  plans: [],

  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      this.plans = await API.getPlans();
      await this.renderList(container, '');
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    }
  },

  async renderList(container, search = '', statusFilter = '') {
    let qs = '';
    if (search) qs += `?search=${encodeURIComponent(search)}`;
    if (statusFilter) qs += (qs ? '&' : '?') + `status=${statusFilter}`;
    const members = await API.getMembers(qs).catch(() => []);

    container.innerHTML = `
      <div class="page-header">
        <h2>${t('members.title')} <span style="font-size:0.9rem;color:var(--text-muted);font-weight:400">(${members.length})</span></h2>
        ${App.hasRole('owner','manager','reception') ? `<button class="btn btn-primary" onclick="Pages.members.openAddModal()">${t('members.add')}</button>` : ''}
      </div>
      <div class="search-bar">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="members-search" placeholder="${t('members.search_placeholder')}" value="${escHtml(search)}">
        </div>
        <select id="members-status-filter" style="width:auto;min-width:140px">
          <option value="">${t('members.all_status')}</option>
          <option value="active" ${statusFilter==='active'?'selected':''}>${t('member.status.active')}</option>
          <option value="expiring_soon" ${statusFilter==='expiring_soon'?'selected':''}>${t('member.status.expiring_soon')}</option>
          <option value="expired" ${statusFilter==='expired'?'selected':''}>${t('member.status.expired')}</option>
          <option value="suspended" ${statusFilter==='suspended'?'selected':''}>${t('member.status.suspended')}</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${t('members.col.id')}</th>
              <th>${t('members.col.name')}</th>
              <th>${t('members.col.phone')}</th>
              <th>${t('members.col.plan')}</th>
              <th>${t('members.col.expires')}</th>
              <th>${t('members.col.status')}</th>
              <th>${t('members.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${members.length === 0
              ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">${t('members.no_records')}</td></tr>`
              : members.map(m => `
                <tr>
                  <td><code style="font-size:0.8rem;color:var(--accent)">${escHtml(m.member_code)}</code></td>
                  <td style="font-weight:500;color:var(--text)">${escHtml(m.name)} ${m.user_id ? '<span title="Has login" style="font-size:0.7rem">🔑</span>' : ''}</td>
                  <td>${escHtml(m.phone)}</td>
                  <td>${escHtml(m.plan_name || '—')}</td>
                  <td>${fmtDate(m.end_date)}</td>
                  <td>${statusBadge(m.status)}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-secondary btn-sm" onclick="Pages.members.viewMember(${m.id})">${t('members.btn.view')}</button>
                      <button class="btn btn-secondary btn-sm" onclick="Pages.members.showQr(${m.id})">${t('members.btn.qr')}</button>
                      ${App.hasRole('owner','manager','reception') ? `<button class="btn btn-secondary btn-sm" onclick="Pages.members.openEditModal(${m.id})">${t('members.btn.edit')}</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `;

    let debounce;
    document.getElementById('members-search').addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.renderList(container, e.target.value, document.getElementById('members-status-filter').value);
      }, 300);
    });
    document.getElementById('members-status-filter').addEventListener('change', e => {
      this.renderList(container, document.getElementById('members-search').value, e.target.value);
    });
  },

  async viewMember(id) {
    try {
      const [m, attendance] = await Promise.all([API.getMember(id), API.getMemberAttendance(id)]);
      const payments = await API.getPayments(`?member_id=${id}`).catch(() => []);
      Modal.open(`👤 ${m.name}`, `
        <div class="profile-header">
          <div class="profile-avatar">${(m.name||'?')[0].toUpperCase()}</div>
          <div class="profile-info">
            <h2>${escHtml(m.name)}</h2>
            <p>${m.member_code} · ${m.phone}${m.email ? ' · ' + m.email : ''}</p>
          </div>
        </div>
        <div class="tabs">
          <button class="tab-btn active" onclick="Pages.members.switchTab(this,'overview')">${t('members.tab.overview')}</button>
          <button class="tab-btn" onclick="Pages.members.switchTab(this,'attendance')">${t('members.tab.attendance')} (${attendance.length})</button>
          <button class="tab-btn" onclick="Pages.members.switchTab(this,'payments')">${t('members.tab.payments')} (${payments.length})</button>
        </div>
        <div id="tab-overview" class="tab-panel active">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.88rem">
            ${[
              [t('members.overview.status'), statusBadge(m.status)],
              [t('members.overview.plan'), escHtml(m.plan_name||'—')],
              [t('members.overview.start'), fmtDate(m.start_date)],
              [t('members.overview.end'), fmtDate(m.end_date)],
              [t('members.overview.dob'), fmtDate(m.dob)],
              [t('members.overview.emergency'), escHtml(m.emergency_contact||'—')]
            ].map(([k,v]) => `<div style="background:var(--bg);border-radius:8px;padding:0.6rem;border:1px solid var(--border)"><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:0.2rem">${k}</div><div>${v}</div></div>`).join('')}
          </div>
          ${m.notes ? `<div class="alert alert-info" style="margin-top:0.75rem;font-size:0.85rem">📝 ${escHtml(m.notes)}</div>` : ''}
          ${App.hasRole('owner','manager','reception') ? `
          <div class="modal-footer">
            ${App.hasRole('owner','manager') ? (m.status==='suspended'
              ? `<button class="btn btn-secondary btn-sm" onclick="Pages.members.doReactivate(${m.id})">${t('members.btn.reactivate')}</button>`
              : `<button class="btn btn-danger btn-sm" onclick="Pages.members.doSuspend(${m.id})">${t('members.btn.suspend')}</button>`) : ''}
            <button class="btn btn-primary btn-sm" onclick="Pages.members.openPaymentModal(${m.id}, '${escHtml(m.name)}')">${t('members.btn.record_payment')}</button>
          </div>` : ''}
        </div>
        <div id="tab-attendance" class="tab-panel">
          ${attendance.length === 0
            ? `<div class="empty-state"><div class="empty-icon">📋</div><p>${t('common.nodata')}</p></div>`
            : `<div class="table-wrap"><table><thead><tr><th>${t('common.date')}</th><th>${t('attendance.col.method')}</th></tr></thead><tbody>
               ${attendance.slice(0,50).map(a=>`<tr><td>${fmtDateTime(a.check_in_time)}</td><td>${t('attendance.method.'+a.method)||a.method}</td></tr>`).join('')}
               </tbody></table></div>`}
        </div>
        <div id="tab-payments" class="tab-panel">
          ${payments.length === 0
            ? `<div class="empty-state"><div class="empty-icon">💳</div><p>${t('common.nodata')}</p></div>`
            : `<div class="table-wrap"><table><thead><tr><th>${t('common.date')}</th><th>${t('common.amount')}</th><th>${t('payments.col.method')}</th><th>${t('members.col.plan')}</th></tr></thead><tbody>
               ${payments.map(p=>`<tr><td>${fmtDate(p.payment_date)}</td><td>${fmtCurrency(p.amount)}</td><td>${t('payment.method.'+p.method)||p.method}</td><td>${escHtml(p.plan_name||'—')}</td></tr>`).join('')}
               </tbody></table></div>`}
        </div>
      `);
    } catch (err) { Toast.error(err.message); }
  },

  switchTab(btn, tabId) {
    btn.closest('.modal-body').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.closest('.modal-body').querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
  },

  async showQr(id) {
    try {
      const data = await API.getMemberQr(id);
      const m = await API.getMember(id);
      Modal.open('📱 QR', `
        <div class="qr-container">
          <div class="member-card">
            <div style="font-size:2.5rem">🏋️</div>
            <div class="member-name">${escHtml(m.name)}</div>
            <div class="member-code">${escHtml(data.member_code)}</div>
          </div>
          <img src="${data.qr}" alt="QR" style="width:200px;height:200px">
          <p style="color:var(--text-muted);font-size:0.8rem">${t('members.qr.scan_hint')}</p>
        </div>
      `);
    } catch (err) { Toast.error(err.message); }
  },

  openAddModal() {
    const planOpts = this.plans.filter(p=>p.is_active).map(p =>
      `<option value="${p.id}">${escHtml(p.name)} (${p.duration_days}${t('common.days')} - ${fmtCurrency(p.price)})</option>`
    ).join('');

    Modal.open(t('members.modal.add'), `
      <form id="member-form">
        <div class="form-row">
          <div class="form-group"><label>${t('members.form.full_name')}</label><input name="name" required placeholder="Sara Al-Rashid"></div>
          <div class="form-group"><label>${t('members.form.phone')}</label><input name="phone" required placeholder="+20 555 0001"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('members.form.email')}</label><input id="new-member-email" name="email" type="email"></div>
          <div class="form-group"><label>${t('members.form.dob')}</label><input name="dob" type="date"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('members.form.plan')}</label><select name="plan_id"><option value="">${t('members.form.no_plan')}</option>${planOpts}</select></div>
          <div class="form-group"><label>${t('members.form.start_date')}</label><input name="start_date" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
        </div>
        <div class="form-group"><label>${t('members.form.emergency')}</label><input name="emergency_contact"></div>
        <div class="form-group"><label>${t('members.form.notes')}</label><textarea name="notes" rows="2"></textarea></div>
        <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:0.5rem">
          <label style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;font-size:0.88rem;color:var(--text)">
            <input type="checkbox" id="toggle-login" name="create_login" value="1"
              style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"
              onchange="Pages.members.toggleLoginFields(this.checked)">
            <span>${t('members.form.create_login')}</span>
          </label>
          <div id="login-fields" style="display:none;margin-top:0.75rem">
            <div class="alert alert-info" style="font-size:0.8rem;margin-bottom:0.75rem">${t('members.form.login_hint')}</div>
            <div class="form-group">
              <label>${t('members.form.password')}</label>
              <input id="new-member-password" name="login_password" type="password" placeholder="${t('members.form.pw_placeholder')}" minlength="8">
            </div>
          </div>
        </div>
        <div id="member-form-error" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('members.modal.add')}</button>
        </div>
      </form>
    `);
    document.getElementById('member-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      if (!data.plan_id) delete data.plan_id;
      if (!data.start_date) delete data.start_date;
      if (!data.create_login) { delete data.create_login; delete data.login_password; }
      try {
        const result = await API.createMember(data);
        Modal.close();
        Toast.success(result.login_created ? t('members.toast.added_login') : t('members.toast.added'));
        this.renderList(document.getElementById('page-content'), '', '');
      } catch (err) {
        document.getElementById('member-form-error').textContent = err.message;
        document.getElementById('member-form-error').style.display = 'block';
      }
    };
  },

  toggleLoginFields(show) {
    const fields = document.getElementById('login-fields');
    const pwInput = document.getElementById('new-member-password');
    if (fields) fields.style.display = show ? 'block' : 'none';
    if (pwInput) pwInput.required = show;
    const emailInput = document.getElementById('new-member-email');
    if (emailInput) emailInput.required = show;
  },

  async openEditModal(id) {
    const m = await API.getMember(id).catch(() => null);
    if (!m) return;
    const planOpts = this.plans.filter(p=>p.is_active).map(p =>
      `<option value="${p.id}" ${m.plan_id==p.id?'selected':''}>${escHtml(p.name)}</option>`
    ).join('');
    Modal.open(t('members.modal.edit'), `
      <form id="edit-member-form">
        <div class="form-row">
          <div class="form-group"><label>${t('members.form.full_name')}</label><input name="name" required value="${escHtml(m.name)}"></div>
          <div class="form-group"><label>${t('members.form.phone')}</label><input name="phone" required value="${escHtml(m.phone)}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('members.form.email')}</label><input name="email" type="email" value="${escHtml(m.email||'')}"></div>
          <div class="form-group"><label>${t('members.form.dob')}</label><input name="dob" type="date" value="${m.dob||''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('members.col.plan')}</label><select name="plan_id"><option value="">${t('members.form.no_plan')}</option>${planOpts}</select></div>
          <div class="form-group"><label>${t('members.form.start_date')}</label><input name="start_date" type="date" value="${m.start_date||''}"></div>
        </div>
        <div class="form-group"><label>${t('members.form.emergency')}</label><input name="emergency_contact" value="${escHtml(m.emergency_contact||'')}"></div>
        <div class="form-group"><label>${t('members.form.notes')}</label><textarea name="notes">${escHtml(m.notes||'')}</textarea></div>
        <div id="edit-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-danger btn-sm" onclick="Pages.members.doDelete(${m.id})">${t('members.btn.delete')}</button>
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('common.save')}</button>
        </div>
      </form>
    `);
    document.getElementById('edit-member-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      try {
        await API.updateMember(id, data);
        Modal.close();
        Toast.success(t('members.toast.updated'));
        this.renderList(document.getElementById('page-content'), '', '');
      } catch (err) {
        document.getElementById('edit-err').textContent = err.message;
        document.getElementById('edit-err').style.display = 'block';
      }
    };
  },

  async doDelete(id) {
    if (!confirm(t('members.confirm.delete'))) return;
    try { await API.deleteMember(id); Modal.close(); Toast.success(t('members.toast.deleted')); this.renderList(document.getElementById('page-content'), '', ''); }
    catch (err) { Toast.error(err.message); }
  },

  async doSuspend(id) {
    if (!confirm(t('members.confirm.suspend'))) return;
    try { await API.suspendMember(id); Modal.close(); Toast.success(t('members.toast.suspended')); this.renderList(document.getElementById('page-content'), '', ''); }
    catch (err) { Toast.error(err.message); }
  },

  async doReactivate(id) {
    try { await API.reactivateMember(id); Modal.close(); Toast.success(t('members.toast.reactivated')); this.renderList(document.getElementById('page-content'), '', ''); }
    catch (err) { Toast.error(err.message); }
  },

  openPaymentModal(memberId, memberName) {
    const planOpts = this.plans.filter(p=>p.is_active).map(p =>
      `<option value="${p.id}">${escHtml(p.name)} (${p.duration_days}${t('common.days')} - ${fmtCurrency(p.price)})</option>`
    ).join('');
    Modal.open(`💳 ${t('members.payment.title')} — ${memberName}`, `
      <form id="pay-form">
        <div class="form-row">
          <div class="form-group"><label>${t('members.payment.amount')}</label><input name="amount" type="number" min="0" required placeholder="200"></div>
          <div class="form-group"><label>${t('members.payment.method')}</label>
            <select name="method">
              <option value="cash">${t('payment.method.cash')}</option>
              <option value="card">${t('payment.method.card')}</option>
              <option value="bank_transfer">${t('payment.method.bank_transfer')}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('members.payment.date')}</label><input name="payment_date" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
          <div class="form-group"><label>${t('members.payment.renew')}</label><select name="plan_id"><option value="">${t('members.payment.no_renewal')}</option>${planOpts}</select></div>
        </div>
        <div class="form-group"><label>${t('members.payment.notes')}</label><input name="notes"></div>
        <div id="pay-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('members.payment.title')}</button>
        </div>
      </form>
    `);
    document.getElementById('pay-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = { ...Object.fromEntries(fd.entries()), member_id: memberId };
      if (!data.plan_id) delete data.plan_id;
      try {
        await API.createPayment(data);
        Modal.close();
        Toast.success(t('members.toast.payment'));
      } catch (err) {
        document.getElementById('pay-err').textContent = err.message;
        document.getElementById('pay-err').style.display = 'block';
      }
    };
  },
};
