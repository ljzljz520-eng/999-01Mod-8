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

    if (!$auth->canExport($user)) {
        $auth->logAudit($user, 'EXPORT_ATTEMPT_DENIED', null, '非管理员尝试导出数据');
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => '仅资产管理员可导出数据',
            'code' => 'EXPORT_PERMISSION_DENIED'
        ]);
        exit;
    }

    $db = new Database();
    $pdo = $db->connect();

    $auth->logAudit($user, 'EXPORT_STARTED');

    $sql = "SELECT a.*, 
                   d.dept_name, 
                   u.real_name as user_name
            FROM assets a
            LEFT JOIN departments d ON a.dept_id = d.id
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $assets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $filename = '固定资产清单_' . date('YmdHis') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    $output = fopen('php://output', 'w');
    fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

    $headers = [
        '固定资产编码', '序列号', '资产名称', '资产类型', '规格型号',
        '采购价格', '采购日期', '所属部门', '领用人', '状态',
        '存放位置', '维修状态', '上次维修日期', '创建时间'
    ];
    fputcsv($output, $headers);

    $statusMap = ['in_use' => '使用中', 'in_repair' => '维修中', 'idle' => '闲置', 'scrapped' => '已报废'];

    foreach ($assets as $asset) {
        $row = [
            $asset['facode'],
            $asset['sn'],
            $asset['asset_name'],
            $asset['asset_type'],
            $asset['specification'],
            $asset['purchase_price'],
            $asset['purchase_date'],
            $asset['dept_name'],
            $asset['user_name'],
            $statusMap[$asset['status']] ?? $asset['status'],
            $asset['location'],
            $asset['repair_status'],
            $asset['last_maintenance_date'],
            $asset['created_at']
        ];
        fputcsv($output, $row);
    }

    fclose($output);

    $auth->logAudit($user, 'EXPORT_SUCCESS', null, '导出 ' . count($assets) . ' 条资产数据');

} catch (Exception $e) {
    if (isset($auth) && isset($user)) {
        $auth->logAudit($user, 'EXPORT_FAILED', null, $e->getMessage());
    }
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
