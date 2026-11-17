/**
 * Simple College Canteen Management System - Main JavaScript
 * Connects to PHP/MySQL (`backend.php`) when on XAMPP, or uses LocalStorage on GitHub Pages.
 */

const DEFAULT_DATA = {
  menu: [
    { id: 1, name: 'Masala Dosa', category: 'Breakfast', price: 50, available: 1 },
    { id: 2, name: 'Idli Vada Plate', category: 'Breakfast', price: 40, available: 1 },
    { id: 3, name: 'Special Veg Thali', category: 'Meals', price: 90, available: 1 },
    { id: 4, name: 'Veg Dum Biryani', category: 'Meals', price: 80, available: 1 },
    { id: 5, name: 'Samosa Plate (2 Pcs)', category: 'Snacks', price: 25, available: 1 },
    { id: 6, name: 'Paneer Grilled Sandwich', category: 'Snacks', price: 55, available: 1 },
    { id: 7, name: 'Masala Kullad Chai', category: 'Drinks', price: 15, available: 1 },
    { id: 8, name: 'Cold Coffee', category: 'Drinks', price: 45, available: 1 }
  ],
  orders: [
    { id: 1, token: 'T-101', customer_name: 'Aarav Sharma', order_type: 'Online Order', items_summary: '1x Masala Dosa, 1x Masala Kullad Chai', total_amount: 65, payment_mode: 'UPI', status: 'Ready' },
    { id: 2, token: 'T-102', customer_name: 'Walk-in Table 3', order_type: 'Walk-in POS', items_summary: '1x Special Veg Thali, 1x Cold Coffee', total_amount: 135, payment_mode: 'Cash', status: 'Preparing' }
  ]
};

let db = JSON.parse(localStorage.getItem('canteen_simple_db')) || structuredClone(DEFAULT_DATA);
let cart = [];
let selectedCategory = 'All';

// Save state & try optional PHP/MySQL sync
function saveDB(action = '', payload = {}) {
  localStorage.setItem('canteen_simple_db', JSON.stringify(db));
  if (action) {
    fetch(`./backend.php?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }
  renderAll();
}

// Switch between the 3 main tabs
function showTab(tabName, btn) {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  btn.classList.add('active');
}

// Filter menu by category
function filterMenu(category, btn) {
  selectedCategory = category;
  document.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderMenu();
}

// Render Food Cards in Tab 1
function renderMenu() {
  const list = db.menu.filter((m) => selectedCategory === 'All' || m.category === selectedCategory);
  document.getElementById('menu-container').innerHTML = list
    .map(
      (item) => `
      <div class="food-item">
        <div>
          <span class="food-cat">${item.category}</span>
          <h3 style="margin-block:0.2rem; font-size:1.02rem;">${item.name}</h3>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="food-price">₹${item.price}</span>
          ${
            Number(item.available) === 1
              ? `<button class="btn" onclick="addToCart(${item.id})">+ Add</button>`
              : `<span class="badge">Sold Out</span>`
          }
        </div>
      </div>`
    )
    .join('');
}

// Cart Functions
function addToCart(id) {
  const item = db.menu.find((m) => Number(m.id) === Number(id));
  if (!item) return;
  const found = cart.find((c) => c.id === item.id);
  if (found) found.qty++;
  else cart.push({ id: item.id, name: item.name, price: Number(item.price), qty: 1 });
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((c) => c.id !== id);
  renderCart();
}

function renderCart() {
  const box = document.getElementById('cart-items');
  if (cart.length === 0) {
    box.innerHTML = `<p style="color:var(--muted);">No items added yet. Click "+ Add" on any dish.</p>`;
    document.getElementById('cart-total').textContent = '₹0';
    return;
  }
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById('cart-total').textContent = `₹${total}`;
  box.innerHTML = cart
    .map(
      (i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding-block:0.35rem; border-block-end:1px solid #f1f5f9;">
        <span><strong>${i.name}</strong> (₹${i.price} × ${i.qty})</span>
        <div>
          <button type="button" class="btn-outline" style="padding:2px 8px; border-radius:4px; cursor:pointer;" onclick="changeQty(${i.id}, -1)">-</button>
          <button type="button" class="btn-outline" style="padding:2px 8px; border-radius:4px; cursor:pointer;" onclick="changeQty(${i.id}, 1)">+</button>
        </div>
      </div>`
    )
    .join('');
}

// Place Order & Show Receipt Modal
function placeOrder(e) {
  e.preventDefault();
  if (cart.length === 0) return alert('Please add at least one food item to the bill!');

  const nextNum = 101 + db.orders.length;
  const order = {
    id: Date.now(),
    token: `T-${nextNum}`,
    customer_name: document.getElementById('cust-name').value.trim(),
    order_type: document.getElementById('order-type').value,
    items_summary: cart.map((i) => `${i.qty}x ${i.name}`).join(', '),
    total_amount: cart.reduce((sum, i) => sum + i.price * i.qty, 0),
    payment_mode: document.getElementById('payment-mode').value,
    status: 'Pending'
  };

  db.orders.unshift(order);
  cart = [];
  e.target.reset();
  saveDB('place_order', order);
  showReceipt(order);
}

function showReceipt(o) {
  document.getElementById('receipt-body').innerHTML = `
    <div style="text-align:center; font-size:1.5rem; font-weight:900; color:var(--orange-dark); margin-block-end:0.4rem;">Token: ${o.token}</div>
    <p><strong>Customer:</strong> ${o.customer_name}</p>
    <p><strong>Type:</strong> ${o.order_type}</p>
    <p><strong>Items:</strong> ${o.items_summary}</p>
    <p><strong>Payment:</strong> ${o.payment_mode}</p>
    <p style="font-size:1.1rem; font-weight:800; margin-block-start:0.4rem; color:var(--orange-dark);">Total Paid: ₹${o.total_amount}</p>
  `;
  document.getElementById('receipt-modal').showModal();
}

// Employee Order Status Progression
function nextStatus(id) {
  const flow = { Pending: 'Preparing', Preparing: 'Ready', Ready: 'Completed' };
  const ord = db.orders.find((o) => Number(o.id) === Number(id));
  if (ord && flow[ord.status]) {
    ord.status = flow[ord.status];
    saveDB('update_status', { id: ord.id, status: ord.status });
  }
}

// Admin Menu Actions
function addMenuItem(e) {
  e.preventDefault();
  const newItem = {
    id: Date.now(),
    name: document.getElementById('new-name').value.trim(),
    category: document.getElementById('new-cat').value,
    price: Number(document.getElementById('new-price').value),
    available: 1
  };
  db.menu.push(newItem);
  e.target.reset();
  saveDB('add_item', newItem);
}

function toggleItem(id) {
  const item = db.menu.find((m) => Number(m.id) === Number(id));
  if (item) {
    item.available = Number(item.available) === 1 ? 0 : 1;
    saveDB('toggle_item', { id });
  }
}

function deleteItem(id) {
  db.menu = db.menu.filter((m) => Number(m.id) !== Number(id));
  saveDB('delete_item', { id });
}

function resetDemo() {
  db = structuredClone(DEFAULT_DATA);
  saveDB();
}

// Render Orders & Admin Tables
function renderAll() {
  renderMenu();
  renderCart();

  const active = db.orders.filter((o) => o.status !== 'Completed');
  document.getElementById('active-count').textContent = active.length;

  const ready = db.orders.filter((o) => o.status === 'Ready').map((o) => o.token);
  const prep = db.orders.filter((o) => o.status === 'Preparing' || o.status === 'Pending').map((o) => o.token);
  document.getElementById('ready-tokens').textContent = ready.length ? ready.join(', ') : 'None';
  document.getElementById('prep-tokens').textContent = prep.length ? prep.join(', ') : 'None';

  document.getElementById('orders-tbody').innerHTML = db.orders
    .map(
      (o) => `
      <tr>
        <td><strong style="color:var(--orange-dark);">${o.token}</strong></td>
        <td>${o.customer_name}</td>
        <td>${o.order_type}</td>
        <td>${o.items_summary}</td>
        <td><strong>₹${o.total_amount}</strong></td>
        <td>${o.payment_mode}</td>
        <td><span class="badge">${o.status}</span></td>
        <td>
          ${
            o.status !== 'Completed'
              ? `<button class="btn" style="padding:0.3rem 0.65rem; font-size:0.8rem;" onclick="nextStatus(${o.id})">Next Status ➔</button>`
              : `Done ✓`
          }
        </td>
      </tr>`
    )
    .join('');

  // Admin Stats & Table
  const totalSales = db.orders.reduce((s, o) => s + Number(o.total_amount), 0);
  document.getElementById('stat-orders').textContent = db.orders.length;
  document.getElementById('stat-sales').textContent = `₹${totalSales}`;
  document.getElementById('stat-items').textContent = db.menu.filter((m) => Number(m.available) === 1).length;

  document.getElementById('admin-menu-tbody').innerHTML = db.menu
    .map(
      (m) => `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td>${m.category}</td>
        <td>₹${m.price}</td>
        <td><span class="badge">${Number(m.available) === 1 ? 'Available' : 'Sold Out'}</span></td>
        <td>
          <button class="btn-outline" style="padding:0.25rem 0.55rem; border-radius:6px; cursor:pointer;" onclick="toggleItem(${m.id})">Toggle</button>
          <button class="btn-outline" style="padding:0.25rem 0.55rem; border-radius:6px; color:#dc2626; cursor:pointer;" onclick="deleteItem(${m.id})">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

renderAll();
