<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-AUTH-TOKEN, X-DB-CONNECTION, X-DB-HOST, X-DB-PORT, X-DB-NAME, X-DB-USER, X-DB-PASSWORD');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

try {
    $facode = isset($_GET['facode']) ? $_GET['facode'] : (isset($_POST['facode']) ? $_POST['facode'] : null);

    if (!$facode) {
        throw new Exception('缺少 facode 参数');
    }

    $db = new Database();
    $pdo = $db->connect();
    $auth = new Auth();

    $user = $auth->getCurrentUser();

    if (!$user) {
        $stmt = $pdo->prepare("SELECT facode, sn FROM facode2sn WHERE facode = :facode");
        $stmt->execute(['facode' => $facode]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $result ?: null,
            'mode' => 'legacy'
        ]);
        exit;
    }

    $auth->logAudit($user, 'QUERY_ATTEMPT', $facode);

    if ($user['role'] === 'vendor') {
        $auth->logAudit($user, 'PERMISSION_DENIED', $facode, '外包人员无权限直接查询资产');
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => '外包维修人员请使用一次性链接查看',
            'code' => 'VENDOR_ACCESS_DENIED'
        ]);
        exit;
    }

    $canAccess = $auth->canAccessAsset($user, $facode);

    if (!$canAccess) {
        $auth->logAudit($user, 'UNAUTHORIZED_ACCESS', $facode, '越权尝试访问非本人/本部门资产');
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => '无权访问该资产数据',
            'code' => 'DATA_PERMISSION_DENIED'
        ]);
        exit;
    }

    $sql = "SELECT a.*, 
                   d.dept_name, 
                   u.real_name as user_name,
                   creator.real_name as created_by_name
            FROM assets a
            LEFT JOIN departments d ON a.dept_id = d.id
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN users creator ON a.user_id = creator.id
            WHERE a.facode = :facode";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['facode' => $facode]);
    $asset = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($asset) {
        $asset = $auth->filterFieldsByRole($user, $asset);
    }

    $auth->logAudit($user, 'QUERY_SUCCESS', $facode);

    echo json_encode([
        'success' => true,
        'data' => $asset ?: null,
        'user_role' => $user['role']
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
