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
    [s.sellers_blocked, 'Bloklangan'],
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

const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
function formatBlockedUntil(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

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
    <article class="order-card ${s.is_blocked ? 'is-blocked' : ''}">
      <div class="order-head">
        <b>${s.shop_name}</b>
        ${s.is_blocked ? '<span class="order-new-badge blocked-badge">Bloklangan</span>' : ''}
      </div>
      <div class="order-meta">
        <span>👤 ${s.owner_name || '—'}</span>
        <span>📞 ${s.phone}</span>
        <span>✉ ${s.email || '—'}</span>
        <span>⌖ ${s.region || '—'}</span>
        <span>🕐 ${new Date(s.created_at).toLocaleString('uz-UZ')}</span>
      </div>
      ${s.is_blocked ? `<p class="blocked-note">Sabab: ${s.blocked_reason || '—'}${s.blocked_until ? ` · ${formatBlockedUntil(s.blocked_until)}gacha` : ' · muddatsiz'}</p>` : ''}
      ${activeStatus === 'pending' ? `<div class="profile-actions">
        <button class="button outline reject-seller" data-id="${s.id}" type="button">Rad etish</button>
        <button class="button primary approve-seller" data-id="${s.id}" type="button">Tasdiqlash</button>
      </div>` : ''}
      ${activeStatus === 'approved' ? `<div class="profile-actions">
        <button class="button outline message-seller" data-id="${s.id}" data-name="${s.shop_name}" type="button">Xabar yuborish</button>
        ${s.is_blocked
          ? `<button class="button primary unblock-seller" data-id="${s.id}" type="button">Blokdan chiqarish</button>`
          : `<button class="button outline block-seller" data-id="${s.id}" data-name="${s.shop_name}" type="button">Bloklash</button>`}
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
  const messageBtn = event.target.closest('.message-seller');
  const blockBtn = event.target.closest('.block-seller');
  const unblockBtn = event.target.closest('.unblock-seller');

  if (approveBtn || rejectBtn) {
    const action = approveBtn ? 'approve' : 'reject';
    try {
      await apiFetch(`/api/admin/sellers/${(approveBtn || rejectBtn).dataset.id}/${action}`, { method: 'POST', headers: adminAuthHeader() });
    } catch (err) {
      toast(err.message);
      return;
    }
    toast(action === 'approve' ? 'Sotuvchi tasdiqlandi' : 'Sotuvchi rad etildi');
    renderStats();
    renderSellers();
    return;
  }

  if (unblockBtn) {
    try {
      await apiFetch(`/api/admin/sellers/${unblockBtn.dataset.id}/unblock`, { method: 'POST', headers: adminAuthHeader() });
    } catch (err) {
      toast(err.message);
      return;
    }
    toast('Sotuvchi blokdan chiqarildi');
    renderStats();
    renderSellers();
    return;
  }

  if (messageBtn) openActionDialog('message', messageBtn.dataset.id, messageBtn.dataset.name);
  if (blockBtn) openActionDialog('block', blockBtn.dataset.id, blockBtn.dataset.name);
});

/* ---- Xabar / Bloklash oynasi ---- */
const actionDialogEl = document.querySelector('#actionDialog');
const actionFormEl = document.querySelector('#actionForm');
let actionMode = 'message';
let actionSellerId = null;

function openActionDialog(mode, sellerId, sellerName) {
  actionMode = mode;
  actionSellerId = sellerId;
  actionFormEl.reset();
  document.querySelector('#actionError').hidden = true;
  const isBlock = mode === 'block';
  document.querySelector('#actionTag').textContent = isBlock ? "DO'KONNI BLOKLASH" : 'XABAR YUBORISH';
  document.querySelector('#actionTitle').textContent = isBlock ? `${sellerName} do'konini bloklash` : `${sellerName} do'koniga xabar`;
  document.querySelector('#actionSubtitle').textContent = isBlock
    ? "Bloklangan do'kon va uning mahsulotlari saytdan darhol yo'qoladi. Sabab sotuvchiga xabar sifatida yuboriladi."
    : "Xabar sotuvchining panelida ko'rinadi.";
  document.querySelector('#actionDurationField').hidden = !isBlock;
  document.querySelector('#actionMessage').placeholder = isBlock ? 'Bloklash sababini yozing' : 'Xabar matnini kiriting';
  document.querySelector('#actionSubmit').textContent = isBlock ? "Bloklash" : 'Yuborish';
  actionDialogEl.showModal();
}

document.querySelector('.close-action').addEventListener('click', () => actionDialogEl.close());

actionFormEl.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.querySelector('#actionMessage').value.trim();
  const errorEl = document.querySelector('#actionError');
  try {
    if (actionMode === 'block') {
      const days = document.querySelector('#actionDuration').value;
      await apiFetch(`/api/admin/sellers/${actionSellerId}/block`, {
        method: 'POST',
        headers: adminAuthHeader(),
        body: JSON.stringify({ reason: message, days: days ? Number(days) : null })
      });
    } else {
      await apiFetch(`/api/admin/sellers/${actionSellerId}/message`, {
        method: 'POST',
        headers: adminAuthHeader(),
        body: JSON.stringify({ message })
      });
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    return;
  }
  actionDialogEl.close();
  toast(actionMode === 'block' ? "Do'kon bloklandi" : 'Xabar yuborildi');
  renderStats();
  renderSellers();
});

if (adminToken()) showPanel(); else showLogin();
