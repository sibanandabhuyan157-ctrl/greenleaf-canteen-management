<?php
/**
 * GreenLeaf Canteen API - Health & Environment Status Endpoint
 */
require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDbConnection();
    $stmt = $pdo->query('SELECT COUNT(*) AS menu_count FROM menu_items');
    $row = $stmt->fetch();

    sendJson([
        'success'    => true,
        'backend'    => 'php_mysql',
        'database'   => DB_NAME,
        'menu_items' => (int)($row['menu_count'] ?? 0),
        'timestamp'  => date('c')
    ]);
} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'backend' => 'offline_fallback',
        'message' => $e->getMessage()
    ], 503);
}
