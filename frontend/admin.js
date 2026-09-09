async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let data = null;
  try { data = await res.json(); } catch { /* bo'sh javob */ }
  if (!res.ok) throw new Error((data && data.detail) || 'Xatolik yuz berdi');
  return data;
}

function adminToken() {
  return localStorage.getItem('qurilish-admin-token') || '';
}

function adminAuthHeader() {
  const token = adminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const loginView = document.querySelector('#loginView');
const panelView = document.querySelector('#adminPanelView');
const logoutBtn = document.querySelector('#adminLogoutBtn');

function showLogin() {
  loginView.hidden = false;
  panelView.hidden = true;
  logoutBtn.hidden = true;
}

function showPanel() {
  loginView.hidden = true;
  panelView.hidden = false;
  logoutBtn.hidden = false;
  renderStats();
  renderSellers();
}

async function renderStats() {
  let s;
  try {
    s = await apiFetch('/api/admin/stats', { headers: adminAuthHeader() });
  } catch {
    return;
  }
  const cards = [
    [s.total_sellers, "Jami sotuvchilar"],
    [s.sellers_approved, 'Tasdiqlangan'],
    [s.sellers_pending, 'Kutilmoqda'],
    [s.total_buyers, 'Jami xaridorlar'],
    [s.total_products, 'Jami mahsulotlar'],
    [s.total_orders, 'Jami buyurtmalar']
  ];
  document.querySelector('#statsGrid').innerHTML = cards.map(([value, label]) => `<div class="stat-card"><b>${value}</b><span>${label}</span></div>`).join('');
}

document.querySelector('#adminLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const errorEl = document.querySelector('#adminLoginError');
  errorEl.hidden = true;
  try {
    const result = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.querySelector('#adminUsername').value.trim(),
        password: document.querySelector('#adminPassword').value
      })
    });
    localStorage.setItem('qurilish-admin-token', result.token);
    showPanel();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('qurilish-admin-token');
  showLogin();
});

let activeStatus = 'pending';

document.querySelectorAll('.dash-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeStatus = tab.dataset.status;
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderSellers();
  });
});

async function renderSellers() {
  let list = [];
  try {
    list = await apiFetch(`/api/admin/sellers?status_filter=${activeStatus}`, { headers: adminAuthHeader() });
  } catch (err) {
    localStorage.removeItem('qurilish-admin-token');
    showLogin();
    return;
  }

  document.querySelector('#sellersEmpty').hidden = list.length > 0;
  document.querySelector('#sellersList').innerHTML = list.map(s => `
    <article class="order-card">
      <div class="order-head"><b>${s.shop_name}</b></div>
      <div class="order-meta">
        <span>👤 ${s.owner_name || '—'}</span>
        <span>📞 ${s.phone}</span>
        <span>✉ ${s.email || '—'}</span>
        <span>⌖ ${s.region || '—'}</span>
        <span>🕐 ${new Date(s.created_at).toLocaleString('uz-UZ')}</span>
      </div>
      ${activeStatus === 'pending' ? `<div class="profile-actions">
        <button class="button outline reject-seller" data-id="${s.id}" type="button">Rad etish</button>
        <button class="button primary approve-seller" data-id="${s.id}" type="button">Tasdiqlash</button>
      </div>` : ''}
    </article>
  `).join('');

  if (activeStatus === 'pending') {
    const badge = document.querySelector('#pendingBadge');
    badge.hidden = list.length === 0;
    badge.textContent = list.length;
  }
}

document.querySelector('#sellersList').addEventListener('click', async event => {
  const approveBtn = event.target.closest('.approve-seller');
  const rejectBtn = event.target.closest('.reject-seller');
  const btn = approveBtn || rejectBtn;
  if (!btn) return;
  const action = approveBtn ? 'approve' : 'reject';
  try {
    await apiFetch(`/api/admin/sellers/${btn.dataset.id}/${action}`, { method: 'POST', headers: adminAuthHeader() });
  } catch (err) {
    toast(err.message);
    return;
  }
  toast(action === 'approve' ? 'Sotuvchi tasdiqlandi' : 'Sotuvchi rad etildi');
  renderStats();
  renderSellers();
});

if (adminToken()) showPanel(); else showLogin();
