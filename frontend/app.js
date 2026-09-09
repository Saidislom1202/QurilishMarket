const regions = [
  ['Viloyatlar', ['Andijon viloyati', 'Buxoro viloyati', 'Farg‘ona viloyati', 'Jizzax viloyati', 'Xorazm viloyati', 'Namangan viloyati', 'Navoiy viloyati', 'Qashqadaryo viloyati', 'Samarqand viloyati', 'Sirdaryo viloyati', 'Surxondaryo viloyati', 'Toshkent viloyati']],
  ['Boshqa hududlar', ['Qoraqalpog‘iston Respublikasi', 'Toshkent shahri']]
];

const regionSelectOptions = '<option value="">Hududni tanlang (ixtiyoriy)</option>' + regions.map(([group, cities]) =>
  `<optgroup label="${group}">${cities.map(city => `<option value="${city}">${city}</option>`).join('')}</optgroup>`
).join('');

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body, e.g. 204 */ }
  if (!res.ok) throw new Error((data && data.detail) || 'Xatolik yuz berdi');
  return data;
}

function authHeader() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// Har bir topilgan mahsulotni id bo'yicha eslab qolamiz — chunki hozirgi ro'yxat
// faqat FILTRLANGAN natijalarni ko'rsatadi, lekin savat/saqlash tugmalari
// avval boshqa filtrda ko'rsatilgan mahsulotga ham tegishli bo'lishi mumkin.
const productIndex = new Map();
function indexProducts(items) {
  items.forEach(p => productIndex.set(p.id, p));
  return items;
}
function findProduct(id) {
  return productIndex.get(id);
}

let cart = JSON.parse(localStorage.getItem('qurilish-cart') || '[]');
let saved = JSON.parse(localStorage.getItem('qurilish-saved') || '[]');
let activeCategory = 'all';
let authToken = localStorage.getItem('qurilish-token') || '';
let currentUser = JSON.parse(localStorage.getItem('qurilish-current-user') || 'null');
let pendingCheckout = false;

const money = v => new Intl.NumberFormat('uz-UZ').format(v) + ' UZS';

const card = p => `<article class="product-card"><div class="product-image" style="background-image:url('${p.image}')">${p.discount ? `<span class="discount">${p.discount}</span>` : ''}</div><div class="product-info"><h3>${p.name}</h3><button class="save-product ${saved.some(x => x.id === p.id) ? 'saved' : ''}" data-id="${p.id}" aria-label="Mahsulotni saqlash">${saved.some(x => x.id === p.id) ? '♥' : '♡'}</button><div class="stars">★★★★★ <small>(${p.rating})</small></div><p class="price">${money(p.price)} <small>/ ${p.unit}</small></p><p class="old-price">${p.old ? money(p.old) : ''}</p><p class="seller-name">⌖ &nbsp;${p.seller} <span class="verified">●</span></p><div class="product-actions"><button class="view-product" data-id="${p.id}">Ko'rish</button><button class="add-cart" data-id="${p.id}">＋ Savatga</button></div></div></article>`;

async function renderProducts() {
  const term = document.querySelector('#searchInput').value.trim();
  const params = new URLSearchParams();
  if (activeCategory !== 'all') params.set('category', activeCategory);
  if (term) params.set('search', term);
  let items = [];
  try {
    items = indexProducts(await apiFetch(`/api/products${params.toString() ? '?' + params : ''}`));
  } catch { /* tarmoq xatosi bo'lsa bo'sh ro'yxat ko'rsatiladi */ }
  document.querySelector('#productGrid').innerHTML = items.map(card).join('');
  document.querySelector('#emptyState').hidden = items.length > 0;
  document.querySelector('#resultMessage').textContent = term
    ? `“${term}” bo'yicha qidiruv natijalari`
    : activeCategory === 'all'
      ? "Eng ko'p xarid qilinadigan mahsulotlar"
      : "Tanlangan kategoriya mahsulotlari";
}

async function renderDiscounts() {
  let items = [];
  try { items = indexProducts(await apiFetch('/api/products?category=sale')); } catch { /* ignore */ }
  document.querySelector('#discountGrid').innerHTML = items.map(card).join('');
}

function selectedRegion() {
  const stored = localStorage.getItem('qurilish-location');
  return stored === 'Toshkent' || !stored ? 'Toshkent shahri' : stored;
}

async function renderShops() {
  const region = selectedRegion();
  let regionalShops = [];
  try { regionalShops = await apiFetch(`/api/shops?region=${encodeURIComponent(region)}`); } catch { /* ignore */ }
  const grid = document.querySelector('#shopGrid');
  grid.innerHTML = regionalShops.length
    ? regionalShops.map(s => `<article class="shop-card"><div class="shop-top"><span class="shop-avatar">${s.initials}</span><div><h3>${s.name} <span class="verified">●</span></h3><div class="rating">★★★★★ <b>${s.rating}</b> <small>(${s.reviews} sharh)</small></div><p class="place">⌖ ${s.place}</p></div></div><button class="view-shop" data-shop="${s.name}">Mahsulotlarni Ko'rish →</button></article>`).join('')
    : `<div class="no-shops"><span>🏪</span><h3>Hali do‘kon yo‘q</h3><p>Qurilish Mollari do‘koni tez orada sizning hududingizda!</p></div>`;
}

function updateCart() {
  const grouped = cart.reduce((groups, item) => {
    (groups[item.seller] ??= []).push(item);
    return groups;
  }, {});
  localStorage.setItem('qurilish-cart', JSON.stringify(cart));
  document.querySelector('#cartCount').textContent = cart.reduce((n, i) => n + i.qty, 0) || '';
  document.querySelector('#cartItems').innerHTML = cart.length
    ? Object.entries(grouped).map(([seller, items]) => `<section class="cart-store"><div class="cart-store-head"><span class="store-badge">🏪</span><div><b>${seller}</b><small>${items.length} xil mahsulot</small></div></div>${items.map(i => `<div class="cart-line"><div><b>${i.name}</b><small>${i.qty} × ${money(i.price)} <em>${money(i.price * i.qty)}</em></small></div><button class="remove-cart" data-id="${i.id}">Olib tashlash</button></div>`).join('')}</section>`).join('')
    : `<p class="empty">Savatingiz hozircha bo'sh.</p>`;
  document.querySelector('#cartTotal').textContent = money(cart.reduce((sum, i) => sum + i.price * i.qty, 0));
}

function updateSaved() {
  localStorage.setItem('qurilish-saved', JSON.stringify(saved));
  document.querySelector('#savedCount').textContent = saved.length || '';
  document.querySelector('#savedItems').innerHTML = saved.length
    ? saved.map(p => `<div class="cart-line"><div><b>${p.name}</b><small>${money(p.price)} / ${p.unit}</small></div><button class="remove-saved" data-id="${p.id}">Olib tashlash</button></div>`).join('')
    : `<p class="empty">Saqlangan mahsulotlar hali yo'q.</p>`;
}

function toggleSaved(id) {
  const p = findProduct(id);
  const present = saved.some(x => x.id === id);
  saved = present ? saved.filter(x => x.id !== id) : [...saved, p];
  updateSaved();
  renderProducts();
  renderDiscounts();
  toast(present ? `${p.name} saqlanganlardan olib tashlandi` : `${p.name} saqlandi`);
}

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function flyToCart(origin, product, onFinish) {
  const target = document.querySelector('.js-cart');
  const visual = origin?.closest('.product-card,.dialog-product')?.querySelector('.product-image');
  if (!target || !visual || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onFinish();
    return;
  }
  const from = visual.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'cart-fly-item';
  fly.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;background-image:url('${product.image}')`;
  document.body.append(fly);
  fly.animate([
    { transform: 'translate(0,0) scale(1)', opacity: .95, borderRadius: '9px' },
    { transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px,${to.top + to.height / 2 - from.top - from.height / 2}px) scale(.08)`, opacity: .2, borderRadius: '50%' }
  ], { duration: 680, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished.then(() => {
    fly.remove();
    onFinish();
    target.classList.remove('cart-bump');
    void target.offsetWidth;
    target.classList.add('cart-bump');
  });
}

function addToCart(id) {
  const p = findProduct(id);
  const line = cart.find(x => x.id === id);
  line ? line.qty++ : cart.push({ ...p, qty: 1 });
  flyToCart(document.activeElement, p, () => {
    updateCart();
    toast(`${p.name} savatga qo'shildi`);
  });
}

function showProduct(id) {
  const p = findProduct(id);
  const isSaved = saved.some(x => x.id === id);
  document.querySelector('#dialogBody').innerHTML = `<div class="dialog-product"><div class="product-image" style="background-image:url('${p.image}')"></div><div class="dialog-copy"><p class="sale-label">${p.discount ? 'AKSIYA ' + p.discount : 'SIFATLI MAHSULOT'}</p><h2>${p.name}</h2><div class="stars">★★★★★ (${p.rating} sharh)</div><p class="price">${money(p.price)} <small>/ ${p.unit}</small></p><p>Mahsulot haqida batafsil ma'lumot olish va bevosita sotuvchi bilan bog'lanish mumkin.</p><p class="seller-name">⌖ ${p.seller} <span class="verified">●</span></p><button class="button primary dialog-add" data-id="${p.id}">＋ Savatga qo'shish</button><button class="button save-product dialog-save ${isSaved ? 'saved' : ''}" data-id="${p.id}">${isSaved ? '♥ Saqlangan' : '♡ Saqlash'}</button></div></div>`;
  document.querySelector('#productDialog').showModal();
}

function setCategory(category) {
  activeCategory = category;
  document.querySelectorAll('.nav-filter').forEach(b => b.classList.toggle('active', b.dataset.category === category));
  renderProducts();
  document.querySelector('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.matches('.add-cart,.dialog-add')) addToCart(+b.dataset.id);
  if (b.matches('.view-product')) showProduct(+b.dataset.id);
  if (b.matches('.remove-cart')) {
    cart = cart.filter(x => x.id !== +b.dataset.id);
    updateCart();
  }
  if (b.matches('.nav-filter,.category-card,.footer-link[data-category]')) setCategory(b.dataset.category);
  if (b.matches('.js-cart')) {
    document.querySelector('#cartDrawer').classList.add('open');
    document.querySelector('#overlay').classList.add('show');
  }
  if (b.matches('.js-close-cart') || b.matches('#overlay')) {
    document.querySelector('#cartDrawer').classList.remove('open');
    document.querySelector('#overlay').classList.remove('show');
  }
  if (b.matches('.dialog-close')) document.querySelector('#productDialog').close();
  if (b.matches('.js-focus-search')) {
    document.querySelector('#searchInput').focus();
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (b.matches('.js-show-all')) setCategory('all');
  if (b.matches('.js-shops')) apiFetch('/api/shops').then(all => toast(`${all.length} ta hamkor do‘kon topildi.`)).catch(() => {});
  if (b.matches('.js-saved')) toast(saved.length ? `${saved.length} ta mahsulot saqlangan.` : 'Saqlangan mahsulotlar hali yo‘q.');
  if (b.matches('.js-info')) toast('Ma’lumot sahifasi demo versiyada.');
  if (b.matches('.js-checkout') && !cart.length) toast('Avval savatga mahsulot qo‘shing.');
  if (b.matches('.view-shop')) {
    document.querySelector('#searchInput').value = b.dataset.shop;
    activeCategory = 'all';
    renderProducts();
    document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
  }
});

document.querySelector('#searchForm').addEventListener('submit', e => {
  e.preventDefault();
  activeCategory = 'all';
  renderProducts();
  document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
});

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.matches('.save-product,.dialog-save')) toggleSaved(+b.dataset.id);
  if (b.matches('.remove-saved')) {
    saved = saved.filter(x => x.id !== +b.dataset.id);
    updateSaved();
    renderProducts();
    renderDiscounts();
    toast('Mahsulot saqlanganlardan olib tashlandi');
  }
  if (b.matches('.js-saved')) {
    document.querySelector('#savedDrawer').classList.add('open');
    document.querySelector('#overlay').classList.add('show');
  }
  if (b.matches('.js-close-saved')) {
    document.querySelector('#savedDrawer').classList.remove('open');
    document.querySelector('#overlay').classList.remove('show');
  }
  if (b.matches('#overlay')) {
    document.querySelector('#savedDrawer').classList.remove('open');
  }
});

document.body.insertAdjacentHTML('beforeend', '<div class="location-menu" id="locationMenu" hidden><label class="sr-only" for="locationSearch">Hududni qidiring</label><input id="locationSearch" type="search" placeholder="Hududni qidiring"><div class="location-list" id="locationList"></div></div>');
const locMenu = document.querySelector('#locationMenu');
const locSearch = document.querySelector('#locationSearch');
const locList = document.querySelector('#locationList');

function renderLocations(query = '') {
  const term = query.trim().toLocaleLowerCase('uz');
  locList.innerHTML = regions.map(([region, cities]) => {
    const matching = cities.filter(city => `${region} ${city}`.toLocaleLowerCase('uz').includes(term));
    return matching.length
      ? `<div class="location-region">${region}</div>${matching.map(city => `<button class="location-option" data-location="${city}"><b>${city}</b><small>${region}</small></button>`).join('')}`
      : '';
  }).join('') || '<p class="empty">Hudud topilmadi.</p>';
}

function closeLocations() {
  locMenu.hidden = true;
  document.querySelector('.js-location').setAttribute('aria-expanded', 'false');
}

renderLocations();
const rememberedLocation = localStorage.getItem('qurilish-location');
if (rememberedLocation) document.querySelector('.js-location span').textContent = rememberedLocation;

locSearch.addEventListener('input', e => renderLocations(e.target.value));

document.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (button?.matches('.js-location')) {
    locMenu.hidden = !locMenu.hidden;
    button.setAttribute('aria-expanded', String(!locMenu.hidden));
    if (!locMenu.hidden) {
      locSearch.value = '';
      renderLocations();
      locSearch.focus();
    }
  }
  if (button?.matches('.location-option')) {
    const place = button.dataset.location;
    document.querySelector('.js-location span').textContent = place;
    localStorage.setItem('qurilish-location', place);
    closeLocations();
    toast(`${place} hududi tanlandi`);
  }
  if (!e.target.closest('.location-menu') && !button?.matches('.js-location')) closeLocations();
});

document.body.insertAdjacentHTML('beforeend', `<dialog class="checkout-dialog" id="checkoutDialog"><div class="checkout-content"><div id="checkoutFormView"><p class="sale-label">BUYURTMANI RASMIYLASHTIRISH</p><h2>Yetkazib berish ma'lumotlari</h2><p class="checkout-message">Sotuvchi siz bilan bog'lanishi uchun ma'lumotlaringizni kiriting.</p><form id="checkoutForm" class="checkout-form"><label><span>Ism va familiya</span><input id="checkoutName" required placeholder="Ismingizni kiriting"></label><label><span>Telefon raqam</span><input id="checkoutPhone" required placeholder="998 90 123 45 67"></label><label><span>Hududingiz</span><select id="checkoutRegion">${regionSelectOptions}</select></label><p class="auth-error" id="checkoutError" hidden></p><button class="button primary" type="submit">Buyurtmani tasdiqlash</button></form></div><div id="checkoutSuccessView" hidden><span class="checkout-icon">✓</span><p class="sale-label">BUYURTMA QABUL QILINDI</p><h2>Rahmat! Buyurtmangiz qabul qilindi.</h2><p class="checkout-message">Do‘konlar siz bilan tez orada aloqaga chiqadi va buyurtma tafsilotlarini tasdiqlaydi.</p><div class="checkout-stores" id="checkoutStores"></div><button class="button primary close-checkout">Tushunarli</button></div></div></dialog>`);

function openCheckout() {
  if (!cart.length) return;
  document.querySelector('#checkoutName').value = currentUser?.name || '';
  document.querySelector('#checkoutPhone').value = currentUser?.phone || '';
  document.querySelector('#checkoutRegion').value = currentUser?.region || localStorage.getItem('qurilish-location') || '';
  document.querySelector('#checkoutError').hidden = true;
  document.querySelector('#checkoutFormView').hidden = false;
  document.querySelector('#checkoutSuccessView').hidden = true;
  document.querySelector('#checkoutDialog').showModal();
}

document.querySelector('#checkoutForm').addEventListener('submit', async event => {
  event.preventDefault();
  const buyerName = document.querySelector('#checkoutName').value.trim();
  const buyerPhone = document.querySelector('#checkoutPhone').value.trim();
  const buyerRegion = document.querySelector('#checkoutRegion').value;
  const items = cart.map(i => ({ product_id: i.id, qty: i.qty }));
  let result;
  try {
    result = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ buyer_name: buyerName, buyer_phone: buyerPhone, buyer_region: buyerRegion, items })
    });
  } catch (err) {
    const el = document.querySelector('#checkoutError');
    el.textContent = err.message;
    el.hidden = false;
    return;
  }
  document.querySelector('#checkoutStores').innerHTML = `<b>Buyurtma yuborildi:</b>${result.sellers.map(store => `<span>🏪 ${store}</span>`).join('')}`;
  document.querySelector('#checkoutFormView').hidden = true;
  document.querySelector('#checkoutSuccessView').hidden = false;
  cart = [];
  updateCart();
});

document.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (button?.matches('.js-checkout') && cart.length) {
    if (currentUser) {
      openCheckout();
    } else {
      pendingCheckout = true;
      toast('Buyurtma berish uchun avval hisobingizga kiring.');
      openAuth('login');
    }
  }
  if (button?.matches('.close-checkout')) document.querySelector('#checkoutDialog').close();
});

document.querySelector('.js-cart').insertAdjacentHTML('afterend', '<button class="header-button js-auth" type="button">♙ <span>Kirish</span></button>');

document.body.insertAdjacentHTML('beforeend', `<dialog class="auth-dialog" id="authDialog"><div class="auth-content"><button class="icon-button close-auth" aria-label="Yopish">×</button><p class="sale-label" id="authTag">XUSH KELIBSIZ</p><h2 id="authTitle">Hisobingizga kiring</h2><p id="authSubtitle">Buyurtmalar va hududingizdagi do‘konlarni ko‘rish uchun kiring.</p><form id="authForm"><label id="authNameField"><span>Ism va familiya</span><input id="authName" placeholder="Ismingizni kiriting"></label><label><span>Telefon raqam</span><input id="authPhone" required placeholder="998 90 123 45 67"></label><label id="authEmailField"><span>Email</span><input id="authEmail" type="email" placeholder="email@example.com"></label><label id="authRegionField"><span>Hududingiz</span><select id="authRegion">${regionSelectOptions}</select></label><label><span>Parol</span><input id="authPassword" type="password" required minlength="6" placeholder="Kamida 6 ta belgi"></label><label id="authPasswordConfirmField"><span>Parolni tasdiqlang</span><input id="authPasswordConfirm" type="password" placeholder="Parolni qayta kiriting"></label><p class="auth-error" id="authError" hidden></p><button class="button primary" type="submit" id="authSubmit">Kirish</button></form><button class="auth-switch" id="authSwitch" type="button">Hisobingiz yo‘qmi? Ro‘yxatdan o‘ting</button></div></dialog>`);

document.body.insertAdjacentHTML('beforeend', `<dialog class="auth-dialog" id="profileDialog"><div class="auth-content"><button class="icon-button close-profile" aria-label="Yopish">×</button><p class="sale-label">MENING PROFILIM</p><h2>Hisobim</h2><div id="profileView"><div class="profile-row"><span>Ism va familiya</span><b id="profileName">—</b></div><div class="profile-row"><span>Telefon</span><b id="profilePhone">—</b></div><div class="profile-row"><span>Email</span><b id="profileEmail">—</b></div><div class="profile-row"><span>Hudud</span><b id="profileRegion">—</b></div><div class="profile-actions"><button class="button outline" type="button" id="profileEditBtn">Tahrirlash</button><button class="button primary" type="button" id="profileLogoutBtn">Chiqish</button></div></div><form id="profileForm" hidden><label><span>Ism va familiya</span><input id="profileNameInput" placeholder="Ismingizni kiriting"></label><label><span>Telefon raqam</span><input id="profilePhoneInput" required placeholder="998 90 123 45 67"></label><label><span>Email</span><input id="profileEmailInput" type="email" placeholder="email@example.com"></label><label><span>Hududingiz</span><select id="profileRegionInput">${regionSelectOptions}</select></label><p class="auth-error" id="profileError" hidden></p><div class="profile-actions"><button class="button outline" type="button" id="profileCancelBtn">Bekor qilish</button><button class="button primary" type="submit">Saqlash</button></div></form></div></dialog>`);

const authDialogEl = document.querySelector('#authDialog');
const authTagEl = document.querySelector('#authTag');
const authTitleEl = document.querySelector('#authTitle');
const authSubtitleEl = document.querySelector('#authSubtitle');
const authFormEl = document.querySelector('#authForm');
const authNameEl = document.querySelector('#authName');
const authPhoneEl = document.querySelector('#authPhone');
const authEmailEl = document.querySelector('#authEmail');
const authRegionEl = document.querySelector('#authRegion');
const authPasswordEl = document.querySelector('#authPassword');
const authPasswordConfirmEl = document.querySelector('#authPasswordConfirm');
const authErrorEl = document.querySelector('#authError');
const authSubmitEl = document.querySelector('#authSubmit');
const authSwitchEl = document.querySelector('#authSwitch');

function updateAuthButton() {
  // innerHTML emas — currentUser.name foydalanuvchi tomonidan kiritilgani uchun XSS oldini olish maqsadida DOM orqali xavfsiz qo'yiladi
  const button = document.querySelector('.js-auth');
  button.textContent = '';
  button.append('♙ ');
  const nameSpan = document.createElement('span');
  nameSpan.textContent = currentUser ? (currentUser.name || 'Mijoz') : 'Kirish';
  button.append(nameSpan);
  button.title = currentUser ? 'Mening profilim' : 'Hisobingizga kiring';
}

function setAuthError(message) {
  authErrorEl.textContent = message;
  authErrorEl.hidden = !message;
}

function openAuth(mode = 'login') {
  const isRegister = mode === 'register';
  authDialogEl.dataset.mode = mode;
  authFormEl.reset();
  setAuthError('');
  authTagEl.textContent = isRegister ? 'RO‘YXATDAN O‘TISH' : 'XUSH KELIBSIZ';
  authTitleEl.textContent = isRegister ? 'Hisob yarating' : 'Hisobingizga kiring';
  authSubtitleEl.textContent = isRegister ? 'Hududingizdagi do‘konlar va buyurtmalarni boshqaring.' : 'Buyurtmalar va hududingizdagi do‘konlarni ko‘rish uchun kiring.';
  document.querySelector('#authNameField').hidden = !isRegister;
  document.querySelector('#authEmailField').hidden = !isRegister;
  document.querySelector('#authRegionField').hidden = !isRegister;
  document.querySelector('#authPasswordConfirmField').hidden = !isRegister;
  authNameEl.required = isRegister;
  authPasswordConfirmEl.required = isRegister;
  authSubmitEl.textContent = isRegister ? 'Ro‘yxatdan o‘tish' : 'Kirish';
  authSwitchEl.textContent = isRegister ? 'Hisobingiz bormi? Kirish' : 'Hisobingiz yo‘qmi? Ro‘yxatdan o‘ting';
  authDialogEl.showModal();
}

updateAuthButton();

authFormEl.addEventListener('submit', async event => {
  event.preventDefault();
  const mode = authDialogEl.dataset.mode;
  const phone = authPhoneEl.value.trim();
  const password = authPasswordEl.value;
  let result;
  try {
    if (mode === 'register') {
      if (password !== authPasswordConfirmEl.value) return setAuthError('Parollar mos kelmadi.');
      result = await apiFetch('/api/buyers/register', {
        method: 'POST',
        body: JSON.stringify({ name: authNameEl.value.trim(), phone, email: authEmailEl.value.trim(), region: authRegionEl.value, password })
      });
    } else {
      result = await apiFetch('/api/buyers/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
    }
  } catch (err) {
    return setAuthError(err.message);
  }
  authToken = result.token;
  currentUser = result.buyer;
  localStorage.setItem('qurilish-token', authToken);
  localStorage.setItem('qurilish-current-user', JSON.stringify(currentUser));
  updateAuthButton();
  authDialogEl.close();
  if (mode === 'register' && currentUser.region) {
    localStorage.setItem('qurilish-location', currentUser.region);
    document.querySelector('.js-location span').textContent = currentUser.region;
  }
  renderShops();
  if (pendingCheckout) {
    pendingCheckout = false;
    toast(`Xush kelibsiz, ${currentUser.name || 'mijoz'}! Buyurtmangizni yakunlang.`);
    openCheckout();
    return;
  }
  const needsLocation = mode === 'register' && !currentUser.region && !localStorage.getItem('qurilish-location');
  toast(needsLocation ? `Xush kelibsiz, ${currentUser.name || 'mijoz'}! Endi hududingizni tanlang.` : `Xush kelibsiz, ${currentUser.name || 'mijoz'}!`);
  if (needsLocation) setTimeout(() => document.querySelector('.js-location').click(), 900);
});

const profileDialogEl = document.querySelector('#profileDialog');
const profileViewEl = document.querySelector('#profileView');
const profileFormEl = document.querySelector('#profileForm');
const profileNameEl = document.querySelector('#profileName');
const profilePhoneEl = document.querySelector('#profilePhone');
const profileEmailEl = document.querySelector('#profileEmail');
const profileRegionEl = document.querySelector('#profileRegion');
const profileNameInputEl = document.querySelector('#profileNameInput');
const profilePhoneInputEl = document.querySelector('#profilePhoneInput');
const profileEmailInputEl = document.querySelector('#profileEmailInput');
const profileRegionInputEl = document.querySelector('#profileRegionInput');
const profileErrorEl = document.querySelector('#profileError');

function openProfile() {
  profileNameEl.textContent = currentUser.name || '—';
  profilePhoneEl.textContent = currentUser.phone || '—';
  profileEmailEl.textContent = currentUser.email || '—';
  profileRegionEl.textContent = currentUser.region || '—';
  profileErrorEl.hidden = true;
  profileViewEl.hidden = false;
  profileFormEl.hidden = true;
  profileDialogEl.showModal();
}

document.querySelector('#profileEditBtn').addEventListener('click', () => {
  profileNameInputEl.value = currentUser.name || '';
  profilePhoneInputEl.value = currentUser.phone || '';
  profileEmailInputEl.value = currentUser.email || '';
  profileRegionInputEl.value = currentUser.region || '';
  profileViewEl.hidden = true;
  profileFormEl.hidden = false;
});

document.querySelector('#profileCancelBtn').addEventListener('click', () => {
  profileFormEl.hidden = true;
  profileViewEl.hidden = false;
});

profileFormEl.addEventListener('submit', async event => {
  event.preventDefault();
  let updated;
  try {
    updated = await apiFetch('/api/buyers/me', {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify({
        name: profileNameInputEl.value.trim(),
        phone: profilePhoneInputEl.value.trim(),
        email: profileEmailInputEl.value.trim(),
        region: profileRegionInputEl.value
      })
    });
  } catch (err) {
    profileErrorEl.textContent = err.message;
    profileErrorEl.hidden = false;
    return;
  }
  currentUser = updated;
  localStorage.setItem('qurilish-current-user', JSON.stringify(currentUser));
  if (currentUser.region) {
    localStorage.setItem('qurilish-location', currentUser.region);
    document.querySelector('.js-location span').textContent = currentUser.region;
    renderShops();
  }
  updateAuthButton();
  openProfile();
  toast('Ma’lumotlar yangilandi');
});

document.querySelector('#profileLogoutBtn').addEventListener('click', () => {
  currentUser = null;
  authToken = '';
  localStorage.removeItem('qurilish-current-user');
  localStorage.removeItem('qurilish-token');
  updateAuthButton();
  profileDialogEl.close();
  toast('Tizimdan chiqdingiz');
});

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.matches('.js-auth')) currentUser ? openProfile() : openAuth('login');
  if (button.matches('.auth-switch')) openAuth(authDialogEl.dataset.mode === 'login' ? 'register' : 'login');
  if (button.matches('.close-auth')) {
    pendingCheckout = false;
    authDialogEl.close();
  }
  if (button.matches('.close-profile')) profileDialogEl.close();
  if (button.matches('.location-option')) setTimeout(renderShops, 0);
});

async function refreshCurrentUser() {
  if (!authToken) return;
  try {
    currentUser = await apiFetch('/api/buyers/me', { headers: authHeader() });
    localStorage.setItem('qurilish-current-user', JSON.stringify(currentUser));
  } catch {
    authToken = '';
    currentUser = null;
    localStorage.removeItem('qurilish-token');
    localStorage.removeItem('qurilish-current-user');
  }
  updateAuthButton();
}

async function init() {
  await refreshCurrentUser();
  await Promise.all([renderProducts(), renderShops(), renderDiscounts()]);
  updateCart();
  updateSaved();
}

init();
