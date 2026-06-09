Pages = window.Pages || {};

Pages.dashboard = {
  charts: {},

  async render(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      const stats = await API.dashboardStats();
      this.renderStats(container, stats);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    }
  },

  renderStats(container, s) {
    Object.values(this.charts).forEach(c => c.destroy());
    this.charts = {};

    container.innerHTML = `
      <div class="card-grid">
        <div class="stat-card green">
          <div class="stat-label">${t('dashboard.active_members')}</div>
          <div class="stat-value">${s.total_active}</div>
          <div class="stat-sub">${s.total_members} ${t('dashboard.total_enrolled')}</div>
        </div>
        <div class="stat-card teal">
          <div class="stat-label">${t('dashboard.today_checkins')}</div>
          <div class="stat-value">${s.today_checkins}</div>
          <div class="stat-sub">${t('dashboard.as_of_now')}</div>
        </div>
        <div class="stat-card gold">
          <div class="stat-label">${t('dashboard.monthly_revenue')}</div>
          <div class="stat-value" style="font-size:1.5rem">${fmtCurrency(s.month_revenue)}</div>
          <div class="stat-sub">${t('dashboard.this_month')}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">${t('dashboard.expired')}</div>
          <div class="stat-value">${s.expired}</div>
          <div class="stat-sub">${s.expiring_soon} ${t('dashboard.expiring_soon')}</div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <h3>${t('dashboard.revenue_chart')}</h3>
          <canvas id="chart-revenue"></canvas>
        </div>
        <div class="chart-card">
          <h3>${t('dashboard.members_chart')}</h3>
          <canvas id="chart-members"></canvas>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem" class="two-col-responsive">
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <h3 style="font-size:0.875rem;font-weight:600;color:var(--warning)">⚠️ ${t('dashboard.expiring_7days')}</h3>
          </div>
          ${s.expiring_list.length === 0
            ? `<p style="color:var(--text-muted);font-size:0.875rem">${t('dashboard.none_expiring')}</p>`
            : s.expiring_list.map(m => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:0.875rem;font-weight:500;color:var(--text)">${escHtml(m.name)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${m.member_code} · ${m.phone}</div>
                </div>
                <span class="badge badge-expiring">${m.days_left}d</span>
              </div>
            `).join('')
          }
        </div>
        <div class="card">
          <h3 style="font-size:0.875rem;font-weight:600;color:var(--text);margin-bottom:1rem">🔔 ${t('dashboard.recent_checkins')}</h3>
          ${s.recent_checkins.length === 0
            ? `<p style="color:var(--text-muted);font-size:0.875rem">${t('dashboard.no_checkins')}</p>`
            : s.recent_checkins.map(c => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:0.875rem;font-weight:500;color:var(--text)">${escHtml(c.name)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${c.member_code}</div>
                </div>
                <div style="text-align:right;font-size:0.75rem;color:var(--text-muted)">${fmtDateTime(c.check_in_time)}</div>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;

    const axisColor = '#94a3b8';
    const gridColor = '#f1f5f9';
    const chartDefaults = {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: axisColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { ticks: { color: axisColor, font: { size: 10 } }, grid: { color: gridColor } }
      }
    };

    const revenueCtx = document.getElementById('chart-revenue');
    if (revenueCtx && s.revenue_chart) {
      this.charts.revenue = new Chart(revenueCtx, {
        type: 'bar',
        data: {
          labels: s.revenue_chart.map(r => r.month),
          datasets: [{ data: s.revenue_chart.map(r => r.revenue || 0), backgroundColor: '#1a2332', borderWidth: 0, borderRadius: 5 }]
        },
        options: { ...chartDefaults }
      });
    }

    const membersCtx = document.getElementById('chart-members');
    if (membersCtx && s.membership_chart) {
      this.charts.members = new Chart(membersCtx, {
        type: 'line',
        data: {
          labels: s.membership_chart.map(r => r.month),
          datasets: [{ data: s.membership_chart.map(r => r.new_members || 0), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', tension: 0.35, fill: true, pointRadius: 4, pointBackgroundColor: '#6366f1' }]
        },
        options: { ...chartDefaults }
      });
    }

    const twoCol = container.querySelector('.two-col-responsive');
    if (twoCol && window.innerWidth < 768) twoCol.style.gridTemplateColumns = '1fr';
  }
};
