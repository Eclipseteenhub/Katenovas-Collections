'use strict';

/* ═══════════════════════════════════════
   KATENOVAS COLLECTIONS — admin.js
   Admin portal — talks to the API
   ═══════════════════════════════════════ */

const API_BASE = '/api';
const ORDER_STATUSES = [
  'Pending', 'Processing', 'Ready for Dispatch',
  'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'
];

/* ─── API helpers ─────────────────────── */

async function apiFetch(path, options) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
  return res.json();
}

async function fetchProducts() { return apiFetch('/products'); }
async function createProduct(data) { return apiFetch('/products', { method: 'POST', body: JSON.stringify(data) }); }
async function updateProduct(id, data) { return apiFetch('/products/' + id, { method: 'PUT', body: JSON.stringify(data) }); }
async function deleteProductById(id) { return apiFetch('/products/' + id, { method: 'DELETE' }); }

async function fetchOrders(search) {
  const qs = search ? '?search=' + encodeURIComponent(search) : '';
  return apiFetch('/orders' + qs);
}
async function patchOrder(id, data) {
  return apiFetch('/orders/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

async function fetchEmailLogs() { return apiFetch('/email-logs'); }
async function sendTestEmail() { return apiFetch('/email-logs/test', { method: 'POST' }); }

/* ─── Auth helpers ────────────────────── */

async function checkSession() {
  try {
    const data = await apiFetch('/admin/session');
    return Boolean(data.authenticated);
  } catch { return false; }
}

async function login(username, password) {
  return apiFetch('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

async function logout() {
  try { await apiFetch('/admin/logout', { method: 'POST' }); } catch {}
  window.location.href = 'admin-login.html';
}

/* ─── Helpers ─────────────────────────── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatPrice(n) { return '\u20a6' + Number(n).toLocaleString('en-NG'); }
function formatDate(d) {
  try { return new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return ''; }
}

/* ─── Toast ───────────────────────────── */

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' toast-' + type : '');
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

/* ─── Stats ───────────────────────────── */

function updateStats(products) {
  const inStock = products.filter(p => p.inStock).length;
  const el = id => document.getElementById(id);
  if (el('totalProducts')) el('totalProducts').textContent = products.length;
  if (el('inStockCount'))  el('inStockCount').textContent  = inStock;
  if (el('outStockCount')) el('outStockCount').textContent = products.length - inStock;
}

/* ─── Render: Admin product list ──────── */

async function renderAdminProducts() {
  const list  = document.getElementById('adminProductsList');
  const empty = document.getElementById('noProducts');
  if (!list) return;

  let products;
  try { products = await fetchProducts(); }
  catch {
    showToast('Could not load products.', 'error');
    return;
  }

  if (products.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    updateStats(products);
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.innerHTML = products.map(p => {
    const colors = Array.isArray(p.colors) ? p.colors.join(', ') : (p.colors || '');
    const sizes  = Array.isArray(p.sizes)  ? p.sizes.join(', ')  : (p.sizes  || '');
    return `
    <div class="admin-product-row">
      <div class="admin-product-img">
        ${p.image
          ? `<img src="${p.image}" alt="${escHtml(p.name)}" />`
          : `<div class="product-img-placeholder small">\uD83D\uDCE6</div>`}
      </div>
      <div class="admin-product-info">
        <h3>${escHtml(p.name)}</h3>
        <p class="admin-product-meta">
          <span>${escHtml(p.category)}</span> &bull;
          <strong>${formatPrice(p.price)}</strong> &bull;
          <span class="stock-badge ${p.inStock ? 'in-stock' : 'out-stock'}">${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
          ${p.stockCount ? `&bull; <span>Qty: ${p.stockCount}</span>` : ''}
        </p>
        ${colors ? `<p class="admin-product-desc">Colors: ${escHtml(colors)}</p>` : ''}
        ${sizes  ? `<p class="admin-product-desc">Sizes: ${escHtml(sizes)}</p>` : ''}
        ${p.description ? `<p class="admin-product-desc">${escHtml(p.description)}</p>` : ''}
      </div>
      <div class="admin-product-actions">
        <button class="btn btn-sm btn-outline" data-edit="${escHtml(p.id)}">Edit</button>
        <button class="btn btn-sm btn-danger"  data-delete="${escHtml(p.id)}">Delete</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit, products));
  });
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.delete));
  });

  updateStats(products);
}

/* ─── Render: Admin orders list ───────── */

async function renderAdminOrders(search) {
  const list  = document.getElementById('adminOrdersList');
  const empty = document.getElementById('noOrders');
  if (!list) return;

  let orders;
  try { orders = await fetchOrders(search); }
  catch {
    showToast('Could not load orders.', 'error');
    return;
  }

  if (orders.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.innerHTML = orders.map(o => {
    const location = [o.customerCity, o.customerState].filter(Boolean).join(', ');
    const landmark = o.customerLandmark ? `<br><em>Landmark: ${escHtml(o.customerLandmark)}</em>` : '';
    return `
    <div class="admin-order-row">
      <div class="admin-order-top">
        <span class="admin-order-customer">${escHtml(o.customerName)}</span>
        <span class="admin-order-ref">${escHtml(o.paystackReference)}</span>
      </div>
      <p class="admin-order-meta">
        <a href="https://wa.me/${escHtml(o.customerPhone.replace(/\D/g,''))}" target="_blank" class="wa-link">
          📱 ${escHtml(o.customerPhone)}
        </a> &bull; ${escHtml(o.customerEmail)}<br>
        📍 ${escHtml(o.customerAddress)}${location ? ', ' + escHtml(location) : ''}${landmark}<br>
        🕐 ${formatDate(o.createdAt)}
      </p>
      <div class="admin-order-items">
        ${(o.items || []).map(it => `<span>${escHtml(it.name)} &times; ${it.qty} &mdash; ${formatPrice(it.price * it.qty)}</span>`).join('')}
      </div>
      <div class="admin-order-bottom">
        <span class="admin-order-total">${formatPrice(o.totalAmount)}</span>
        <span class="status-badge status-${escHtml((o.paymentStatus || '').toLowerCase())}">Payment: ${escHtml(o.paymentStatus)}</span>
        <select class="order-status-select" data-order-id="${escHtml(o.id)}">
          ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === o.orderStatus ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-outline notes-btn" data-order-id="${escHtml(o.id)}" data-notes="${escHtml(o.sellerNotes || '')}">
          📝 ${o.sellerNotes ? 'Edit Notes' : 'Add Notes'}
        </button>
      </div>
      ${o.sellerNotes ? `<p class="seller-notes-preview">📝 ${escHtml(o.sellerNotes)}</p>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.order-status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id        = sel.dataset.orderId;
      const prevValue = sel.dataset.prev || sel.value;
      sel.disabled    = true;
      try {
        await patchOrder(id, { orderStatus: sel.value });
        sel.dataset.prev = sel.value;
        showToast('Status updated — customer email sent.');
      } catch (err) {
        sel.value = prevValue;
        showToast(err.message || 'Failed to update status.', 'error');
      } finally { sel.disabled = false; }
    });
  });

  list.querySelectorAll('.notes-btn').forEach(btn => {
    btn.addEventListener('click', () => openNotesModal(btn.dataset.orderId, btn.dataset.notes || ''));
  });
}

/* ─── Render: Email logs ──────────────── */

async function renderEmailLogs() {
  const list  = document.getElementById('adminEmailLogsList');
  const empty = document.getElementById('noEmailLogs');
  if (!list) return;

  let logs;
  try { logs = await fetchEmailLogs(); }
  catch {
    showToast('Could not load email logs.', 'error');
    return;
  }

  if (!logs || logs.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.innerHTML = logs.map(log => `
    <div class="email-log-row">
      <div class="email-log-main">
        <span class="email-log-type">${escHtml(log.emailType.replace(/_/g, ' '))}</span>
        <span class="email-log-subject">${escHtml(log.subject)}</span>
      </div>
      <div class="email-log-meta">
        <span class="email-log-recipient">To: ${escHtml(log.recipient)}</span>
        <span class="status-badge ${log.status === 'sent' ? 'status-success' : 'status-failed'}">
          ${log.status === 'sent' ? '✅ Sent' : '❌ Failed'}
        </span>
        <span class="email-log-date">${formatDate(log.createdAt)}</span>
      </div>
      ${log.errorMessage ? `<p class="email-log-error">Error: ${escHtml(log.errorMessage)}</p>` : ''}
    </div>
  `).join('');
}

/* ─── Notes modal ─────────────────────── */

function openNotesModal(orderId, notes) {
  document.getElementById('notesOrderId').value = orderId;
  document.getElementById('notesTextarea').value = notes;
  document.getElementById('notesModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeNotesModal() {
  document.getElementById('notesModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function saveNotes() {
  const orderId = document.getElementById('notesOrderId').value;
  const notes   = document.getElementById('notesTextarea').value.trim();
  const saveBtn = document.getElementById('saveNotes');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';
  try {
    await patchOrder(orderId, { sellerNotes: notes });
    closeNotesModal();
    showToast('Notes saved.');
    await renderAdminOrders(document.getElementById('orderSearchInput')?.value || '');
  } catch (err) {
    showToast(err.message || 'Failed to save notes.', 'error');
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Notes';
  }
}

/* ─── Field validation ────────────────── */

function setFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('input-error');
  let hint = el.parentElement.querySelector('.field-hint.error-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'field-hint error-hint';
    el.parentElement.appendChild(hint);
  }
  hint.textContent = msg;
}

function clearFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('input-error');
  const hint = el.parentElement.querySelector('.field-hint.error-hint');
  if (hint) hint.remove();
}

function clearAllFieldErrors() {
  ['productName','productPrice','productCategory'].forEach(clearFieldError);
}

/* ─── Modal ───────────────────────────── */

let editingId = null;

function clearForm() {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value        = '';
  document.getElementById('productImageData').value = '';
  document.getElementById('productStockCount').value = '0';
  document.getElementById('productColors').value    = '';
  document.getElementById('productSizes').value     = '';
  const preview = document.getElementById('imagePreview');
  const label   = document.getElementById('imageUploadLabel');
  if (preview) { preview.src = ''; preview.classList.add('hidden'); }
  if (label)   label.classList.remove('hidden');
  document.getElementById('productInStock').checked = true;
  clearAllFieldErrors();
}

function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Product';
  clearForm();
  document.getElementById('productModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => document.getElementById('productName').focus(), 100);
}

function openEditModal(id, products) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  editingId = id;

  document.getElementById('modalTitle').textContent   = 'Edit Product';
  document.getElementById('productId').value          = id;
  document.getElementById('productName').value        = product.name;
  document.getElementById('productPrice').value       = product.price;
  document.getElementById('productCategory').value    = product.category;
  document.getElementById('productDescription').value = product.description || '';
  document.getElementById('productInStock').checked   = product.inStock;
  document.getElementById('productImageData').value   = product.image || '';
  document.getElementById('productStockCount').value  = product.stockCount || 0;
  document.getElementById('productColors').value      = Array.isArray(product.colors) ? product.colors.join(', ') : (product.colors || '');
  document.getElementById('productSizes').value       = Array.isArray(product.sizes)  ? product.sizes.join(', ')  : (product.sizes  || '');
  clearAllFieldErrors();

  const preview = document.getElementById('imagePreview');
  const label   = document.getElementById('imageUploadLabel');
  if (product.image) {
    preview.src = product.image;
    preview.classList.remove('hidden');
    if (label) label.classList.add('hidden');
  } else {
    preview.classList.add('hidden');
    if (label) label.classList.remove('hidden');
  }

  document.getElementById('productModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  clearAllFieldErrors();
  editingId = null;
}

/* ─── Save product ────────────────────── */

async function saveProduct(e) {
  e.preventDefault();
  clearAllFieldErrors();

  const name        = document.getElementById('productName').value.trim();
  const priceRaw    = document.getElementById('productPrice').value.trim();
  const price       = parseFloat(priceRaw);
  const category    = document.getElementById('productCategory').value;
  const description = document.getElementById('productDescription').value.trim();
  const image       = document.getElementById('productImageData').value;
  const inStock     = document.getElementById('productInStock').checked;
  const stockCount  = parseInt(document.getElementById('productStockCount').value || '0', 10) || 0;
  const colors      = document.getElementById('productColors').value.trim();
  const sizes       = document.getElementById('productSizes').value.trim();

  let hasError = false;
  if (!name)                             { setFieldError('productName',     'Product name is required.');    hasError = true; }
  if (!priceRaw || isNaN(price) || price < 0) { setFieldError('productPrice', 'Enter a valid price.');      hasError = true; }
  if (!category)                         { setFieldError('productCategory', 'Please select a category.');   hasError = true; }
  if (hasError) { showToast('Please fix the highlighted fields.', 'error'); return; }

  const saveBtn = document.getElementById('saveProductBtn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving\u2026';

  const payload = { name, price, category, description, image, inStock, stockCount, colors, sizes };

  try {
    if (editingId) {
      await updateProduct(editingId, payload);
      showToast('Product updated!');
    } else {
      await createProduct(payload);
      showToast('Product added!');
    }
    closeProductModal();
    await renderAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to save product.', 'error');
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Product';
  }
}

/* ─── Delete product ──────────────────── */

let pendingDeleteId = null;

function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirmModal').classList.remove('hidden');
}

async function executeDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  pendingDeleteId = null;
  document.getElementById('confirmModal').classList.add('hidden');
  try {
    await deleteProductById(id);
    showToast('Product deleted.');
    await renderAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to delete product.', 'error');
  }
}

/* ─── Image upload ────────────────────── */

function handleImageUpload(file) {
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { showToast('Image must be under 3 MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    document.getElementById('productImageData').value = dataUrl;
    const preview = document.getElementById('imagePreview');
    const label   = document.getElementById('imageUploadLabel');
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    if (label) label.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

/* ─── Tabs ────────────────────────────── */

function initTabs() {
  const tabBtns   = document.querySelectorAll('.admin-tab-btn');
  const tabPanels = document.querySelectorAll('.admin-tab-panel');
  if (!tabBtns.length) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      tabPanels.forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.tabPanel !== target);
      });
      if (target === 'orders')      renderAdminOrders(document.getElementById('orderSearchInput')?.value || '');
      if (target === 'email-logs')  renderEmailLogs();
    });
  });
}

/* ─── Init: Login page ────────────────── */

function initLoginPage() {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  checkSession().then(auth => { if (auth) window.location.href = 'admin-dashboard.html'; });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username  = document.getElementById('username').value.trim();
    const password  = document.getElementById('password').value;
    const errorEl   = document.getElementById('loginError');
    const submitBtn = form.querySelector('button[type="submit"]');

    if (errorEl) errorEl.classList.add('hidden');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logging in\u2026'; }

    try {
      await login(username, password);
      window.location.href = 'admin-dashboard.html';
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message || 'Invalid username or password.'; errorEl.classList.remove('hidden'); }
      document.getElementById('password').value = '';
      document.getElementById('password').focus();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
    }
  });

  ['username','password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const errorEl = document.getElementById('loginError');
      if (errorEl) errorEl.classList.add('hidden');
    });
  });
}

/* ─── Init: Dashboard page ────────────── */

async function initDashboardPage() {
  const authenticated = await checkSession();
  if (!authenticated) { window.location.href = 'admin-login.html'; return; }

  renderAdminProducts();
  initTabs();

  document.getElementById('addProductBtn').addEventListener('click', openAddModal);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('closeModal').addEventListener('click', closeProductModal);
  document.getElementById('cancelModal').addEventListener('click', closeProductModal);
  document.getElementById('productForm').addEventListener('submit', saveProduct);

  document.getElementById('cancelDelete').addEventListener('click', () => {
    pendingDeleteId = null;
    document.getElementById('confirmModal').classList.add('hidden');
  });
  document.getElementById('confirmDelete').addEventListener('click', executeDelete);

  document.getElementById('productModal').addEventListener('click', e => {
    if (e.target === document.getElementById('productModal')) closeProductModal();
  });

  document.getElementById('closeNotesModal')?.addEventListener('click', closeNotesModal);
  document.getElementById('cancelNotes')?.addEventListener('click', closeNotesModal);
  document.getElementById('saveNotes')?.addEventListener('click', saveNotes);
  document.getElementById('notesModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('notesModal')) closeNotesModal();
  });

  const imageInput = document.getElementById('productImage');
  if (imageInput) {
    imageInput.addEventListener('change', e => handleImageUpload(e.target.files[0]));
  }
  const preview = document.getElementById('imagePreview');
  const label   = document.getElementById('imageUploadLabel');
  if (preview) preview.addEventListener('click', () => imageInput?.click());
  if (label)   label.addEventListener('click',   () => imageInput?.click());

  ['productName','productPrice','productCategory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input',  () => clearFieldError(id));
    if (el) el.addEventListener('change', () => clearFieldError(id));
  });

  const orderSearch = document.getElementById('orderSearchInput');
  if (orderSearch) {
    let debounce;
    orderSearch.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => renderAdminOrders(orderSearch.value), 300);
    });
  }

  document.getElementById('testEmailBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('testEmailBtn');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const res = await sendTestEmail();
      if (res.success) showToast('Test email sent! Check your inbox.');
      else showToast('Email failed: ' + (res.error || 'unknown error'), 'error');
    } catch (err) {
      showToast(err.message || 'Failed to send test email.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Test Email';
    }
  });

  document.getElementById('refreshEmailLogsBtn')?.addEventListener('click', () => renderEmailLogs());
}

/* ─── Page init ───────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('admin-login'))      { initLoginPage(); }
  else if (path.includes('admin-dashboard')) { initDashboardPage(); }
});
