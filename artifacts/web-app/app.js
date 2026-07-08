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
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || ('API error ' + res.status));
  }
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
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
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
            class="btn btn-sm btn-gold add-to-cart-btn"
            data-id="${escHtml(p.id)}"
            ${p.inStock ? '' : 'disabled'}
          >${p.inStock ? 'Add to Cart' : 'Unavailable'}</button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach add-to-cart via event delegation (works in module scope)
  grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
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
    if (cartSummary) cartSummary.classList.add('hidden');
    if (emptyCart)   emptyCart.classList.remove('hidden');
    updateCartBadge();
    return;
  }

  if (emptyCart)   emptyCart.classList.add('hidden');
  if (cartSummary) cartSummary.classList.remove('hidden');

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
            <button class="qty-btn" data-id="${escHtml(p.id)}" data-delta="-1">\u2212</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-id="${escHtml(p.id)}" data-delta="1">+</button>
          </div>
          <p class="cart-item-total">${formatPrice(lineTotal)}</p>
          <button class="remove-btn" data-id="${escHtml(p.id)}">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  // Attach cart controls via event delegation
  cartItemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => updateCartQty(btn.dataset.id, parseInt(btn.dataset.delta)));
  });
  cartItemsEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });

  const total = getCartTotal(products);
  if (subtotalEl) subtotalEl.textContent = formatPrice(total);
  if (totalEl)    totalEl.textContent    = formatPrice(total);
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
    waBtn.replaceWith(waBtn.cloneNode(true));
    document.getElementById('whatsappBtn')
      .addEventListener('click', sendWhatsAppOrder);
  }
}

/* ─── Init: Checkout page ─────────────── */

async function initCheckoutPage() {
  const layout = document.getElementById('checkoutLayout');
  const empty  = document.getElementById('checkoutEmpty');
  const summaryItemsEl = document.getElementById('checkoutSummaryItems');
  const totalEl = document.getElementById('checkoutTotal');
  const form    = document.getElementById('checkoutForm');
  const payBtn  = document.getElementById('payBtn');
  if (!layout || !form) return;

  const cart     = getCart();
  const products = await fetchProducts();

  if (cart.length === 0) {
    layout.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }

  const lineItems = cart
    .map(item => {
      const p = products.find(pr => pr.id === item.id);
      if (!p) return null;
      return { product: p, qty: item.qty };
    })
    .filter(Boolean);

  summaryItemsEl.innerHTML = lineItems.map(({ product, qty }) => `
    <div class="checkout-summary-row">
      <span>${escHtml(product.name)} &times; ${qty}</span>
      <span>${formatPrice(product.price * qty)}</span>
    </div>
  `).join('');

  const total = getCartTotal(products);
  totalEl.textContent = formatPrice(total);

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const name    = document.getElementById('customerName').value.trim();
    const phone   = document.getElementById('customerPhone').value.trim();
    const email   = document.getElementById('customerEmail').value.trim();
    const address = document.getElementById('customerAddress').value.trim();

    if (!name || !phone || !email || !address) {
      showToast('Please fill in all fields.');
      return;
    }

    payBtn.disabled    = true;
    payBtn.textContent = 'Redirecting to Paystack\u2026';

    try {
      const callbackUrl = window.location.origin + window.location.pathname.replace(/checkout\.html$/, 'order-success.html');
      const data = await apiFetch('/checkout/initialize', {
        method: 'POST',
        body: JSON.stringify({
          items: lineItems.map(({ product, qty }) => ({ id: product.id, qty })),
          customer: { name, phone, email, address },
          callbackUrl
        })
      });
      window.location.href = data.authorizationUrl;
    } catch (err) {
      showToast(err.message || 'Could not start payment. Please try again.');
      payBtn.disabled    = false;
      payBtn.textContent = 'Pay with Paystack';
    }
  });
}

/* ─── Init: Order success page ────────── */

async function initOrderSuccessPage() {
  const box     = document.getElementById('orderStatusBox');
  const titleEl = document.getElementById('orderStatusTitle');
  const msgEl   = document.getElementById('orderStatusMessage');
  if (!box) return;

  const params    = new URLSearchParams(window.location.search);
  const reference = params.get('reference') || params.get('trxref');

  if (!reference) {
    box.classList.add('failed');
    box.querySelector('.order-status-icon').textContent = '\u2716';
    titleEl.textContent = 'No payment reference found';
    msgEl.textContent   = 'We could not find a payment reference in this link. If you completed a payment, please contact us on WhatsApp.';
    return;
  }

  try {
    const data = await apiFetch('/checkout/verify/' + encodeURIComponent(reference));

    if (data.status === 'success') {
      saveCart([]);
      box.classList.add('success');
      box.querySelector('.order-status-icon').textContent = '\u2705';
      titleEl.textContent = 'Payment Successful!';
      msgEl.innerHTML = `Thank you, ${escHtml(data.order.customerName)}! Your order has been received and is being processed.<br><span class="order-ref">Ref: ${escHtml(reference)}</span><br>We'll reach out on WhatsApp/phone with delivery updates.`;
    } else {
      box.classList.add('failed');
      box.querySelector('.order-status-icon').textContent = '\u2716';
      titleEl.textContent = 'Payment Not Successful';
      msgEl.innerHTML = `Your payment could not be confirmed.<br><span class="order-ref">Ref: ${escHtml(reference)}</span><br>No charge was completed. Please try again or contact us on WhatsApp for help.`;
    }
  } catch (err) {
    box.classList.add('failed');
    box.querySelector('.order-status-icon').textContent = '\u2716';
    titleEl.textContent = 'Could Not Verify Payment';
    msgEl.textContent   = 'We could not verify this payment right now. Please contact us on WhatsApp with your order reference.';
  }
}

/* ─── Page init ───────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  updateCartBadge();

  const path = window.location.pathname;
  if (path.includes('products')) { initProductsPage(); }
  else if (path.includes('cart')) { initCartPage(); }
  else if (path.includes('checkout')) { initCheckoutPage(); }
  else if (path.includes('order-success')) { initOrderSuccessPage(); }
});
