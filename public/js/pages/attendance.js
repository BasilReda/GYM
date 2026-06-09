Pages = window.Pages || {};

Pages.attendance = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h2>${t('attendance.title')}</h2></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem" id="checkin-area">
        <div class="card">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:1rem">${t('attendance.checkin_by_id')}</h3>
          <div style="display:flex;gap:0.5rem">
            <input id="checkin-code" placeholder="GDM-2026-0001" style="flex:1">
            <button class="btn btn-primary" onclick="Pages.attendance.doCheckin()">${t('attendance.btn.checkin')}</button>
          </div>
          <div id="checkin-result" style="margin-top:0.75rem"></div>
        </div>
        <div class="card">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:1rem">${t('attendance.qr_scanner')}</h3>
          <div id="qr-scanner-area">
            <button class="btn btn-secondary btn-full" onclick="Pages.attendance.startQrScanner()">${t('attendance.open_camera')}</button>
            <div id="qr-reader" style="margin-top:0.75rem;display:none"></div>
            <div id="qr-result" style="margin-top:0.75rem"></div>
          </div>
        </div>
      </div>
      <div class="page-header" style="margin-top:0.5rem">
        <h3 style="font-size:1rem;font-weight:600">${t('attendance.log')}</h3>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <input type="date" id="att-from" value="${new Date().toISOString().split('T')[0]}" style="width:auto">
          <input type="date" id="att-to" value="${new Date().toISOString().split('T')[0]}" style="width:auto">
          <button class="btn btn-secondary btn-sm" onclick="Pages.attendance.loadLog()">${t('attendance.filter')}</button>
        </div>
      </div>
      <div id="att-log"></div>
    `;
    document.getElementById('checkin-code').addEventListener('keydown', e => { if (e.key === 'Enter') Pages.attendance.doCheckin(); });
    await this.loadLog();
  },

  async doCheckin() {
    const code = document.getElementById('checkin-code').value.trim();
    const res = document.getElementById('checkin-result');
    if (!code) { res.innerHTML = `<div class="alert alert-warning">${t('attendance.enter_id')}</div>`; return; }
    try {
      const r = await API.checkinByCode(code, 'staff');
      res.innerHTML = `<div class="alert alert-success">✅ ${t('member.checkin')}: <strong>${escHtml(r.member_name)}</strong></div>`;
      document.getElementById('checkin-code').value = '';
      await this.loadLog();
    } catch (err) {
      if (err.message.includes('Already checked')) {
        res.innerHTML = `<div class="alert alert-warning">⚠️ ${t('attendance.already_checked')}</div>`;
      } else {
        res.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
      }
    }
  },

  scanStream: null,

  async startQrScanner() {
    const area = document.getElementById('qr-reader');
    area.style.display = 'block';
    area.innerHTML = `
      <video id="qr-video" style="width:100%;border-radius:8px;border:2px solid var(--border)" playsinline autoplay></video>
      <div style="margin-top:0.5rem">
        <button class="btn btn-danger btn-sm" onclick="Pages.attendance.stopQrScanner()">${t('attendance.stop_camera')}</button>
      </div>
    `;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.scanStream = stream;
      const video = document.getElementById('qr-video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let scanning = true;
      const tick = () => {
        if (!scanning || !document.getElementById('qr-video')) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          if (window.jsQR) {
            const code = jsQR(imgData.data, imgData.width, imgData.height);
            if (code && code.data) { scanning = false; this.stopQrScanner(); this.processQrData(code.data); return; }
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (err) {
      area.innerHTML = `<div class="alert alert-error">${t('attendance.stop_camera')}: ${escHtml(err.message)}</div>`;
    }
  },

  stopQrScanner() {
    if (this.scanStream) { this.scanStream.getTracks().forEach(t => t.stop()); this.scanStream = null; }
    const area = document.getElementById('qr-reader');
    if (area) { area.style.display = 'none'; area.innerHTML = ''; }
  },

  async processQrData(data) {
    const res = document.getElementById('qr-result');
    try {
      const r = await API.qrCheckin(data);
      res.innerHTML = `<div class="alert alert-success">✅ ${t('member.checkin')}: <strong>${escHtml(r.member_name)}</strong></div>`;
      await this.loadLog();
    } catch (err) {
      res.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
    }
  },

  async loadLog() {
    const logEl = document.getElementById('att-log');
    if (!logEl) return;
    const from = document.getElementById('att-from')?.value;
    const to   = document.getElementById('att-to')?.value;
    let qs = '?';
    if (from) qs += `from=${from}&`;
    if (to)   qs += `to=${to}&`;
    try {
      const rows = await API.getAttendance(qs);
      logEl.innerHTML = rows.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📋</div><p>${t('attendance.no_records')}</p></div>`
        : `<div class="table-wrap">
            <table>
              <thead><tr>
                <th>${t('attendance.col.member')}</th>
                <th>${t('attendance.col.id')}</th>
                <th>${t('attendance.col.time')}</th>
                <th>${t('attendance.col.method')}</th>
                <th>${t('attendance.col.by')}</th>
              </tr></thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td style="font-weight:500;color:var(--text)">${escHtml(r.member_name)}</td>
                    <td><code style="color:var(--accent);font-size:0.8rem">${escHtml(r.member_code)}</code></td>
                    <td>${fmtDateTime(r.check_in_time)}</td>
                    <td>${t('attendance.method.'+r.method)||r.method}</td>
                    <td>${escHtml(r.recorded_by_name||'—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
    } catch (err) {
      logEl.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    }
  }
};
