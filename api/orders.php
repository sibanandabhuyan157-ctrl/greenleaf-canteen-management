<?php
/**
 * GreenLeaf Canteen API - Orders (Online Pre-Order + Offline Walk-in Counter POS + KDS)
 */
require_once __DIR__ . '/../config/db.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = $_GET['status'] ?? '';
    $source = $_GET['source'] ?? '';

    $where = [];
    $params = [];
    if ($status !== '' && $status !== 'all') {
        $where[] = 'o.order_status = :status';
        $params[':status'] = $status;
    }
    if ($source !== '' && $source !== 'all') {
        $where[] = 'o.order_source = :source';
        $params[':source'] = $source;
    }

    $whereClause = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $stmt = $pdo->prepare("SELECT o.* FROM orders o {$whereClause} ORDER BY o.id DESC LIMIT 100");
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    // Attach order items for each order
    if ($orders) {
        $orderIds = array_column($orders, 'id');
        $inQuery  = implode(',', array_fill(0, count($orderIds), '?'));
        $itemStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ({$inQuery})");
        $itemStmt->execute($orderIds);
        $allItems = $itemStmt->fetchAll();

        $grouped = [];
        foreach ($allItems as $item) {
            $grouped[$item['order_id']][] = $item;
        }
        foreach ($orders as &$ord) {
            $ord['items'] = $grouped[$ord['id']] ?? [];
        }
    }

    sendJson([
        'success' => true,
        'orders'  => $orders
    ]);
}

if ($method === 'POST') {
    $input = getJsonInput();
    $items = $input['items'] ?? [];
    if (empty($items) || !is_array($items)) {
        sendJson(['success' => false, 'message' => 'Order must contain at least one item.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $countStmt = $pdo->query('SELECT COUNT(*) FROM orders');
        $nextNum   = 101 + (int)$countStmt->fetchColumn();
        $prefix    = (($input['order_source'] ?? 'online') === 'offline_pos') ? 'POS-' : 'GL-';
        $token     = $input['token_number'] ?? ($prefix . $nextNum);

        $subtotal = 0.0;
        foreach ($items as $item) {
            $qty   = max(1, (int)($item['quantity'] ?? 1));
            $price = (float)($item['unit_price'] ?? $item['price'] ?? 0);
            $subtotal += $qty * $price;
        }

        $discount = (float)($input['discount_amount'] ?? 0);
        $taxable  = max(0, $subtotal - $discount);
        $tax      = isset($input['tax_amount']) ? (float)$input['tax_amount'] : round($taxable * 0.05, 2);
        $total    = round($taxable + $tax, 2);

        $orderStmt = $pdo->prepare(
            'INSERT INTO orders
            (token_number, user_id, customer_name, customer_phone, campus_id, order_source, service_type, table_Or_pickup,
             subtotal, tax_amount, discount_amount, total_amount, coupon_code, payment_method, payment_status, order_status, notes, handled_by)
             VALUES
            (:token, :uid, :cname, :cphone, :cid, :source, :service, :slot,
             :sub, :tax, :disc, :total, :coupon, :pay_method, :pay_status, :status, :notes, :handler)'
        );

        $orderStmt->execute([
            ':token'      => $token,
            ':uid'        => !empty($input['user_id']) ? (int)$input['user_id'] : null,
            ':cname'      => trim((string)($input['customer_name'] ?? 'Walk-in Guest')),
            ':cphone'     => trim((string)($input['customer_phone'] ?? '')),
            ':cid'        => trim((string)($input['campus_id'] ?? '')),
            ':source'     => in_array($input['order_source'] ?? '', ['online', 'offline_pos'], true) ? $input['order_source'] : 'online',
            ':service'    => in_array($input['service_type'] ?? '', ['dine_in', 'pickup', 'parcel'], true) ? $input['service_type'] : 'pickup',
            ':slot'       => trim((string)($input['table_Or_pickup'] ?? 'Counter Pickup')),
            ':sub'        => $subtotal,
            ':tax'        => $tax,
            ':disc'       => $discount,
            ':total'      => $total,
            ':coupon'     => $input['coupon_code'] ?? null,
            ':pay_method' => in_array($input['payment_method'] ?? '', ['cash', 'upi', 'wallet', 'card'], true) ? $input['payment_method'] : 'upi',
            ':pay_status' => $input['payment_status'] ?? 'paid',
            ':status'     => $input['order_status'] ?? 'pending',
            ':notes'      => trim((string)($input['notes'] ?? '')),
            ':handler'    => trim((string)($input['handled_by'] ?? 'Self-Service Online'))
        ]);

        $orderId = (int)$pdo->lastInsertId();

        $itemInsert = $pdo->prepare(
            'INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price)
             VALUES (:oid, :mid, :name, :qty, :uprice, :tprice)'
        );
        $stockUpdate = $pdo->prepare(
            'UPDATE menu_items
             SET stock_qty = GREATEST(0, stock_qty - :qty),
                 is_available = IF(GREATEST(0, stock_qty - :qty2) = 0, 0, is_available)
             WHERE id = :mid'
        );

        foreach ($items as $item) {
            $mid   = !empty($item['menu_item_id']) ? (int)$item['menu_item_id'] : (!empty($item['id']) ? (int)$item['id'] : null);
            $qty   = max(1, (int)($item['quantity'] ?? 1));
            $price = (float)($item['unit_price'] ?? $item['price'] ?? 0);

            $itemInsert->execute([
                ':oid'    => $orderId,
                ':mid'    => $mid,
                ':name'   => (string)($item['item_name'] ?? $item['name'] ?? 'Canteen Item'),
                ':qty'    => $qty,
                ':uprice' => $price,
                ':tprice' => round($qty * $price, 2)
            ]);

            if ($mid) {
                $stockUpdate->execute([':qty' => $qty, ':qty2' => $qty, ':mid' => $mid]);
            }
        }

        // Deduct wallet balance if paid via campus wallet
        if (($input['payment_method'] ?? '') === 'wallet' && !empty($input['campus_id'])) {
            $wStmt = $pdo->prepare('UPDATE users SET wallet_balance = GREATEST(0, wallet_balance - :amt) WHERE campus_id = :cid');
            $wStmt->execute([':amt' => $total, ':cid' => $input['campus_id']]);
        }

        $pdo->commit();

        sendJson([
            'success'      => true,
            'message'      => 'Order placed successfully.',
            'order_id'     => $orderId,
            'token_number' => $token,
            'total_amount' => $total
        ], 201);
    } catch (Throwable $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'message' => 'Failed to place order: ' . $e->getMessage()], 500);
    }
}

if ($method === 'PUT' || $method === 'PATCH') {
    $input = getJsonInput();
    $orderId = (int)($input['id'] ?? 0);
    $token   = trim((string)($input['token_number'] ?? ''));
    $status  = $input['order_status'] ?? '';

    $allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!in_array($status, $allowed, true)) {
        sendJson(['success' => false, 'message' => 'Invalid order status value.'], 422);
    }

    if ($orderId > 0) {
        $stmt = $pdo->prepare('UPDATE orders SET order_status = :status WHERE id = :id');
        $stmt->execute([':status' => $status, ':id' => $orderId]);
    } elseif ($token !== '') {
        $stmt = $pdo->prepare('UPDATE orders SET order_status = :status WHERE token_number = :token');
        $stmt->execute([':status' => $status, ':token' => $token]);
    } else {
        sendJson(['success' => false, 'message' => 'Order ID or token number required.'], 422);
    }

    sendJson([
        'success'      => true,
        'message'      => "Order status updated to {$status}.",
        'order_status' => $status
    ]);
}

sendJson(['success' => false, 'message' => 'Method not allowed'], 405);
