// ─── TOAST ───
const Toast = {
  show(msg, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), duration);
  },
  success: (m) => Toast.show(m, 'success'),
  error: (m) => Toast.show(m, 'error'),
  info: (m) => Toast.show(m, 'info'),
};

// ─── MODAL ───
const Modal = {
  open(title, bodyHtml, onOpen) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').style.display = 'flex';
    if (onOpen) setTimeout(onOpen, 50);
  },
  close() { document.getElementById('modal-overlay').style.display = 'none'; },
  setBody(html) { document.getElementById('modal-body').innerHTML = html; },
};

// ─── MAIN APP ───
const App = {
  user: null,
  lang: 'en',
  currentPage: null,

  // Bottom nav items per role (max 5 for bottom nav)
  _navDef: {
    member: [
      { key: 'my-membership', icon: '🏅', label: 'nav.my_membership' },
    ],
    owner: [
      { key: 'dashboard',     icon: '📊', label: 'nav.dashboard' },
      { key: 'members',       icon: '👥', label: 'nav.members' },
      { key: 'payments',      icon: '💳', label: 'nav.payments' },
      { key: 'classes',       icon: '📅', label: 'nav.classes' },
      { key: 'users',         icon: '⚙️', label: 'nav.users' },
    ],
    manager: [
      { key: 'dashboard',  icon: '📊', label: 'nav.dashboard' },
      { key: 'members',    icon: '👥', label: 'nav.members' },
      { key: 'attendance', icon: '✅', label: 'nav.attendance' },
      { key: 'payments',   icon: '💳', label: 'nav.payments' },
      { key: 'classes',    icon: '📅', label: 'nav.classes' },
    ],
    reception: [
      { key: 'dashboard',  icon: '📊', label: 'nav.dashboard' },
      { key: 'members',    icon: '👥', label: 'nav.members' },
      { key: 'attendance', icon: '✅', label: 'nav.attendance' },
      { key: 'payments',   icon: '💳', label: 'nav.payments' },
    ],
    trainer: [
      { key: 'attendance', icon: '✅', label: 'nav.attendance' },
      { key: 'classes',    icon: '📅', label: 'nav.classes' },
    ],
  },

  async init() {
    // Auto-login via QR code URL param ?al=base64(email:password)
    const params = new URLSearchParams(window.location.search);
    const al = params.get('al');
    if (al) {
      try {
        const [email, password] = atob(al).split(':');
        const res = await API.login(email, password);
        API.setToken(res.token);
        localStorage.setItem('gd_user', JSON.stringify(res.user));
        this.user = res.user;
        this.lang = res.user.language || 'en';
        this.applyLang(this.lang, false);
        // Clean URL without reloading
        window.history.replaceState({}, '', window.location.pathname);
        this.showApp();
        const startPage = res.user.role === 'member' ? 'my-membership' : 'dashboard';
        this.navigate(startPage);
        return;
      } catch { /* fall through to normal login */ }
    }

    const token = API.getToken();
    if (!token) { this.showLogin(); return; }
    try {
      this.user = JSON.parse(localStorage.getItem('gd_user') || 'null') || await API.me();
      this.lang = this.user.language || 'en';
      this.applyLang(this.lang, false);
      this.showApp();
      const startPage = this.user.role === 'member' ? 'my-membership' : 'dashboard';
      this.navigate(startPage);
    } catch {
      API.clearToken();
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';
    this.applyLang(this.lang, false);
    document.getElementById('login-form').onsubmit = (e) => this.doLogin(e);
  },

  async doLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    btn.disabled = true;
    btn.textContent = '…';
    errEl.style.display = 'none';
    try {
      const res = await API.login(email, password);
      API.setToken(res.token);
      localStorage.setItem('gd_user', JSON.stringify(res.user));
      this.user = res.user;
      this.lang = res.user.language || 'en';
      this.applyLang(this.lang, false);
      document.getElementById('login-page').style.display = 'none';
      this.showApp();
      const startPage = res.user.role === 'member' ? 'my-membership' : 'dashboard';
      this.navigate(startPage);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span data-i18n="login.signin">${t('login.signin')}</span>`;
    }
  },

  showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this.buildNav();
    this.buildBottomNav();
    const u = this.user;
    document.getElementById('user-avatar').textContent = (u.name || 'U')[0].toUpperCase();
    document.getElementById('user-info-sidebar').innerHTML =
      `<strong>${u.name}</strong><span style="text-transform:capitalize">${u.role}</span>`;
    // Populate avatar dropdown
    const menuName = document.getElementById('user-menu-name');
    const menuRole = document.getElementById('user-menu-role');
    if (menuName) menuName.textContent = u.name;
    if (menuRole) menuRole.textContent = u.role;
    this.updateLangButtons();
    // Show QR share button only for staff (not members)
    const shareBtn = document.getElementById('btn-share-qr');
    if (shareBtn) shareBtn.style.display = u.role !== 'member' ? 'inline-flex' : 'none';
  },

  buildNav() {
    const role = this.user?.role || 'reception';
    const signOutBtn = `
      <div style="margin-top:auto;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.12);margin-top:auto">
        <button class="nav-item" onclick="App.logout()"
          style="color:#ff8080;background:rgba(255,80,80,0.1);border-radius:8px;font-weight:600">
          <span class="nav-icon">🚪</span>
          <span>${t('nav.logout')}</span>
        </button>
      </div>`;

    if (role === 'member') {
      document.getElementById('sidebar-nav').innerHTML = `
        <button class="nav-item" data-page="my-membership" onclick="App.navigate('my-membership')">
          <span class="nav-icon">🏅</span><span data-i18n="nav.my_membership">${t('nav.my_membership')}</span>
        </button>
        ${signOutBtn}
      `;
      return;
    }

    const all = [
      { key: 'dashboard',     icon: '📊', label: 'nav.dashboard',     roles: ['owner','manager','reception'] },
      { key: 'members',       icon: '👥', label: 'nav.members',       roles: ['owner','manager','reception'] },
      { key: 'attendance',    icon: '✅', label: 'nav.attendance',    roles: ['owner','manager','reception','trainer'] },
      { key: 'payments',      icon: '💳', label: 'nav.payments',      roles: ['owner','manager','reception'] },
      { key: 'trainers',      icon: '🏋️', label: 'nav.trainers',      roles: ['owner','manager'] },
      { key: 'classes',       icon: '📅', label: 'nav.classes',       roles: ['owner','manager','trainer'] },
      { key: 'subscriptions', icon: '🏷️', label: 'nav.subscriptions', roles: ['owner'] },
      { key: 'users',         icon: '⚙️', label: 'nav.users',         roles: ['owner','manager'] },
    ];
    const items = all.filter(i => i.roles.includes(role));
    document.getElementById('sidebar-nav').innerHTML = items.map(i => `
      <button class="nav-item" data-page="${i.key}" onclick="App.navigate('${i.key}')">
        <span class="nav-icon">${i.icon}</span>
        <span data-i18n="${i.label}">${t(i.label)}</span>
      </button>
    `).join('') + signOutBtn;
  },

  buildBottomNav() {
    const role = this.user?.role || 'reception';
    const items = this._navDef[role] || this._navDef.reception;
    const bnEl = document.getElementById('bottom-nav');
    const bnInner = document.getElementById('bottom-nav-inner');

    bnInner.innerHTML = items.map(i => `
      <button class="bn-item" data-page="${i.key}" onclick="App.navigate('${i.key}')" title="${t(i.label)}">
        <span class="bn-icon">${i.icon}</span>
        <span class="bn-label">${t(i.label)}</span>
      </button>
    `).join('');

    // Bottom nav only shows on mobile
    bnEl.style.display = '';  // CSS controls visibility via media query
  },

  navigate(page) {
    this.currentPage = page;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Update bottom nav active state
    document.querySelectorAll('.bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const titles = {
      dashboard: t('nav.dashboard'), members: t('nav.members'),
      attendance: t('nav.attendance'), payments: t('nav.payments'),
      trainers: t('nav.trainers'), classes: t('nav.classes'),
      subscriptions: t('nav.subscriptions'), users: t('nav.users'),
      'my-membership': t('nav.my_membership'),
    };
    document.getElementById('topbar-title').textContent = titles[page] || page;

    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    const pages = {
      dashboard:     Pages.dashboard,
      members:       Pages.members,
      attendance:    Pages.attendance,
      payments:      Pages.payments,
      trainers:      Pages.trainers,
      classes:       Pages.classes,
      subscriptions: Pages.subscriptions,
      users:         Pages.users,
      'my-membership': Pages.memberPortal,
    };
    if (pages[page]) pages[page].render(content);

    // Close sidebar on navigation (mobile)
    if (window.innerWidth <= 768) {
      this._closeSidebar();
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      this._closeSidebar();
    } else {
      sidebar.classList.add('open');
      backdrop.classList.add('visible');
      // Prevent body scroll when sidebar open
      document.body.style.overflow = 'hidden';
    }
  },

  _closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.classList.remove('visible');
    document.body.style.overflow = '';
  },

  async setLang(lang) {
    this.lang = lang;
    this.applyLang(lang, true);
    if (this.user) {
      try { await API.setLanguage(lang); } catch {}
      this.user.language = lang;
      localStorage.setItem('gd_user', JSON.stringify(this.user));
    }
  },

  applyLang(lang, rebuild = true) {
    window._lang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    applyTranslations();
    this.updateLangButtons();
    if (rebuild && this.user) {
      this.buildNav();
      this.buildBottomNav();
      this.navigate(this.currentPage);
    }
  },

  updateLangButtons() {
    ['en','ar'].forEach(l => {
      document.querySelectorAll(`#lang-${l}, #app-lang-${l}`).forEach(el => {
        el.classList.toggle('active', this.lang === l);
      });
    });
  },

  openShareModal() {
    const base        = window.location.origin;
    const token       = btoa('reception@gymdesk.com:Reception@123');
    const qrUrl       = `${base}/?al=${token}`;
    const safeQrUrl   = qrUrl.replace(/'/g, '');

    Modal.open('📱 Open GYMAWY on your phone', `
      <div style="text-align:center;padding:0.5rem 0">

        <div id="share-qr-box" style="display:inline-block;padding:14px;background:#fff;border-radius:12px;border:1px solid var(--border);margin-bottom:0.75rem"></div>

        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem">
          Scan to open GYMAWY — logs in as Reception automatically
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">
          <code style="background:var(--bg);padding:0.4rem 0.75rem;border-radius:6px;font-size:0.8rem;border:1px solid var(--border);word-break:break-all">${base}</code>
          <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard?.writeText('${safeQrUrl}').then(()=>Toast.success('Copied!'))">📋</button>
        </div>


      </div>
    `, () => {
      const el = document.getElementById('share-qr-box');
      if (el && window.QRCode) {
        new QRCode(el, {
          text: qrUrl,
          width:      200,
          height:     200,
          colorDark:  '#1a2332',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    });
  },

  toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (!menu) return;
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
      menu.classList.remove('open');
    } else {
      menu.classList.add('open');
      // Close when clicking anywhere outside
      setTimeout(() => {
        const close = (e) => {
          if (!menu.contains(e.target) && e.target.id !== 'user-avatar') {
            menu.classList.remove('open');
            document.removeEventListener('click', close);
          }
        };
        document.addEventListener('click', close);
      }, 10);
    }
  },

  logout() {
    API.clearToken();
    localStorage.removeItem('gd_user');
    this.user = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('user-menu')?.classList.remove('open');
    this._closeSidebar();
  },

  hasRole(...roles) { return roles.includes(this.user?.role); },
};

// ─── UTILITY HELPERS ───
function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(d) { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString(); }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString(); }
function fmtCurrency(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' EGP'; }
function statusBadge(s) {
  const map = { active: 'badge-active', expiring_soon: 'badge-expiring', expired: 'badge-expired', suspended: 'badge-suspended' };
  const label = t(`member.status.${s}`) || s;
  return `<span class="badge ${map[s] || ''}">${escHtml(label)}</span>`;
}
function roleBadge(r) { return `<span class="badge badge-${r}">${r}</span>`; }

// ─── START ───
window.addEventListener('DOMContentLoaded', () => App.init());
