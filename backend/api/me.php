<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-AUTH-TOKEN, X-DB-CONNECTION, X-DB-HOST, X-DB-PORT, X-DB-NAME, X-DB-USER, X-DB-PASSWORD');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/auth.php';

try {
    $auth = new Auth();
    $user = $auth->requireLogin();

    echo json_encode([
        'success' => true,
        'data' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'real_name' => $user['real_name'],
            'role' => $user['role'],
            'dept_id' => $user['dept_id'],
            'can_export' => $auth->canExport($user),
            'can_generate_link' => $user['role'] === 'admin'
        ]
    ]);

} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
