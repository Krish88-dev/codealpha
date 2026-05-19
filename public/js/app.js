const apiBase = '/api';
const cartKey = 'codealpha_cart';
const authKey = 'codealpha_token';

const getToken = () => localStorage.getItem(authKey);
const setToken = (token) => localStorage.setItem(authKey, token);
const getCart = () => JSON.parse(localStorage.getItem(cartKey) || '[]');
const setCart = (cart) => localStorage.setItem(cartKey, JSON.stringify(cart));

const updateCartCount = () => {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('#cart-count').forEach(el => el.textContent = count);
};

const fetchJson = async (url, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(url, { ...options, headers });
  return res.json();
};

const showProducts = async () => {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const products = await fetchJson(`${apiBase}/products`);
  grid.innerHTML = products.map(product => `
    <article class="product-card">
      <img src="${product.imageUrl}" alt="${product.name}" />
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <p><strong>$${product.price.toFixed(2)}</strong></p>
      <div class="product-actions">
        <a class="primary-button" href="product.html?id=${product.id}">View</a>
        <button class="primary-button" data-add="${product.id}">Add to Cart</button>
      </div>
    </article>
  `).join('');
  grid.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => addToCart(Number(button.dataset.add)));
  });
};

const addToCart = (productId) => {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId);
  if (item) item.quantity += 1;
  else cart.push({ productId, quantity: 1 });
  setCart(cart);
  updateCartCount();
  alert('Added to cart');
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
    <h2>${product.name}</h2>
    <p>${product.description}</p>
    <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
    <p><strong>Stock:</strong> ${product.stock}</p>
    <button class="primary-button" id="add-product-to-cart">Add to Cart</button>
  `;
  document.getElementById('add-product-to-cart').addEventListener('click', () => addToCart(product.id));
};

const renderCart = async () => {
  const list = document.getElementById('cart-list');
  const subtotalEl = document.getElementById('cart-subtotal');
  const checkoutButton = document.getElementById('checkout-button');
  const message = document.getElementById('checkout-message');
  if (!list || !subtotalEl || !checkoutButton) return;

  const cart = getCart();
  if (cart.length === 0) {
    list.innerHTML = '<p>Your cart is empty.</p>';
    subtotalEl.textContent = '0.00';
    checkoutButton.disabled = true;
    return;
  }

  const products = await fetchJson(`${apiBase}/products`);
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
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
          <p>$${product.price.toFixed(2)} each</p>
          <p><strong>Line:</strong> $${lineTotal.toFixed(2)}</p>
        </div>
        <div>
          <button class="quantity-button" data-action="minus" data-id="${item.productId}">-</button>
          <button class="quantity-button" data-action="plus" data-id="${item.productId}">+</button>
          <button class="remove-button" data-remove="${item.productId}">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  subtotalEl.textContent = total.toFixed(2);
  checkoutButton.disabled = false;
  message.textContent = '';

  list.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.action;
      const item = cart.find(i => i.productId === id);
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
      const id = Number(button.dataset.remove);
      setCart(cart.filter(i => i.productId !== id));
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
      message.textContent = `Order #${response.orderId} created. Total: $${response.total.toFixed(2)}`;
    } else {
      message.textContent = response.message || 'Checkout failed.';
    }
  });
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
        window.location.href = 'index.html';
      } else {
        registerError.textContent = response.message || 'Registration failed.';
      }
    });
  }
};

const init = () => {
  updateCartCount();
  showProducts();
  renderProductDetail();
  renderCart();
  handleAuthForms();
};

window.addEventListener('DOMContentLoaded', init);
