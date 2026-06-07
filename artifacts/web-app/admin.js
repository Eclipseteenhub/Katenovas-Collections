'use strict';

/* ═══════════════════════════════════════
   KATENOVAS COLLECTIONS — admin.js
   Admin portal
   ═══════════════════════════════════════ */

const ADMIN_CREDS  = { username: '@Eragbai50', password: '408258' };
const SESSION_KEY  = 'kc_admin_session';
const PRODUCTS_KEY = 'kc_products';

/* ─── Auth helpers ────────────────────── */

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

function checkAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'admin-login.html';
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'admin-login.html';
}

/* ─── Storage helpers ─────────────────── */

function getProducts() {
  try {
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

function generateId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/* ─── Escape HTML ─────────────────────── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Toast ───────────────────────────── */

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = 'toast' + (type ? ' toast-' + type : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ─── Stats ───────────────────────────── */

function updateStats() {
  const products = getProducts();
  const inStock  = products.filter(p => p.inStock).length;
  const totalEl  = document.getElementById('totalProducts');
  const inEl     = document.getElementById('inStockCount');
  const outEl    = document.getElementById('outStockCount');
  if (totalEl) totalEl.textContent = products.length;
  if (inEl)    inEl.textContent    = inStock;
  if (outEl)   outEl.textContent   = products.length - inStock;
}

/* ─── Render: Admin product list ──────── */

function renderAdminProducts() {
  const list  = document.getElementById('adminProductsList');
  const empty = document.getElementById('noProducts');
  if (!list) return;

  const products = getProducts();

  if (products.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    updateStats();
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
        <button class="btn btn-sm btn-outline" onclick="openEditModal('${escHtml(p.id)}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${escHtml(p.id)}')">Delete</button>
      </div>
    </div>
  `).join('');

  updateStats();
}

/* ─── Modal: open / close ─────────────── */

let editingId = null;

function clearForm() {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value       = '';
  document.getElementById('productImageData').value = '';
  const preview = document.getElementById('imagePreview');
  const label   = document.getElementById('imageUploadLabel');
  preview.src   = '';
  preview.classList.add('hidden');
  label.classList.remove('hidden');
  document.getElementById('productInStock').checked = true;
}

function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Product';
  clearForm();
  document.getElementById('productModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function openEditModal(id) {
  const product = getProducts().find(p => p.id === id);
  if (!product) return;
  editingId = id;

  document.getElementById('modalTitle').textContent      = 'Edit Product';
  document.getElementById('productId').value             = id;
  document.getElementById('productName').value           = product.name;
  document.getElementById('productPrice').value          = product.price;
  document.getElementById('productCategory').value       = product.category;
  document.getElementById('productDescription').value    = product.description || '';
  document.getElementById('productInStock').checked      = product.inStock;
  document.getElementById('productImageData').value      = product.image || '';

  const preview = document.getElementById('imagePreview');
  const label   = document.getElementById('imageUploadLabel');

  if (product.image) {
    preview.src = product.image;
    preview.classList.remove('hidden');
    label.classList.add('hidden');
  } else {
    preview.classList.add('hidden');
    label.classList.remove('hidden');
  }

  document.getElementById('productModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  editingId = null;
}

/* ─── Save product ────────────────────── */

function saveProduct(e) {
  e.preventDefault();

  const name        = document.getElementById('productName').value.trim();
  const price       = parseFloat(document.getElementById('productPrice').value);
  const category    = document.getElementById('productCategory').value;
  const description = document.getElementById('productDescription').value.trim();
  const image       = document.getElementById('productImageData').value;
  const inStock     = document.getElementById('productInStock').checked;

  if (!name || isNaN(price) || price < 0 || !category) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  const products = getProducts();

  if (editingId) {
    const idx = products.findIndex(p => p.id === editingId);
    if (idx !== -1) {
      products[idx] = { ...products[idx], name, price, category, description, image, inStock };
    }
    showToast('Product updated!');
  } else {
    products.unshift({
      id: generateId(),
      name, price, category, description, image, inStock,
      createdAt: Date.now()
    });
    showToast('Product added!');
  }

  saveProducts(products);
  renderAdminProducts();
  closeProductModal();
}

/* ─── Delete product ──────────────────── */

let pendingDeleteId = null;

function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function executeDelete() {
  if (!pendingDeleteId) return;
  const products = getProducts().filter(p => p.id !== pendingDeleteId);
  saveProducts(products);
  pendingDeleteId = null;
  document.getElementById('confirmModal').classList.add('hidden');
  renderAdminProducts();
  showToast('Product deleted.');
}

/* ─── Image upload ────────────────────── */

function handleImageUpload(file) {
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be under 2 MB.', 'error');
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
    label.classList.add('hidden');
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
      errorEl.classList.remove('hidden');
      document.getElementById('password').value = '';
      document.getElementById('password').focus();
    }
  });
}

/* ─── Init: Dashboard page ────────────── */

function initDashboardPage() {
  checkAuth();
  renderAdminProducts();

  /* Buttons */
  document.getElementById('addProductBtn')
    .addEventListener('click', openAddModal);

  document.getElementById('logoutBtn')
    .addEventListener('click', logout);

  document.getElementById('closeModal')
    .addEventListener('click', closeProductModal);

  document.getElementById('cancelModal')
    .addEventListener('click', closeProductModal);

  document.getElementById('productForm')
    .addEventListener('submit', saveProduct);

  /* Delete confirm modal */
  document.getElementById('cancelDelete').addEventListener('click', () => {
    pendingDeleteId = null;
    document.getElementById('confirmModal').classList.add('hidden');
  });

  document.getElementById('confirmDelete')
    .addEventListener('click', executeDelete);

  /* Close product modal by clicking overlay */
  document.getElementById('productModal').addEventListener('click', e => {
    if (e.target === document.getElementById('productModal')) {
      closeProductModal();
    }
  });

  /* Image upload */
  const imageInput = document.getElementById('productImage');
  if (imageInput) {
    imageInput.addEventListener('change', e => handleImageUpload(e.target.files[0]));
  }

  document.getElementById('imagePreview').addEventListener('click', () => {
    document.getElementById('productImage').click();
  });

  document.getElementById('imageUploadLabel').addEventListener('click', () => {
    document.getElementById('productImage').click();
  });
}

/* ─── Page init ───────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  if (path.includes('admin-login')) {
    initLoginPage();
  } else if (path.includes('admin-dashboard')) {
    initDashboardPage();
  }
});
