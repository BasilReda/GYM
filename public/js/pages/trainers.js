Pages = window.Pages || {};

Pages.trainers = {
  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try { await this.renderList(container); }
    catch (err) { container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`; }
  },

  async renderList(container) {
    const trainers = await API.getTrainers();
    container.innerHTML = `
      <div class="page-header">
        <h2>${t('trainers.title')}</h2>
        ${App.hasRole('owner','manager') ? `<button class="btn btn-primary" onclick="Pages.trainers.openAddModal()">${t('trainers.add')}</button>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">
        ${trainers.length === 0
          ? `<div class="empty-state"><div class="empty-icon">🏋️</div><p>${t('trainers.no_records')}</p></div>`
          : trainers.map(tr => `
            <div class="card">
              <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
                <div class="profile-avatar" style="width:46px;height:46px;font-size:1.2rem">${(tr.name||'?')[0].toUpperCase()}</div>
                <div>
                  <div style="font-weight:600;color:var(--text)">${escHtml(tr.name)}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(tr.specialization || t('trainers.general'))}</div>
                </div>
              </div>
              ${tr.phone ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.25rem">📞 ${escHtml(tr.phone)}</div>` : ''}
              ${tr.email ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.25rem">✉️ ${escHtml(tr.email)}</div>` : ''}
              ${tr.bio ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;font-style:italic">${escHtml(tr.bio)}</div>` : ''}
              ${App.hasRole('owner','manager') ? `
                <div class="btn-group" style="margin-top:1rem">
                  <button class="btn btn-secondary btn-sm" onclick="Pages.trainers.openEditModal(${tr.id})">${t('trainers.btn.edit')}</button>
                  <button class="btn btn-danger btn-sm" onclick="Pages.trainers.doDelete(${tr.id})">${t('trainers.btn.remove')}</button>
                </div>` : ''}
            </div>
          `).join('')}
      </div>
    `;
  },

  openAddModal() {
    Modal.open(t('trainers.modal.add'), `
      <form id="trainer-form">
        <div class="form-row">
          <div class="form-group"><label>${t('trainers.form.name')}</label><input name="name" required></div>
          <div class="form-group"><label>${t('trainers.form.specialization')}</label><input name="specialization" placeholder="CrossFit, Yoga…"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('trainers.form.phone')}</label><input name="phone"></div>
          <div class="form-group"><label>${t('trainers.form.email')}</label><input name="email" type="email"></div>
        </div>
        <div class="form-group"><label>${t('trainers.form.bio')}</label><textarea name="bio" rows="2"></textarea></div>
        <div id="tr-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('trainers.modal.add')}</button>
        </div>
      </form>
    `);
    document.getElementById('trainer-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await API.createTrainer(Object.fromEntries(new FormData(e.target).entries()));
        Modal.close(); Toast.success(t('trainers.toast.added'));
        this.renderList(document.getElementById('page-content'));
      } catch (err) { document.getElementById('tr-err').textContent = err.message; document.getElementById('tr-err').style.display='block'; }
    };
  },

  async openEditModal(id) {
    const tr = await API.getTrainers().then(ts => ts.find(x => x.id === id));
    if (!tr) return;
    Modal.open(t('trainers.modal.edit'), `
      <form id="edit-tr-form">
        <div class="form-row">
          <div class="form-group"><label>${t('trainers.form.name')}</label><input name="name" required value="${escHtml(tr.name)}"></div>
          <div class="form-group"><label>${t('trainers.form.specialization')}</label><input name="specialization" value="${escHtml(tr.specialization||'')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('trainers.form.phone')}</label><input name="phone" value="${escHtml(tr.phone||'')}"></div>
          <div class="form-group"><label>${t('trainers.form.email')}</label><input name="email" value="${escHtml(tr.email||'')}"></div>
        </div>
        <div class="form-group"><label>${t('trainers.form.bio')}</label><textarea name="bio" rows="2">${escHtml(tr.bio||'')}</textarea></div>
        <div id="edit-tr-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('common.save')}</button>
        </div>
      </form>
    `);
    document.getElementById('edit-tr-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await API.updateTrainer(id, Object.fromEntries(new FormData(e.target).entries()));
        Modal.close(); Toast.success(t('trainers.toast.updated'));
        this.renderList(document.getElementById('page-content'));
      } catch (err) { document.getElementById('edit-tr-err').textContent = err.message; document.getElementById('edit-tr-err').style.display='block'; }
    };
  },

  async doDelete(id) {
    if (!confirm(t('trainers.confirm.remove'))) return;
    try { await API.deleteTrainer(id); Toast.success(t('trainers.toast.removed')); this.renderList(document.getElementById('page-content')); }
    catch (err) { Toast.error(err.message); }
  }
};
