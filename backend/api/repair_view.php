<?php
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: text/html; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/auth.php';

$token = $_GET['token'] ?? '';

if (!$token) {
    echo '<!DOCTYPE html><html><head><title>链接无效</title></head><body style="padding:40px;font-family:sans-serif;"><h1>链接无效</h1><p>缺少访问令牌。</p></body></html>';
    exit;
}

$auth = new Auth();
$assetData = $auth->verifyOneTimeLink($token);

if (!$assetData) {
    echo '<!DOCTYPE html><html><head><title>链接已失效</title></head><body style="padding:40px;font-family:sans-serif;"><h1>链接已失效</h1><p>该一次性链接已被使用或已过期，请联系管理员重新生成。</p></body></html>';
    exit;
}

$vendorUser = ['role' => 'vendor', 'username' => 'vendor_' . $auth->getClientIP(), 'id' => null];
$filteredAsset = $auth->filterFieldsByRole($vendorUser, $assetData);

?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>维修设备信息 - <?php echo htmlspecialchars($filteredAsset['facode']); ?></title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; }
        .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
        .content { padding: 30px; }
        .field { margin-bottom: 24px; }
        .field-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .field-value { font-size: 18px; font-weight: 600; color: #1f2937; font-family: 'SF Mono', Monaco, monospace; }
        .status-badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
        .status-in_repair { background: #fef3c7; color: #92400e; }
        .status-in_use { background: #d1fae5; color: #065f46; }
        .status-idle { background: #e5e7eb; color: #374151; }
        .divider { height: 1px; background: #e5e7eb; margin: 20px 0; }
        .notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin-top: 20px; }
        .notice h3 { color: #92400e; font-size: 14px; margin-bottom: 6px; }
        .notice p { color: #78350f; font-size: 13px; line-height: 1.6; }
        .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>设备维修信息</h1>
            <p>仅限维修人员查看 - 一次性访问</p>
            <span class="badge">已验证</span>
        </div>
        <div class="content">
            <div class="field">
                <div class="field-label">固定资产编码</div>
                <div class="field-value"><?php echo htmlspecialchars($filteredAsset['facode']); ?></div>
            </div>
            <div class="field">
                <div class="field-label">序列号 (SN)</div>
                <div class="field-value"><?php echo htmlspecialchars($filteredAsset['sn']); ?></div>
            </div>
            <div class="field">
                <div class="field-label">设备名称</div>
                <div class="field-value"><?php echo htmlspecialchars($filteredAsset['asset_name']); ?></div>
            </div>
            <div class="field">
                <div class="field-label">规格型号</div>
                <div class="field-value" style="font-size:16px;"><?php echo htmlspecialchars($filteredAsset['specification'] ?? '-'); ?></div>
            </div>
            <div class="divider"></div>
            <div class="field">
                <div class="field-label">设备状态</div>
                <span class="status-badge status-<?php echo $filteredAsset['status']; ?>">
                    <?php 
                    $statusMap = ['in_use' => '使用中', 'in_repair' => '维修中', 'idle' => '闲置', 'scrapped' => '已报废'];
                    echo $statusMap[$filteredAsset['status']] ?? $filteredAsset['status'];
                    ?>
                </span>
            </div>
            <div class="field">
                <div class="field-label">存放位置</div>
                <div class="field-value" style="font-size:16px;"><?php echo htmlspecialchars($filteredAsset['location'] ?? '-'); ?></div>
            </div>
            <div class="field">
                <div class="field-label">上次维修日期</div>
                <div class="field-value" style="font-size:16px;"><?php echo htmlspecialchars($filteredAsset['last_maintenance_date'] ?? '无记录'); ?></div>
            </div>
            <div class="notice">
                <h3>⚠️ 注意事项</h3>
                <p>此页面为一次性访问链接，刷新后将失效。如需再次查看请联系资产管理员重新生成链接。维修完成后请及时更新设备状态。</p>
            </div>
        </div>
        <div class="footer">
            访问IP: <?php echo htmlspecialchars($auth->getClientIP()); ?> | 查看时间: <?php echo date('Y-m-d H:i:s'); ?>
        </div>
    </div>
</body>
</html>
