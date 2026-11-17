<?php
/**
 * Simple Canteen Management System - PHP + MySQL Backend
 * Connects to `canteen_db` and handles menu & order actions.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$conn = @new mysqli('localhost', 'root', '', 'canteen_db');
if ($conn->connect_error) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'msg' => 'MySQL not connected']);
    exit;
}

$action = $_GET['action'] ?? '';
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

// 1. Fetch all menu items and orders
if ($action === 'load') {
    $menu   = $conn->query("SELECT * FROM menu ORDER BY id ASC")->fetch_all(MYSQLI_ASSOC);
    $orders = $conn->query("SELECT * FROM orders ORDER BY id DESC")->fetch_all(MYSQLI_ASSOC);
    echo json_encode(['ok' => true, 'menu' => $menu, 'orders' => $orders]);
    exit;
}

// 2. Place a new order (Online or Offline Walk-in)
if ($action === 'place_order') {
    $stmt = $conn->prepare("INSERT INTO orders (token, customer_name, order_type, items_summary, total_amount, payment_mode, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')");
    $stmt->bind_param("ssssds", $input['token'], $input['customer_name'], $input['order_type'], $input['items_summary'], $input['total_amount'], $input['payment_mode']);
    $stmt->execute();
    echo json_encode(['ok' => true, 'id' => $conn->insert_id]);
    exit;
}

// 3. Update order status (Pending -> Preparing -> Ready -> Completed)
if ($action === 'update_status') {
    $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->bind_param("si", $input['status'], $input['id']);
    $stmt->execute();
    echo json_encode(['ok' => true]);
    exit;
}

// 4. Add a new menu item
if ($action === 'add_item') {
    $stmt = $conn->prepare("INSERT INTO menu (name, category, price, available) VALUES (?, ?, ?, 1)");
    $stmt->bind_param("ssd", $input['name'], $input['category'], $input['price']);
    $stmt->execute();
    echo json_encode(['ok' => true, 'id' => $conn->insert_id]);
    exit;
}

// 5. Toggle item availability (Available / Sold Out)
if ($action === 'toggle_item') {
    $id = (int)($input['id'] ?? 0);
    $conn->query("UPDATE menu SET available = IF(available=1, 0, 1) WHERE id = $id");
    echo json_encode(['ok' => true]);
    exit;
}

// 6. Delete a menu item
if ($action === 'delete_item') {
    $id = (int)($input['id'] ?? 0);
    $conn->query("DELETE FROM menu WHERE id = $id");
    echo json_encode(['ok' => true]);
    exit;
}

echo json_encode(['ok' => false, 'msg' => 'Invalid action']);
