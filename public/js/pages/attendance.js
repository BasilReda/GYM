Pages = window.Pages || {};

Pages.attendance = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h2>${t('attendance.title')}</h2></div>

      <div class="att-checkin-grid" id="checkin-area">

        <!-- Manual ID check-in -->
        <div class="card">
          <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:1rem">${t('attendance.checkin_by_id')}</h3>
          <div style="display:flex;gap:0.5rem">
            <input id="checkin-code" placeholder="GDM-2026-0001" style="flex:1"
              autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false">
            <button class="btn btn-primary" onclick="Pages.attendance.doCheckin()">${t('attendance.btn.checkin')}</button>
          </div>
          <div id="checkin-result" style="margin-top:0.75rem"></div>
        </div>

        <!-- QR Camera scanner -->
        <div class="card" id="qr-scanner-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <h3 style="font-size:0.95rem;font-weight:600">${t('attendance.qr_scanner')}</h3>
            <div id="qr-cam-controls" style="display:none;gap:0.4rem;display:none">
              <button class="btn btn-sm btn-secondary" id="btn-flip-cam" onclick="Pages.attendance.flipCamera()" title="${t('attendance.flip_camera')}">🔄</button>
              <button class="btn btn-sm btn-danger" onclick="Pages.attendance.stopQrScanner()">${t('attendance.stop_camera')}</button>
            </div>
          </div>

          <div id="qr-idle">
            <button class="btn btn-primary btn-full" style="padding:0.85rem;font-size:0.95rem" onclick="Pages.attendance.startQrScanner()">
              📷 ${t('attendance.open_camera')}
            </button>
          </div>

          <!-- Scanner viewport -->
          <div id="qr-viewport" style="display:none;position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:1/1;max-height:320px">
            <video id="qr-video" style="width:100%;height:100%;object-fit:cover;display:block" playsinline autoplay muted></video>

            <!-- Viewfinder overlay -->
            <div class="qr-overlay">
              <div class="qr-finder">
                <span class="qr-corner tl"></span>
                <span class="qr-corner tr"></span>
                <span class="qr-corner bl"></span>
                <span class="qr-corner br"></span>
                <div class="qr-scanline"></div>
              </div>
            </div>

            <!-- Status label inside viewport -->
            <div id="qr-status-badge" class="qr-status-badge">
              <span class="qr-pulse"></span> ${t('attendance.scanning')}
            </div>
          </div>

          <div id="qr-result" style="margin-top:0.75rem"></div>
        </div>
      </div>

      <!-- Attendance Log -->
      <div class="page-header" style="margin-top:1.25rem">
        <h3 style="font-size:0.95rem;font-weight:600">${t('attendance.log')}</h3>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <input type="date" id="att-from" value="${new Date().toISOString().split('T')[0]}" style="width:auto">
          <input type="date" id="att-to" value="${new Date().toISOString().split('T')[0]}" style="width:auto">
          <button class="btn btn-secondary btn-sm" onclick="Pages.attendance.loadLog()">${t('attendance.filter')}</button>
        </div>
      </div>
      <div id="att-log"></div>
    `;

    document.getElementById('checkin-code').addEventListener('keydown', e => {
      if (e.key === 'Enter') Pages.attendance.doCheckin();
    });

    await this.loadLog();
  },

  // ─── Manual code check-in ──────────────────────────────────
  async doCheckin() {
    const code  = document.getElementById('checkin-code').value.trim();
    const resEl = document.getElementById('checkin-result');
    if (!code) {
      resEl.innerHTML = `<div class="alert alert-warning">${t('attendance.enter_id')}</div>`;
      return;
    }
    try {
      const r = await API.checkinByCode(code, 'staff');
      resEl.innerHTML = `<div class="alert alert-success">✅ ${t('member.checkin')}: <strong>${escHtml(r.member_name)}</strong></div>`;
      document.getElementById('checkin-code').value = '';
      await this.loadLog();
    } catch (err) {
      if (err.message.includes('Already checked')) {
        resEl.innerHTML = `<div class="alert alert-warning">⚠️ ${t('attendance.already_checked')}</div>`;
      } else {
        resEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
      }
    }
  },

  // ─── QR Scanner state ─────────────────────────────────────
  _stream:        null,
  _rafId:         null,
  _scanning:      false,
  _facingMode:    'environment',  // back camera by default
  _canvas:        null,
  _ctx:           null,

  async startQrScanner() {
    // Check jsQR loaded
    if (!window.jsQR) {
      document.getElementById('qr-result').innerHTML =
        `<div class="alert alert-error">jsQR library not loaded. Check your internet connection and reload.</div>`;
      return;
    }

    document.getElementById('qr-idle').style.display    = 'none';
    document.getElementById('qr-viewport').style.display = 'block';
    document.getElementById('qr-cam-controls').style.display = 'flex';
    document.getElementById('qr-result').innerHTML       = '';

    await this._startStream();
  },

  async _startStream() {
    // Stop any existing stream first
    this._stopStream();

    this._scanning = false;
    const statusEl = document.getElementById('qr-status-badge');
    if (statusEl) statusEl.innerHTML = `<span class="qr-pulse"></span> ${t('attendance.scanning')}`;

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this._facingMode },
          width:  { ideal: 1280 },
          height: { ideal: 1280 },
        }
      };
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      const video = document.getElementById('qr-video');
      if (!video) { this._stopStream(); return; }
      video.srcObject = this._stream;
      await video.play();

      if (!this._canvas) {
        this._canvas = document.createElement('canvas');
        this._ctx    = this._canvas.getContext('2d');
      }

      this._scanning = true;
      this._tick();
    } catch (err) {
      this._handleCameraError(err);
    }
  },

  _tick() {
    if (!this._scanning) return;
    const video = document.getElementById('qr-video');
    if (!video || !document.getElementById('qr-viewport')) { this._scanning = false; return; }

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const { videoWidth: w, videoHeight: h } = video;
      this._canvas.width  = w;
      this._canvas.height = h;
      this._ctx.drawImage(video, 0, 0, w, h);
      const imgData = this._ctx.getImageData(0, 0, w, h);
      const code    = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });

      if (code && code.data) {
        this._scanning = false;
        this._onCodeDetected(code.data);
        return;
      }
    }
    this._rafId = requestAnimationFrame(() => this._tick());
  },

  async _onCodeDetected(data) {
    // Flash the viewfinder green
    const vp = document.getElementById('qr-viewport');
    if (vp) vp.style.outline = '3px solid var(--success)';

    const statusEl = document.getElementById('qr-status-badge');
    if (statusEl) statusEl.innerHTML = `⏳ ${t('common.loading')}`;

    this.stopQrScanner();

    const resEl = document.getElementById('qr-result');
    resEl.innerHTML = `<div class="alert" style="background:var(--bg);border:1px solid var(--border)">${t('common.loading')}</div>`;

    try {
      const r = await API.qrCheckin(data);
      resEl.innerHTML = `
        <div class="alert alert-success" style="display:flex;align-items:center;gap:0.6rem">
          <span style="font-size:1.5rem">✅</span>
          <div>
            <div style="font-weight:600">${t('member.checkin')}: ${escHtml(r.member_name)}</div>
            <div style="font-size:0.78rem;opacity:0.75">${escHtml(r.member_code || data)}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-full" style="margin-top:0.5rem" onclick="Pages.attendance.resetScanner()">
          📷 ${t('attendance.scan_next')}
        </button>`;
      await this.loadLog();
    } catch (err) {
      const isAlready = err.message.includes('Already checked');
      resEl.innerHTML = `
        <div class="alert ${isAlready ? 'alert-warning' : 'alert-error'}">
          ${isAlready ? '⚠️ ' + t('attendance.already_checked') : '❌ ' + escHtml(err.message)}
        </div>
        <button class="btn btn-secondary btn-full" style="margin-top:0.5rem" onclick="Pages.attendance.resetScanner()">
          📷 ${t('attendance.scan_next')}
        </button>`;
    }
  },

  resetScanner() {
    document.getElementById('qr-result').innerHTML = '';
    this.startQrScanner();
  },

  async flipCamera() {
    this._facingMode = this._facingMode === 'environment' ? 'user' : 'environment';
    await this._startStream();
  },

  stopQrScanner() {
    this._scanning = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._stopStream();

    const vp   = document.getElementById('qr-viewport');
    const idle = document.getElementById('qr-idle');
    const ctrl = document.getElementById('qr-cam-controls');
    if (vp)   { vp.style.display = 'none'; vp.style.outline = ''; }
    if (idle) idle.style.display = 'block';
    if (ctrl) ctrl.style.display = 'none';
  },

  _stopStream() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    const video = document.getElementById('qr-video');
    if (video) { video.srcObject = null; }
  },

  _handleCameraError(err) {
    document.getElementById('qr-idle').style.display    = 'block';
    document.getElementById('qr-viewport').style.display = 'none';
    document.getElementById('qr-cam-controls').style.display = 'none';

    let msg = escHtml(err.message);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = t('attendance.camera_denied');
    } else if (err.name === 'NotFoundError') {
      msg = t('attendance.camera_not_found');
    }
    document.getElementById('qr-result').innerHTML =
      `<div class="alert alert-error" style="margin-top:0.5rem">📷 ${msg}</div>`;
  },

  // ─── Attendance log ────────────────────────────────────────
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
                    <td style="font-weight:500">${escHtml(r.member_name)}</td>
                    <td><code style="color:var(--accent);font-size:0.8rem">${escHtml(r.member_code)}</code></td>
                    <td>${fmtDateTime(r.check_in_time)}</td>
                    <td>${t('attendance.method.' + r.method) || r.method}</td>
                    <td>${escHtml(r.recorded_by_name || '—')}</td>
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
