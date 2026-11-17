# 🍃 GreenLeaf Canteen Management System (Offline & Online Hybrid)

![GreenLeaf Logo](./assets/logo-leaf.svg)

A complete **Full-Stack Offline & Online College Canteen Management System** built with **HTML5, Modern CSS3, Vanilla JavaScript (ES6+), PHP 8+, and MySQL (PDO)** featuring a clean **Green & White** visual theme and a custom **Leaf Logo**.

- 🌐 **Live Public Website (For Employees & Students)**: https://sibanandabhuyan157-ctrl.github.io/greenleaf-canteen-management/
- 📦 **GitHub Repository**: https://github.com/sibanandabhuyan157-ctrl/greenleaf-canteen-management

---

## 🌟 Complete Canteen Management Features

1. **🌿 Student & Faculty Online Pre-Ordering Portal**
   - Browse categorized campus menu (`Breakfast`, `Meals & Thalis`, `Campus Snacks`, `Fresh Beverages`, `Healthy & Salads`, `Desserts`).
   - Filter by **Pure Veg**, **Chef's Specials**, or instant keyword search.
   - Apply student & staff promo coupons (`GREEN20`, `WELCOME10`, `STAFF25`, `HOSTEL15`).
   - Pay via **Campus Smart Wallet**, **UPI QR**, or **Cash at Counter** and receive an instant **Digital Pickup Token (`GL-101`)**.

2. **🖥️ Employee Walk-In Counter POS (Offline & Online Point of Sale)**
   - High-speed touch-friendly billing grid for canteen employees (`Ramesh Verma - EMP-CAN-01`).
   - Works **100% Offline** during internet outages (via Service Worker `sw.js` + local queue sync to `api/sync.php`).
   - Built-in **Cash Received & Change Return Calculator**, manual staff discount, table/parcel selection, and **1-Click Thermal Receipt Printing**.

3. **🔔 Live Kitchen Display System (KDS) & Public TV Token Board**
   - Real-time 4-stage order workflow: `Pending` → `Preparing in Kitchen` → `Ready at Counter` → `Completed`.
   - Public Canteen Token Board showing **Ready for Pickup** vs **Preparing** tokens with audio chime notification.

4. **📦 Menu CRUD & Raw Material Kitchen Inventory**
   - Add, edit, delete, restock (`+20 portions`), or toggle availability (`Sold Out` / `Available`) for any canteen dish.
   - Track raw kitchen groceries (`Rice`, `Milk`, `Paneer`, `Sunflower Oil`, `Biodegradable Plates`) with automatic **Low Stock Alerts**.

5. **💳 Campus Digital Wallet & Passbook**
   - Cashless student & employee wallet directory with instant counter recharge (`+₹100`, `+₹250`, `+₹500`, `+₹1000`) and full transaction ledger.

6. **📊 Admin Revenue Analytics, CSV Reports & Student Feedback Wall**
   - Real-time KPIs (Total Revenue, Online Revenue, Walk-in POS Revenue, Average Hygiene & Taste Rating).
   - Visual payment split charts, **One-Click CSV Sales Report Export**, and verified student star ratings & reviews.

---

## 🛠️ Technology Stack

- **Frontend**: Semantic HTML5 (`<dialog>` native modals), Modern CSS3 (Grid, Flexbox, Logical Properties, Green & White Palette), Vanilla JavaScript (ES6+)
- **Offline Capabilities**: Progressive Web App (`manifest.json`, `sw.js` Service Worker), `localStorage` Hybrid DB, `BroadcastChannel` multi-tab real-time sync
- **Backend**: PHP 8+ REST API (`api/auth.php`, `api/menu.php`, `api/orders.php`, `api/inventory.php`, `api/wallet.php`, `api/analytics.php`, `api/sync.php`)
- **Database**: MySQL / MariaDB (`database/schema.sql`, `config/db.php` via PDO)

---

## 🚀 How to Run

### Option A: Instant Public Web App (GitHub Pages / Static Server)
Open `index.html` or visit the deployed GitHub Pages link. The **Smart Hybrid API Layer (`js/api.js`)** automatically detects when PHP/MySQL is not present and runs the full relational database engine directly in the browser with pre-seeded college canteen data!

### Option B: Local XAMPP / WAMP / LAMP Server (Full PHP + MySQL Mode)
1. Copy this project folder into `C:/xampp/htdocs/greenleaf-canteen/`.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) and import `database/schema.sql` (creates the `greenleaf_canteen` database and seeds all tables).
4. Check `config/db.php` (defaults to `host=127.0.0.1`, `dbname=greenleaf_canteen`, `user=root`, `pass=''`).
5. Visit `http://localhost/greenleaf-canteen/` — the status bar will automatically display **`Online • PHP 8 + MySQL Connected`**.
