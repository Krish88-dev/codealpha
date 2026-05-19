const apiBase = '/api';
const cartKey = 'codealpha_cart';
const authKey = 'codealpha_token';
const userKey = 'codealpha_user';
let allProducts = [];

const socket = typeof io === 'function' ? io() : null;

const getToken = () => localStorage.getItem(authKey);
const setToken = (token) => localStorage.setItem(authKey, token);
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(userKey) || 'null');
  } catch {
    return null;
  }
};
const setUser = (user) => localStorage.setItem(userKey, JSON.stringify(user));
const clearAuth = () => {
  localStorage.removeItem(authKey);
  localStorage.removeItem(userKey);
};
const getCart = () => JSON.parse(localStorage.getItem(cartKey) || '[]');
const setCart = (cart) => localStorage.setItem(cartKey, JSON.stringify(cart));

const formatCurrency = (value) => Number(value).toLocaleString('en-IN', {
  style: 'currency',
  currency: 'INR'
});

const updateCartCount = () => {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('#cart-count').forEach(el => el.textContent = count);
};

const showNotification = (message) => {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.padding = '16px 22px';
    toast.style.background = 'rgba(15, 23, 42, 0.96)';
    toast.style.color = '#f8fafc';
    toast.style.borderRadius = '18px';
    toast.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.18)';
    toast.style.zIndex = 9999;
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(-8px)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(0)';
  }, 3800);
};

const fetchJson = async (url, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(url, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (res.status === 401) {
    clearAuth();
    showNotification('Session expired — please login again.');
    window.location.href = 'login.html';
    return data;
  }
  if (!res.ok) throw data || { message: 'Request failed' };
  return data;
};

const updateUserArea = () => {
  const area = document.getElementById('user-area');
  if (!area) return;
  const user = getUser();
  if (user) {
    area.innerHTML = `
      <span class="user-pill">Hi, ${user.username}</span>
      <button id="logout-button" class="secondary-button logout-button">Logout</button>
    `;
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        clearAuth();
        updateUserArea();
        window.location.href = 'index.html';
      });
    }
  } else {
    area.innerHTML = `
      <a href="login.html">Login</a>
      <a href="register.html">Register</a>
    `;
  }
};

const getFilteredProducts = () => {
  const query = document.getElementById('product-search')?.value.toLowerCase().trim() || '';
  const sortValue = document.getElementById('product-sort')?.value || '';
  let filtered = [...allProducts];

  if (query) {
    filtered = filtered.filter((product) => {
      return product.name.toLowerCase().includes(query)
        || product.description.toLowerCase().includes(query);
    });
  }

  if (sortValue) {
    filtered.sort((a, b) => {
      if (sortValue === 'price_asc') return a.price - b.price;
      if (sortValue === 'price_desc') return b.price - a.price;
      if (sortValue === 'name_asc') return a.name.localeCompare(b.name);
      if (sortValue === 'name_desc') return b.name.localeCompare(a.name);
      return 0;
    });
  }

  return filtered;
};

const renderProductCards = (products) => {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = '<div class="product-card"><div class="product-card-content"><h3>No products found.</h3><p>Try a different search or clear filters.</p></div></div>';
    return;
  }

  grid.innerHTML = products.map(product => `
    <article class="product-card">
      <img src="${product.imageUrl}" alt="${product.name}" />
      <div class="product-card-content">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="price-row">
          <strong>${formatCurrency(product.price)}</strong>
          <span>${product.stock} in stock</span>
        </div>
        <div class="product-actions">
          <a class="primary-button" href="product.html?id=${product._id}">View details</a>
          <button class="primary-button" data-add="${product._id}">Add to cart</button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => addToCart(button.dataset.add));
  });
};

const initProductTools = () => {
  const searchInput = document.getElementById('product-search');
  const sortSelect = document.getElementById('product-sort');
  const clearBtn = document.getElementById('clear-filters');

  if (searchInput) {
    searchInput.addEventListener('input', () => renderProductCards(getFilteredProducts()));
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => renderProductCards(getFilteredProducts()));
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = '';
      renderProductCards(getFilteredProducts());
    });
  }
};

const showProducts = async () => {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  allProducts = await fetchJson(`${apiBase}/products`);
  renderProductCards(getFilteredProducts());
  initProductTools();
};

const addToCart = (productId) => {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId);
  if (item) item.quantity += 1;
  else cart.push({ productId, quantity: 1 });
  setCart(cart);
  updateCartCount();
  showNotification('Added item to cart');
};

const renderProductDetail = async () => {
  const detail = document.getElementById('product-detail');
  if (!detail) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    detail.innerHTML = '<p>Product ID missing.</p>';
    return;
  }

  const product = await fetchJson(`${apiBase}/products/${id}`);
  detail.innerHTML = `
    <img src="${product.imageUrl}" alt="${product.name}" />
    <div class="product-detail-content">
      <div class="detail-intro">
        <span class="eyebrow">Product Details</span>
        <h2>${product.name}</h2>
        <p>${product.description}</p>
      </div>
      <div class="product-detail-meta">
        <span class="pill">Price: ${formatCurrency(product.price)}</span>
        <span class="pill">Stock: ${product.stock}</span>
        <span class="pill">SKU: ${product._id.slice(-8).toUpperCase()}</span>
      </div>
      <div class="detail-grid">
        <div class="detail-box">
          <h3>Key highlights</h3>
          <ul>
            <li>Premium quality and finish</li>
            <li>Free delivery within India</li>
            <li>30-day easy returns</li>
          </ul>
        </div>
        <div class="detail-box detail-summary">
          <h3>Order summary</h3>
          <p><strong>Buying this item is easy.</strong></p>
          <p>Enjoy fast checkout plus instant notification when the order is placed.</p>
          <button class="primary-button" id="add-product-to-cart">Add to cart</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-product-to-cart').addEventListener('click', () => addToCart(product._id));
};

const renderCart = async () => {
  const list = document.getElementById('cart-list');
  const subtotalEl = document.getElementById('cart-subtotal');
  const checkoutButton = document.getElementById('checkout-button');
  const message = document.getElementById('checkout-message');
  if (!list || !subtotalEl || !checkoutButton) return;

  const cart = getCart();
  if (cart.length === 0) {
    list.innerHTML = '<div class="product-card"><div class="product-card-content"><h3>Your cart is empty</h3><p>Add items to begin checkout.</p></div></div>';
    subtotalEl.textContent = formatCurrency(0);
    checkoutButton.disabled = true;
    return;
  }

  const products = await fetchJson(`${apiBase}/products`);
  const productMap = Object.fromEntries(products.map(p => [p._id, p]));
  let total = 0;

  list.innerHTML = cart.map(item => {
    const product = productMap[item.productId];
    if (!product) return '';
    const lineTotal = product.price * item.quantity;
    total += lineTotal;
    return `
      <div class="cart-item">
        <div>
          <h3>${product.name}</h3>
          <p>Qty: ${item.quantity}</p>
          <p>${formatCurrency(product.price)} each</p>
          <p><strong>Line:</strong> ${formatCurrency(lineTotal)}</p>
        </div>
        <div>
          <button class="quantity-button" data-action="minus" data-id="${item.productId}">-</button>
          <button class="quantity-button" data-action="plus" data-id="${item.productId}">+</button>
          <button class="remove-button" data-remove="${item.productId}">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  subtotalEl.textContent = formatCurrency(total);
  checkoutButton.disabled = false;
  message.textContent = '';

  list.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const productId = button.dataset.id;
      const action = button.dataset.action;
      const item = cart.find(i => i.productId === productId);
      if (!item) return;
      if (action === 'plus') item.quantity += 1;
      if (action === 'minus') item.quantity = Math.max(1, item.quantity - 1);
      setCart(cart.filter(i => i.quantity > 0));
      renderCart();
      updateCartCount();
    });
  });

  list.querySelectorAll('[data-remove]').forEach(button => {
    button.addEventListener('click', () => {
      const productId = button.dataset.remove;
      setCart(cart.filter(i => i.productId !== productId));
      renderCart();
      updateCartCount();
    });
  });

  checkoutButton.addEventListener('click', async () => {
    const token = getToken();
    if (!token) {
      message.textContent = 'Please login to checkout.';
      return;
    }
    const response = await fetchJson(`${apiBase}/orders`, {
      method: 'POST',
      body: JSON.stringify({ items: cart })
    });
    if (response.orderId) {
      setCart([]);
      renderCart();
      updateCartCount();
      showNotification(`Order #${response.orderId} placed successfully`);
      message.textContent = `Order #${response.orderId} created. Total: ${formatCurrency(response.total)}`;
    } else {
      message.textContent = response.message || 'Checkout failed.';
    }
  });
};

const renderOrders = async () => {
  const ordersList = document.getElementById('orders-list');
  if (!ordersList) return;

  const token = getToken();
  if (!token) {
    ordersList.innerHTML = '<div class="auth-card"><p class="info-text">Please log in to view your order history.</p></div>';
    return;
  }

  const orders = await fetchJson(`${apiBase}/orders`);
  if (!Array.isArray(orders) || orders.length === 0) {
    ordersList.innerHTML = '<div class="product-card"><div class="product-card-content"><h3>No orders yet</h3><p>Place a purchase and come back to track it here.</p></div></div>';
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    return `
    <article class="order-card">
      <div class="order-meta">
        <div>
          <h3>Order #${order._id}</h3>
          <span>${new Date(order.createdAt).toLocaleString()}</span>
        </div>
        <div class="order-summary-badge">
          <span>${itemCount} item${itemCount === 1 ? '' : 's'}</span>
          <strong>${formatCurrency(order.total)}</strong>
        </div>
      </div>
      <div class="order-status">Status: <strong>Processing</strong></div>
      ${order.items.map(item => `
        <div class="order-item">
          <div>
            <strong>${item.productId?.name || 'Product'}</strong>
            <p>Qty: ${item.quantity}</p>
          </div>
          <div>
            <p>${formatCurrency(item.unitPrice)}</p>
            <p class="item-total">${formatCurrency(item.unitPrice * item.quantity)}</p>
          </div>
        </div>
      `).join('')}
      <div class="order-row">
        <span>Expected delivery</span>
        <span>5-7 business days</span>
      </div>
    </article>
  `;
  }).join('');
};

const handleAuthForms = () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const response = await fetchJson(`${apiBase}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (response.token) {
        setToken(response.token);
        setUser(response.user);
        window.location.href = 'index.html';
      } else {
        loginError.textContent = response.message || 'Login failed.';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value.trim();
      const response = await fetchJson(`${apiBase}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      if (response.token) {
        setToken(response.token);
        setUser(response.user);
        window.location.href = 'index.html';
      } else {
        registerError.textContent = response.message || 'Registration failed.';
      }
    });
  }
};

const connectRealtime = () => {
  if (!socket) return;
  socket.on('welcome', (data) => {
    console.log(data.message);
  });
  socket.on('orderPlaced', (payload) => {
    showNotification(`New order placed by ${payload.username}: ${formatCurrency(payload.total)}`);
  });
};

const init = () => {
  updateUserArea();
  updateCartCount();
  showProducts();
  renderProductDetail();
  renderCart();
  renderOrders();
  handleAuthForms();
  connectRealtime();
};

window.addEventListener('DOMContentLoaded', init);
