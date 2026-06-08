<?php
error_reporting(0);
ini_set('display_errors', 0);

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
    $user = $auth->getCurrentUser();

    if ($user) {
        $db = new Database();
        $pdo = $db->connect();
        $stmt = $pdo->prepare("DELETE FROM sessions WHERE token = :token");
        $stmt->execute(['token' => $user['token']]);
        $auth->logAudit($user, 'LOGOUT');
    }

    echo json_encode([
        'success' => true,
        'message' => '登出成功'
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => true,
        'message' => '登出成功'
    ]);
}
