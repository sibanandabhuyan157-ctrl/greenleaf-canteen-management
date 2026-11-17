-- ============================================================================
-- GreenLeaf Canteen Management System (Offline & Online Hybrid Canteen)
-- Technology: PHP 8+ & MySQL / MariaDB
-- Scope: Complete College Project Database Schema & Initial Seed Data
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `greenleaf_canteen`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `greenleaf_canteen`;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE (Students, Faculty, Canteen Employees, Admin)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `campus_id` VARCHAR(32) NOT NULL UNIQUE COMMENT 'Roll No or Employee ID',
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NOT NULL,
  `role` ENUM('student', 'employee', 'admin') NOT NULL DEFAULT 'student',
  `password_hash` VARCHAR(255) NOT NULL,
  `wallet_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(60) NOT NULL,
  `slug` VARCHAR(60) NOT NULL UNIQUE,
  `icon` VARCHAR(32) DEFAULT 'utensils',
  `sort_order` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. MENU ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `price` DECIMAL(8, 2) NOT NULL,
  `cost_price` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `is_veg` TINYINT(1) NOT NULL DEFAULT 1,
  `calories` INT UNSIGNED DEFAULT 250,
  `prep_time_mins` INT UNSIGNED DEFAULT 10,
  `stock_qty` INT NOT NULL DEFAULT 50,
  `low_stock_threshold` INT NOT NULL DEFAULT 10,
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `is_special` TINYINT(1) NOT NULL DEFAULT 0,
  `badge` VARCHAR(40) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_menu_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. ORDERS TABLE (Supports both Online Pre-Orders & Offline Walk-in POS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `token_number` VARCHAR(20) NOT NULL UNIQUE,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_phone` VARCHAR(20) DEFAULT '',
  `campus_id` VARCHAR(32) DEFAULT '',
  `order_source` ENUM('online', 'offline_pos') NOT NULL DEFAULT 'online',
  `service_type` ENUM('dine_in', 'pickup', 'parcel') NOT NULL DEFAULT 'pickup',
  `table_Or_pickup` VARCHAR(50) DEFAULT 'Counter Pickup',
  `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `coupon_code` VARCHAR(30) DEFAULT NULL,
  `payment_method` ENUM('cash', 'upi', 'wallet', 'card') NOT NULL DEFAULT 'upi',
  `payment_status` ENUM('paid', 'pending', 'refunded') NOT NULL DEFAULT 'paid',
  `order_status` ENUM('pending', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` VARCHAR(255) DEFAULT '',
  `handled_by` VARCHAR(80) DEFAULT 'Self-Service Online',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_order_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. ORDER ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT UNSIGNED NOT NULL,
  `menu_item_id` INT UNSIGNED DEFAULT NULL,
  `item_name` VARCHAR(120) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(8, 2) NOT NULL,
  `total_price` DECIMAL(10, 2) NOT NULL,
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_menu` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. RAW MATERIAL INVENTORY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `ingredient_name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(60) NOT NULL,
  `current_qty` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `unit` VARCHAR(20) NOT NULL DEFAULT 'kg',
  `min_level` DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
  `unit_cost` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `supplier` VARCHAR(100) DEFAULT 'Local Farm Co-op',
  `last_restocked` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. WALLET TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `campus_id` VARCHAR(32) NOT NULL,
  `txn_type` ENUM('credit', 'debit') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `description` VARCHAR(200) NOT NULL,
  `reference_no` VARCHAR(50) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wallet_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. COUPONS & PROMOTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL UNIQUE,
  `description` VARCHAR(150) NOT NULL,
  `discount_percent` INT UNSIGNED NOT NULL,
  `max_discount` DECIMAL(8, 2) NOT NULL DEFAULT 100.00,
  `min_order_amount` DECIMAL(8, 2) NOT NULL DEFAULT 50.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. CUSTOMER FEEDBACK TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `feedback` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `token_number` VARCHAR(20) DEFAULT '',
  `customer_name` VARCHAR(100) NOT NULL,
  `role_label` VARCHAR(50) DEFAULT 'Student',
  `rating` TINYINT UNSIGNED NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
  `comment` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO `users` (`campus_id`, `full_name`, `email`, `phone`, `role`, `password_hash`, `wallet_balance`) VALUES
('STU-2026-101', 'Aarav Sharma (Student)', 'aarav@college.edu', '9876543210', 'student', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 450.00),
('STU-2026-102', 'Priya Patel (Student)', 'priya@college.edu', '9876543211', 'student', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 280.00),
('EMP-CAN-01', 'Ramesh Verma (Counter Staff)', 'ramesh.pos@college.edu', '9876543220', 'employee', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 600.00),
('ADM-CAN-01', 'Dr. S. Bhuyan (Canteen Admin)', 'admin@college.edu', '9876543200', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1500.00);

INSERT INTO `categories` (`id`, `name`, `slug`, `icon`, `sort_order`) VALUES
(1, 'Breakfast & Tiffin', 'breakfast', 'sunrise', 1),
(2, 'Meals & Thalis', 'meals', 'bowl', 2),
(3, 'Campus Snacks', 'snacks', 'flame', 3),
(4, 'Fresh Beverages', 'beverages', 'cup', 4),
(5, 'Healthy & Salads', 'healthy', 'leaf', 5),
(6, 'Desserts & Bakery', 'desserts', 'cake', 6);

INSERT INTO `menu_items` (`category_id`, `name`, `description`, `price`, `cost_price`, `is_veg`, `calories`, `prep_time_mins`, `stock_qty`, `low_stock_threshold`, `is_available`, `is_special`, `badge`) VALUES
(1, 'Masala Dosa with Coconut Chutney', 'Crispy golden fermented crepe stuffed with spiced potato mash, served with fresh sambar & chutney.', 55.00, 24.00, 1, 340, 8, 42, 10, 1, 1, 'Bestseller'),
(1, 'Steamed Idli Vada Combo (2+1)', 'Two fluffy rice idlis and one crispy medu vada served with piping hot sambar.', 45.00, 18.00, 1, 280, 5, 38, 10, 1, 0, 'Morning Hit'),
(1, 'Poha with Sev & Pomegranate', 'Light flattened rice tempered with curry leaves, mustard seeds, peanuts, and fresh coriander.', 35.00, 12.00, 1, 220, 5, 25, 8, 1, 0, 'Light & Healthy'),
(2, 'GreenLeaf Special Deluxe Veg Thali', '2 Phulka rotis, jeera rice, dal tadka, paneer butter masala, seasonal veg, raita, papad & gulab jamun.', 110.00, 52.00, 1, 680, 12, 30, 8, 1, 1, 'Chef Special'),
(2, 'Rajma Chawal Bowl', 'Home-style slow-cooked red kidney beans curry over aromatic basmati rice with pickled onions.', 65.00, 26.00, 1, 450, 7, 34, 10, 1, 0, 'Student Favorite'),
(2, 'Hyderabadi Veg Dum Biryani', 'Fragrant long-grain basmati rice layered with spiced garden vegetables, mint, and burhani raita.', 95.00, 42.00, 1, 560, 10, 18, 8, 1, 1, 'Popular'),
(2, 'Classic Egg Curry & Rice Combo', 'Two farm-fresh boiled eggs simmered in onion-tomato masala gravy with steamed rice.', 85.00, 38.00, 0, 520, 10, 22, 6, 1, 0, 'High Protein'),
(3, 'Punjabi Samosa Plate (2 Pcs)', 'Crisp flaky pastry triangles stuffed with spiced potato & green peas, with tamarind-mint chutney.', 30.00, 11.00, 1, 310, 4, 65, 15, 1, 0, 'Quick Bite'),
(3, 'Grilled Paneer Tikka Sandwich', 'Triple-layer whole wheat jumbo bread filled with smoky paneer tikka, mint mayo & crunchy veggies.', 60.00, 25.00, 1, 390, 8, 16, 6, 1, 1, 'Must Try'),
(3, 'Veg Hakka Noodles', 'Wok-tossed noodles with julienned bell peppers, cabbage, carrots, and Indo-Chinese soy garlic glaze.', 70.00, 28.00, 1, 430, 9, 24, 8, 1, 0, ''),
(4, 'Adrak Elaichi Kullad Chai', 'Freshly brewed Assam tea infused with crushed ginger and green cardamom served in an earthen cup.', 15.00, 5.00, 1, 90, 3, 120, 20, 1, 0, 'Campus Staple'),
(4, 'Cold Coffee with Cocoa Foam', 'Chilled creamy arabica coffee blended with milk and topped with rich chocolate dust.', 50.00, 18.00, 1, 240, 4, 32, 8, 1, 1, 'Chilled'),
(4, 'Fresh Mint Mojito Cooler', 'Refreshing muddled garden mint leaves, lime wedges, and sparkling water over crushed ice.', 45.00, 14.00, 1, 110, 4, 28, 8, 1, 0, 'Zero Caffeine'),
(5, 'GreenLeaf Sprouted Protein Bowl', 'Steamed moong sprouts, chickpeas, cucumber, cherry tomatoes, paneer cubes & lemon-herb dressing.', 60.00, 24.00, 1, 260, 5, 19, 6, 1, 1, '100% Healthy'),
(6, 'Warm Gulab Jamun (2 Pcs)', 'Soft khoya dumplings soaked in rose and saffron-infused sugar syrup.', 35.00, 14.00, 1, 320, 3, 8, 10, 1, 0, 'Low Stock'),
(6, 'Dark Chocolate Walnut Brownie', 'Fudgy oven-baked cocoa brownie studded with roasted Himalayan walnuts.', 55.00, 22.00, 1, 380, 4, 14, 5, 1, 0, '');

INSERT INTO `inventory_items` (`ingredient_name`, `category`, `current_qty`, `unit`, `min_level`, `unit_cost`, `supplier`) VALUES
('Basmati & Sona Masoori Rice', 'Grains & Staples', 42.50, 'kg', 15.00, 68.00, 'AgroFresh Wholesale'),
('Fresh Farm Milk (Full Cream)', 'Dairy', 28.00, 'liters', 12.00, 56.00, 'Campus Dairy Co-op'),
('Fresh Malai Paneer', 'Dairy', 4.50, 'kg', 6.00, 320.00, 'Campus Dairy Co-op'),
('Whole Wheat Atta & Maida', 'Grains & Staples', 35.00, 'kg', 10.00, 42.00, 'AgroFresh Wholesale'),
('Potatoes, Onions & Tomatoes', 'Fresh Produce', 48.00, 'kg', 20.00, 34.00, 'GreenValley Farmers'),
('Cold-Pressed Sunflower Oil', 'Oils & Condiments', 8.00, 'liters', 10.00, 135.00, 'Metro Cash & Carry'),
('Assam CTC Tea Leaves & Coffee', 'Beverages', 6.50, 'kg', 3.00, 410.00, 'Darjeeling Estates'),
('Eco-Friendly Biodegradable Plates', 'Packaging', 180.00, 'packs', 50.00, 25.00, 'EcoLeaf Supplies');

INSERT INTO `coupons` (`code`, `description`, `discount_percent`, `max_discount`, `min_order_amount`, `is_active`) VALUES
('GREEN20', '20% OFF on Healthy & Eco-Friendly Canteen Pre-Orders', 20, 50.00, 80.00, 1),
('WELCOME10', 'Flat 10% OFF on all student online orders', 10, 40.00, 50.00, 1),
('STAFF25', '25% Faculty & Canteen Employee Special Discount', 25, 75.00, 100.00, 1),
('HOSTEL15', '15% OFF on Evening Snacks & Combos', 15, 45.00, 60.00, 1);

INSERT INTO `feedback` (`token_number`, `customer_name`, `role_label`, `rating`, `comment`) VALUES
('GL-101', 'Aarav Sharma', 'B.Tech CSE - 3rd Yr', 5, 'Loved the online pre-order system! Walked in between lectures and my Masala Dosa was hot and ready at the token counter.'),
('GL-102', 'Prof. Meera Nair', 'ECE Department', 5, 'The GreenLeaf Sprouted Protein Bowl and Kullad Chai are super fresh. Clean green & white interface is very easy to use.'),
('GL-103', 'Rohan Das', 'MBA - 1st Yr', 4, 'Counter billing is super fast now with the POS receipt and live token display screen.');
