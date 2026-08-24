'use strict';

/* ═══════════════════════════════════════
   KATENOVAS COLLECTIONS — admin.js
   Admin portal — talks to the API
   ═══════════════════════════════════════ */

const API_BASE = '/api';
const ORDER_STATUSES = [
  'Pending', 'Processing', 'Ready for Dispatch',
  'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled',
  'Stock Review Required'
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
async function sendManualEmail(data) {
  return apiFetch('/email-logs/send', { method: 'POST', body: JSON.stringify(data) });
}

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

function safeImageSrc(value) {
  const image = String(value || '');
  if (/^https:\/\//i.test(image) || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(image)) {
    return escHtml(image);
  }
  return '';
}

const EMAIL_TEMPLATES = {
  order: ['Order update from Katenovas Collections', 'Hello! We have received your order and will begin preparing it shortly. We will keep you updated as it moves through delivery.'],
  delay: ['Update about your delivery', 'Hello! We are sorry, but your delivery is taking a little longer than expected. We will update you as soon as we have a confirmed delivery time.'],
  stock: ['Important update about your order', 'Hello! We are sorry to let you know that an item in your order is currently out of stock. Please reply so we can arrange a replacement or refund.'],
  payment: ['Payment reminder', 'Hello! This is a friendly reminder that your order is awaiting payment. Please contact us if you need any help completing checkout.'],
  thanks: ['Thank you for shopping with us', 'Hello! Thank you for choosing Katenovas Collections. We truly appreciate your order and hope you love it.'],
  refund: ['Update about your refund', 'Hello! We are writing to update you about your refund request. Please reply to this email if you have any questions.'],
  promotion: ['A special offer from Katenovas Collections', 'Hello! We have a special offer available for you. Reply to this email or contact us on WhatsApp for details.'],
};

function closeEmailComposer() {
  document.getElementById('emailComposerModal')?.classList.add('hidden');
  document.getElementById('emailPreview')?.classList.add('hidden');
}

function initEmailComposer() {
  const modal = document.getElementById('emailComposerModal');
  const form = document.getElementById('emailComposerForm');
  const template = document.getElementById('emailTemplate');
  const subject = document.getElementById('emailSubject');
  const message = document.getElementById('emailMessage');
  if (!modal || !form || !template || !subject || !message) return;

  document.getElementById('composeEmailBtn')?.addEventListener('click', () => {
    form.reset();
    modal.classList.remove('hidden');
    document.getElementById('emailRecipient')?.focus();
  });
  document.getElementById('closeEmailComposer')?.addEventListener('click', closeEmailComposer);
  document.getElementById('cancelEmailComposer')?.addEventListener('click', closeEmailComposer);
  modal.addEventListener('click', event => { if (event.target === modal) closeEmailComposer(); });
  template.addEventListener('change', () => {
    const selected = EMAIL_TEMPLATES[template.value];
    if (selected) { subject.value = selected[0]; message.value = selected[1]; }
  });
  document.getElementById('previewEmailBtn')?.addEventListener('click', () => {
    document.getElementById('emailPreviewSubject').textContent = subject.value || '(No subject)';
    document.getElementById('emailPreviewMessage').textContent = message.value || '(No message)';
    document.getElementById('emailPreview').classList.remove('hidden');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const recipient = document.getElementById('emailRecipient').value.trim();
    if (!recipient || !subject.value.trim() || !message.value.trim()) {
      showToast('Recipient, subject, and message are required.', 'error');
      return;
    }
    const button = document.getElementById('sendManualEmailBtn');
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await sendManualEmail({ recipient, subject: subject.value.trim(), message: message.value.trim() });
      showToast('Email sent successfully.');
      closeEmailComposer();
      renderEmailLogs();
    } catch (error) {
      showToast(error.message || 'Could not send email.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Send Email';
    }
  });
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
  const inStock = products.filter(p => p.inStock && Number(p.stockCount) > 0).length;
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
        ${safeImageSrc(p.image)
          ? `<img src="${safeImageSrc(p.image)}" alt="${escHtml(p.name)}" />`
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
let keepVideoForNext = false;

function clearForm() {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value        = '';
  document.getElementById('productImageData').value = '';
  document.getElementById('productVideoData').value = '';
  videoTrim = { start: 0, end: 0, muted: false, cuts: [] };
  document.getElementById('productStockCount').value = '0';
  document.getElementById('productColors').value    = '';
  document.getElementById('productSizes').value     = '';
  const preview = document.getElementById('imagePreview');
  const label   = document.getElementById('imageUploadLabel');
  if (preview) { preview.src = ''; preview.classList.add('hidden'); }
  if (label)   label.classList.remove('hidden');
  const vp = document.getElementById('videoPreview');
  const vl = document.getElementById('videoUploadLabel');
  const vb = document.getElementById('videoEditBar');
  const vi = document.getElementById('productVideo');
  const sa2 = document.getElementById('saveAndAnotherBtn');
  const mh2 = document.getElementById('multiHint');
  if (vp) { vp.pause(); vp.removeAttribute('src'); vp.classList.add('hidden'); vp.style.pointerEvents = 'none'; }
  if (vl) vl.classList.remove('hidden');
  if (vb) vb.classList.add('hidden');
  if (vi) { vi.style.display = ''; vi.style.pointerEvents = ''; vi.value = ''; }
  if (sa2) sa2.style.display = 'none';
  if (mh2) mh2.classList.add('hidden');
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

  let vSrc = product.video || '';
  let vMeta = { start: 0, end: 0, muted: false, cuts: [] };
  try { if (vSrc && vSrc.trim().startsWith('{')) { const o=JSON.parse(vSrc); vSrc=o.src||''; vMeta={ start:o.trimStart||0, end:o.trimEnd||0, muted:!!o.muted, cuts: o.cuts || [] }; } } catch {}
  document.getElementById('productVideoData').value = product.video || '';
  videoTrim = { start: vMeta.start, end: vMeta.end || 0, muted: vMeta.muted, cuts: vMeta.cuts || [] };
  const vPreview = document.getElementById('videoPreview');
  const vLabel = document.getElementById('videoUploadLabel');
  const vBar = document.getElementById('videoEditBar');
  const vInput = document.getElementById('productVideo');
  if (vSrc) {
    vPreview.src = vSrc; vPreview.classList.remove('hidden'); vPreview.style.pointerEvents = 'auto';
    if (vLabel) vLabel.classList.add('hidden');
    if (vBar) vBar.classList.remove('hidden');
    if (vInput) { vInput.style.display = 'none'; vInput.style.pointerEvents = 'none'; }
    if (vMeta.muted) vPreview.muted = true;
  } else {
    vPreview.removeAttribute('src'); vPreview.classList.add('hidden'); vPreview.style.pointerEvents = 'none';
    if (vLabel) vLabel.classList.remove('hidden');
    if (vBar) vBar.classList.add('hidden');
    if (vInput) { vInput.style.display = ''; vInput.style.pointerEvents = ''; }
  }

  document.getElementById('productModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  clearAllFieldErrors();
  editingId = null;
  videoTrim = { start: 0, end: 0, muted: false, cuts: [] };
  const vp = document.getElementById('videoPreview');
  if (vp) { vp.pause(); vp.removeAttribute('src'); vp.classList.add('hidden'); vp.style.pointerEvents = 'none'; }
  const vl = document.getElementById('videoUploadLabel');
  if (vl) vl.classList.remove('hidden');
  const vb = document.getElementById('videoEditBar');
  if (vb) vb.classList.add('hidden');
  const vi2 = document.getElementById('productVideo');
  if (vi2) { vi2.style.display = ''; vi2.style.pointerEvents = ''; }
  const ve = document.getElementById('videoEditorModal');
  if (ve) ve.classList.add('hidden');
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
  let video       = document.getElementById('productVideoData').value || '';
  // If video was already JSON, unwrap src first
  let _vSrc = video; try { if (_vSrc && _vSrc.trim().startsWith('{')) _vSrc = JSON.parse(_vSrc).src || _vSrc; } catch {}
  if (video && (videoTrim.muted || videoTrim.start > 0.05 || (videoTrim.end && Math.abs(videoTrim.end - (document.getElementById('videoPreview')?.duration || 0)) > 0.5) || (videoTrim.cuts && videoTrim.cuts.length))) {
    try { video = JSON.stringify({ src: _vSrc, trimStart: videoTrim.start, trimEnd: videoTrim.end, muted: videoTrim.muted, cuts: videoTrim.cuts || [] }); } catch {}
  }

  let hasError = false;
  if (!name)                             { setFieldError('productName',     'Product name is required.');    hasError = true; }
  if (!priceRaw || isNaN(price) || price <= 0) { setFieldError('productPrice', 'Enter a valid price greater than zero.');      hasError = true; }
  if (!Number.isInteger(stockCount) || stockCount < 0) { showToast('Stock count must be a whole number of zero or more.', 'error'); hasError = true; }
  if (!category)                         { setFieldError('productCategory', 'Please select a category.');   hasError = true; }
  if (hasError) { showToast('Please fix the highlighted fields.', 'error'); return; }

  const saveBtn = document.getElementById('saveProductBtn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving\u2026';

  const payload = { name, price, category, description, image, video, inStock, stockCount, colors, sizes };

  try {
    if (editingId) {
      await updateProduct(editingId, payload);
      showToast('Product updated!');
      closeProductModal();
    } else {
      await createProduct(payload);
      if (keepVideoForNext && video) {
        showToast('Product added! Video kept — trim to next product\'s section and save again.');
        document.getElementById('productName').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productCategory').value = '';
        document.getElementById('productDescription').value = '';
        document.getElementById('productColors').value = '';
        document.getElementById('productSizes').value = '';
        document.getElementById('productStockCount').value = '0';
        document.getElementById('productInStock').checked = true;
        document.getElementById('productImageData').value = '';
        const ip2 = document.getElementById('imagePreview');
        const il2 = document.getElementById('imageUploadLabel');
        if (ip2) { ip2.src = ''; ip2.classList.add('hidden'); }
        if (il2) il2.classList.remove('hidden');
        const vp2 = document.getElementById('videoPreview');
        videoTrim = { start: 0, end: vp2?.duration || videoTrim.end || 0, muted: false, cuts: [] };
        keepVideoForNext = false;
        await renderAdminProducts();
        return;
      } else {
        showToast('Product added!');
        closeProductModal();
      }
    }
    await renderAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to save product.', 'error');
  } finally {
    keepVideoForNext = false;
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
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    showToast('Please upload a PNG, JPEG, WebP, or GIF image.', 'error');
    return;
  }
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

let videoTrim = { start: 0, end: 0, muted: false, cuts: [] };

function handleVideoUpload(file) {
  if (!file) return;
  if (!['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'].includes(file.type) && !file.type.startsWith('video/')) {
    showToast('Please upload MP4, MOV, or WEBM video.', 'error'); return;
  }
  if (file.size > 20 * 1024 * 1024) { showToast('Video must be under 20 MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    document.getElementById('productVideoData').value = dataUrl;
    const preview = document.getElementById('videoPreview');
    const label = document.getElementById('videoUploadLabel');
    const bar = document.getElementById('videoEditBar');
    const input = document.getElementById('productVideo');
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    preview.style.pointerEvents = 'auto';
    if (label) label.classList.add('hidden');
    if (bar) bar.classList.remove('hidden');
    if (input) { input.style.display = 'none'; input.style.pointerEvents = 'none'; }
    const sa = document.getElementById('saveAndAnotherBtn');
    const mh = document.getElementById('multiHint');
    if (sa) sa.style.display = ''; if (mh) mh.classList.remove('hidden');
    preview.onloadedmetadata = () => {
      videoTrim = { start: 0, end: preview.duration || 0, muted: false, cuts: [] };
      if (!document.getElementById('productImageData').value) {
        setTimeout(() => captureFrame(preview, 0.5), 600);
      }
    };
  };
  reader.readAsDataURL(file);
}

function captureFrame(videoEl, timeSec) {
  try {
    const canvas = document.getElementById('frameCanvas');
    const t = Math.max(0, Math.min(timeSec, (videoEl.duration || 1) - 0.1));
    const prevTime = videoEl.currentTime;
    const doCapture = () => {
      canvas.width = videoEl.videoWidth || 640;
      canvas.height = videoEl.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      document.getElementById('productImageData').value = dataUrl;
      const preview = document.getElementById('imagePreview');
      const label = document.getElementById('imageUploadLabel');
      preview.src = dataUrl;
      preview.classList.remove('hidden');
      if (label) label.classList.add('hidden');
      showToast('Cover updated from video frame.');
      videoEl.currentTime = prevTime;
      videoEl.removeEventListener('seeked', doCapture);
    };
    if (Math.abs(videoEl.currentTime - t) < 0.05) doCapture();
    else { videoEl.addEventListener('seeked', doCapture, { once: true }); videoEl.currentTime = t; }
  } catch {}
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

  const videoInput = document.getElementById('productVideo');
  if (videoInput) videoInput.addEventListener('change', e => handleVideoUpload(e.target.files[0]));
  document.getElementById('clearVideoBtn')?.addEventListener('click', () => {
  document.getElementById('productVideoData').value = '';
  videoTrim = { start: 0, end: 0, muted: false, cuts: [] };
  const vp = document.getElementById('videoPreview');
  if (vp) { vp.pause(); vp.removeAttribute('src'); vp.classList.add('hidden'); vp.style.pointerEvents = 'none'; }
  const vi = document.getElementById('productVideo');
  if (vi) { vi.style.display = ''; vi.style.pointerEvents = ''; vi.value = ''; }
  document.getElementById('videoUploadLabel')?.classList.remove('hidden');
  document.getElementById('videoEditBar')?.classList.add('hidden');
  const saC = document.getElementById('saveAndAnotherBtn');
  const mhC = document.getElementById('multiHint');
  if (saC) saC.style.display = 'none';
  if (mhC) mhC.classList.add('hidden');
  });
  document.getElementById('pickCoverFrame')?.addEventListener('click', () => {
    const vp = document.getElementById('videoPreview');
    if (!vp || !vp.src) { showToast('Upload a video first.', 'error'); return; }
    captureFrame(vp, vp.currentTime || 0.5);
  });
  // Video editor modal
  const edModal = document.getElementById('videoEditorModal');
  const edVideo = document.getElementById('editorVideo');
  const trimS = document.getElementById('trimStart');
  const trimE = document.getElementById('trimEnd');
  const trimLabel = document.getElementById('trimLabel');
  const muteToggle = document.getElementById('muteToggle');
  function openVideoEditor() {
    const src = document.getElementById('productVideoData').value;
    if (!src) { showToast('Upload a video first.', 'error'); return; }
    let s = src; try { if (s.trim().startsWith('{')) s = JSON.parse(s).src; } catch {}
    edVideo.src = s; edVideo.muted = videoTrim.muted;
    edVideo.onloadedmetadata = () => {
      const d = edVideo.duration || 10;
      trimS.max = String(Math.floor(d * 10) / 10); trimE.max = String(Math.floor(d * 10) / 10);
      trimS.value = String(videoTrim.start || 0); trimE.value = String(videoTrim.end || d);
      if (muteToggle) muteToggle.checked = !!videoTrim.muted;
      const upd = () => { if (trimLabel) trimLabel.textContent = parseFloat(trimS.value).toFixed(1) + 's — ' + parseFloat(trimE.value).toFixed(1) + 's'; };
      trimS.oninput = upd; trimE.oninput = upd; upd();
      renderCuts();
    };
    if (!edVideo.duration) renderCuts();
    edModal.classList.remove('hidden'); document.body.classList.add('modal-open');
  }
  // Split & cut handling
  const splitBtn = document.getElementById('splitBtn');
  const cutsList = document.getElementById('cutsList');
  const splitInfo = document.getElementById('splitInfo');
  function renderCuts() {
    if (!cutsList) return;
    const cuts = videoTrim.cuts || [];
    if (!cuts.length) { cutsList.innerHTML = '<span style="font-size:0.75rem;color:#999;">No cuts yet. Pause video where you want to cut, then press Split.</span>'; if (splitInfo) splitInfo.textContent = ''; return; }
    cutsList.innerHTML = cuts.map((c,i) => `<div style="display:flex;align-items:center;gap:0.5rem;background:#fff5f5;border:1px solid #f0d0d0;padding:0.4rem 0.6rem;border-radius:6px;font-size:0.78rem;"><span>✂️ ${c.start.toFixed(1)}s → ${c.end.toFixed(1)}s</span><span style="color:#999;">will be skipped</span><button data-idx="${i}" class="remove-cut" style="margin-left:auto;color:var(--red);background:none;border:none;cursor:pointer;font-size:0.75rem;">Remove</button></div>`).join('');
    cutsList.querySelectorAll('.remove-cut').forEach(b => b.addEventListener('click', () => { videoTrim.cuts.splice(parseInt(b.dataset.idx),1); renderCuts(); }));
    if (splitInfo) splitInfo.textContent = cuts.length + ' cut' + (cuts.length>1?'s':'') + ' • storefront will skip ' + cuts.map(c=> (c.end-c.start).toFixed(1)+'s').join(', ');
  }
  splitBtn?.addEventListener('click', () => {
    if (!edVideo.src) { showToast('Load a video first.', 'error'); return; }
    const t = edVideo.currentTime;
    const d = edVideo.duration || 0;
    const s = parseFloat(trimS.value) || 0;
    const e = parseFloat(trimE.value) || d;
    if (t <= s + 0.3 || t >= e - 0.3) { showToast('Move playhead inside the trim range to split.', 'error'); return; }
    const cutEnd = Math.min(t + 2, e);
    videoTrim.cuts = videoTrim.cuts || [];
    videoTrim.cuts.push({ start: t, end: cutEnd });
    // keep cuts sorted
    videoTrim.cuts.sort((a,b)=>a.start-b.start);
    renderCuts();
    showToast('Cut added: ' + t.toFixed(1) + 's → ' + cutEnd.toFixed(1) + 's will be removed on playback. Drag end to adjust (2s default).');
  });
  // Enforce trim/cuts during editor preview
  edVideo.addEventListener('timeupdate', () => {
    const cur = edVideo.currentTime;
    const s = parseFloat(trimS?.value) || videoTrim.start || 0;
    const e = parseFloat(trimE?.value) || videoTrim.end || edVideo.duration || 0;
    if (cur < s) { edVideo.currentTime = s; return; }
    if (e && cur >= e - 0.15) { edVideo.pause(); return; }
    for (const c of (videoTrim.cuts || [])) {
      if (cur >= c.start && cur < c.end - 0.05) { edVideo.currentTime = c.end; break; }
    }
  });
  document.getElementById('openVideoEditor')?.addEventListener('click', openVideoEditor);
  document.getElementById('closeVideoEditor')?.addEventListener('click', () => { edModal.classList.add('hidden'); document.body.classList.remove('modal-open'); });
  document.getElementById('cancelVideoEdit')?.addEventListener('click', () => { edModal.classList.add('hidden'); document.body.classList.remove('modal-open'); });
  edModal?.addEventListener('click', e => { if (e.target === edModal) { edModal.classList.add('hidden'); document.body.classList.remove('modal-open'); } });
  document.getElementById('applyVideoEdit')?.addEventListener('click', () => {
    videoTrim.start = parseFloat(trimS.value) || 0;
    videoTrim.end = parseFloat(trimE.value) || (edVideo.duration || 0);
    videoTrim.muted = !!muteToggle?.checked;
    const vp = document.getElementById('videoPreview');
    if (vp) { vp.muted = videoTrim.muted; vp.currentTime = videoTrim.start; }
    showToast(videoTrim.muted ? 'Video muted — will save muted.' : 'Trim applied — storefront will respect start/end.');
    edModal.classList.add('hidden'); document.body.classList.remove('modal-open');
  });
  document.getElementById('saveAndAnotherBtn')?.addEventListener('click', () => {
    keepVideoForNext = true;
    document.getElementById('productForm').requestSubmit();
  });

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
  initEmailComposer();
  initNotifications();
}

async function initNotifications() {
  const bell = document.getElementById('notifBell');
  const dropdown = document.getElementById('notifDropdown');
  const countEl = document.getElementById('notifCount');
  const listEl = document.getElementById('notifList');
  const emptyEl = document.getElementById('noNotifs');
  const markAllBtn = document.getElementById('markAllReadBtn');
  if (!bell || !dropdown) return;

  async function fetchNotifs() {
    try {
      const data = await apiFetch('/notifications');
      const notifs = data.notifications || [];
      const unread = data.unreadCount ?? notifs.filter(n=>!n.isRead).length;
      if (countEl) {
        if (unread > 0) { countEl.textContent = unread > 99 ? '99+' : String(unread); countEl.classList.remove('hidden'); }
        else countEl.classList.add('hidden');
      }
      if (listEl) {
        if (!notifs.length) { listEl.innerHTML = ''; if (emptyEl) emptyEl.style.display = 'block'; return; }
        if (emptyEl) emptyEl.style.display = 'none';
        listEl.innerHTML = notifs.map(n => `
          <div style="padding:0.7rem 0.9rem;border-bottom:1px solid #f0ebe3;display:flex;gap:0.6rem;${n.isRead?'opacity:0.6':''}">
            <div style="font-size:1.1rem;">${n.type.includes('order') ? '🛒' : n.type.includes('payment') ? '💳' : n.type.includes('stock') ? '⚠️' : '🔔'}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.85rem;">${escHtml(n.title)}</div>
              <div style="font-size:0.8rem;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(n.message)}</div>
              <div style="font-size:0.7rem;color:#aaa;">${new Date(n.createdAt).toLocaleString()}</div>
            </div>
            ${!n.isRead ? `<button data-id="${n.id}" class="mark-read-btn" style="align-self:center;font-size:0.7rem;color:var(--burgundy);background:none;border:none;cursor:pointer;">Mark read</button>` : ''}
          </div>
        `).join('');
        listEl.querySelectorAll('.mark-read-btn').forEach(b => b.addEventListener('click', async () => {
          await apiFetch('/notifications/' + b.dataset.id + '/read', { method: 'PATCH' });
          fetchNotifs();
        }));
      }
    } catch {}
  }

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) fetchNotifs();
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== bell && !bell.contains(e.target)) dropdown.classList.add('hidden');
  });
  markAllBtn?.addEventListener('click', async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    fetchNotifs();
  });

  fetchNotifs();
  setInterval(fetchNotifs, 30000);
}

/* ─── Page init ───────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('admin-login'))      { initLoginPage(); }
  else if (path.includes('admin-dashboard')) { initDashboardPage(); }
});
