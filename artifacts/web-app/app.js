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
  const empty = document.getElementById('checkoutEmpty');
  const summaryItemsEl = document.getElementById('checkoutSummaryItems');
  const totalEl = document.getElementById('checkoutTotal');
  const form = document.getElementById('checkoutForm');
  const payBtn = document.getElementById('payBtn');
  if (!layout || !form || !summaryItemsEl || !totalEl || !payBtn) return;

  const cart = getCart();
  const products = await fetchProducts();
  const lineItems = cart
    .map(item => {
      const product = products.find(row => row.id === item.id);
      return product ? { product, qty: item.qty } : null;
    })
    .filter(Boolean);

  if (cart.length === 0 || lineItems.length !== cart.length) {
    layout.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    showToast('Your cart changed. Please return to your cart and try again.');
    return;
  }

  summaryItemsEl.innerHTML = lineItems.map(({ product, qty }) => `
    <div class="checkout-summary-row">
      <span>${escHtml(product.name)} &times; ${qty}</span>
      <span>${formatPrice(product.price * qty)}</span>
    </div>
  `).join('');
  totalEl.textContent = formatPrice(getCartTotal(products));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const customer = {
      name: document.getElementById('customerName').value.trim(),
      phone: document.getElementById('customerPhone').value.trim(),
      email: document.getElementById('customerEmail').value.trim(),
      address: document.getElementById('customerAddress').value.trim(),
      state: (document.getElementById('customerState')?.value || '').trim(),
      city: (document.getElementById('customerCity')?.value || '').trim(),
      landmark: (document.getElementById('customerLandmark')?.value || '').trim()
    };
    if (!customer.name || !customer.phone || !customer.email || !customer.address) {
      showToast('Please fill in your name, phone, email, and address.');
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = 'Checking stock and redirecting to Paystack…';
    try {
      // The server rereads product prices and inventory; the browser only sends IDs and quantities.
      const data = await apiFetch('/checkout/initialize', {
        method: 'POST',
        body: JSON.stringify({
          items: lineItems.map(({ product, qty }) => ({ id: product.id, qty })),
          customer
        })
      });
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      showToast(error.message || 'Could not start payment. Please try again.');
      payBtn.disabled = false;
      payBtn.textContent = 'Pay Securely with Paystack';
    }
  });
}


/* ─── Init: Order success page ────────── */


async function initOrderSuccessPage() {
  const box = document.getElementById('orderStatusBox');
  const titleEl = document.getElementById('orderStatusTitle');
  const msgEl = document.getElementById('orderStatusMessage');
  if (!box || !titleEl || !msgEl) return;

  const params = new URLSearchParams(window.location.search);
  const reference = params.get('reference') || params.get('trxref');
  if (!reference) {
    box.classList.add('failed');
    box.querySelector('.order-status-icon').textContent = '✖';
    titleEl.textContent = 'No payment reference found';
    msgEl.textContent = 'We could not find a payment reference in this link. If you completed payment, please contact us on WhatsApp.';
    return;
  }

  try {
    const data = await apiFetch('/checkout/verify/' + encodeURIComponent(reference));
    const publicReference = data.order?.reference || reference;
    if (data.status === 'success') {
      saveCart([]);
      box.classList.add('success');
      box.querySelector('.order-status-icon').textContent = '✅';
      titleEl.textContent = data.requiresSupport
        ? 'Payment Received — We Need to Confirm Stock'
        : 'Payment Successful!';
      msgEl.textContent = data.requiresSupport
        ? 'Your payment was received. Please contact us on WhatsApp with reference: ' + publicReference + '.'
        : 'Your order has been received and is being processed. Reference: ' + publicReference + '. We will reach out with delivery updates.';
    } else if (data.status === 'pending') {
      box.querySelector('.order-status-icon').textContent = '⏳';
      titleEl.textContent = 'Confirming Payment';
      msgEl.textContent = 'We are still confirming your payment. Please refresh shortly. Reference: ' + publicReference + '.';
    } else {
      box.classList.add('failed');
      box.querySelector('.order-status-icon').textContent = '✖';
      titleEl.textContent = 'Payment Not Successful';
      msgEl.textContent = 'Your payment could not be confirmed. Reference: ' + publicReference + '. Please try again or contact us on WhatsApp.';
    }
  } catch {
    box.classList.add('failed');
    box.querySelector('.order-status-icon').textContent = '✖';
    titleEl.textContent = 'Could Not Verify Payment';
    msgEl.textContent = 'We could not verify this payment right now. Please contact us on WhatsApp with your order reference.';
  }
}


/* ─── AI Chat Widget ──────────────────── */


function initChatWidget() {
  // Don't show on admin pages
  if (window.location.pathname.includes('admin')) return;


  const WA_URL = 'https://wa.me/2348025497647';
  let messages = [];
  let isOpen   = false;


  // Build DOM
  const widget = document.createElement('div');
  widget.id = 'kcChat';
  widget.innerHTML = `
    <button id="kcChatBtn" class="kc-chat-btn" aria-label="Chat with us">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="kc-chat-badge hidden">1</span>
    </button>
    <div id="kcChatPanel" class="kc-chat-panel hidden">
      <div class="kc-chat-header">
        <div class="kc-chat-header-info">
          <div class="kc-chat-avatar">K</div>
          <div>
            <strong>Kena</strong>
            <p>Katenovas Assistant &bull; 24/7</p>
          </div>
        </div>
        <div class="kc-chat-header-actions">
          <a href="${WA_URL}" target="_blank" class="kc-wa-btn" title="Chat on WhatsApp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          </a>
          <button id="kcChatClose" class="kc-chat-close">&times;</button>
        </div>
      </div>
      <div id="kcChatMessages" class="kc-chat-messages"></div>
      <div class="kc-chat-input-row">
        <input id="kcChatInput" type="text" placeholder="Ask about products, delivery…" maxlength="500" autocomplete="off" />
        <button id="kcChatSend" class="kc-chat-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);


  const btn      = document.getElementById('kcChatBtn');
  const panel    = document.getElementById('kcChatPanel');
  const closeBtn = document.getElementById('kcChatClose');
  const input    = document.getElementById('kcChatInput');
  const sendBtn  = document.getElementById('kcChatSend');
  const msgsEl   = document.getElementById('kcChatMessages');
  const badge    = widget.querySelector('.kc-chat-badge');


  function renderMessages() {
    msgsEl.replaceChildren();
    for (const message of messages) {
      const row = document.createElement('div');
      row.className = 'kc-msg kc-msg-' + (message.role === 'user' ? 'user' : 'assistant');
      const bubble = document.createElement('div');
      bubble.className = 'kc-msg-bubble';
      bubble.style.whiteSpace = 'pre-wrap';
      // Never turn customer or AI text into HTML.
      bubble.textContent = String(message.content ?? '');
      row.appendChild(bubble);
      msgsEl.appendChild(row);
    }
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }


  function addMsg(role, content) {
    messages.push({ role, content });
    renderMessages();
  }


  function openPanel() {
    isOpen = true;
    panel.classList.remove('hidden');
    btn.classList.add('active');
    badge.classList.add('hidden');
    if (messages.length === 0) {
      addMsg('assistant', 'Hi! 👋 I\'m Kena, your Katenovas shopping assistant.\n\nI can help you find products, answer questions about delivery, payment, and more. What can I help you with today?');
    }
    setTimeout(() => input.focus(), 150);
  }


  function closePanel() {
    isOpen = false;
    panel.classList.add('hidden');
    btn.classList.remove('active');
  }


  btn.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);


  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg('user', text);


    // Typing indicator
    const typingId = 'kc-typing-' + Date.now();
    msgsEl.innerHTML += `<div id="${typingId}" class="kc-msg kc-msg-assistant"><div class="kc-msg-bubble kc-typing"><span></span><span></span><span></span></div></div>`;
    msgsEl.scrollTop = msgsEl.scrollHeight;
    sendBtn.disabled = true;
    input.disabled   = true;


    try {
      const res  = await fetch(KC.API_BASE + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();


      document.getElementById(typingId)?.remove();
      addMsg('assistant', data.reply || 'Sorry, I couldn\'t get a response. Please try again!');


      if (data.handoff) {
        setTimeout(() => { window.open(WA_URL, '_blank'); }, 800);
      }
    } catch {
      document.getElementById(typingId)?.remove();
      addMsg('assistant', 'I\'m having trouble connecting right now. Please WhatsApp us at +234 802 549 7647 for help!');
    } finally {
      sendBtn.disabled = false;
      input.disabled   = false;
      input.focus();
    }
  }


  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });


  // Show badge after 8 seconds if not opened
  setTimeout(() => {
    if (!isOpen) badge.classList.remove('hidden');
  }, 8000);
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


  // Chat widget — on all customer pages
  initChatWidget();
});
