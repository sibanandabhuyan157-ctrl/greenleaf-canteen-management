<?php
/**
 * GreenLeaf Canteen API - Analytics, Daily Sales Reports & Student Feedback
 */
require_once __DIR__ . '/../config/db.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $kpiSql = "
        SELECT
            COUNT(*) AS total_orders,
            COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue,
            COALESCE(SUM(CASE WHEN order_source = 'online' AND order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS online_revenue,
            COALESCE(SUM(CASE WHEN order_source = 'offline_pos' AND order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS pos_revenue,
            SUM(CASE WHEN order_status IN ('pending', 'preparing', 'ready') THEN 1 ELSE 0 END) AS active_orders
        FROM orders
    ";
    $kpis = $pdo->query($kpiSql)->fetch();

    $lowStockMenu = (int)$pdo->query('SELECT COUNT(*) FROM menu_items WHERE stock_qty <= low_stock_threshold')->fetchColumn();
    $lowStockInv  = (int)$pdo->query('SELECT COUNT(*) FROM inventory_items WHERE current_qty <= min_level')->fetchColumn();

    $feedback = $pdo->query('SELECT * FROM feedback ORDER BY id DESC LIMIT 20')->fetchAll();

    sendJson([
        'success'        => true,
        'kpis'           => $kpis,
        'low_stock_menu' => $lowStockMenu,
        'low_stock_inv'  => $lowStockInv,
        'feedback'       => $feedback
    ]);
}

if ($method === 'POST') {
    $input = getJsonInput();
    $name    = trim((string)($input['customer_name'] ?? 'Anonymous Student'));
    $role    = trim((string)($input['role_label'] ?? 'Student'));
    $token   = trim((string)($input['token_number'] ?? ''));
    $rating  = max(1, min(5, (int)($input['rating'] ?? 5)));
    $comment = trim((string)($input['comment'] ?? ''));

    if ($comment === '') {
        sendJson(['success' => false, 'message' => 'Please enter a feedback comment.'], 422);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO feedback (token_number, customer_name, role_label, rating, comment)
         VALUES (:token, :name, :role, :rating, :comment)'
    );
    $stmt->execute([
        ':token'   => $token,
        ':name'    => $name,
        ':role'    => $role,
        ':rating'  => $rating,
        ':comment' => $comment
    ]);

    sendJson([
        'success' => true,
        'message' => 'Thank you for your valuable canteen feedback!',
        'id'      => (int)$pdo->lastInsertId()
    ], 201);
}

sendJson(['success' => false, 'message' => 'Method not allowed'], 405);
