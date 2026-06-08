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
    $user = $auth->requireRole('admin');

    $input = json_decode(file_get_contents('php://input'), true);
    $facode = $input['facode'] ?? '';

    if (!$facode) {
        throw new Exception('缺少 facode 参数');
    }

    $db = new Database();
    $pdo = $db->connect();

    $stmt = $pdo->prepare("SELECT id FROM assets WHERE facode = :facode");
    $stmt->execute(['facode' => $facode]);
    $asset = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$asset) {
        throw new Exception('资产不存在');
    }

    $token = $auth->generateOneTimeLink($user, $asset['id']);

    $baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]";
    $link = $baseUrl . '/api/repair_view.php?token=' . $token;

    echo json_encode([
        'success' => true,
        'data' => [
            'token' => $token,
            'link' => $link,
            'expires_in' => '24小时'
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
