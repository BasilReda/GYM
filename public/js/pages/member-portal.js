Pages = window.Pages || {};

Pages.memberPortal = {
  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      const [profile, attData] = await Promise.all([
        API.get('/portal/me'),
        API.get('/portal/attendance'),
      ]);
      this.renderDashboard(container, profile, attData);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    }
  },

  renderDashboard(container, p, attData) {
    const daysLeft  = p.days_left;
    const totalDays = p.duration_days || 30;
    const usedDays  = totalDays - Math.max(daysLeft, 0);
    const pct       = Math.min(100, Math.max(0, Math.round((usedDays / totalDays) * 100)));

    const statusMeta = {
      active:        { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: t('member.status.active') },
      expiring_soon: { color: '#d97706', bg: '#fef9c3', border: '#fde68a', label: t('member.status.expiring_soon') },
      expired:       { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', label: t('member.status.expired') },
      suspended:     { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', label: t('member.status.suspended') },
    };
    const sm = statusMeta[p.status] || statusMeta.active;

    // Heatmap
    const last30      = attData.last_30 || {};
    const heatmapDays = Object.keys(last30).sort();
    const heatmap = heatmapDays.map(d => {
      const count   = last30[d];
      const bg      = count > 0 ? '#1a2332' : '#e2e8f0';
      const dayName = new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
      return `<div title="${dayName}: ${count}" style="width:18px;height:18px;border-radius:3px;background:${bg};flex-shrink:0"></div>`;
    }).join('');

    const daysLeftLabel = daysLeft !== null ? (daysLeft < 0 ? t('member.status.expired') : daysLeft + 'd') : '—';

    container.innerHTML = `
      <!-- GREETING -->
      <div style="margin-bottom:1.5rem">
        <h2 style="font-size:1.5rem;font-weight:700;color:var(--text);letter-spacing:-0.02em">
          ${t('portal.welcome')} ${escHtml(p.name.split(' ')[0])} 👋
        </h2>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.2rem">${p.member_code}</p>
      </div>

      <!-- SUBSCRIPTION CARD -->
      <div style="background:var(--accent);border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;position:relative;overflow:hidden;color:#fff">
        <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.05);pointer-events:none"></div>
        <div style="position:absolute;bottom:-20px;right:80px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.05);pointer-events:none"></div>

        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:1.5rem">
          <div>
            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.55);margin-bottom:0.3rem">${t('portal.plan')}</div>
            <div style="font-size:1.35rem;font-weight:700">${escHtml(p.plan_name || t('portal.no_plan'))}</div>
          </div>
          <span style="background:${sm.bg};color:${sm.color};border:1px solid ${sm.border};padding:0.3rem 0.9rem;border-radius:100px;font-size:0.75rem;font-weight:600;white-space:nowrap">
            ${sm.label}
          </span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem">
          <div>
            <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">${t('portal.start_date')}</div>
            <div style="font-weight:600;font-size:0.9rem">${fmtDate(p.start_date)}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">${t('portal.expires')}</div>
            <div style="font-weight:600;font-size:0.9rem">${fmtDate(p.end_date)}</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">${t('portal.days_left')}</div>
            <div style="font-weight:700;font-size:1.2rem">${daysLeftLabel}</div>
          </div>
        </div>

        ${p.end_date ? `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:rgba(255,255,255,0.55);margin-bottom:0.4rem">
            <span>${t('portal.sub_used')}</span><span>${pct}%</span>
          </div>
          <div style="height:5px;background:rgba(255,255,255,0.15);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:rgba(255,255,255,0.7);border-radius:3px;transition:width 0.5s ease"></div>
          </div>
        </div>` : ''}

        ${p.status === 'expiring_soon' ? `
        <div style="margin-top:1rem;padding:0.65rem 1rem;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-size:0.82rem;color:rgba(255,255,255,0.9)">
          ⚠️ ${t('portal.expiring_warn_1')} <strong>${daysLeft} ${t('portal.expiring_warn_2')}</strong>. ${t('portal.expiring_warn_3')}
        </div>` : ''}
        ${p.status === 'expired' ? `
        <div style="margin-top:1rem;padding:0.65rem 1rem;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-size:0.82rem;color:rgba(255,255,255,0.9)">
          ❌ ${t('portal.expired_warn')}
        </div>` : ''}
      </div>

      <!-- STATS ROW -->
      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="stat-card teal">
          <div class="stat-label">${t('portal.this_month')}</div>
          <div class="stat-value">${attData.this_month}</div>
          <div class="stat-sub">${t('portal.checkins')}</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-label">${t('portal.this_year')}</div>
          <div class="stat-value">${attData.this_year}</div>
          <div class="stat-sub">${t('portal.total_visits')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${t('portal.member_since')}</div>
          <div class="stat-value" style="font-size:1rem;padding-top:0.3rem">${fmtDate(p.created_at?.split('T')[0])}</div>
          <div class="stat-sub">${escHtml(p.member_code)}</div>
        </div>
      </div>

      <!-- HEATMAP -->
      <div class="card" style="margin-bottom:1.5rem">
        <h3 style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:1rem">${t('portal.heatmap_title')}</h3>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${heatmap}</div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;font-size:0.72rem;color:var(--text-muted)">
          <span>${t('portal.heatmap_less')}</span>
          <div style="width:12px;height:12px;border-radius:2px;background:#e2e8f0"></div>
          <div style="width:12px;height:12px;border-radius:2px;background:#1a2332"></div>
          <span>${t('portal.heatmap_more')}</span>
        </div>
      </div>

      <!-- RECENT CHECK-INS -->
      <div class="card">
        <h3 style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:1rem">${t('portal.recent_checkins')}</h3>
        ${attData.records.length === 0
          ? `<div class="empty-state" style="padding:1rem"><div class="empty-icon">🏃</div><p>${t('portal.no_checkins')}</p></div>`
          : `<div class="table-wrap" style="border:none;margin-bottom:0;box-shadow:none">
              <table>
                <thead><tr><th>${t('portal.col.datetime')}</th><th>${t('portal.col.method')}</th></tr></thead>
                <tbody>
                  ${attData.records.slice(0, 20).map(r => `
                    <tr>
                      <td>${fmtDateTime(r.check_in_time)}</td>
                      <td>${t('attendance.method.' + r.method) || r.method}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
  }
};
