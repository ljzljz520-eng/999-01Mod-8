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
require_once __DIR__ . '/../config/database.php';

try {
    $auth = new Auth();
    $user = $auth->requireLogin();

    if ($user['role'] === 'vendor') {
        $auth->logAudit($user, 'PERMISSION_DENIED', null, '外包人员尝试访问列表接口');
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => '外包维修人员无权限访问列表',
            'code' => 'VENDOR_ACCESS_DENIED'
        ]);
        exit;
    }

    $db = new Database();
    $pdo = $db->connect();

    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 20;
    $keyword = isset($_GET['keyword']) ? trim($_GET['keyword']) : '';
    $offset = ($page - 1) * $pageSize;

    $sql = "SELECT a.*, 
                   d.dept_name, 
                   u.real_name as user_name
            FROM assets a
            LEFT JOIN departments d ON a.dept_id = d.id
            LEFT JOIN users u ON a.user_id = u.id
            WHERE 1=1";

    $params = [];

    if ($keyword) {
        $sql .= " AND (a.facode LIKE :keyword OR a.sn LIKE :keyword OR a.asset_name LIKE :keyword)";
        $params['keyword'] = "%{$keyword}%";
    }

    $permissionResult = $auth->filterAssetsByPermission($user, $sql, $params);
    $sql = $permissionResult['sql'];
    $params = $permissionResult['params'];

    $countSql = preg_replace('/SELECT\s+.*?\s+FROM\s+/is', 'SELECT COUNT(*) FROM ', $sql, 1);
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    $sql .= " ORDER BY a.id DESC LIMIT :offset, :pageSize";
    $params['offset'] = $offset;
    $params['pageSize'] = $pageSize;

    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        if ($key === 'offset' || $key === 'pageSize') {
            $stmt->bindValue($key, $value, PDO::PARAM_INT);
        } else {
            $stmt->bindValue($key, $value);
        }
    }
    $stmt->execute();
    $assets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($assets as &$asset) {
        $asset = $auth->filterFieldsByRole($user, $asset);
    }

    $auth->logAudit($user, 'LIST_QUERY', null, "查询列表，共 {$total} 条");

    echo json_encode([
        'success' => true,
        'data' => [
            'list' => $assets,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'user_role' => $user['role'],
            'can_export' => $auth->canExport($user)
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
