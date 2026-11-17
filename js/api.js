/**
 * GreenLeaf Canteen Management System
 * Smart Hybrid Data Layer (PHP/MySQL REST API + Offline LocalStorage Engine + BroadcastChannel Sync)
 */

class GreenLeafAPI {
  constructor() {
    this.storageKey = 'greenleaf_canteen_db_v1';
    this.offlineQueueKey = 'greenleaf_offline_queue_v1';
    this.backendMode = 'checking'; // 'php_mysql' | 'hybrid_local' | 'offline_forced'
    this.forceOffline = false;
    this.channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('greenleaf_canteen_sync')
      : null;

    this.ensureLocalStore();
  }

  ensureLocalStore() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      localStorage.setItem(this.storageKey, JSON.stringify(window.GREENLEAF_SEED_DATA));
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.menu_items)) {
          localStorage.setItem(this.storageKey, JSON.stringify(window.GREENLEAF_SEED_DATA));
        }
      } catch {
        localStorage.setItem(this.storageKey, JSON.stringify(window.GREENLEAF_SEED_DATA));
      }
    }
  }

  getLocalDB() {
    this.ensureLocalStore();
    return JSON.parse(localStorage.getItem(this.storageKey));
  }

  saveLocalDB(db, notify = true) {
    localStorage.setItem(this.storageKey, JSON.stringify(db));
    if (notify && this.channel) {
      this.channel.postMessage({ type: 'db_updated', timestamp: Date.now() });
    }
  }

  resetDemoData() {
    localStorage.setItem(this.storageKey, JSON.stringify(window.GREENLEAF_SEED_DATA));
    localStorage.removeItem(this.offlineQueueKey);
    if (this.channel) {
      this.channel.postMessage({ type: 'db_updated', timestamp: Date.now() });
    }
    return this.getLocalDB();
  }

  getOfflineQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.offlineQueueKey) || '[]');
    } catch {
      return [];
    }
  }

  pushOfflineQueue(order) {
    const q = this.getOfflineQueue();
    q.push(order);
    localStorage.setItem(this.offlineQueueKey, JSON.stringify(q));
  }

  clearOfflineQueue() {
    localStorage.removeItem(this.offlineQueueKey);
  }

  async detectBackend() {
    if (this.forceOffline || !navigator.onLine) {
      this.backendMode = 'offline_forced';
      return this.backendMode;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const res = await fetch('./api/index.php', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.success && data.backend === 'php_mysql') {
          this.backendMode = 'php_mysql';
          return this.backendMode;
        }
      }
    } catch {
      // Static host (e.g., GitHub Pages) or offline mode
    }

    this.backendMode = 'hybrid_local';
    return this.backendMode;
  }

  async toggleOfflineSimulation(forceState) {
    this.forceOffline = typeof forceState === 'boolean' ? forceState : !this.forceOffline;
    if (this.forceOffline) {
      this.backendMode = 'offline_forced';
    } else {
      await this.detectBackend();
      await this.syncPendingOrders();
    }
    return this.backendMode;
  }

  async syncPendingOrders() {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) {
      return { synced: 0 };
    }
    if (this.backendMode === 'php_mysql') {
      try {
        const res = await fetch('./api/sync.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: queue })
        });
        if (res.ok) {
          this.clearOfflineQueue();
          return { synced: queue.length };
        }
      } catch {
        // Keep in queue until reachable
      }
    }
    // In hybrid mode, mark queued orders as synced
    const count = queue.length;
    this.clearOfflineQueue();
    return { synced: count };
  }

  // =========================================================================
  // MENU & CATEGORIES
  // =========================================================================
  async getMenuData() {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        const res = await fetch('./api/menu.php');
        const data = await res.json();
        if (data.success) {
          const db = this.getLocalDB();
          db.categories = data.categories;
          db.menu_items = data.items;
          this.saveLocalDB(db, false);
          return data;
        }
      } catch {
        // Fallback to local DB
      }
    }
    const db = this.getLocalDB();
    return {
      success: true,
      categories: db.categories,
      items: db.menu_items
    };
  }

  async saveMenuItem(itemData) {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        const method = itemData.id ? 'PUT' : 'POST';
        const res = await fetch('./api/menu.php', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemData)
        });
        const data = await res.json();
        if (data.success) return data;
      } catch {
        // Fallback to local
      }
    }

    const db = this.getLocalDB();
    const cat = db.categories.find((c) => Number(c.id) === Number(itemData.category_id)) || db.categories[0];

    if (itemData.id) {
      const idx = db.menu_items.findIndex((m) => Number(m.id) === Number(itemData.id));
      if (idx !== -1) {
        db.menu_items[idx] = {
          ...db.menu_items[idx],
          ...itemData,
          id: Number(itemData.id),
          category_id: Number(cat.id),
          category_name: cat.name,
          category_slug: cat.slug,
          price: Number(itemData.price),
          stock_qty: Number(itemData.stock_qty),
          is_veg: Number(itemData.is_veg),
          is_special: Number(itemData.is_special),
          is_available: Number(itemData.stock_qty) > 0 ? 1 : 0
        };
      }
      this.saveLocalDB(db);
      return { success: true, message: 'Menu item updated successfully.' };
    } else {
      const nextId = db.menu_items.reduce((max, m) => Math.max(max, Number(m.id)), 0) + 1;
      const newItem = {
        id: nextId,
        category_id: Number(cat.id),
        category_name: cat.name,
        category_slug: cat.slug,
        name: itemData.name,
        description: itemData.description || 'Freshly prepared in the GreenLeaf campus kitchen.',
        price: Number(itemData.price),
        cost_price: Number(itemData.cost_price || Math.round(itemData.price * 0.45)),
        is_veg: Number(itemData.is_veg ?? 1),
        calories: Number(itemData.calories || 260),
        prep_time_mins: Number(itemData.prep_time_mins || 8),
        stock_qty: Number(itemData.stock_qty ?? 35),
        low_stock_threshold: Number(itemData.low_stock_threshold || 8),
        is_available: Number(itemData.stock_qty ?? 35) > 0 ? 1 : 0,
        is_special: Number(itemData.is_special ?? 0),
        badge: itemData.badge || 'New',
        emoji: itemData.emoji || '🍽️'
      };
      db.menu_items.unshift(newItem);
      this.saveLocalDB(db);
      return { success: true, message: 'New menu item added to canteen menu!', id: nextId };
    }
  }

  async toggleMenuAvailability(id) {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch('./api/menu.php', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'toggle_availability' })
        });
      } catch {}
    }
    const db = this.getLocalDB();
    const item = db.menu_items.find((m) => Number(m.id) === Number(id));
    if (item) {
      item.is_available = item.is_available ? 0 : 1;
      this.saveLocalDB(db);
    }
    return { success: true };
  }

  async restockMenuItem(id, addQty = 20) {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch('./api/menu.php', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'restock', add_qty: addQty })
        });
      } catch {}
    }
    const db = this.getLocalDB();
    const item = db.menu_items.find((m) => Number(m.id) === Number(id));
    if (item) {
      item.stock_qty = Number(item.stock_qty) + Number(addQty);
      item.is_available = 1;
      this.saveLocalDB(db);
    }
    return { success: true };
  }

  async deleteMenuItem(id) {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch(`./api/menu.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {}
    }
    const db = this.getLocalDB();
    db.menu_items = db.menu_items.filter((m) => Number(m.id) !== Number(id));
    this.saveLocalDB(db);
    return { success: true };
  }

  // =========================================================================
  // ORDERS & KITCHEN DISPLAY SYSTEM (KDS)
  // =========================================================================
  async getOrders() {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        const res = await fetch('./api/orders.php');
        const data = await res.json();
        if (data.success) {
          const db = this.getLocalDB();
          db.orders = data.orders;
          this.saveLocalDB(db, false);
          return data.orders;
        }
      } catch {}
    }
    const db = this.getLocalDB();
    return db.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async createOrder(orderPayload) {
    const db = this.getLocalDB();
    const maxId = db.orders.reduce((max, o) => Math.max(max, Number(o.id || 100)), 100);
    const nextId = maxId + 1;
    const prefix = orderPayload.order_source === 'offline_pos' ? 'POS-' : 'GL-';
    const tokenNumber = orderPayload.token_number || `${prefix}${nextId}`;

    let subtotal = 0;
    const normalizedItems = (orderPayload.items || []).map((item) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      const uPrice = Number(item.unit_price ?? item.price ?? 0);
      const tPrice = Number((qty * uPrice).toFixed(2));
      subtotal += tPrice;
      return {
        menu_item_id: Number(item.menu_item_id || item.id),
        item_name: item.item_name || item.name,
        quantity: qty,
        unit_price: uPrice,
        total_price: tPrice
      };
    });

    const discount = Number(orderPayload.discount_amount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const tax = Number((taxable * 0.05).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));

    // Check wallet balance if paying via campus wallet
    if (orderPayload.payment_method === 'wallet') {
      const cid = orderPayload.campus_id || 'STU-2026-101';
      const user = db.users.find((u) => u.campus_id.toUpperCase() === cid.toUpperCase());
      if (!user) {
        return { success: false, message: `Campus ID "${cid}" not found in wallet registry.` };
      }
      if (Number(user.wallet_balance) < total) {
        return {
          success: false,
          message: `Insufficient wallet balance (Available: ₹${Number(user.wallet_balance).toFixed(2)}, Required: ₹${total.toFixed(2)}). Please recharge wallet or choose UPI/Cash.`
        };
      }
      user.wallet_balance = Number((Number(user.wallet_balance) - total).toFixed(2));
      db.wallet_transactions.unshift({
        id: Date.now(),
        campus_id: user.campus_id,
        txn_type: 'debit',
        amount: total,
        description: `Order ${tokenNumber} (${normalizedItems.map((i) => i.item_name).join(', ').slice(0, 60)})`,
        reference_no: `ORD-${nextId}`,
        created_at: new Date().toISOString()
      });
    }

    // Deduct stock quantities
    normalizedItems.forEach((ordItem) => {
      const menuObj = db.menu_items.find((m) => Number(m.id) === Number(ordItem.menu_item_id));
      if (menuObj) {
        menuObj.stock_qty = Math.max(0, Number(menuObj.stock_qty) - ordItem.quantity);
        if (menuObj.stock_qty === 0) {
          menuObj.is_available = 0;
        }
      }
    });

    const newOrder = {
      id: nextId,
      token_number: tokenNumber,
      customer_name: orderPayload.customer_name || 'Walk-in Guest',
      customer_phone: orderPayload.customer_phone || '',
      campus_id: orderPayload.campus_id || '',
      order_source: orderPayload.order_source || 'online',
      service_type: orderPayload.service_type || 'pickup',
      table_Or_pickup: orderPayload.table_Or_pickup || 'Counter Pickup',
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: tax,
      discount_amount: discount,
      total_amount: total,
      coupon_code: orderPayload.coupon_code || null,
      payment_method: orderPayload.payment_method || 'upi',
      payment_status: 'paid',
      order_status: orderPayload.order_status || 'pending',
      notes: orderPayload.notes || '',
      handled_by: orderPayload.handled_by || (orderPayload.order_source === 'offline_pos' ? 'Ramesh Verma (POS Counter)' : 'Online Self-Order'),
      created_at: new Date().toISOString(),
      items: normalizedItems
    };

    db.orders.unshift(newOrder);
    this.saveLocalDB(db);

    if (this.forceOffline || !navigator.onLine) {
      this.pushOfflineQueue(newOrder);
    } else if (this.backendMode === 'php_mysql') {
      try {
        await fetch('./api/orders.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrder)
        });
      } catch {
        this.pushOfflineQueue(newOrder);
      }
    }

    return {
      success: true,
      order: newOrder,
      token_number: tokenNumber,
      total_amount: total
    };
  }

  async updateOrderStatus(orderIdOrToken, newStatus) {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch('./api/orders.php', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: orderIdOrToken, token_number: String(orderIdOrToken), order_status: newStatus })
        });
      } catch {}
    }

    const db = this.getLocalDB();
    const ord = db.orders.find(
      (o) => Number(o.id) === Number(orderIdOrToken) || o.token_number === String(orderIdOrToken)
    );
    if (ord) {
      ord.order_status = newStatus;
      ord.updated_at = new Date().toISOString();
      this.saveLocalDB(db);
    }
    return { success: true, order: ord };
  }

  // =========================================================================
  // INVENTORY & RAW MATERIALS
  // =========================================================================
  async getInventory() {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        const res = await fetch('./api/inventory.php');
        const data = await res.json();
        if (data.success) {
          const db = this.getLocalDB();
          db.inventory_items = data.inventory;
          this.saveLocalDB(db, false);
          return data.inventory;
        }
      } catch {}
    }
    return this.getLocalDB().inventory_items;
  }

  async updateInventoryQty(id, deltaQty) {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch('./api/inventory.php', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, add_qty: deltaQty })
        });
      } catch {}
    }
    const db = this.getLocalDB();
    const inv = db.inventory_items.find((i) => Number(i.id) === Number(id));
    if (inv) {
      inv.current_qty = Math.max(0, Number((Number(inv.current_qty) + Number(deltaQty)).toFixed(2)));
      this.saveLocalDB(db);
    }
    return { success: true };
  }

  async addInventoryItem(payload) {
    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch('./api/inventory.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {}
    }
    const db = this.getLocalDB();
    const nextId = db.inventory_items.reduce((max, i) => Math.max(max, Number(i.id)), 0) + 1;
    db.inventory_items.push({
      id: nextId,
      ingredient_name: payload.ingredient_name,
      category: payload.category || 'Kitchen Staples',
      current_qty: Number(payload.current_qty || 10),
      unit: payload.unit || 'kg',
      min_level: Number(payload.min_level || 5),
      unit_cost: Number(payload.unit_cost || 50),
      supplier: payload.supplier || 'Campus Vendor'
    });
    this.saveLocalDB(db);
    return { success: true };
  }

  // =========================================================================
  // WALLET & COUPONS
  // =========================================================================
  async getWalletData() {
    const db = this.getLocalDB();
    return {
      users: db.users,
      transactions: db.wallet_transactions,
      coupons: db.coupons
    };
  }

  async validateCoupon(code, subtotal) {
    const cleanCode = String(code || '').trim().toUpperCase();
    const db = this.getLocalDB();
    const coupon = db.coupons.find((c) => c.code.toUpperCase() === cleanCode && Number(c.is_active) === 1);
    if (!coupon) {
      return { success: false, message: 'Invalid or expired promo code.' };
    }
    if (subtotal < Number(coupon.min_order_amount)) {
      return {
        success: false,
        message: `Minimum order of ₹${coupon.min_order_amount} required for code ${coupon.code}.`
      };
    }
    const discount = Math.min(
      Number(coupon.max_discount),
      Number(((subtotal * Number(coupon.discount_percent)) / 100).toFixed(2))
    );
    return {
      success: true,
      coupon,
      discount_amount: discount,
      message: `${coupon.code} applied! Saved ₹${discount.toFixed(2)} (${coupon.discount_percent}% OFF)`
    };
  }

  async rechargeWallet(campusId, amount, description = 'Counter Cash / UPI Top-Up') {
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) {
      return { success: false, message: 'Please enter a valid recharge amount.' };
    }

    const db = this.getLocalDB();
    const user = db.users.find((u) => u.campus_id.toUpperCase() === String(campusId).trim().toUpperCase());
    if (!user) {
      return { success: false, message: 'Campus ID not found.' };
    }

    user.wallet_balance = Number((Number(user.wallet_balance) + numAmt).toFixed(2));
    db.wallet_transactions.unshift({
      id: Date.now(),
      campus_id: user.campus_id,
      txn_type: 'credit',
      amount: numAmt,
      description,
      reference_no: 'TOP-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      created_at: new Date().toISOString()
    });
    this.saveLocalDB(db);

    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch('./api/wallet.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campus_id: user.campus_id, amount: numAmt, txn_type: 'credit', description })
        });
      } catch {}
    }

    return {
      success: true,
      wallet_balance: user.wallet_balance,
      user,
      message: `Recharged ₹${numAmt.toFixed(2)} for ${user.full_name}. New balance: ₹${user.wallet_balance.toFixed(2)}`
    };
  }

  // =========================================================================
  // FEEDBACK
  // =========================================================================
  async submitFeedback(payload) {
    const db = this.getLocalDB();
    const newEntry = {
      id: Date.now(),
      token_number: payload.token_number || '',
      customer_name: payload.customer_name || 'Campus Student',
      role_label: payload.role_label || 'Student',
      rating: Number(payload.rating || 5),
      comment: payload.comment,
      created_at: new Date().toISOString()
    };
    db.feedback.unshift(newEntry);
    this.saveLocalDB(db);

    if (this.backendMode === 'php_mysql' && !this.forceOffline) {
      try {
        await fetch('./api/analytics.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEntry)
        });
      } catch {}
    }
    return { success: true, entry: newEntry };
  }
}

window.canteenAPI = new GreenLeafAPI();
