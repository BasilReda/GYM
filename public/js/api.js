const API = {
  base: '/api',

  getToken() { return localStorage.getItem('gd_token'); },
  setToken(t) { localStorage.setItem('gd_token', t); },
  clearToken() { localStorage.removeItem('gd_token'); localStorage.removeItem('gd_user'); },

  async request(method, path, body) {
    const opts = { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' } };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { App.logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body),
  put: (path, body) => API.request('PUT', path, body),
  patch: (path, body) => API.request('PATCH', path, body),
  delete: (path) => API.request('DELETE', path),

  // Auth
  login: (email, password) => API.post('/auth/login', { email, password }),
  me: () => API.get('/auth/me'),
  setLanguage: (lang) => API.put('/auth/language', { language: lang }),

  // Dashboard
  dashboardStats: () => API.get('/dashboard/stats'),
  getUsers: () => API.get('/dashboard/users'),
  createUser: (d) => API.post('/dashboard/users', d),
  toggleUser: (id) => API.patch(`/dashboard/users/${id}/toggle`),

  // Members
  getMembers: (q = '') => API.get('/members' + q),
  getMember: (id) => API.get(`/members/${id}`),
  createMember: (d) => API.post('/members', d),
  updateMember: (id, d) => API.put(`/members/${id}`, d),
  deleteMember: (id) => API.delete(`/members/${id}`),
  getMemberQr: (id) => API.get(`/members/${id}/qr`),
  suspendMember: (id) => API.post(`/members/${id}/suspend`),
  reactivateMember: (id) => API.post(`/members/${id}/reactivate`),

  // Subscriptions
  getPlans: () => API.get('/subscriptions'),
  createPlan: (d) => API.post('/subscriptions', d),
  updatePlan: (id, d) => API.put(`/subscriptions/${id}`, d),
  deletePlan: (id) => API.delete(`/subscriptions/${id}`),

  // Attendance
  checkinByCode: (member_code, method) => API.post('/attendance/checkin', { member_code, method }),
  checkinById: (member_id) => API.post('/attendance/checkin', { member_id, method: 'staff' }),
  qrCheckin: (qr_data) => API.post('/attendance/qr-checkin', { qr_data }),
  getAttendance: (q = '') => API.get('/attendance' + q),
  getTodayCount: () => API.get('/attendance/today-count'),
  getMemberAttendance: (id) => API.get(`/attendance/member/${id}`),

  // Payments
  getPayments: (q = '') => API.get('/payments' + q),
  createPayment: (d) => API.post('/payments', d),
  getPaymentSummary: () => API.get('/payments/summary'),
  getOverdue: () => API.get('/payments/overdue'),

  // Trainers
  getTrainers: () => API.get('/trainers'),
  createTrainer: (d) => API.post('/trainers', d),
  updateTrainer: (id, d) => API.put(`/trainers/${id}`, d),
  deleteTrainer: (id) => API.delete(`/trainers/${id}`),

  // Classes
  getClassTypes: () => API.get('/classes/types'),
  createClassType: (d) => API.post('/classes/types', d),
  getSessions: (q = '') => API.get('/classes/sessions' + q),
  createSession: (d) => API.post('/classes/sessions', d),
  cancelSession: (id) => API.patch(`/classes/sessions/${id}/cancel`),
  getSessionAttendance: (id) => API.get(`/classes/sessions/${id}/attendance`),
  markClassAttendance: (sessionId, d) => API.post(`/classes/sessions/${sessionId}/attendance`, d),
};
