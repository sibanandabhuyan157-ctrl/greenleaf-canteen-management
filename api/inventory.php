<?php
/**
 * GreenLeaf Canteen API - Raw Material & Kitchen Inventory Management
 */
require_once __DIR__ . '/../config/db.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $items = $pdo->query('SELECT * FROM inventory_items ORDER BY (current_qty <= min_level) DESC, ingredient_name ASC')->fetchAll();
    sendJson([
        'success'   => true,
        'inventory' => $items
    ]);
}

if ($method === 'POST') {
    $input = getJsonInput();
    $name     = trim((string)($input['ingredient_name'] ?? ''));
    $category = trim((string)($input['category'] ?? 'General'));
    $qty      = (float)($input['current_qty'] ?? 0);
    $unit     = trim((string)($input['unit'] ?? 'kg'));
    $minLevel = (float)($input['min_level'] ?? 5);
    $unitCost = (float)($input['unit_cost'] ?? 0);
    $supplier = trim((string)($input['supplier'] ?? 'Local Supplier'));

    if ($name === '') {
        sendJson(['success' => false, 'message' => 'Ingredient name is required.'], 422);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO inventory_items (ingredient_name, category, current_qty, unit, min_level, unit_cost, supplier)
         VALUES (:name, :cat, :qty, :unit, :min, :cost, :sup)'
    );
    $stmt->execute([
        ':name' => $name,
        ':cat'  => $category,
        ':qty'  => $qty,
        ':unit' => $unit,
        ':min'  => $minLevel,
        ':cost' => $unitCost,
        ':sup'  => $supplier
    ]);

    sendJson([
        'success' => true,
        'message' => 'Inventory item added.',
        'id'      => (int)$pdo->lastInsertId()
    ], 201);
}

if ($method === 'PUT' || $method === 'PATCH') {
    $input = getJsonInput();
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        sendJson(['success' => false, 'message' => 'Inventory ID required.'], 422);
    }

    if (isset($input['add_qty'])) {
        $add = (float)$input['add_qty'];
        $stmt = $pdo->prepare('UPDATE inventory_items SET current_qty = GREATEST(0, current_qty + :add) WHERE id = :id');
        $stmt->execute([':add' => $add, ':id' => $id]);
    } elseif (isset($input['current_qty'])) {
        $stmt = $pdo->prepare('UPDATE inventory_items SET current_qty = GREATEST(0, :qty) WHERE id = :id');
        $stmt->execute([':qty' => (float)$input['current_qty'], ':id' => $id]);
    }

    sendJson(['success' => true, 'message' => 'Inventory level updated.']);
}

sendJson(['success' => false, 'message' => 'Method not allowed'], 405);
