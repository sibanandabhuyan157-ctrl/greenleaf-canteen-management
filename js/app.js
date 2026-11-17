/**
 * GreenLeaf Canteen Management System (Offline & Online Hybrid Canteen)
 * Main Application Controller (HTML5 + CSS3 + ES6 JS + PHP/MySQL Hybrid API)
 */

(function () {
  'use strict';

  const api = window.canteenAPI;

  // Application State
  const state = {
    activeView: 'online',
    activeRole: 'all',
    currentUser: null,
    categories: [],
    menuItems: [],
    orders: [],
    inventory: [],
    users: [],
    transactions: [],
    coupons: [],
    feedback: [],

    // Online Portal Filters & Cart
    onlineCategory: 'all',
    onlineDiet: 'all',
    onlineSearch: '',
    onlineCart: [
      { id: 1, name: 'Masala Dosa with Coconut Chutney', price: 55, quantity: 1 },
      { id: 11, name: 'Adrak Elaichi Kullad Chai', price: 15, quantity: 2 }
    ],
    appliedCoupon: null,

    // Employee POS Filters & Cart
    posCategory: 'all',
    posSearch: '',
    posCart: [
      { id: 4, name: 'GreenLeaf Special Deluxe Veg Thali', price: 110, quantity: 1 },
      { id: 8, name: 'Punjabi Samosa Plate (2 Pcs)', price: 30, quantity: 1 }
    ],

    // KDS Filter
    kdsSourceFilter: 'all'
  };

  // =========================================================================
  // INITIALIZATION & MODERN WEB GUIDANCE DIALOG POLYFILL
  // =========================================================================
  async function initApp() {
    setupDialogLightDismissFallback();
    registerServiceWorker();
    startLiveClock();
    bindStaticEvents();

    await api.detectBackend();
    await refreshAllData();

    // Listen for real-time updates across tabs (e.g. POS tab -> KDS Token Board tab)
    if (api.channel) {
      api.channel.addEventListener('message', () => {
        refreshAllData();
      });
    }

    window.addEventListener('online', async () => {
      await api.detectBackend();
      const res = await api.syncPendingOrders();
      if (res.synced > 0) {
        showToast(`🌐 Back Online! Synced ${res.synced} offline POS order(s) to database.`);
      }
      updateConnectionUI();
      refreshAllData();
    });

    window.addEventListener('offline', () => {
      api.backendMode = 'offline_forced';
      updateConnectionUI();
      showToast('⚡ Internet disconnected — Offline Counter Mode active.');
    });
  }

  /**
   * Modern Web Guidance fallback for <dialog closedby="any">
   */
  function setupDialogLightDismissFallback() {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener('pointerup', (e) => {
          if (pressedOutside && outside(e, dialog)) dialog.close();
        });
      }
    }

    document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dlg = document.getElementById(btn.dataset.closeDialog);
        if (dlg) dlg.close();
      });
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function startLiveClock() {
    const el = document.getElementById('live-clock');
    const tick = () => {
      const now = new Date();
      const str = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
      if (el) el.textContent = `🌱 ${dateStr} • ${str} • Canteen Open`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // =========================================================================
  // DATA LOADING & GLOBAL UI REFRESH
  // =========================================================================
  async function refreshAllData() {
    const menuData = await api.getMenuData();
    state.categories = menuData.categories || [];
    state.menuItems = menuData.items || [];

    state.orders = await api.getOrders();
    state.inventory = await api.getInventory();

    const walletData = await api.getWalletData();
    state.users = walletData.users || [];
    state.transactions = walletData.transactions || [];
    state.coupons = walletData.coupons || [];

    const db = api.getLocalDB();
    state.feedback = db.feedback || [];

    if (!state.currentUser && state.users.length > 0) {
      state.currentUser = state.users[0];
    } else if (state.currentUser) {
      const updated = state.users.find((u) => u.campus_id === state.currentUser.campus_id);
      if (updated) state.currentUser = updated;
    }

    updateConnectionUI();
    updateHeaderBadges();
    renderCategoryPills();
    renderOnlineMenu();
    renderOnlineCart();
    renderPOSGrid();
    renderPOSCart();
    renderKDS();
    renderInventoryTables();
    renderWalletModule();
    renderReportsModule();
    renderAuthModalCards();
  }

  function updateConnectionUI() {
    const dot = document.getElementById('connection-dot');
    const txt = document.getElementById('connection-text');
    const qBadge = document.getElementById('pos-offline-queue-badge');
    const qLen = api.getOfflineQueue().length;

    if (qBadge) {
      qBadge.textContent = `Offline Queue: ${qLen}`;
    }

    if (api.forceOffline || !navigator.onLine) {
      dot.classList.add('offline');
      txt.textContent = `Offline Counter Mode (${qLen} queued for sync)`;
    } else if (api.backendMode === 'php_mysql') {
      dot.classList.remove('offline');
      txt.textContent = 'Online • PHP 8 + MySQL Connected';
    } else {
      dot.classList.remove('offline');
      txt.textContent = 'Online • Hybrid Browser DB Ready';
    }
  }

  function updateHeaderBadges() {
    const availCount = state.menuItems.filter((m) => Number(m.is_available) === 1 && Number(m.stock_qty) > 0).length;
    const activeOrders = state.orders.filter((o) =>
      ['pending', 'preparing', 'ready'].includes(o.order_status)
    ).length;
    const lowMenu = state.menuItems.filter((m) => Number(m.stock_qty) <= Number(m.low_stock_threshold)).length;
    const lowInv = state.inventory.filter((i) => Number(i.current_qty) <= Number(i.min_level)).length;

    document.getElementById('badge-menu-count').textContent = availCount;
    document.getElementById('badge-active-orders').textContent = activeOrders;
    document.getElementById('badge-low-stock').textContent = lowMenu + lowInv;

    const readyTokens = state.orders
      .filter((o) => o.order_status === 'ready')
      .map((o) => o.token_number);
    document.getElementById('hero-ready-tokens').textContent =
      readyTokens.length > 0 ? readyTokens.slice(0, 2).join(', ') : 'All Served';

    if (state.currentUser) {
      const bal = Number(state.currentUser.wallet_balance || 0);
      document.getElementById('hero-wallet-bal').textContent = `₹${bal.toFixed(2)}`;
      document.getElementById('active-user-label').textContent =
        `${state.currentUser.full_name.split(' ')[0]} (₹${bal.toFixed(0)})`;
    }
  }

  // =========================================================================
  // MODULE 1: ONLINE MENU & PRE-ORDER PORTAL
  // =========================================================================
  function renderCategoryPills() {
    const onlineWrap = document.getElementById('online-category-pills');
    const posWrap = document.getElementById('pos-category-pills');

    const allCats = [{ id: 'all', name: 'All Items', slug: 'all', icon: '🍃' }, ...state.categories];

    if (onlineWrap) {
      onlineWrap.innerHTML = allCats
        .map(
          (c) => `
          <button type="button" class="cat-pill ${state.onlineCategory === String(c.id) ? 'active' : ''}" data-online-cat="${c.id}">
            ${c.icon || '🍽️'} ${escapeHtml(c.name)}
          </button>`
        )
        .join('');

      onlineWrap.querySelectorAll('[data-online-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.onlineCategory = btn.dataset.onlineCat;
          renderCategoryPills();
          renderOnlineMenu();
        });
      });
    }

    if (posWrap) {
      posWrap.innerHTML = allCats
        .map(
          (c) => `
          <button type="button" class="cat-pill ${state.posCategory === String(c.id) ? 'active' : ''}" data-pos-cat="${c.id}">
            ${c.icon || '🍽️'} ${escapeHtml(c.name)}
          </button>`
        )
        .join('');

      posWrap.querySelectorAll('[data-pos-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.posCategory = btn.dataset.posCat;
          renderCategoryPills();
          renderPOSGrid();
        });
      });
    }
  }

  function renderOnlineMenu() {
    const grid = document.getElementById('online-menu-grid');
    if (!grid) return;

    const query = state.onlineSearch.trim().toLowerCase();
    const filtered = state.menuItems.filter((item) => {
      if (state.onlineCategory !== 'all' && String(item.category_id) !== state.onlineCategory) {
        return false;
      }
      if (state.onlineDiet === 'veg' && Number(item.is_veg) !== 1) {
        return false;
      }
      if (state.onlineDiet === 'special' && Number(item.is_special) !== 1) {
        return false;
      }
      if (query && !item.name.toLowerCase().includes(query) && !(item.description || '').toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="card-box" style="grid-column: 1 / -1; text-align:center; padding:2.5rem;">
          <p style="font-size:1.05rem; font-weight:700; color:var(--green-900);">No matching canteen items found</p>
          <p style="font-size:0.84rem; color:var(--slate-600); margin-block-start:0.3rem;">Try clearing your search or switching category filters.</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered
      .map((item) => {
        const isOut = Number(item.is_available) === 0 || Number(item.stock_qty) <= 0;
        const isLow = !isOut && Number(item.stock_qty) <= Number(item.low_stock_threshold);
        const inCart = state.onlineCart.find((c) => Number(c.id) === Number(item.id));

        return `
        <article class="food-card ${isOut ? 'sold-out' : ''}">
          <div>
            <div class="food-card-top">
              <div class="food-emoji-avatar" aria-hidden="true">${item.emoji || '🍲'}</div>
              <div class="food-badges">
                <span class="diet-dot ${Number(item.is_veg) === 1 ? '' : 'non-veg'}" title="${Number(item.is_veg) === 1 ? 'Pure Vegetarian' : 'Contains Egg'}"></span>
                ${item.badge ? `<span class="badge badge-green">${escapeHtml(item.badge)}</span>` : ''}
                ${isLow ? `<span class="badge badge-amber">Only ${item.stock_qty} left</span>` : ''}
                ${isOut ? `<span class="badge badge-red">Sold Out</span>` : ''}
              </div>
            </div>
            <h3 class="food-title">${escapeHtml(item.name)}</h3>
            <p class="food-desc">${escapeHtml(item.description)}</p>
          </div>

          <div>
            <div class="food-meta" style="margin-block-end:0.55rem;">
              <span>⏱️ ${item.prep_time_mins || 8} mins</span>
              <span>🔥 ${item.calories || 250} kcal</span>
              <span>📦 Stock: ${item.stock_qty}</span>
            </div>
            <div class="food-footer">
              <span class="food-price">₹${Number(item.price).toFixed(0)}</span>
              ${
                isOut
                  ? `<button type="button" class="btn btn-secondary btn-sm" disabled>Unavailable</button>`
                  : inCart
                  ? `<div class="qty-controls">
                      <button type="button" class="qty-btn" data-online-dec="${item.id}" aria-label="Decrease quantity">−</button>
                      <span style="font-size:0.84rem; font-weight:800; padding-inline:0.35rem;">${inCart.quantity}</span>
                      <button type="button" class="qty-btn" data-online-inc="${item.id}" aria-label="Increase quantity">+</button>
                    </div>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-online-add="${item.id}">+ Add to Tray</button>`
              }
            </div>
          </div>
        </article>`;
      })
      .join('');

    grid.querySelectorAll('[data-online-add]').forEach((btn) => {
      btn.addEventListener('click', () => addToCart('online', Number(btn.dataset.onlineAdd), 1));
    });
    grid.querySelectorAll('[data-online-inc]').forEach((btn) => {
      btn.addEventListener('click', () => addToCart('online', Number(btn.dataset.onlineInc), 1));
    });
    grid.querySelectorAll('[data-online-dec]').forEach((btn) => {
      btn.addEventListener('click', () => addToCart('online', Number(btn.dataset.onlineDec), -1));
    });
  }

  function addToCart(mode, itemId, delta) {
    const cart = mode === 'online' ? state.onlineCart : state.posCart;
    const menuObj = state.menuItems.find((m) => Number(m.id) === Number(itemId));
    if (!menuObj) return;

    const existing = cart.find((c) => Number(c.id) === Number(itemId));
    if (existing) {
      existing.quantity += delta;
      if (existing.quantity <= 0) {
        const idx = cart.indexOf(existing);
        cart.splice(idx, 1);
      } else if (existing.quantity > Number(menuObj.stock_qty)) {
        existing.quantity = Number(menuObj.stock_qty);
        showToast(`⚠️ Only ${menuObj.stock_qty} portions available for ${menuObj.name}`);
      }
    } else if (delta > 0) {
      if (Number(menuObj.stock_qty) <= 0) {
        showToast(`❌ ${menuObj.name} is currently out of stock.`);
        return;
      }
      cart.push({
        id: Number(menuObj.id),
        name: menuObj.name,
        price: Number(menuObj.price),
        quantity: 1
      });
    }

    if (mode === 'online') {
      renderOnlineMenu();
      renderOnlineCart();
    } else {
      renderPOSCart();
    }
  }

  function getOnlineTotals() {
    const subtotal = state.onlineCart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let discount = 0;
    if (state.appliedCoupon) {
      if (subtotal >= Number(state.appliedCoupon.min_order_amount)) {
        discount = Math.min(
          Number(state.appliedCoupon.max_discount),
          Number(((subtotal * Number(state.appliedCoupon.discount_percent)) / 100).toFixed(2))
        );
      } else {
        state.appliedCoupon = null;
        document.getElementById('coupon-feedback-msg').textContent = '';
      }
    }
    const taxable = Math.max(0, subtotal - discount);
    const tax = Number((taxable * 0.05).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));
    return { subtotal, discount, tax, total };
  }

  function renderOnlineCart() {
    const listEl = document.getElementById('online-cart-list');
    const countEl = document.getElementById('online-cart-count');
    if (!listEl) return;

    const totalItems = state.onlineCart.reduce((acc, i) => acc + i.quantity, 0);
    countEl.textContent = totalItems;

    if (state.onlineCart.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:1.4rem 0.5rem; color:var(--slate-500); font-size:0.82rem;">
          🍃 Your canteen tray is empty. Select items from the menu to pre-order!
        </div>`;
    } else {
      listEl.innerHTML = state.onlineCart
        .map(
          (item) => `
          <div class="cart-item-row">
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHtml(item.name)}</div>
              <div class="cart-item-sub">₹${item.price} × ${item.quantity} = <strong>₹${(item.price * item.quantity).toFixed(0)}</strong></div>
            </div>
            <div class="qty-controls">
              <button type="button" class="qty-btn" data-cart-dec="${item.id}">−</button>
              <span style="font-size:0.8rem; font-weight:800; padding-inline:0.3rem;">${item.quantity}</span>
              <button type="button" class="qty-btn" data-cart-inc="${item.id}">+</button>
            </div>
          </div>`
        )
        .join('');

      listEl.querySelectorAll('[data-cart-dec]').forEach((b) =>
        b.addEventListener('click', () => addToCart('online', Number(b.dataset.cartDec), -1))
      );
      listEl.querySelectorAll('[data-cart-inc]').forEach((b) =>
        b.addEventListener('click', () => addToCart('online', Number(b.dataset.cartInc), 1))
      );
    }

    const { subtotal, discount, tax, total } = getOnlineTotals();
    document.getElementById('online-sub-val').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('online-disc-val').textContent = `-₹${discount.toFixed(2)}`;
    document.getElementById('online-tax-val').textContent = `₹${tax.toFixed(2)}`;
    document.getElementById('online-total-val').textContent = `₹${total.toFixed(2)}`;
  }

  // =========================================================================
  // MODULE 2: EMPLOYEE WALK-IN COUNTER POS (OFFLINE / ONLINE)
  // =========================================================================
  function renderPOSGrid() {
    const grid = document.getElementById('pos-items-grid');
    if (!grid) return;

    const q = state.posSearch.trim().toLowerCase();
    const items = state.menuItems.filter((m) => {
      if (state.posCategory !== 'all' && String(m.category_id) !== state.posCategory) return false;
      if (q && !m.name.toLowerCase().includes(q) && !String(m.price).includes(q)) return false;
      return true;
    });

    grid.innerHTML = items
      .map((item) => {
        const isOut = Number(item.is_available) === 0 || Number(item.stock_qty) <= 0;
        return `
        <button type="button" class="pos-tile" data-pos-add="${item.id}" ${isOut ? 'disabled' : ''}>
          <div style="display:flex; justify-content:space-between; align-items:center; inline-size:100%;">
            <span style="font-size:1.35rem;">${item.emoji || '🍛'}</span>
            <span class="badge ${isOut ? 'badge-red' : 'badge-green'}">${isOut ? 'Out' : `Qty: ${item.stock_qty}`}</span>
          </div>
          <div style="font-weight:700; font-size:0.84rem; color:var(--slate-900); line-height:1.25;">
            ${escapeHtml(item.name)}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; inline-size:100%; margin-block-start:0.2rem;">
            <span class="pos-tile-price">₹${Number(item.price).toFixed(0)}</span>
            <span style="font-size:0.72rem; color:var(--green-700); font-weight:700;">+ TAP BILL</span>
          </div>
        </button>`;
      })
      .join('');

    grid.querySelectorAll('[data-pos-add]').forEach((tile) => {
      tile.addEventListener('click', () => addToCart('pos', Number(tile.dataset.posAdd), 1));
    });
  }

  function getPOSTotals() {
    const subtotal = state.posCart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const manualDisc = Math.min(
      subtotal,
      Math.max(0, Number(document.getElementById('pos-manual-discount')?.value || 0))
    );
    const taxable = Math.max(0, subtotal - manualDisc);
    const tax = Number((taxable * 0.05).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));
    return { subtotal, discount: manualDisc, tax, total };
  }

  function renderPOSCart() {
    const listEl = document.getElementById('pos-cart-list');
    if (!listEl) return;

    if (state.posCart.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:1.4rem 0.5rem; color:var(--slate-500); font-size:0.82rem;">
          🖥️ Tap any food tile on the left to punch a walk-in counter bill.
        </div>`;
    } else {
      listEl.innerHTML = state.posCart
        .map(
          (item) => `
          <div class="cart-item-row">
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHtml(item.name)}</div>
              <div class="cart-item-sub">₹${item.price} × ${item.quantity} = <strong>₹${(item.price * item.quantity).toFixed(0)}</strong></div>
            </div>
            <div class="qty-controls">
              <button type="button" class="qty-btn" data-pos-dec="${item.id}">−</button>
              <span style="font-size:0.8rem; font-weight:800; padding-inline:0.3rem;">${item.quantity}</span>
              <button type="button" class="qty-btn" data-pos-inc="${item.id}">+</button>
            </div>
          </div>`
        )
        .join('');

      listEl.querySelectorAll('[data-pos-dec]').forEach((b) =>
        b.addEventListener('click', () => addToCart('pos', Number(b.dataset.posDec), -1))
      );
      listEl.querySelectorAll('[data-pos-inc]').forEach((b) =>
        b.addEventListener('click', () => addToCart('pos', Number(b.dataset.posInc), 1))
      );
    }

    const { subtotal, tax, total } = getPOSTotals();
    document.getElementById('pos-sub-val').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('pos-tax-val').textContent = `₹${tax.toFixed(2)}`;
    document.getElementById('pos-total-val').textContent = `₹${total.toFixed(2)}`;
    updatePOSChangeCalculator();
  }

  function updatePOSChangeCalculator() {
    const { total } = getPOSTotals();
    const cashInput = Number(document.getElementById('pos-cash-received')?.value || 0);
    const changeEl = document.getElementById('pos-change-return');
    if (!changeEl) return;

    if (cashInput > 0 && cashInput >= total) {
      changeEl.textContent = `₹${(cashInput - total).toFixed(2)}`;
      changeEl.style.color = 'var(--green-800)';
    } else if (cashInput > 0 && cashInput < total) {
      changeEl.textContent = `Due: ₹${(total - cashInput).toFixed(2)}`;
      changeEl.style.color = 'var(--red-600)';
    } else {
      changeEl.textContent = '₹0.00';
      changeEl.style.color = 'var(--green-900)';
    }
  }

  // =========================================================================
  // MODULE 3: LIVE KITCHEN DISPLAY SYSTEM (KDS) & PUBLIC TOKEN BOARD
  // =========================================================================
  function renderKDS() {
    const readyWrap = document.getElementById('public-ready-tokens');
    const prepWrap = document.getElementById('public-prep-tokens');

    const readyOrders = state.orders.filter((o) => o.order_status === 'ready');
    const prepOrders = state.orders.filter((o) => o.order_status === 'preparing' || o.order_status === 'pending');

    if (readyWrap) {
      readyWrap.innerHTML = readyOrders.length
        ? readyOrders.map((o) => `<span class="big-token-pill ready">🔔 ${escapeHtml(o.token_number)}</span>`).join('')
        : `<span style="color:#bbf7d0; font-size:0.86rem;">No tokens waiting at counter right now</span>`;
    }

    if (prepWrap) {
      prepWrap.innerHTML = prepOrders.length
        ? prepOrders.map((o) => `<span class="big-token-pill preparing">🍳 ${escapeHtml(o.token_number)}</span>`).join('')
        : `<span style="color:#bbf7d0; font-size:0.86rem;">Kitchen queue clear</span>`;
    }

    const filteredOrders = state.orders.filter((o) => {
      if (state.kdsSourceFilter !== 'all' && o.order_source !== state.kdsSourceFilter) return false;
      return true;
    });

    const statuses = [
      { key: 'pending', next: 'preparing', btnLabel: '🔥 Start Cooking', btnClass: 'btn-primary' },
      { key: 'preparing', next: 'ready', btnLabel: '🔔 Mark Ready', btnClass: 'btn-primary' },
      { key: 'ready', next: 'completed', btnLabel: '✔️ Handover Order', btnClass: 'btn-secondary' },
      { key: 'completed', next: null, btnLabel: '', btnClass: '' }
    ];

    statuses.forEach(({ key, next, btnLabel, btnClass }) => {
      const colList = document.getElementById(`kds-list-${key}`);
      const countBadge = document.getElementById(`kds-count-${key}`);
      const list = filteredOrders.filter((o) => o.order_status === key);

      if (countBadge) countBadge.textContent = list.length;
      if (!colList) return;

      if (list.length === 0) {
        colList.innerHTML = `<div style="text-align:center; padding:1.5rem 0.5rem; color:var(--slate-500); font-size:0.8rem;">No orders in ${key}</div>`;
        return;
      }

      colList.innerHTML = list
        .slice(0, 12)
        .map((ord) => {
          const isPOS = ord.order_source === 'offline_pos';
          const itemsHtml = (ord.items || [])
            .map((i) => `<div style="font-size:0.8rem; font-weight:600;">• ${i.quantity}× ${escapeHtml(i.item_name)}</div>`)
            .join('');

          return `
          <article class="kds-order-card status-${ord.order_status}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="kds-token">${escapeHtml(ord.token_number)}</span>
              <span class="badge ${isPOS ? 'badge-blue' : 'badge-green'}">${isPOS ? '🖥️ WALK-IN POS' : '🌿 ONLINE'}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--slate-600);">
              <strong>${escapeHtml(ord.customer_name)}</strong> • ${escapeHtml(ord.table_Or_pickup || 'Counter')}
            </div>
            <div style="background:var(--white); padding:0.45rem 0.6rem; border-radius:6px; border:1px solid var(--slate-200);">
              ${itemsHtml}
            </div>
            ${ord.notes ? `<div style="font-size:0.74rem; color:var(--amber-600); font-weight:600;">📝 Note: ${escapeHtml(ord.notes)}</div>` : ''}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-block-start:0.2rem;">
              <button type="button" class="btn btn-secondary btn-sm" data-print-order="${ord.id}">🧾 Receipt</button>
              ${
                next
                  ? `<button type="button" class="btn ${btnClass} btn-sm" data-kds-advance="${ord.id}" data-kds-next="${next}">${btnLabel}</button>`
                  : `<span class="badge badge-green">Served</span>`
              }
            </div>
          </article>`;
        })
        .join('');

      colList.querySelectorAll('[data-kds-advance]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.kdsAdvance);
          const nextSt = btn.dataset.kdsNext;
          await api.updateOrderStatus(id, nextSt);
          if (nextSt === 'ready') {
            playTokenChime();
          }
          showToast(`🔔 Order updated to ${nextSt.toUpperCase()}!`);
          await refreshAllData();
        });
      });

      colList.querySelectorAll('[data-print-order]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const ord = state.orders.find((o) => Number(o.id) === Number(btn.dataset.printOrder));
          if (ord) openReceiptModal(ord);
        });
      });
    });
  }

  // =========================================================================
  // MODULE 4: MENU CRUD & RAW MATERIAL INVENTORY TABLES
  // =========================================================================
  function renderInventoryTables() {
    const menuTbody = document.getElementById('inventory-menu-tbody');
    const rawTbody = document.getElementById('inventory-raw-tbody');

    if (menuTbody) {
      menuTbody.innerHTML = state.menuItems
        .map((item) => {
          const isLow = Number(item.stock_qty) <= Number(item.low_stock_threshold);
          const isAvail = Number(item.is_available) === 1 && Number(item.stock_qty) > 0;
          return `
          <tr>
            <td>
              <div style="font-weight:700; color:var(--slate-900);">${item.emoji || '🍽️'} ${escapeHtml(item.name)}</div>
              <div style="font-size:0.74rem; color:var(--slate-500);">${escapeHtml(item.badge || 'Standard Item')}</div>
            </td>
            <td>${escapeHtml(item.category_name || '')}</td>
            <td>${Number(item.is_veg) === 1 ? '<span class="badge badge-green">Pure Veg</span>' : '<span class="badge badge-red">Egg/Non-Veg</span>'}</td>
            <td><strong>₹${Number(item.price).toFixed(0)}</strong></td>
            <td>
              <strong style="color:${isLow ? 'var(--red-600)' : 'var(--green-800)'};">${item.stock_qty} portions</strong>
            </td>
            <td>
              <span class="badge ${isAvail ? 'badge-green' : 'badge-red'}">${isAvail ? 'Available' : 'Sold Out'}</span>
            </td>
            <td>
              <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm" data-restock-menu="${item.id}">+20 Stock</button>
                <button type="button" class="btn btn-secondary btn-sm" data-toggle-menu="${item.id}">${isAvail ? 'Mark Out' : 'Enable'}</button>
                <button type="button" class="btn btn-secondary btn-sm" data-edit-menu="${item.id}">✏️ Edit</button>
                <button type="button" class="btn btn-danger btn-sm" data-del-menu="${item.id}">🗑️</button>
              </div>
            </td>
          </tr>`;
        })
        .join('');

      menuTbody.querySelectorAll('[data-restock-menu]').forEach((b) =>
        b.addEventListener('click', async () => {
          await api.restockMenuItem(Number(b.dataset.restockMenu), 20);
          showToast('📦 Added +20 portions to dish stock.');
          refreshAllData();
        })
      );
      menuTbody.querySelectorAll('[data-toggle-menu]').forEach((b) =>
        b.addEventListener('click', async () => {
          await api.toggleMenuAvailability(Number(b.dataset.toggleMenu));
          showToast('🔄 Dish availability toggled.');
          refreshAllData();
        })
      );
      menuTbody.querySelectorAll('[data-edit-menu]').forEach((b) =>
        b.addEventListener('click', () => openEditMenuModal(Number(b.dataset.editMenu)))
      );
      menuTbody.querySelectorAll('[data-del-menu]').forEach((b) =>
        b.addEventListener('click', async () => {
          await api.deleteMenuItem(Number(b.dataset.delMenu));
          showToast('🗑️ Dish removed from canteen menu.');
          refreshAllData();
        })
      );
    }

    if (rawTbody) {
      rawTbody.innerHTML = state.inventory
        .map((inv) => {
          const isLow = Number(inv.current_qty) <= Number(inv.min_level);
          return `
          <tr>
            <td><strong>${escapeHtml(inv.ingredient_name)}</strong></td>
            <td>${escapeHtml(inv.category)}</td>
            <td><strong>${inv.current_qty} ${escapeHtml(inv.unit)}</strong></td>
            <td>${inv.min_level} ${escapeHtml(inv.unit)}</td>
            <td>${escapeHtml(inv.supplier)}</td>
            <td>
              <span class="badge ${isLow ? 'badge-red' : 'badge-green'}">
                ${isLow ? '⚠️ Low Stock Alert' : '✅ Healthy Stock'}
              </span>
            </td>
            <td>
              <div style="display:flex; gap:0.35rem;">
                <button type="button" class="btn btn-primary btn-sm" data-raw-delta="${inv.id}" data-amt="10">+10 ${escapeHtml(inv.unit)}</button>
                <button type="button" class="btn btn-secondary btn-sm" data-raw-delta="${inv.id}" data-amt="-2">−2 Use</button>
              </div>
            </td>
          </tr>`;
        })
        .join('');

      rawTbody.querySelectorAll('[data-raw-delta]').forEach((b) =>
        b.addEventListener('click', async () => {
          await api.updateInventoryQty(Number(b.dataset.rawDelta), Number(b.dataset.amt));
          showToast('🌾 Raw material inventory updated.');
          refreshAllData();
        })
      );
    }
  }

  // =========================================================================
  // MODULE 5: CAMPUS DIGITAL WALLET & COUPONS
  // =========================================================================
  function renderWalletModule() {
    const usersTbody = document.getElementById('wallet-users-tbody');
    const txnsTbody = document.getElementById('wallet-txns-tbody');
    const selectEl = document.getElementById('wallet-topup-id');
    const couponsEl = document.getElementById('wallet-coupons-list');

    if (selectEl) {
      const currentVal = selectEl.value;
      selectEl.innerHTML = state.users
        .map(
          (u) =>
            `<option value="${escapeHtml(u.campus_id)}">${escapeHtml(u.campus_id)} — ${escapeHtml(u.full_name)} (₹${Number(u.wallet_balance).toFixed(2)})</option>`
        )
        .join('');
      if (currentVal) selectEl.value = currentVal;
    }

    if (usersTbody) {
      usersTbody.innerHTML = state.users
        .map(
          (u) => `
          <tr>
            <td><strong>${escapeHtml(u.campus_id)}</strong></td>
            <td>${escapeHtml(u.full_name)}</td>
            <td><span class="badge badge-green">${escapeHtml(u.role)}</span></td>
            <td><strong style="color:var(--green-800); font-size:0.95rem;">₹${Number(u.wallet_balance).toFixed(2)}</strong></td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm" data-select-wallet="${escapeHtml(u.campus_id)}">⚡ Quick Recharge +₹200</button>
            </td>
          </tr>`
        )
        .join('');

      usersTbody.querySelectorAll('[data-select-wallet]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const cid = btn.dataset.selectWallet;
          const res = await api.rechargeWallet(cid, 200, 'Quick Counter Cash Top-Up');
          if (res.success) {
            showToast(`💳 ${res.message}`);
            refreshAllData();
          }
        });
      });
    }

    if (txnsTbody) {
      txnsTbody.innerHTML = state.transactions
        .slice(0, 15)
        .map(
          (t) => `
          <tr>
            <td><code>${escapeHtml(t.reference_no || 'TXN')}</code></td>
            <td><strong>${escapeHtml(t.campus_id)}</strong></td>
            <td>
              <span class="badge ${t.txn_type === 'credit' ? 'badge-green' : 'badge-amber'}">
                ${t.txn_type === 'credit' ? 'CREDIT (+)' : 'DEBIT (−)'}
              </span>
            </td>
            <td><strong>₹${Number(t.amount).toFixed(2)}</strong></td>
            <td>${escapeHtml(t.description)}</td>
          </tr>`
        )
        .join('');
    }

    if (couponsEl) {
      couponsEl.innerHTML = state.coupons
        .map(
          (c) => `
          <div style="background:var(--green-50); border:1px dashed var(--green-500); padding:0.55rem 0.75rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:var(--green-900); font-size:0.84rem;">${escapeHtml(c.code)} (${c.discount_percent}% OFF)</strong>
              <div style="font-size:0.74rem; color:var(--slate-600);">${escapeHtml(c.description)} • Min ₹${c.min_order_amount}</div>
            </div>
            <span class="badge badge-green">Max ₹${c.max_discount}</span>
          </div>`
        )
        .join('');
    }
  }

  // =========================================================================
  // MODULE 6: ADMIN ANALYTICS, SALES REPORTS & FEEDBACK
  // =========================================================================
  function renderReportsModule() {
    const kpiGrid = document.getElementById('reports-kpi-grid');
    const chartsArea = document.getElementById('reports-charts-area');
    const ordersTbody = document.getElementById('reports-orders-tbody');
    const fbList = document.getElementById('feedback-wall-list');

    const validOrders = state.orders.filter((o) => o.order_status !== 'cancelled');
    const totalRev = validOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const onlineRev = validOrders
      .filter((o) => o.order_source === 'online')
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const posRev = validOrders
      .filter((o) => o.order_source === 'offline_pos')
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const avgRating =
      state.feedback.length > 0
        ? (state.feedback.reduce((s, f) => s + Number(f.rating), 0) / state.feedback.length).toFixed(1)
        : '5.0';

    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-label">Total Canteen Revenue</div>
          <div class="kpi-value">₹${totalRev.toFixed(2)}</div>
          <div class="kpi-sub">Across ${validOrders.length} Total Orders</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">🌿 Online Pre-Order Revenue</div>
          <div class="kpi-value">₹${onlineRev.toFixed(2)}</div>
          <div class="kpi-sub">${validOrders.filter((o) => o.order_source === 'online').length} Student/Staff Orders</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">🖥️ Walk-In Counter POS Revenue</div>
          <div class="kpi-value">₹${posRev.toFixed(2)}</div>
          <div class="kpi-sub">${validOrders.filter((o) => o.order_source === 'offline_pos').length} Counter Bills</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">⭐ Campus Hygiene &amp; Taste Rating</div>
          <div class="kpi-value">${avgRating} / 5.0</div>
          <div class="kpi-sub">Based on ${state.feedback.length} Verified Reviews</div>
        </div>`;
    }

    if (chartsArea) {
      const byMethod = { wallet: 0, upi: 0, cash: 0, card: 0 };
      validOrders.forEach((o) => {
        const m = o.payment_method || 'upi';
        byMethod[m] = (byMethod[m] || 0) + Number(o.total_amount || 0);
      });
      const maxVal = Math.max(1, totalRev);

      const rows = [
        { label: '💳 Campus Smart Wallet', val: byMethod.wallet },
        { label: '📱 UPI QR (GPay / PhonePe)', val: byMethod.upi },
        { label: '💵 Counter Cash Billing', val: byMethod.cash },
        { label: '🌐 Online Portal vs Walk-in POS Split (Online Share)', val: onlineRev }
      ];

      chartsArea.innerHTML = rows
        .map((r) => {
          const pct = Math.min(100, Math.round((r.val / maxVal) * 100));
          return `
          <div class="chart-row">
            <div class="chart-row-head">
              <span>${r.label}</span>
              <span>₹${r.val.toFixed(2)} (${pct}%)</span>
            </div>
            <div class="chart-track">
              <div class="chart-fill" style="inline-size:${pct}%;"></div>
            </div>
          </div>`;
        })
        .join('');
    }

    if (ordersTbody) {
      ordersTbody.innerHTML = state.orders
        .map((o) => {
          const itemSummary = (o.items || []).map((i) => `${i.quantity}× ${i.item_name}`).join(', ');
          return `
          <tr>
            <td><strong>${escapeHtml(o.token_number)}</strong></td>
            <td>${escapeHtml(o.customer_name)}</td>
            <td>
              <span class="badge ${o.order_source === 'offline_pos' ? 'badge-blue' : 'badge-green'}">
                ${o.order_source === 'offline_pos' ? 'POS Counter' : 'Online'}
              </span>
            </td>
            <td style="max-inline-size:240px; white-space:nowrap; overflow:clip; text-overflow:ellipsis;" title="${escapeHtml(itemSummary)}">
              ${escapeHtml(itemSummary)}
            </td>
            <td><strong>₹${Number(o.total_amount).toFixed(2)}</strong></td>
            <td style="text-transform:uppercase; font-weight:700; font-size:0.76rem;">${escapeHtml(o.payment_method)}</td>
            <td><span class="badge badge-green">${escapeHtml(o.order_status)}</span></td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm" data-ledger-receipt="${o.id}">🖨️ Print</button>
            </td>
          </tr>`;
        })
        .join('');

      ordersTbody.querySelectorAll('[data-ledger-receipt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const ord = state.orders.find((o) => Number(o.id) === Number(btn.dataset.ledgerReceipt));
          if (ord) openReceiptModal(ord);
        });
      });
    }

    if (fbList) {
      fbList.innerHTML = state.feedback
        .map(
          (f) => `
          <div style="background:var(--green-50); border:1px solid var(--green-200); padding:0.75rem; border-radius:0.65rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-block-end:0.25rem;">
              <strong style="font-size:0.85rem; color:var(--green-900);">${escapeHtml(f.customer_name)} <span style="font-weight:500; color:var(--slate-600);">(${escapeHtml(f.role_label || 'Student')})</span></strong>
              <span style="font-size:0.8rem;">${'⭐'.repeat(Math.min(5, Math.max(1, Number(f.rating))))}</span>
            </div>
            <p style="font-size:0.8rem; color:var(--slate-700);">${escapeHtml(f.comment)}</p>
          </div>`
        )
        .join('');
    }
  }

  // =========================================================================
  // MODALS: RECEIPT PRINTING, ADD/EDIT DISH, ACCOUNT SWITCHER
  // =========================================================================
  function openReceiptModal(order) {
    const area = document.getElementById('receipt-print-area');
    const dlg = document.getElementById('receipt-dialog');
    if (!area || !dlg) return;

    const dateStr = new Date(order.created_at || Date.now()).toLocaleString();
    const itemsRows = (order.items || [])
      .map(
        (i) => `
        <div class="receipt-line">
          <span>${i.quantity}x ${escapeHtml(i.item_name.slice(0, 22))}</span>
          <span>₹${Number(i.total_price).toFixed(2)}</span>
        </div>`
      )
      .join('');

    area.innerHTML = `
      <div class="receipt-center">
        <img src="./assets/logo-leaf.svg" alt="GreenLeaf Logo" width="42" height="42" style="margin-inline:auto; margin-block-end:0.35rem;" />
        <div style="font-weight:900; font-size:1.05rem;">GREENLEAF CAMPUS CANTEEN</div>
        <div style="font-size:0.74rem;">Offline &amp; Online Smart Canteen System</div>
        <div style="font-size:0.72rem;">GSTIN: 21AABCG2026F1Z5</div>
      </div>
      <div class="receipt-divider"></div>
      <div style="text-align:center; margin-block:0.4rem;">
        <div style="font-size:0.75rem; font-weight:700;">ORDER PICKUP TOKEN</div>
        <div style="font-size:1.75rem; font-weight:900; letter-spacing:0.05em;">${escapeHtml(order.token_number)}</div>
        <div style="font-size:0.74rem;">Mode: ${order.order_source === 'offline_pos' ? 'WALK-IN COUNTER POS' : 'ONLINE PRE-ORDER'}</div>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-line"><span>Customer:</span><span>${escapeHtml(order.customer_name)}</span></div>
      <div class="receipt-line"><span>Slot/Table:</span><span>${escapeHtml(order.table_Or_pickup || 'Counter')}</span></div>
      <div class="receipt-line"><span>Time:</span><span>${escapeHtml(dateStr)}</span></div>
      <div class="receipt-divider"></div>
      ${itemsRows}
      <div class="receipt-divider"></div>
      <div class="receipt-line"><span>Subtotal:</span><span>₹${Number(order.subtotal).toFixed(2)}</span></div>
      ${Number(order.discount_amount) > 0 ? `<div class="receipt-line"><span>Discount:</span><span>-₹${Number(order.discount_amount).toFixed(2)}</span></div>` : ''}
      <div class="receipt-line"><span>GST (5%):</span><span>₹${Number(order.tax_amount).toFixed(2)}</span></div>
      <div class="receipt-line" style="font-weight:900; font-size:0.98rem;">
        <span>TOTAL PAID (${escapeHtml(String(order.payment_method).toUpperCase())}):</span>
        <span>₹${Number(order.total_amount).toFixed(2)}</span>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-center" style="font-size:0.74rem; margin-block-start:0.5rem;">
        🌿 Eat Fresh • Save Paper • Zero Food Waste<br/>Thank you for visiting GreenLeaf Canteen!
      </div>
    `;

    dlg.showModal();
  }

  function openEditMenuModal(itemId) {
    const dlg = document.getElementById('menu-item-dialog');
    const title = document.getElementById('menu-dialog-title');
    const item = state.menuItems.find((m) => Number(m.id) === Number(itemId));

    if (item) {
      title.textContent = `✏️ Edit Dish: ${item.name}`;
      document.getElementById('dish-id').value = item.id;
      document.getElementById('dish-name').value = item.name;
      document.getElementById('dish-category').value = item.category_id;
      document.getElementById('dish-desc').value = item.description;
      document.getElementById('dish-price').value = item.price;
      document.getElementById('dish-stock').value = item.stock_qty;
      document.getElementById('dish-veg').value = item.is_veg;
      document.getElementById('dish-special').value = item.badge || '';
      document.getElementById('dish-calories').value = item.calories || 260;
      document.getElementById('dish-prep').value = item.prep_time_mins || 8;
    } else {
      title.textContent = '🍃 Add New Canteen Dish';
      document.getElementById('menu-item-form').reset();
      document.getElementById('dish-id').value = '';
    }
    dlg.showModal();
  }

  function renderAuthModalCards() {
    const wrap = document.getElementById('auth-Account-cards');
    if (!wrap) return;

    wrap.innerHTML = state.users
      .map((u) => {
        const isCurrent = state.currentUser && state.currentUser.campus_id === u.campus_id;
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border-radius:0.65rem; border:1.5px solid ${isCurrent ? 'var(--green-600)' : 'var(--slate-200)'}; background:${isCurrent ? 'var(--green-50)' : 'var(--white)'};">
          <div>
            <div style="font-weight:800; color:var(--green-900);">${escapeHtml(u.full_name)}</div>
            <div style="font-size:0.76rem; color:var(--slate-600);">
              ID: <strong>${escapeHtml(u.campus_id)}</strong> • Role: <strong style="text-transform:uppercase;">${escapeHtml(u.role)}</strong> • Wallet: <strong>₹${Number(u.wallet_balance).toFixed(2)}</strong>
            </div>
          </div>
          <button type="button" class="btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-sm" data-switch-user="${escapeHtml(u.campus_id)}">
            ${isCurrent ? '✓ Active' : 'Switch Account'}
          </button>
        </div>`;
      })
      .join('');

    wrap.querySelectorAll('[data-switch-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const user = state.users.find((u) => u.campus_id === btn.dataset.switchUser);
        if (user) {
          state.currentUser = user;
          document.getElementById('online-cust-name').value = user.full_name.replace(/\s*\(.*?\)\s*/, '');
          document.getElementById('online-campus-id').value = user.campus_id;
          updateHeaderBadges();
          renderAuthModalCards();
          document.getElementById('auth-dialog').close();
          showToast(`👤 Switched active profile to ${user.full_name}`);
        }
      });
    });
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================
  function bindStaticEvents() {
    // Primary Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Role Switcher in Top Status Bar
    document.querySelectorAll('.role-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const role = btn.dataset.role;
        state.activeRole = role;

        document.querySelectorAll('.nav-tab').forEach((tab) => {
          const allowed = (tab.dataset.roles || 'all').split(',');
          tab.style.display = role === 'all' || allowed.includes(role) ? 'inline-flex' : 'none';
        });

        if (role === 'student') switchView('online');
        else if (role === 'employee') switchView('pos');
        else if (role === 'admin') switchView('reports');
      });
    });

    // Toggle Offline / Online Mode Simulation
    document.getElementById('btn-toggle-offline')?.addEventListener('click', async () => {
      const mode = await api.toggleOfflineSimulation();
      updateConnectionUI();
      if (mode === 'offline_forced') {
        showToast('⚡ Switched to Offline Counter Mode! Orders are stored locally and queued for sync.');
      } else {
        showToast('🌐 Switched to Online Mode! Pending offline orders synced.');
      }
    });

    // Online Search & Diet Filter
    document.getElementById('online-search-input')?.addEventListener('input', (e) => {
      state.onlineSearch = e.target.value;
      renderOnlineMenu();
    });

    document.getElementById('online-diet-filter')?.addEventListener('change', (e) => {
      state.onlineDiet = e.target.value;
      renderOnlineMenu();
    });

    // Hero Coupon Chips
    document.querySelectorAll('[data-apply-coupon]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const code = chip.dataset.applyCoupon;
        document.getElementById('online-coupon-input').value = code;
        applyOnlineCoupon(code);
      });
    });

    document.getElementById('btn-apply-coupon')?.addEventListener('click', () => {
      const code = document.getElementById('online-coupon-input').value;
      applyOnlineCoupon(code);
    });

    document.getElementById('btn-clear-online-cart')?.addEventListener('click', () => {
      state.onlineCart = [];
      state.appliedCoupon = null;
      document.getElementById('coupon-feedback-msg').textContent = '';
      renderOnlineMenu();
      renderOnlineCart();
    });

    // Online Order Checkout Form
    document.getElementById('online-checkout-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.onlineCart.length === 0) {
        showToast('⚠️ Please add at least one item to your tray first!');
        return;
      }

      const { subtotal, discount, tax, total } = getOnlineTotals();
      const payload = {
        customer_name: document.getElementById('online-cust-name').value.trim() || 'Campus Student',
        campus_id: document.getElementById('online-campus-id').value.trim(),
        order_source: 'online',
        service_type: document.getElementById('online-service-type').value,
        table_Or_pickup: document.getElementById('online-pickup-slot').value.trim() || 'Counter Pickup',
        payment_method: document.getElementById('online-pay-method').value,
        notes: document.getElementById('online-notes').value.trim(),
        coupon_code: state.appliedCoupon ? state.appliedCoupon.code : null,
        subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total_amount: total,
        order_status: 'pending',
        items: state.onlineCart.map((i) => ({
          menu_item_id: i.id,
          item_name: i.name,
          quantity: i.quantity,
          unit_price: i.price
        }))
      };

      const res = await api.createOrder(payload);
      if (!res.success) {
        showToast(`❌ ${res.message}`);
        return;
      }

      state.onlineCart = [];
      state.appliedCoupon = null;
      document.getElementById('coupon-feedback-msg').textContent = '';
      document.getElementById('online-notes').value = '';
      await refreshAllData();
      openReceiptModal(res.order);
      showToast(`🎉 Order placed! Your Pickup Token is ${res.token_number}`);
    });

    // Employee POS Search & Controls
    document.getElementById('pos-search-input')?.addEventListener('input', (e) => {
      state.posSearch = e.target.value;
      renderPOSGrid();
    });

    document.getElementById('pos-manual-discount')?.addEventListener('input', () => renderPOSCart());
    document.getElementById('pos-cash-received')?.addEventListener('input', () => updatePOSChangeCalculator());

    document.getElementById('btn-clear-pos-cart')?.addEventListener('click', () => {
      state.posCart = [];
      document.getElementById('pos-manual-discount').value = 0;
      document.getElementById('pos-cash-received').value = '';
      renderPOSCart();
    });

    // Employee POS Checkout Form
    document.getElementById('pos-checkout-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.posCart.length === 0) {
        showToast('⚠️ Counter register is empty. Tap items on the left to bill.');
        return;
      }

      const submitter = e.submitter;
      const targetStatus = submitter?.dataset?.posStatus || 'preparing';
      const { subtotal, discount, tax, total } = getPOSTotals();

      const payload = {
        customer_name: document.getElementById('pos-cust-name').value.trim() || 'Walk-in Guest',
        campus_id: '',
        order_source: 'offline_pos',
        service_type: 'dine_in',
        table_Or_pickup: document.getElementById('pos-table-slot').value,
        payment_method: document.getElementById('pos-pay-method').value,
        subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total_amount: total,
        order_status: targetStatus,
        handled_by: 'Ramesh Verma (POS #1)',
        items: state.posCart.map((i) => ({
          menu_item_id: i.id,
          item_name: i.name,
          quantity: i.quantity,
          unit_price: i.price
        }))
      };

      const res = await api.createOrder(payload);
      if (!res.success) {
        showToast(`❌ ${res.message}`);
        return;
      }

      state.posCart = [];
      document.getElementById('pos-manual-discount').value = 0;
      document.getElementById('pos-cash-received').value = '';
      await refreshAllData();
      openReceiptModal(res.order);
      showToast(`🧾 Counter POS Bill ${res.token_number} generated!`);
    });

    // KDS Source Filter
    document.getElementById('kds-source-filter')?.addEventListener('change', (e) => {
      state.kdsSourceFilter = e.target.value;
      renderKDS();
    });

    // Inventory Modals
    document.getElementById('btn-open-add-menu')?.addEventListener('click', () => openEditMenuModal(null));

    document.getElementById('menu-item-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idVal = document.getElementById('dish-id').value;
      const payload = {
        id: idVal ? Number(idVal) : undefined,
        name: document.getElementById('dish-name').value.trim(),
        category_id: Number(document.getElementById('dish-category').value),
        description: document.getElementById('dish-desc').value.trim(),
        price: Number(document.getElementById('dish-price').value),
        stock_qty: Number(document.getElementById('dish-stock').value),
        is_veg: Number(document.getElementById('dish-veg').value),
        badge: document.getElementById('dish-special').value.trim(),
        is_special: document.getElementById('dish-special').value.trim() ? 1 : 0,
        calories: Number(document.getElementById('dish-calories').value || 250),
        prep_time_mins: Number(document.getElementById('dish-prep').value || 8)
      };

      await api.saveMenuItem(payload);
      document.getElementById('menu-item-dialog').close();
      showToast('🍃 Canteen menu updated successfully!');
      await refreshAllData();
    });

    document.getElementById('btn-open-add-raw')?.addEventListener('click', () => {
      document.getElementById('raw-material-form').reset();
      document.getElementById('raw-material-dialog').showModal();
    });

    document.getElementById('raw-material-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await api.addInventoryItem({
        ingredient_name: document.getElementById('raw-name').value.trim(),
        category: document.getElementById('raw-category').value.trim(),
        unit: document.getElementById('raw-unit').value,
        current_qty: Number(document.getElementById('raw-qty').value),
        min_level: Number(document.getElementById('raw-min').value),
        supplier: document.getElementById('raw-supplier').value.trim()
      });
      document.getElementById('raw-material-dialog').close();
      showToast('🌾 New raw material added to kitchen inventory!');
      await refreshAllData();
    });

    // Wallet Recharge Form & Quick Presets
    document.querySelectorAll('[data-quick-topup]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('wallet-topup-amount').value = btn.dataset.quickTopup;
      });
    });

    document.getElementById('wallet-recharge-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cid = document.getElementById('wallet-topup-id').value;
      const amt = Number(document.getElementById('wallet-topup-amount').value);
      const desc = document.getElementById('wallet-topup-desc').value.trim();

      const res = await api.rechargeWallet(cid, amt, desc);
      if (res.success) {
        showToast(`💰 ${res.message}`);
        await refreshAllData();
      } else {
        showToast(`❌ ${res.message}`);
      }
    });

    // Reports & Feedback Events
    document.getElementById('btn-export-csv')?.addEventListener('click', exportOrdersToCSV);

    document.getElementById('btn-reset-demo')?.addEventListener('click', async () => {
      api.resetDemoData();
      await refreshAllData();
      showToast('🔄 Demo dataset restored to fresh college project defaults.');
    });

    document.getElementById('feedback-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await api.submitFeedback({
        customer_name: document.getElementById('fb-name').value.trim(),
        role_label: document.getElementById('fb-role').value.trim(),
        token_number: document.getElementById('fb-token').value.trim(),
        rating: Number(document.getElementById('fb-rating').value),
        comment: document.getElementById('fb-comment').value.trim()
      });
      document.getElementById('feedback-form').reset();
      showToast('⭐ Thank you! Your review has been posted to the canteen wall.');
      await refreshAllData();
    });

    // Print Receipt Button
    document.getElementById('btn-print-receipt')?.addEventListener('click', () => {
      window.print();
    });

    // Open Account Switcher Modal
    document.getElementById('btn-open-auth')?.addEventListener('click', () => {
      renderAuthModalCards();
      document.getElementById('auth-dialog').showModal();
    });
  }

  async function applyOnlineCoupon(code) {
    const subtotal = state.onlineCart.reduce((s, i) => s + i.price * i.quantity, 0);
    const msgEl = document.getElementById('coupon-feedback-msg');
    const res = await api.validateCoupon(code, subtotal);

    if (res.success) {
      state.appliedCoupon = res.coupon;
      msgEl.style.color = 'var(--green-700)';
      msgEl.textContent = `✅ ${res.message}`;
      showToast(`🏷️ ${res.message}`);
    } else {
      state.appliedCoupon = null;
      msgEl.style.color = 'var(--red-600)';
      msgEl.textContent = `⚠️ ${res.message}`;
    }
    renderOnlineCart();
  }

  function switchView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll('.nav-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.view === viewName);
    });
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${viewName}`);
    });
  }

  function exportOrdersToCSV() {
    const headers = ['Token', 'Customer', 'Source', 'Slot_Or_Table', 'Subtotal', 'Discount', 'GST', 'Total', 'Payment', 'Status', 'Created_At'];
    const rows = state.orders.map((o) => [
      o.token_number,
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      o.order_source,
      `"${(o.table_Or_pickup || '').replace(/"/g, '""')}"`,
      o.subtotal,
      o.discount_amount,
      o.tax_amount,
      o.total_amount,
      o.payment_method,
      o.order_status,
      o.created_at
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `greenleaf_canteen_sales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Exported canteen sales ledger to CSV!');
  }

  function playTokenChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  }

  function showToast(message) {
    const wrap = document.getElementById('toast-container');
    if (!wrap) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    wrap.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
