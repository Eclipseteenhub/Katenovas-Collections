'use strict';

/* ═══════════════════════════════════════
   KATENOVAS COLLECTIONS — app.js
   Customer-facing pages
   ═══════════════════════════════════════ */

const KC = {
  WA_NUMBER: '2348025497647',
  KEYS: {
    products: 'kc_products',
    cart:     'kc_cart'
  }
};

/* ─── Storage helpers ─────────────────── */

function getProducts() {
  try {
    return JSON.parse(localStorage.getItem(KC.KEYS.products)) || [];
  } catch {
    return [];
  }
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(KC.KEYS.cart)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(KC.KEYS.cart, JSON.stringify(cart));
  updateCartBadge();
}

/* ─── Cart operations ─────────────────── */

function addToCart(productId) {
  const products = getProducts();
  const product  = products.find(p => p.id === productId);
  if (!product || !product.inStock) return;

  const cart     = getCart();
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }

  saveCart(cart);
  showToast('\u2714 ' + product.name + ' added to cart!');
}

function updateCartQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.qty = Math.max(1, item.qty + delta);
  saveCart(cart);
  renderCart();
}

function removeFromCart(productId) {
  const updated = getCart().filter(i => i.id !== productId);
  saveCart(updated);
  renderCart();
}

function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function getCartTotal() {
  const products = getProducts();
  return getCart().reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

/* ─── Format helpers ──────────────────── */

function formatPrice(n) {
  return '\u20a6' + Number(n).toLocaleString('en-NG');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Cart badge ──────────────────────── */

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('#cartBadge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'inline-flex';
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

/* ─── Nav (hamburger) ─────────────────── */

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

function renderProducts(category, query) {
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('emptyMessage');
  if (!grid) return;

  let products = getProducts();

  if (category && category !== 'All') {
    products = products.filter(p => p.category === category);
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (products.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = products.map(p => `
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

function renderCart() {
  const cartItemsEl = document.getElementById('cartItems');
  const cartSummary = document.getElementById('cartSummary');
  const emptyCart   = document.getElementById('emptyCart');
  const subtotalEl  = document.getElementById('cartSubtotal');
  const totalEl     = document.getElementById('cartTotal');
  if (!cartItemsEl) return;

  const cart     = getCart();
  const products = getProducts();

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

  const total        = getCartTotal();
  subtotalEl.textContent = formatPrice(total);
  totalEl.textContent    = formatPrice(total);
  updateCartBadge();
}

/* ─── WhatsApp checkout ───────────────── */

function sendWhatsAppOrder() {
  const cart     = getCart();
  const products = getProducts();
  if (cart.length === 0) return;

  const lines = cart.map(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return null;
    return `\u2022 ${p.name} x${item.qty} \u2014 ${formatPrice(p.price * item.qty)}`;
  }).filter(Boolean);

  const total   = getCartTotal();
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

  const url = `https://wa.me/${KC.WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

/* ─── Init: Products page ─────────────── */

function initProductsPage() {
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

  renderProducts(activeCategory, searchQuery);

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      renderProducts(activeCategory, searchQuery);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderProducts(activeCategory, searchQuery);
    });
  });
}

/* ─── Init: Cart page ─────────────────── */

function initCartPage() {
  renderCart();
  const waBtn = document.getElementById('whatsappBtn');
  if (waBtn) waBtn.addEventListener('click', sendWhatsAppOrder);
}

/* ─── Page init ───────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  updateCartBadge();

  const path = window.location.pathname;

  if (path.includes('products')) {
    initProductsPage();
  } else if (path.includes('cart')) {
    initCartPage();
  }
});
