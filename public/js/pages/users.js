Pages = window.Pages || {};

Pages.users = {
  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try { await this.renderList(container); }
    catch (err) { container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`; }
  },

  async renderList(container) {
    const users = await API.getUsers().catch(() => []);
    container.innerHTML = `
      <div class="page-header">
        <h2>${t('users.title')}</h2>
        ${App.hasRole('owner') ? `<button class="btn btn-primary" onclick="Pages.users.openAddModal()">${t('users.add')}</button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${t('users.col.name')}</th>
              <th>${t('users.col.email')}</th>
              <th>${t('users.col.role')}</th>
              <th>${t('users.col.status')}</th>
              <th>${t('users.col.created')}</th>
              ${App.hasRole('owner') ? `<th>${t('users.col.actions')}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${users.length === 0
              ? `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">${t('users.no_records')}</td></tr>`
              : users.map(u => `
                <tr>
                  <td style="font-weight:500;color:var(--text)">${escHtml(u.name)}</td>
                  <td style="font-size:0.85rem">${escHtml(u.email)}</td>
                  <td>${roleBadge(u.role)}</td>
                  <td><span class="badge ${u.is_active ? 'badge-active' : 'badge-expired'}">${u.is_active ? t('common.active') : t('common.inactive')}</span></td>
                  <td style="font-size:0.8rem">${fmtDate(u.created_at)}</td>
                  ${App.hasRole('owner') ? `<td><button class="btn btn-secondary btn-sm" onclick="Pages.users.toggleUser(${u.id}, ${u.is_active})">${u.is_active ? t('users.btn.deactivate') : t('users.btn.activate')}</button></td>` : ''}
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async toggleUser(id, isActive) {
    if (id === App.user.id) { Toast.error(t('users.toast.self_deactivate')); return; }
    const msg = isActive ? t('users.confirm.deactivate') : t('users.confirm.activate');
    if (!confirm(msg)) return;
    try {
      await API.toggleUser(id);
      Toast.success(isActive ? t('users.toast.deactivated') : t('users.toast.activated'));
      this.renderList(document.getElementById('page-content'));
    } catch (err) { Toast.error(err.message); }
  },

  openAddModal() {
    Modal.open(t('users.modal.add'), `
      <form id="user-form">
        <div class="form-group"><label>${t('users.form.name')}</label><input name="name" required placeholder="Ahmed Hassan"></div>
        <div class="form-group"><label>${t('users.form.email')}</label><input name="email" type="email" required placeholder="staff@gymdesk.com"></div>
        <div class="form-row">
          <div class="form-group"><label>${t('users.form.password')}</label><input name="password" type="password" required minlength="8" placeholder="${t('users.form.pw_hint')}"></div>
          <div class="form-group"><label>${t('users.form.role')}</label>
            <select name="role" required>
              <option value="reception">${t('users.role.reception')}</option>
              <option value="trainer">${t('users.role.trainer')}</option>
              <option value="manager">${t('users.role.manager')}</option>
              ${App.user.role === 'owner' ? `<option value="owner">${t('users.role.owner')}</option>` : ''}
            </select>
          </div>
        </div>
        <div id="user-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('users.form.create_btn')}</button>
        </div>
      </form>
    `);
    document.getElementById('user-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      try {
        await API.createUser(data);
        Modal.close(); Toast.success(t('users.toast.created'));
        this.renderList(document.getElementById('page-content'));
      } catch (err) { document.getElementById('user-err').textContent = err.message; document.getElementById('user-err').style.display='block'; }
    };
  }
};
