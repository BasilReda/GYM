Pages = window.Pages || {};

Pages.classes = {
  trainers: [],
  classTypes: [],

  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      [this.trainers, this.classTypes] = await Promise.all([API.getTrainers(), API.getClassTypes()]);
      await this.renderWeek(container);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    }
  },

  async renderWeek(container, weekOffset = 0) {
    const today  = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
    });
    const from = days[0].toISOString().split('T')[0];
    const to   = days[6].toISOString().split('T')[0];
    const sessions = await API.getSessions(`?from=${from}&to=${to}`);

    const lang = window._lang || 'en';
    const dayNames = lang === 'ar'
      ? ['الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد']
      : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const canManage = App.hasRole('owner','manager');

    container.innerHTML = `
      <div class="page-header">
        <h2>${t('classes.title')}</h2>
        <div class="btn-group">
          ${canManage ? `<button class="btn btn-secondary btn-sm" onclick="Pages.classes.openClassTypeModal()">${t('classes.add_type')}</button>` : ''}
          ${canManage ? `<button class="btn btn-primary" onclick="Pages.classes.openAddSessionModal()">${t('classes.schedule_btn')}</button>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
        <button class="btn btn-secondary btn-sm" onclick="Pages.classes.renderWeek(document.getElementById('page-content'), ${weekOffset - 1})">◀</button>
        <span style="font-size:0.9rem;color:var(--text-muted)">${t('classes.week_of')} ${days[0].toLocaleDateString()} — ${days[6].toLocaleDateString()}</span>
        <button class="btn btn-secondary btn-sm" onclick="Pages.classes.renderWeek(document.getElementById('page-content'), ${weekOffset + 1})">▶</button>
        <button class="btn btn-ghost btn-sm" onclick="Pages.classes.renderWeek(document.getElementById('page-content'), 0)">${t('classes.today')}</button>
      </div>
      <div class="week-grid">
        ${days.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0];
          const daySessions = sessions.filter(s => s.session_date === dateStr);
          const isToday = dateStr === today.toISOString().split('T')[0];
          return `
            <div class="day-col" style="${isToday ? 'border-color:var(--accent)' : ''}">
              <h4 style="${isToday ? 'color:var(--accent)' : ''}">${dayNames[i]}<br><span style="font-size:0.65rem">${dateStr}</span></h4>
              ${daySessions.length === 0
                ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">—</div>'
                : daySessions.map(s => `
                  <div class="session-pill ${s.status==='cancelled'?'cancelled':''}" onclick="Pages.classes.viewSession(${s.id})">
                    <div class="sp-time">${s.start_time} – ${s.end_time}</div>
                    <div class="sp-name">${escHtml(s.class_name)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">${escHtml(s.trainer_name || t('classes.unassigned'))}</div>
                  </div>
                `).join('')}
            </div>
          `;
        }).join('')}
      </div>
      <div class="page-header" style="margin-top:0.5rem"><h3 style="font-size:0.95rem;color:var(--text-muted)">${t('classes.types_title')}</h3></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem">
        ${this.classTypes.map(ct => `
          <div class="card" style="padding:1rem">
            <div style="font-weight:600;margin-bottom:0.25rem;color:var(--text)">${escHtml(ct.name)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${ct.duration_minutes}min · Max ${ct.capacity}</div>
            ${ct.description ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">${escHtml(ct.description)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  async viewSession(id) {
    try {
      const sessions = await API.getSessions();
      const session = sessions.find(s => s.id === id);
      if (!session) return;
      const attendance = await API.getSessionAttendance(id);
      Modal.open(`📅 ${session.class_name} — ${session.session_date}`, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;font-size:0.87rem">
          ${[
            [t('classes.col.time'), `${session.start_time} – ${session.end_time}`],
            [t('classes.col.trainer'), session.trainer_name || t('classes.unassigned')],
            [t('classes.col.room'), session.room || '—'],
            [t('classes.col.status'), session.status]
          ].map(([k,v]) => `<div style="background:var(--bg);border-radius:8px;padding:0.5rem;border:1px solid var(--border)"><div style="color:var(--text-muted);font-size:0.72rem">${k}</div><div>${escHtml(v)}</div></div>`).join('')}
        </div>
        <h4 style="font-size:0.9rem;margin-bottom:0.75rem">${t('classes.attendees')} (${attendance.length})</h4>
        ${attendance.length === 0
          ? `<div class="empty-state" style="padding:1rem"><p>${t('classes.no_attendance')}</p></div>`
          : `<div class="table-wrap"><table><thead><tr><th>${t('common.name')}</th><th>${t('common.status')}</th></tr></thead><tbody>
             ${attendance.map(a=>`<tr><td>${escHtml(a.member_name)}</td><td><span class="badge ${a.status==='present'?'badge-active':a.status==='late'?'badge-expiring':'badge-expired'}">${a.status}</span></td></tr>`).join('')}
             </tbody></table></div>`}
        ${App.hasRole('owner','manager','trainer') && session.status !== 'cancelled' ? `
          <div class="modal-footer">
            ${App.hasRole('owner','manager') ? `<button class="btn btn-danger btn-sm" onclick="Pages.classes.doCancel(${id})">${t('classes.btn.cancel')}</button>` : ''}
            <button class="btn btn-primary btn-sm" onclick="Pages.classes.openMarkAttendanceModal(${id})">${t('classes.btn.mark')}</button>
          </div>` : ''}
      `);
    } catch (err) { Toast.error(err.message); }
  },

  async doCancel(id) {
    if (!confirm(t('classes.confirm.cancel'))) return;
    try { await API.cancelSession(id); Modal.close(); Toast.success(t('classes.toast.cancelled')); this.renderWeek(document.getElementById('page-content')); }
    catch (err) { Toast.error(err.message); }
  },

  async openMarkAttendanceModal(sessionId) {
    const members = await API.getMembers().catch(() => []);
    Modal.open(t('classes.modal.mark'), `
      <form id="att-form">
        <div class="form-row">
          <div class="form-group"><label>${t('classes.form.member')}</label>
            <select name="member_id" required><option value="">${t('common.select')}</option>
            ${members.map(m=>`<option value="${m.id}">${escHtml(m.name)} (${m.member_code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>${t('classes.form.att_status')}</label>
            <select name="status">
              <option value="present">${t('classes.form.present')}</option>
              <option value="absent">${t('classes.form.absent')}</option>
              <option value="late">${t('classes.form.late')}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.close')}</button>
          <button type="submit" class="btn btn-primary">${t('classes.form.mark_btn')}</button>
        </div>
      </form>
    `);
    document.getElementById('att-form').onsubmit = async (e) => {
      e.preventDefault();
      try { await API.markClassAttendance(sessionId, Object.fromEntries(new FormData(e.target).entries())); Toast.success(t('classes.toast.marked')); }
      catch (err) { Toast.error(err.message); }
    };
  },

  openAddSessionModal() {
    const classOpts   = this.classTypes.map(ct => `<option value="${ct.id}">${escHtml(ct.name)}</option>`).join('');
    const trainerOpts = this.trainers.map(tr => `<option value="${tr.id}">${escHtml(tr.name)}</option>`).join('');
    Modal.open(t('classes.modal.session'), `
      <form id="session-form">
        <div class="form-row">
          <div class="form-group"><label>${t('classes.form.class_type')}</label>
            <select name="class_type_id" required><option value="">${t('common.select')}</option>${classOpts}</select>
          </div>
          <div class="form-group"><label>${t('classes.form.trainer')}</label>
            <select name="trainer_id"><option value="">${t('classes.unassigned')}</option>${trainerOpts}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('classes.form.date')}</label><input name="session_date" type="date" required value="${new Date().toISOString().split('T')[0]}"></div>
          <div class="form-group"><label>${t('classes.form.room')}</label><input name="room" placeholder="Studio A"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>${t('classes.form.start')}</label><input name="start_time" type="time" required value="07:00"></div>
          <div class="form-group"><label>${t('classes.form.end')}</label><input name="end_time" type="time" required value="08:00"></div>
        </div>
        <div id="sess-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('classes.form.schedule_btn')}</button>
        </div>
      </form>
    `);
    document.getElementById('session-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.trainer_id) delete data.trainer_id;
      try {
        await API.createSession(data);
        Modal.close(); Toast.success(t('classes.toast.scheduled'));
        this.renderWeek(document.getElementById('page-content'));
      } catch (err) { document.getElementById('sess-err').textContent = err.message; document.getElementById('sess-err').style.display='block'; }
    };
  },

  openClassTypeModal() {
    const trainerOpts = this.trainers.map(tr => `<option value="${tr.id}">${escHtml(tr.name)}</option>`).join('');
    Modal.open(t('classes.modal.type'), `
      <form id="ct-form">
        <div class="form-group"><label>${t('common.name')} *</label><input name="name" required placeholder="CrossFit, Yoga…"></div>
        <div class="form-row">
          <div class="form-group"><label>${t('classes.form.capacity')}</label><input name="capacity" type="number" value="20" min="1"></div>
          <div class="form-group"><label>${t('classes.form.duration_min')}</label><input name="duration_minutes" type="number" value="60" min="10"></div>
        </div>
        <div class="form-group"><label>${t('classes.form.default_trainer')}</label>
          <select name="default_trainer_id"><option value="">${t('common.none')}</option>${trainerOpts}</select>
        </div>
        <div class="form-group"><label>${t('classes.form.description')}</label><textarea name="description" rows="2"></textarea></div>
        <div id="ct-err" class="alert alert-error" style="display:none"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-primary">${t('common.add')}</button>
        </div>
      </form>
    `);
    document.getElementById('ct-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.default_trainer_id) delete data.default_trainer_id;
      try {
        await API.createClassType(data);
        Modal.close(); Toast.success(t('classes.toast.type_added'));
        this.classTypes = await API.getClassTypes();
        this.renderWeek(document.getElementById('page-content'));
      } catch (err) { document.getElementById('ct-err').textContent = err.message; document.getElementById('ct-err').style.display='block'; }
    };
  }
};
