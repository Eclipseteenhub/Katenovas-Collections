'use strict';

/* ═══════════════════════════════════════
   KATENOVAS COLLECTIONS — admin.js
   Admin portal — talks to the API
   ═══════════════════════════════════════ */

const ADMIN_CREDS = { username: '@Eragbai50', password: '408258' };
const SESSION_KEY = 'kc_admin_session';
const API_BASE    = '/api';

/* ─── API helpers ─────────────────────── */

async function apiFetch(path, options) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
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

/* ─── Auth helpers ────────────────────── */

function isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === 'true'; }

function checkAuth() {
  if (!isLoggedIn()) window.location.href = 'admin-login.html';
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'admin-login.html';
}

/* ─── Helpers ─────────────────────────── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  try {
    products = await fetchProducts();
  } catch {
    showToast('Could not load products. Check your connection.', 'error');
    return;
  }

  if (products.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    updateStats(products);
    return;
  }

  if (empty) empty.classList.add('hidden');

  list.innerHTML = products.map(p => `
    <div class="admin-product-row">
      <div class="admin-product-img">
        ${p.image
          ? `<img src="${p.image}" alt="${escHtml(p.name)}" />`
          : `<div class="product-img-placeholder small">\uD83D\uDCE6</div>`
        }
      </div>
      <div class="admin-product-info">
        <h3>${escHtml(p.name)}</h3>
        <p class="admin-product-meta">
          <span>${escHtml(p.category)}</span> &bull;
          <strong>\u20a6${Number(p.price).toLocaleString('en-NG')}</strong> &bull;
          <span class="stock-badge ${p.inStock ? 'in-stock' : 'out-stock'}">
            ${p.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </p>
        ${p.description ? `<p class="admin-product-desc">${escHtml(p.description)}</p>` : ''}
      </div>
      <div class="admin-product-actions">
        <button class="btn btn-sm btn-outline" data-edit="${escHtml(p.id)}">Edit</button>
        <button class="btn btn-sm btn-danger"  data-delete="${escHtml(p.id)}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit, products));
  });
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.delete));
  });

  updateStats(products);
}

/* ─── Field validation helpers ────────── */

function setFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('input-error');
  let hint = el.parentElement.querySelector('.field-hint');
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
  const hint = el.parentElement.querySelector('.field-hint');
  if (hint) hint.remove();
}

function clearAllFieldErrors() {
  ['productName', 'productPrice', 'productCategory'].forEach(clearFieldError);
}

/* ─── Modal ───────────────────────────── */

let editingId = null;

function clearForm() {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value        = '';
  document.getElementById('productImageData').value = '';
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

  // Validate each field individually
  let hasError = false;

  if (!name) {
    setFieldError('productName', 'Product name is required.');
    hasError = true;
  }

  if (!priceRaw || isNaN(price) || price < 0) {
    setFieldError('productPrice', 'Enter a valid price (e.g. 5000).');
    hasError = true;
  }

  if (!category) {
    setFieldError('productCategory', 'Please select a category.');
    hasError = true;
  }

  if (hasError) {
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveProductBtn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving\u2026';

  try {
    if (editingId) {
      await updateProduct(editingId, { name, price, category, description, image, inStock });
      showToast('Product updated successfully!');
    } else {
      await createProduct({ name, price, category, description, image, inStock });
      showToast('Product added successfully!');
    }
    closeProductModal();
    await renderAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to save product. Try again.', 'error');
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
  if (file.size > 3 * 1024 * 1024) {
    showToast('Image must be under 3 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    document.getElementById('productImageData').value = dataUrl;
    const preview = document.getElementById('imagePreview');
    const label   = document.getElementById('imageUploadLabel');
    preview.src   = dataUrl;
    preview.classList.remove('hidden');
    if (label) label.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

/* ─── Init: Login page ────────────────── */

function initLoginPage() {
  if (isLoggedIn()) {
    window.location.href = 'admin-dashboard.html';
    return;
  }

  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl  = document.getElementById('loginError');

    if (username === ADMIN_CREDS.username && password === ADMIN_CREDS.password) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      window.location.href = 'admin-dashboard.html';
    } else {
      if (errorEl) errorEl.classList.remove('hidden');
      document.getElementById('password').value = '';
      document.getElementById('password').focus();
    }
  });

  // Hide error when user starts typing again
  ['username', 'password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const errorEl = document.getElementById('loginError');
      if (errorEl) errorEl.classList.add('hidden');
    });
  });
}

/* ─── Init: Dashboard page ────────────── */

function initDashboardPage() {
  checkAuth();
  renderAdminProducts();

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

  const imageInput = document.getElementById('productImage');
  if (imageInput) {
    imageInput.addEventListener('change', e => handleImageUpload(e.target.files[0]));
  }
  const preview = document.getElementById('imagePreview');
  const label   = document.getElementById('imageUploadLabel');
  if (preview) preview.addEventListener('click', () => imageInput && imageInput.click());
  if (label)   label.addEventListener('click',   () => imageInput && imageInput.click());

  // Clear field errors when user corrects inputs
  ['productName', 'productPrice', 'productCategory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearFieldError(id));
    if (el) el.addEventListener('change', () => clearFieldError(id));
  });
}

/* ─── Page init ───────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('admin-login'))      { initLoginPage(); }
  else if (path.includes('admin-dashboard')) { initDashboardPage(); }
});
