-- =========================================================
-- Simple College Canteen Management Database (MySQL)
-- =========================================================

CREATE DATABASE IF NOT EXISTS canteen_db;
USE canteen_db;

-- 1. Menu Table
CREATE TABLE IF NOT EXISTS menu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  available TINYINT(1) DEFAULT 1
);

-- 2. Orders Table (Supports Online & Offline Walk-in Orders)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(20) NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  order_type VARCHAR(30) NOT NULL,   -- 'Online' or 'Walk-in POS'
  items_summary TEXT NOT NULL,
  total_amount DECIMAL(8,2) NOT NULL,
  payment_mode VARCHAR(30) NOT NULL, -- 'UPI' or 'Cash'
  status VARCHAR(30) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Canteen Menu Data
INSERT INTO menu (name, category, price, available) VALUES
('Masala Dosa', 'Breakfast', 50.00, 1),
('Idli Vada Plate', 'Breakfast', 40.00, 1),
('Special Veg Thali', 'Meals', 90.00, 1),
('Veg Dum Biryani', 'Meals', 80.00, 1),
('Samosa Plate (2 Pcs)', 'Snacks', 25.00, 1),
('Paneer Grilled Sandwich', 'Snacks', 55.00, 1),
('Masala Kullad Chai', 'Drinks', 15.00, 1),
('Cold Coffee', 'Drinks', 45.00, 1);

-- Sample Initial Orders
INSERT INTO orders (token, customer_name, order_type, items_summary, total_amount, payment_mode, status) VALUES
('T-101', 'Aarav Sharma', 'Online', '1x Masala Dosa, 1x Masala Kullad Chai', 65.00, 'UPI', 'Ready'),
('T-102', 'Counter Table 3', 'Walk-in POS', '1x Special Veg Thali, 1x Cold Coffee', 135.00, 'Cash', 'Preparing');
