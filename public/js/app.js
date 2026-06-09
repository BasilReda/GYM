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

  async init() {
    const token = API.getToken();
    if (!token) { this.showLogin(); return; }
    try {
      this.user = JSON.parse(localStorage.getItem('gd_user') || 'null') || await API.me();
      this.lang = this.user.language || 'en';
      this.applyLang(this.lang, false);
      this.showApp();
      // Members go to their portal; staff go to dashboard
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
    const u = this.user;
    document.getElementById('user-avatar').textContent = (u.name || 'U')[0].toUpperCase();
    document.getElementById('user-info-sidebar').innerHTML =
      `<strong>${u.name}</strong><span style="text-transform:capitalize">${u.role}</span>`;
    this.updateLangButtons();
  },

  buildNav() {
    const role = this.user?.role || 'reception';

    // Member gets their own portal-focused nav
    if (role === 'member') {
      const nav = document.getElementById('sidebar-nav');
      nav.innerHTML = `
        <button class="nav-item" data-page="my-membership" onclick="App.navigate('my-membership')">
          <span class="nav-icon">🏅</span><span>My Membership</span>
        </button>
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
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = items.map(i => `
      <button class="nav-item" data-page="${i.key}" onclick="App.navigate('${i.key}')">
        <span class="nav-icon">${i.icon}</span>
        <span data-i18n="${i.label}">${t(i.label)}</span>
      </button>
    `).join('');
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    const titles = {
      dashboard: 'Dashboard', members: 'Members', attendance: 'Attendance',
      payments: 'Payments', trainers: 'Trainers', classes: 'Classes',
      subscriptions: 'Subscription Plans', users: 'Staff Accounts',
      'my-membership': 'My Membership',
    };
    document.getElementById('topbar-title').textContent = titles[page] || page;

    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    const pages = {
      dashboard: Pages.dashboard,
      members: Pages.members,
      attendance: Pages.attendance,
      payments: Pages.payments,
      trainers: Pages.trainers,
      classes: Pages.classes,
      subscriptions: Pages.subscriptions,
      users: Pages.users,
      'my-membership': Pages.memberPortal,
    };
    if (pages[page]) pages[page].render(content);

    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
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
    if (rebuild && this.user) { this.buildNav(); this.navigate(this.currentPage); }
  },

  updateLangButtons() {
    ['en','ar'].forEach(l => {
      document.querySelectorAll(`#lang-${l}, #app-lang-${l}`).forEach(el => {
        el.classList.toggle('active', this.lang === l);
      });
    });
  },

  logout() {
    API.clearToken();
    this.user = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
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
