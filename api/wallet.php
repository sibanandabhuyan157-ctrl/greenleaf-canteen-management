<?php
/**
 * GreenLeaf Canteen API - Campus Wallet & Coupon Validation
 */
require_once __DIR__ . '/../config/db.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $users   = $pdo->query('SELECT id, campus_id, full_name, role, wallet_balance FROM users ORDER BY id ASC')->fetchAll();
    $txns    = $pdo->query('SELECT * FROM wallet_transactions ORDER BY id DESC LIMIT 40')->fetchAll();
    $coupons = $pdo->query('SELECT * FROM coupons WHERE is_active = 1 ORDER BY id ASC')->fetchAll();

    sendJson([
        'success'      => true,
        'users'        => $users,
        'transactions' => $txns,
        'coupons'      => $coupons
    ]);
}

if ($method === 'POST') {
    $input  = getJsonInput();
    $action = $input['action'] ?? 'topup';

    if ($action === 'validate_coupon') {
        $code     = strtoupper(trim((string)($input['code'] ?? '')));
        $subtotal = (float)($input['subtotal'] ?? 0);

        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE UPPER(code) = :code AND is_active = 1 LIMIT 1');
        $stmt->execute([':code' => $code]);
        $coupon = $stmt->fetch();

        if (!$coupon) {
            sendJson(['success' => false, 'message' => 'Invalid or expired coupon code.'], 404);
        }
        if ($subtotal < (float)$coupon['min_order_amount']) {
            sendJson([
                'success' => false,
                'message' => 'Minimum order of ₹' . number_format((float)$coupon['min_order_amount'], 0) . ' required for ' . $code
            ], 422);
        }

        $discount = min((float)$coupon['max_discount'], round($subtotal * ((int)$coupon['discount_percent'] / 100), 2));
        sendJson([
            'success'         => true,
            'coupon'          => $coupon,
            'discount_amount' => $discount,
            'message'         => "Coupon {$code} applied! You saved ₹{$discount}."
        ]);
    }

    // Wallet top-up / debit
    $campusId = trim((string)($input['campus_id'] ?? 'STU-2026-101'));
    $amount   = (float)($input['amount'] ?? 0);
    $type     = in_array($input['txn_type'] ?? 'credit', ['credit', 'debit'], true) ? $input['txn_type'] : 'credit';
    $desc     = trim((string)($input['description'] ?? 'Counter Wallet Recharge'));

    if ($amount <= 0) {
        sendJson(['success' => false, 'message' => 'Enter a valid positive amount.'], 422);
    }

    $uStmt = $pdo->prepare('SELECT * FROM users WHERE campus_id = :cid LIMIT 1');
    $uStmt->execute([':cid' => $campusId]);
    $user = $uStmt->fetch();

    if (!$user) {
        sendJson(['success' => false, 'message' => 'Campus ID not found.'], 404);
    }

    $delta = ($type === 'credit') ? $amount : -$amount;
    $newBalance = max(0, (float)$user['wallet_balance'] + $delta);

    $pdo->beginTransaction();
    try {
        $upd = $pdo->prepare('UPDATE users SET wallet_balance = :bal WHERE id = :id');
        $upd->execute([':bal' => $newBalance, ':id' => $user['id']]);

        $ins = $pdo->prepare(
            'INSERT INTO wallet_transactions (user_id, campus_id, txn_type, amount, description, reference_no)
             VALUES (:uid, :cid, :type, :amt, :desc, :ref)'
        );
        $ins->execute([
            ':uid'  => $user['id'],
            ':cid'  => $campusId,
            ':type' => $type,
            ':amt'  => $amount,
            ':desc' => $desc,
            ':ref'  => 'TXN-' . strtoupper(substr(md5(uniqid('', true)), 0, 8))
        ]);
        $pdo->commit();

        sendJson([
            'success'        => true,
            'message'        => 'Wallet updated successfully.',
            'wallet_balance' => $newBalance
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

sendJson(['success' => false, 'message' => 'Method not allowed'], 405);
