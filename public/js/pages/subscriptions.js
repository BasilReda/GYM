Pages = window.Pages || {};

Pages.subscriptions = {
  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    await this.renderList(container);
  },

  async renderList(container) {
    const plans = await API.getPlans().catch(() => []);
    container.innerHTML = `
      <div class="page-header">
        <h2>${t('subscriptions.title')}</h2>
        ${App.hasRole('owner') ? `<button class="btn btn-primary" onclick="Pages.subscriptions.openAddModal()">${t('subscriptions.add')}</button>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">
        ${plans.length === 0
          ? `<div class="empty-state"><div class="empty-icon">🏷️</div><p>${t('subscriptions.no_records')}</p></div>`
          : plans.map(p => `
            <div class="card" style="border-left:3px solid ${p.is_active ? 'var(--accent)' : 'var(--border)'}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.75rem">
                <h3 style="font-size:1rem;color:var(--text);font-weight:600">${escHtml(p.name)}</h3>
                <span class="badge ${p.is_active ? 'badge-active' : 'badge-expired'}">${p.is_active ? t('subscriptions.active') : t('subscriptions.inactive')}</span>
              </div>
              <div style="font-size:1.8rem;font-weight:700;color:var(--gold);margin-bottom:0.25rem">${fmtCurrency(p.price)}</div>
              <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem">${p.duration_days} ${t('subscriptions.days')}</div>
              ${p.description ? `<div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(p.description)}</div>` : ''}
              ${App.hasRole('owner') ? `
                <div class="btn-group" style="margin-top:1rem">
                  <button class="btn btn-secondary btn-sm" onclick="Pages.subscriptions.openEditModal(${p.id})">${t('subscriptions.btn.edit')}</button>
                  <button class="btn btn-danger btn-sm" onclick="Pages.subscriptions.doDelete(${p.id})">${p.is_active ? t('subscriptions.btn.deactivate') : t('subscriptions.btn.delete')}</button>
                </div>` : ''}
            </div>
          `).join('')}
      </div>
    `;
  },

  openAddModal() {
    Modal.open(t('subscriptions.modal.add'), `
      <form id="plan-form">
        <div class="form-row">
          <div class="form-group"><label>${t('subscriptions.form.name')}</label><input name="name" required></div>
          <div class="form-group"><label>${t('subscriptions.form.duration')}</label><input name="duration_days" type="number" min="1" required placeholder="30"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('subscriptions.form.price')}</label><input name="price" type="number" min="0" step="0.01" required placeholder="200"></div>
        </div>
        <div class="form-group"><label>${t('subscriptions.form.description')}</label><textarea name="description" rows="2"></textarea></div>
        <div id="plan-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('subscriptions.modal.add')}</button>
        </div>
      </form>
    `);
    document.getElementById('plan-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await API.createPlan(Object.fromEntries(new FormData(e.target).entries()));
        Modal.close(); Toast.success(t('subscriptions.toast.created'));
        this.renderList(document.getElementById('page-content'));
      } catch (err) { document.getElementById('plan-err').textContent = err.message; document.getElementById('plan-err').style.display='block'; }
    };
  },

  async openEditModal(id) {
    const plans = await API.getPlans();
    const p = plans.find(x => x.id === id);
    if (!p) return;
    Modal.open(t('subscriptions.modal.edit'), `
      <form id="edit-plan-form">
        <div class="form-row">
          <div class="form-group"><label>${t('subscriptions.form.name')}</label><input name="name" required value="${escHtml(p.name)}"></div>
          <div class="form-group"><label>${t('subscriptions.form.duration')}</label><input name="duration_days" type="number" min="1" required value="${p.duration_days}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('subscriptions.form.price')}</label><input name="price" type="number" min="0" step="0.01" required value="${p.price}"></div>
          <div class="form-group"><label>${t('subscriptions.form.status')}</label>
            <select name="is_active">
              <option value="1" ${p.is_active?'selected':''}>${t('subscriptions.active')}</option>
              <option value="0" ${!p.is_active?'selected':''}>${t('subscriptions.inactive')}</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>${t('subscriptions.form.description')}</label><textarea name="description" rows="2">${escHtml(p.description||'')}</textarea></div>
        <div id="edit-plan-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('common.save')}</button>
        </div>
      </form>
    `);
    document.getElementById('edit-plan-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await API.updatePlan(id, Object.fromEntries(new FormData(e.target).entries()));
        Modal.close(); Toast.success(t('subscriptions.toast.updated'));
        this.renderList(document.getElementById('page-content'));
      } catch (err) { document.getElementById('edit-plan-err').textContent = err.message; document.getElementById('edit-plan-err').style.display='block'; }
    };
  },

  async doDelete(id) {
    if (!confirm(t('subscriptions.confirm.deactivate'))) return;
    try { await API.deletePlan(id); Toast.success(t('subscriptions.toast.deactivated')); this.renderList(document.getElementById('page-content')); }
    catch (err) { Toast.error(err.message); }
  }
};
