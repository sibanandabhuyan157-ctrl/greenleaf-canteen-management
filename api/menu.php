<?php
/**
 * GreenLeaf Canteen API - Menu Items & Category Management (CRUD + Stock Control)
 */
require_once __DIR__ . '/../config/db.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $categories = $pdo->query('SELECT * FROM categories ORDER BY sort_order ASC')->fetchAll();
    $sql = 'SELECT m.*, c.name AS category_name, c.slug AS category_slug
            FROM menu_items m
            JOIN categories c ON c.id = m.category_id
            ORDER BY m.is_special DESC, m.id ASC';
    $items = $pdo->query($sql)->fetchAll();

    sendJson([
        'success'    => true,
        'categories' => $categories,
        'items'      => $items
    ]);
}

if ($method === 'POST') {
    $input = getJsonInput();
    $name        = trim((string)($input['name'] ?? ''));
    $categoryId  = (int)($input['category_id'] ?? 1);
    $description = trim((string)($input['description'] ?? 'Freshly prepared in the GreenLeaf campus kitchen.'));
    $price       = (float)($input['price'] ?? 0);
    $costPrice   = (float)($input['cost_price'] ?? round($price * 0.45, 2));
    $isVeg       = isset($input['is_veg']) ? (int)(bool)$input['is_veg'] : 1;
    $calories    = (int)($input['calories'] ?? 250);
    $prepTime    = (int)($input['prep_time_mins'] ?? 8);
    $stockQty    = (int)($input['stock_qty'] ?? 40);
    $lowStock    = (int)($input['low_stock_threshold'] ?? 10);
    $isSpecial   = isset($input['is_special']) ? (int)(bool)$input['is_special'] : 0;
    $badge       = trim((string)($input['badge'] ?? ''));

    if ($name === '' || $price <= 0) {
        sendJson(['success' => false, 'message' => 'Valid item name and price are required.'], 422);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO menu_items
         (category_id, name, description, price, cost_price, is_veg, calories, prep_time_mins, stock_qty, low_stock_threshold, is_available, is_special, badge)
         VALUES (:cat, :name, :desc, :price, :cost, :veg, :cal, :prep, :stock, :low, :avail, :spec, :badge)'
    );
    $stmt->execute([
        ':cat'   => $categoryId,
        ':name'  => $name,
        ':desc'  => $description,
        ':price' => $price,
        ':cost'  => $costPrice,
        ':veg'   => $isVeg,
        ':cal'   => $calories,
        ':prep'  => $prepTime,
        ':stock' => $stockQty,
        ':low'   => $lowStock,
        ':avail' => $stockQty > 0 ? 1 : 0,
        ':spec'  => $isSpecial,
        ':badge' => $badge
    ]);

    sendJson([
        'success' => true,
        'message' => 'Menu item added successfully.',
        'id'      => (int)$pdo->lastInsertId()
    ], 201);
}

if ($method === 'PUT' || $method === 'PATCH') {
    $input = getJsonInput();
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        sendJson(['success' => false, 'message' => 'Menu item ID is required.'], 422);
    }

    if (isset($input['action']) && $input['action'] === 'toggle_availability') {
        $stmt = $pdo->prepare('UPDATE menu_items SET is_available = IF(is_available = 1, 0, 1) WHERE id = :id');
        $stmt->execute([':id' => $id]);
        sendJson(['success' => true, 'message' => 'Availability updated.']);
    }

    if (isset($input['action']) && $input['action'] === 'restock') {
        $addQty = max(1, (int)($input['add_qty'] ?? 20));
        $stmt = $pdo->prepare('UPDATE menu_items SET stock_qty = stock_qty + :qty, is_available = 1 WHERE id = :id');
        $stmt->execute([':qty' => $addQty, ':id' => $id]);
        sendJson(['success' => true, 'message' => "Restocked +{$addQty} units."]);
    }

    $stmt = $pdo->prepare(
        'UPDATE menu_items
         SET name = :name, category_id = :cat, description = :desc, price = :price,
             is_veg = :veg, calories = :cal, prep_time_mins = :prep, stock_qty = :stock,
             is_available = :avail, is_special = :spec, badge = :badge
         WHERE id = :id'
    );
    $stmt->execute([
        ':name'  => trim((string)$input['name']),
        ':cat'   => (int)($input['category_id'] ?? 1),
        ':desc'  => trim((string)($input['description'] ?? '')),
        ':price' => (float)$input['price'],
        ':veg'   => (int)(bool)($input['is_veg'] ?? 1),
        ':cal'   => (int)($input['calories'] ?? 250),
        ':prep'  => (int)($input['prep_time_mins'] ?? 8),
        ':stock' => (int)($input['stock_qty'] ?? 30),
        ':avail' => (int)(bool)($input['is_available'] ?? 1),
        ':spec'  => (int)(bool)($input['is_special'] ?? 0),
        ':badge' => trim((string)($input['badge'] ?? '')),
        ':id'    => $id
    ]);

    sendJson(['success' => true, 'message' => 'Menu item updated.']);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? (getJsonInput()['id'] ?? 0));
    if ($id <= 0) {
        sendJson(['success' => false, 'message' => 'Valid item ID required.'], 422);
    }
    $stmt = $pdo->prepare('DELETE FROM menu_items WHERE id = :id');
    $stmt->execute([':id' => $id]);
    sendJson(['success' => true, 'message' => 'Menu item removed.']);
}

sendJson(['success' => false, 'message' => 'Method not allowed'], 405);
