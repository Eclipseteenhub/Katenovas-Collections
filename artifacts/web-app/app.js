'use strict';

/* ═══════════════════════════════════════
   KATENOVAS COLLECTIONS — app.js
   Customer-facing pages
   ═══════════════════════════════════════ */

const KC = {
  WA_NUMBER: '2348025497647',
  API_BASE:  '/api',
  CART_KEY:  'kc_cart'
};

/* ─── API helpers ─────────────────────── */

async function apiFetch(path, options) {
  const res = await fetch(KC.API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}

async function fetchProducts() {
  try {
    return await apiFetch('/products');
  } catch {
    return [];
  }
}

/* ─── Cart (stays in localStorage) ───── */

function getCart() {
  try { return JSON.parse(localStorage.getItem(KC.CART_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(KC.CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function getCartCount() {
  return getCart().reduce((s, i) => s + i.qty, 0);
}

function getCartTotal(products) {
  return getCart().reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

/* ─── Cart operations ─────────────────── */

async function addToCart(productId) {
  const products = await fetchProducts();
  const product  = products.find(p => p.id === productId);
  if (!product || !product.inStock) return;

  const cart     = getCart();
  const existing = cart.find(i => i.id === productId);
  if (existing) { existing.qty += 1; } else { cart.push({ id: productId, qty: 1 }); }
  saveCart(cart);
  showToast('\u2714 ' + product.name + ' added to cart!');
}

function updateCartQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart(cart);
  initCartPage();
}

function removeFromCart(productId) {
  saveCart(getCart().filter(i => i.id !== productId));
  initCartPage();
}

/* ─── Format helpers ──────────────────── */

function formatPrice(n) {
  return '\u20a6' + Number(n).toLocaleString('en-NG');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Cart badge ──────────────────────── */

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('#cartBadge').forEach(el => {
    el.textContent = count;
  });
}

/* ─── Toast ───────────────────────────── */

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

/* ─── Nav hamburger ───────────────────── */

function initNav() {
  const toggle = document.getElementById('navToggle');
  const nav    = document.getElementById('siteNav');
  const close  = document.getElementById('navClose');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => nav.classList.add('open'));
  if (close) close.addEventListener('click', () => nav.classList.remove('open'));
  nav.addEventListener('click', e => {
    if (e.target.classList.contains('nav-link')) nav.classList.remove('open');
  });
}

/* ─── Render: Products page ───────────── */

function renderProducts(products, category, query) {
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('emptyMessage');
  if (!grid) return;

  let list = products;

  if (category && category !== 'All') {
    list = list.filter(p => p.category === category);
  }
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = list.map(p => `
    <div class="product-card">
      <div class="product-img-wrap">
        ${p.image
          ? `<img src="${p.image}" alt="${escHtml(p.name)}" class="product-img" loading="lazy" />`
          : `<div class="product-img-placeholder">\uD83D\uDCE6</div>`
        }
        <span class="stock-badge ${p.inStock ? 'in-stock' : 'out-stock'}">
          ${p.inStock ? 'Available' : 'Out of Stock'}
        </span>
      </div>
      <div class="product-body">
        <span class="product-category">${escHtml(p.category)}</span>
        <h3 class="product-name">${escHtml(p.name)}</h3>
        ${p.description ? `<p class="product-desc">${escHtml(p.description)}</p>` : ''}
        <div class="product-footer">
          <span class="product-price">${formatPrice(p.price)}</span>
          <button
            class="btn btn-sm btn-gold"
            onclick="addToCart('${escHtml(p.id)}')"
            ${p.inStock ? '' : 'disabled'}
          >${p.inStock ? 'Add to Cart' : 'Unavailable'}</button>
        </div>
      </div>
    </div>
  `).join('');
}

/* ─── Render: Cart page ───────────────── */

async function renderCart() {
  const cartItemsEl = document.getElementById('cartItems');
  const cartSummary = document.getElementById('cartSummary');
  const emptyCart   = document.getElementById('emptyCart');
  const subtotalEl  = document.getElementById('cartSubtotal');
  const totalEl     = document.getElementById('cartTotal');
  if (!cartItemsEl) return;

  const cart     = getCart();
  const products = await fetchProducts();

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '';
    cartSummary.classList.add('hidden');
    emptyCart.classList.remove('hidden');
    updateCartBadge();
    return;
  }

  emptyCart.classList.add('hidden');
  cartSummary.classList.remove('hidden');

  cartItemsEl.innerHTML = cart.map(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return '';
    const lineTotal = p.price * item.qty;
    return `
      <div class="cart-item">
        <div class="cart-item-img">
          ${p.image
            ? `<img src="${p.image}" alt="${escHtml(p.name)}" />`
            : `<div class="product-img-placeholder small">\uD83D\uDCE6</div>`
          }
        </div>
        <div class="cart-item-info">
          <h3 class="cart-item-name">${escHtml(p.name)}</h3>
          <p class="cart-item-category">${escHtml(p.category)}</p>
          <p class="cart-item-price">${formatPrice(p.price)} each</p>
        </div>
        <div class="cart-item-controls">
          <div class="qty-controls">
            <button class="qty-btn" onclick="updateCartQty('${escHtml(p.id)}', -1)">\u2212</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" onclick="updateCartQty('${escHtml(p.id)}', 1)">+</button>
          </div>
          <p class="cart-item-total">${formatPrice(lineTotal)}</p>
          <button class="remove-btn" onclick="removeFromCart('${escHtml(p.id)}')">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  const total = getCartTotal(products);
  subtotalEl.textContent = formatPrice(total);
  totalEl.textContent    = formatPrice(total);
  updateCartBadge();
}

/* ─── WhatsApp checkout ───────────────── */

async function sendWhatsAppOrder() {
  const cart     = getCart();
  const products = await fetchProducts();
  if (cart.length === 0) return;

  const lines = cart.map(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return null;
    return `\u2022 ${p.name} x${item.qty} \u2014 ${formatPrice(p.price * item.qty)}`;
  }).filter(Boolean);

  const total   = getCartTotal(products);
  const message = [
    'Hello Katenovas Collections! \uD83D\uDC4B',
    '',
    'I would like to place the following order:',
    '',
    ...lines,
    '',
    `*Total: ${formatPrice(total)}*`,
    '',
    'Please confirm availability and delivery details. Thank you!'
  ].join('\n');

  window.open(`https://wa.me/${KC.WA_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

/* ─── Init: Products page ─────────────── */

async function initProductsPage() {
  const searchInput = document.getElementById('searchInput');
  const filterBtns  = document.querySelectorAll('.filter-btn');

  let activeCategory = 'All';
  let searchQuery    = '';

  const params = new URLSearchParams(window.location.search);
  const urlCat = params.get('category');
  if (urlCat) {
    activeCategory = urlCat;
    filterBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === urlCat);
    });
  }

  const products = await fetchProducts();
  renderProducts(products, activeCategory, searchQuery);

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      renderProducts(products, activeCategory, searchQuery);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderProducts(products, activeCategory, searchQuery);
    });
  });
}

/* ─── Init: Cart page ─────────────────── */

async function initCartPage() {
  await renderCart();
  const waBtn = document.getElementById('whatsappBtn');
  if (waBtn) {
    waBtn.replaceWith(waBtn.cloneNode(true)); // remove old listeners
    document.getElementById('whatsappBtn')
      .addEventListener('click', sendWhatsAppOrder);
  }
}

/* ─── Page init ───────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  updateCartBadge();

  const path = window.location.pathname;
  if (path.includes('products')) { initProductsPage(); }
  else if (path.includes('cart')) { initCartPage(); }
});
