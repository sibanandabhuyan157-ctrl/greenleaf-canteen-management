<?php
/**
 * GreenLeaf Canteen API - Authentication & Role Management
 * Supports Student, Canteen Employee (POS/KDS), and Admin roles
 */
require_once __DIR__ . '/../config/db.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT id, campus_id, full_name, email, phone, role, wallet_balance, is_active, created_at FROM users ORDER BY id ASC');
    sendJson([
        'success' => true,
        'users'   => $stmt->fetchAll()
    ]);
}

if ($method === 'POST') {
    $input = getJsonInput();
    $action = $input['action'] ?? 'login';

    if ($action === 'login') {
        $identifier = trim((string)($input['identifier'] ?? ''));
        $role = trim((string)($input['role'] ?? ''));

        if ($role && !$identifier) {
            $stmt = $pdo->prepare('SELECT id, campus_id, full_name, email, phone, role, wallet_balance FROM users WHERE role = :role LIMIT 1');
            $stmt->execute([':role' => $role]);
        } else {
            $stmt = $pdo->prepare('SELECT id, campus_id, full_name, email, phone, role, wallet_balance FROM users WHERE email = :id OR campus_id = :id2 LIMIT 1');
            $stmt->execute([':id' => $identifier, ':id2' => $identifier]);
        }

        $user = $stmt->fetch();
        if (!$user) {
            sendJson(['success' => false, 'message' => 'User account not found.'], 404);
        }

        sendJson([
            'success' => true,
            'message' => 'Authenticated successfully.',
            'user'    => $user
        ]);
    }

    if ($action === 'register') {
        $campusId = trim((string)($input['campus_id'] ?? ('STU-' . rand(1000, 9999))));
        $fullName = trim((string)($input['full_name'] ?? ''));
        $email    = trim((string)($input['email'] ?? ''));
        $phone    = trim((string)($input['phone'] ?? ''));
        $role     = in_array($input['role'] ?? '', ['student', 'employee', 'admin'], true) ? $input['role'] : 'student';
        $password = password_hash((string)($input['password'] ?? 'canteen123'), PASSWORD_BCRYPT);

        if (!$fullName || !$email) {
            sendJson(['success' => false, 'message' => 'Full name and email are required.'], 422);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users (campus_id, full_name, email, phone, role, password_hash, wallet_balance)
             VALUES (:campus_id, :full_name, :email, :phone, :role, :password_hash, :wallet)'
        );
        $stmt->execute([
            ':campus_id'     => $campusId,
            ':full_name'     => $fullName,
            ':email'         => $email,
            ':phone'         => $phone,
            ':role'          => $role,
            ':password_hash' => $password,
            ':wallet'        => 200.00
        ]);

        sendJson([
            'success' => true,
            'message' => 'Account created with ₹200 welcome wallet balance.',
            'user_id' => (int)$pdo->lastInsertId()
        ], 201);
    }
}

sendJson(['success' => false, 'message' => 'Unsupported method'], 405);
