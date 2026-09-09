const regions = [
  ['Viloyatlar', ['Andijon viloyati', 'Buxoro viloyati', 'Farg‘ona viloyati', 'Jizzax viloyati', 'Xorazm viloyati', 'Namangan viloyati', 'Navoiy viloyati', 'Qashqadaryo viloyati', 'Samarqand viloyati', 'Sirdaryo viloyati', 'Surxondaryo viloyati', 'Toshkent viloyati']],
  ['Boshqa hududlar', ['Qoraqalpog‘iston Respublikasi', 'Toshkent shahri']]
];

const regionSelectOptions = '<option value="">Hududni tanlang</option>' + regions.map(([group, cities]) =>
  `<optgroup label="${group}">${cities.map(city => `<option value="${city}">${city}</option>`).join('')}</optgroup>`
).join('');

const categoryOptions = [
  ['brick', "G'isht & Bloklar"],
  ['paint', "Bo'yoq & Gips"],
  ['plumbing', 'Santexnika'],
  ['electric', 'Elektr'],
  ['wood', "Yog'och"],
  ['tools', 'Asboblar']
];

const money = v => new Intl.NumberFormat('uz-UZ').format(v) + ' UZS';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let data = null;
  try { data = await res.json(); } catch { /* bo'sh javob, masalan 204 */ }
  if (!res.ok) throw new Error((data && data.detail) || 'Xatolik yuz berdi');
  return data;
}

function sellerToken() {
  return localStorage.getItem('qurilish-seller-token') || '';
}

function sellerAuthHeader() {
  const token = sellerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setSellerSession(token, seller) {
  localStorage.setItem('qurilish-seller-token', token);
  localStorage.setItem('qurilish-seller-session', JSON.stringify(seller));
}

function clearSellerSession() {
  localStorage.removeItem('qurilish-seller-token');
  localStorage.removeItem('qurilish-seller-session');
}

function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- seller.html: landing + auth ---------- */
const sellerAuthForm = document.querySelector('#sellerAuthForm');
if (sellerAuthForm) {
  if (sellerToken()) location.href = 'seller-dashboard.html';

  document.querySelector('#sellerRegion').innerHTML = regionSelectOptions;

  let sellerAuthMode = 'register';
  const els = {
    tag: document.querySelector('#sellerAuthTag'),
    title: document.querySelector('#sellerAuthTitle'),
    subtitle: document.querySelector('#sellerAuthSubtitle'),
    shopField: document.querySelector('#sellerShopField'),
    ownerField: document.querySelector('#sellerOwnerField'),
    emailField: document.querySelector('#sellerEmailField'),
    regionField: document.querySelector('#sellerRegionField'),
    passwordConfirmField: document.querySelector('#sellerPasswordConfirmField'),
    termsField: document.querySelector('#sellerTermsField'),
    shopName: document.querySelector('#sellerShopName'),
    ownerName: document.querySelector('#sellerOwnerName'),
    phone: document.querySelector('#sellerPhone'),
    email: document.querySelector('#sellerEmail'),
    region: document.querySelector('#sellerRegion'),
    password: document.querySelector('#sellerPassword'),
    passwordConfirm: document.querySelector('#sellerPasswordConfirm'),
    termsCheck: document.querySelector('#sellerTermsCheck'),
    error: document.querySelector('#sellerAuthError'),
    submit: document.querySelector('#sellerAuthSubmit'),
    switchBtn: document.querySelector('#sellerAuthSwitch')
  };

  function showSellerError(message) {
    els.error.textContent = message;
    els.error.hidden = false;
  }

  function setSellerMode(mode) {
    sellerAuthMode = mode;
    const isRegister = mode === 'register';
    els.tag.textContent = isRegister ? "DO'KON OCHISH" : 'XUSH KELIBSIZ';
    els.title.textContent = isRegister ? "Do'kon ma'lumotlarini kiriting" : 'Sotuvchi hisobiga kiring';
    els.subtitle.textContent = isRegister ? "Bir necha daqiqada do'koningizni oching va sotishni boshlang." : "Do'koningizni boshqarish uchun kiring.";
    els.shopField.hidden = !isRegister;
    els.ownerField.hidden = !isRegister;
    els.emailField.hidden = !isRegister;
    els.regionField.hidden = !isRegister;
    els.passwordConfirmField.hidden = !isRegister;
    els.termsField.hidden = !isRegister;
    els.shopName.required = isRegister;
    els.passwordConfirm.required = isRegister;
    els.termsCheck.required = isRegister;
    els.submit.textContent = isRegister ? "Do'konni ochish" : 'Kirish';
    els.switchBtn.textContent = isRegister ? 'Hisobingiz bormi? Kirish' : "Hisobingiz yo'qmi? Do'kon oching";
    els.error.hidden = true;
    sellerAuthForm.reset();
  }

  setSellerMode('register');

  els.switchBtn.addEventListener('click', () => setSellerMode(sellerAuthMode === 'register' ? 'login' : 'register'));

  document.querySelector('#sellerLoginBtn').addEventListener('click', () => {
    setSellerMode('login');
    document.querySelector('#royxat').scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelector('#sellerStartBtn').addEventListener('click', () => {
    setSellerMode('register');
    document.querySelector('#royxat').scrollIntoView({ behavior: 'smooth' });
  });

  sellerAuthForm.addEventListener('submit', async event => {
    event.preventDefault();
    const phone = els.phone.value.trim();
    const password = els.password.value;
    let result;
    try {
      if (sellerAuthMode === 'register') {
        if (password !== els.passwordConfirm.value) return showSellerError('Parollar mos kelmadi.');
        if (!els.termsCheck.checked) return showSellerError('Davom etish uchun sotuvchi shartlariga rozilik bildiring.');
        result = await apiFetch('/api/sellers/register', {
          method: 'POST',
          body: JSON.stringify({
            shop_name: els.shopName.value.trim(),
            owner_name: els.ownerName.value.trim(),
            phone,
            email: els.email.value.trim(),
            region: els.region.value,
            password
          })
        });
      } else {
        result = await apiFetch('/api/sellers/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
      }
    } catch (err) {
      return showSellerError(err.message);
    }
    setSellerSession(result.token, result.seller);
    location.href = 'seller-dashboard.html';
  });
}

/* ---------- seller-dashboard.html ---------- */
const dashShopNameEl = document.querySelector('#dashShopName');
if (dashShopNameEl) {
  initDashboard();
}

async function initDashboard() {
  if (!sellerToken()) {
    location.href = 'seller.html';
    return;
  }

  let seller;
  try {
    seller = await apiFetch('/api/sellers/me', { headers: sellerAuthHeader() });
  } catch {
    clearSellerSession();
    location.href = 'seller.html';
    return;
  }
  localStorage.setItem('qurilish-seller-session', JSON.stringify(seller));

  document.querySelectorAll('#pendingLogoutBtn,#rejectedLogoutBtn,#sellerLogoutBtn').forEach(btn => {
    btn?.addEventListener('click', () => {
      clearSellerSession();
      location.href = 'seller.html';
    });
  });

  if (seller.status === 'pending') {
    document.querySelector('#pendingView').hidden = false;
    return;
  }
  if (seller.status === 'rejected') {
    document.querySelector('#rejectedView').hidden = false;
    return;
  }

  document.querySelector('#dashboardView').hidden = false;
  dashShopNameEl.textContent = seller.shop_name;

  document.querySelectorAll('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.dash-panel').forEach(p => p.hidden = p.id !== `tab-${tab.dataset.tab}`);
      if (tab.dataset.tab === 'orders') { markOrdersViewed(); renderMonthlyStats(); }
    });
  });

  /* ---- Do'kon ma'lumotlari ---- */
  const shopRegionInput = document.querySelector('#shopRegionInput');
  shopRegionInput.innerHTML = regionSelectOptions;

  function renderShopView() {
    const s = JSON.parse(localStorage.getItem('qurilish-seller-session'));
    document.querySelector('#shopViewName').textContent = s.shop_name || '—';
    document.querySelector('#shopViewOwner').textContent = s.owner_name || '—';
    document.querySelector('#shopViewPhone').textContent = s.phone || '—';
    document.querySelector('#shopViewEmail').textContent = s.email || '—';
    document.querySelector('#shopViewRegion').textContent = s.region || '—';
  }
  renderShopView();

  document.querySelector('#shopEditBtn').addEventListener('click', () => {
    const s = JSON.parse(localStorage.getItem('qurilish-seller-session'));
    document.querySelector('#shopNameInput').value = s.shop_name || '';
    document.querySelector('#shopOwnerInput').value = s.owner_name || '';
    document.querySelector('#shopPhoneInput').value = s.phone || '';
    document.querySelector('#shopEmailInput').value = s.email || '';
    shopRegionInput.value = s.region || '';
    document.querySelector('#shopFormError').hidden = true;
    document.querySelector('#shopView').hidden = true;
    document.querySelector('#shopForm').hidden = false;
  });

  document.querySelector('#shopCancelBtn').addEventListener('click', () => {
    document.querySelector('#shopForm').hidden = true;
    document.querySelector('#shopView').hidden = false;
  });

  document.querySelector('#shopForm').addEventListener('submit', async event => {
    event.preventDefault();
    const err = document.querySelector('#shopFormError');
    let updated;
    try {
      updated = await apiFetch('/api/sellers/me', {
        method: 'PUT',
        headers: sellerAuthHeader(),
        body: JSON.stringify({
          shop_name: document.querySelector('#shopNameInput').value.trim(),
          owner_name: document.querySelector('#shopOwnerInput').value.trim(),
          phone: document.querySelector('#shopPhoneInput').value.trim(),
          email: document.querySelector('#shopEmailInput').value.trim(),
          region: shopRegionInput.value
        })
      });
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      return;
    }
    localStorage.setItem('qurilish-seller-session', JSON.stringify(updated));
    dashShopNameEl.textContent = updated.shop_name;
    renderShopView();
    document.querySelector('#shopForm').hidden = true;
    document.querySelector('#shopView').hidden = false;
    toast('Do‘kon ma’lumotlari yangilandi');
  });

  /* ---- Mahsulotlar ---- */
  document.querySelector('#productCategory').innerHTML = categoryOptions.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

  async function renderMyProducts() {
    let mine = [];
    try { mine = await apiFetch('/api/sellers/me/products', { headers: sellerAuthHeader() }); } catch { /* ignore */ }
    document.querySelector('#sellerProductsEmpty').hidden = mine.length > 0;
    document.querySelector('#sellerProductsGrid').innerHTML = mine.map(p => `<article class="seller-product-card"><div class="product-image" style="background-image:url('${p.image}')">${p.discount ? `<span class="discount">${p.discount}</span>` : ''}</div><div class="seller-product-info"><b>${p.name}</b><span>${money(p.price)} / ${p.unit}</span><button class="button outline delete-product" data-id="${p.id}" type="button">O'chirish</button></div></article>`).join('');
  }
  renderMyProducts();

  // Tanlangan rasmni brauzerda siqib, upload uchun Blob tayyorlaymiz.
  function readImageAsCompressedBlob(file, maxSize = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('image-decode-failed'));
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('blob-failed')), 'image/jpeg', quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  let productImageBlob = null;
  const productImageFileEl = document.querySelector('#productImageFile');
  const productImagePreviewEl = document.querySelector('#productImagePreview');
  const productImagePreviewImgEl = document.querySelector('#productImagePreviewImg');

  productImageFileEl.addEventListener('change', async () => {
    const file = productImageFileEl.files[0];
    if (!file) return;
    document.querySelector('#productFormError').hidden = true;
    try {
      productImageBlob = await readImageAsCompressedBlob(file);
      productImagePreviewImgEl.src = URL.createObjectURL(productImageBlob);
      productImagePreviewEl.hidden = false;
    } catch {
      const err = document.querySelector('#productFormError');
      err.textContent = 'Rasmni o‘qib bo‘lmadi, boshqa fayl tanlang.';
      err.hidden = false;
      productImageBlob = null;
      productImagePreviewEl.hidden = true;
    }
  });

  document.querySelector('#addProductBtn').addEventListener('click', () => {
    const form = document.querySelector('#productForm');
    form.hidden = !form.hidden;
    if (!form.hidden) {
      form.reset();
      productImageBlob = null;
      productImagePreviewEl.hidden = true;
      document.querySelector('#productFormError').hidden = true;
    }
  });

  document.querySelector('#productCancelBtn').addEventListener('click', () => {
    document.querySelector('#productForm').hidden = true;
  });

  document.querySelector('#productForm').addEventListener('submit', async event => {
    event.preventDefault();
    const errorEl = document.querySelector('#productFormError');
    if (!productImageBlob) {
      errorEl.textContent = 'Mahsulot rasmini tanlang.';
      errorEl.hidden = false;
      return;
    }
    const price = Number(document.querySelector('#productPrice').value);
    const oldPrice = Number(document.querySelector('#productOldPrice').value) || null;

    try {
      const formData = new FormData();
      formData.append('file', productImageBlob, 'photo.jpg');
      const uploadRes = await fetch(`${API_BASE}/api/uploads/image`, {
        method: 'POST',
        headers: sellerAuthHeader(),
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.detail || 'Rasm yuklashda xatolik');

      await apiFetch('/api/sellers/me/products', {
        method: 'POST',
        headers: sellerAuthHeader(),
        body: JSON.stringify({
          name: document.querySelector('#productName').value.trim(),
          category: document.querySelector('#productCategory').value,
          price,
          unit: document.querySelector('#productUnit').value.trim(),
          old_price: oldPrice,
          image_url: uploadData.url
        })
      });
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.hidden = false;
      return;
    }

    renderMyProducts();
    document.querySelector('#productForm').hidden = true;
    toast('Mahsulot qo‘shildi');
  });

  document.querySelector('#sellerProductsGrid').addEventListener('click', async event => {
    const btn = event.target.closest('.delete-product');
    if (!btn) return;
    try {
      await apiFetch(`/api/sellers/me/products/${btn.dataset.id}`, { method: 'DELETE', headers: sellerAuthHeader() });
    } catch (e) {
      toast(e.message);
      return;
    }
    renderMyProducts();
    toast('Mahsulot o‘chirildi');
  });

  /* ---- Buyurtmalar ---- */
  async function renderOrders() {
    let mine = [];
    try { mine = await apiFetch('/api/sellers/me/orders', { headers: sellerAuthHeader() }); } catch { /* ignore */ }
    document.querySelector('#ordersEmpty').hidden = mine.length > 0;
    document.querySelector('#ordersList').innerHTML = mine.map(o => `<article class="order-card ${o.status === 'yangi' ? 'is-new' : ''}"><div class="order-head"><b>${o.buyer_name}</b>${o.status === 'yangi' ? '<span class="order-new-badge">Yangi</span>' : ''}</div><div class="order-meta"><span>📞 ${o.buyer_phone}</span><span>⌖ ${o.buyer_region || '—'}</span><span>🕐 ${new Date(o.created_at).toLocaleString('uz-UZ')}</span></div><div class="order-items">${o.items.map(i => `<span>${i.name} × ${i.qty}</span>`).join('')}</div><div class="order-total">Jami: <b>${money(o.total)}</b></div></article>`).join('');
    const newCount = mine.filter(o => o.status === 'yangi').length;
    const badge = document.querySelector('#ordersBadge');
    badge.hidden = newCount === 0;
    badge.textContent = newCount;
  }

  async function markOrdersViewed() {
    try { await apiFetch('/api/sellers/me/orders/mark-viewed', { method: 'POST', headers: sellerAuthHeader() }); } catch { /* ignore */ }
    setTimeout(renderOrders, 1200);
  }

  renderOrders();

  /* ---- Oylik statistika ---- */
  const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  function formatMonth(key) {
    const [y, m] = key.split('-');
    return `${UZ_MONTHS[Number(m) - 1]} ${y}`;
  }

  async function renderMonthlyStats() {
    let months = [];
    try { months = await apiFetch('/api/sellers/me/stats', { headers: sellerAuthHeader() }); } catch { /* ignore */ }
    document.querySelector('#statsEmpty').hidden = months.length > 0;
    document.querySelector('#statsTable').hidden = months.length === 0;
    document.querySelector('#statsTableBody').innerHTML = months.map(m => `<tr><td>${formatMonth(m.month)}</td><td><b>${m.order_count}</b></td><td><b>${money(m.total)}</b></td></tr>`).join('');
  }
  renderMonthlyStats();
}
