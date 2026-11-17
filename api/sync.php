<?php
/**
 * GreenLeaf Canteen API - Offline POS Queue Synchronization Endpoint
 * Syncs orders created while offline in the browser POS into MySQL when connection is restored
 */
require_once __DIR__ . '/../config/db.php';

$pdo = getDbConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['success' => false, 'message' => 'POST required'], 405);
}

$input  = getJsonInput();
$orders = $input['orders'] ?? [];
$synced = 0;

foreach ($orders as $ord) {
    $token = $ord['token_number'] ?? '';
    if (!$token) {
        continue;
    }
    $chk = $pdo->prepare('SELECT id FROM orders WHERE token_number = :token LIMIT 1');
    $chk->execute([':token' => $token]);
    if ($chk->fetch()) {
        continue;
    }

    $ins = $pdo->prepare(
        'INSERT INTO orders
         (token_number, customer_name, customer_phone, campus_id, order_source, service_type, table_Or_pickup,
          subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status, order_status, handled_by)
         VALUES (:token, :cname, :cphone, :cid, :source, :service, :slot, :sub, :tax, :disc, :tot, :pay, :pstat, :ostat, :handler)'
    );
    $ins->execute([
        ':token'   => $token,
        ':cname'   => $ord['customer_name'] ?? 'Walk-in Guest',
        ':cphone'  => $ord['customer_phone'] ?? '',
        ':cid'     => $ord['campus_id'] ?? '',
        ':source'  => $ord['order_source'] ?? 'offline_pos',
        ':service' => $ord['service_type'] ?? 'pickup',
        ':slot'    => $ord['table_Or_pickup'] ?? 'Counter POS',
        ':sub'     => (float)($ord['subtotal'] ?? 0),
        ':tax'     => (float)($ord['tax_amount'] ?? 0),
        ':disc'    => (float)($ord['discount_amount'] ?? 0),
        ':tot'     => (float)($ord['total_amount'] ?? 0),
        ':pay'     => $ord['payment_method'] ?? 'cash',
        ':pstat'   => 'paid',
        ':ostat'   => $ord['order_status'] ?? 'completed',
        ':handler' => $ord['handled_by'] ?? 'Counter Staff (Offline Sync)'
    ]);
    $synced++;
}

sendJson([
    'success'      => true,
    'synced_count' => $synced,
    'message'      => "Synced {$synced} offline order(s) to MySQL."
]);
