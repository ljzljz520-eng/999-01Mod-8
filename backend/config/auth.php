<?php

require_once __DIR__ . '/database.php';

class Auth {
    private $db;
    private $pdo;

    public function __construct() {
        $this->db = new Database();
        $this->pdo = $this->db->connect();
    }

    public function getCurrentUser() {
        $headers = array_change_key_case(getallheaders(), CASE_UPPER);
        $token = $headers['X-AUTH-TOKEN'] ?? '';

        if (!$token) {
            return null;
        }

        $stmt = $this->pdo->prepare("
            SELECT s.*, u.username, u.real_name, u.role, u.dept_id 
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = :token AND s.expires_at > NOW()
        ");
        $stmt->execute(['token' => $token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$session) {
            return null;
        }

        return [
            'id' => $session['user_id'],
            'username' => $session['username'],
            'real_name' => $session['real_name'],
            'role' => $session['role'],
            'dept_id' => $session['dept_id'],
            'token' => $token
        ];
    }

    public function requireLogin() {
        $user = $this->getCurrentUser();
        if (!$user) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error' => '未登录或会话已过期',
                'code' => 'UNAUTHORIZED'
            ]);
            exit;
        }
        return $user;
    }

    public function requireRole($allowedRoles) {
        $user = $this->requireLogin();
        if (!in_array($user['role'], (array)$allowedRoles)) {
            $this->logAudit($user, 'PERMISSION_DENIED', null, '角色权限不足，需要: ' . implode(',', (array)$allowedRoles));
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => '权限不足',
                'code' => 'FORBIDDEN'
            ]);
            exit;
        }
        return $user;
    }

    public function canAccessAsset($user, $assetFacode) {
        if ($user['role'] === 'admin') {
            return true;
        }

        $stmt = $this->pdo->prepare("SELECT * FROM assets WHERE facode = :facode");
        $stmt->execute(['facode' => $assetFacode]);
        $asset = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$asset) {
            return true;
        }

        if ($user['role'] === 'employee') {
            $isOwner = $asset['user_id'] == $user['id'];
            $isSameDept = $asset['dept_id'] && $user['dept_id'] && $asset['dept_id'] == $user['dept_id'];
            return $isOwner || $isSameDept;
        }

        return false;
    }

    public function filterAssetsByPermission($user, $sql, $params = []) {
        if ($user['role'] === 'admin') {
            return ['sql' => $sql, 'params' => $params];
        }

        if ($user['role'] === 'employee') {
            $whereClause = " AND (a.user_id = :current_user_id OR a.dept_id = :current_dept_id)";
            $sql .= $whereClause;
            $params['current_user_id'] = $user['id'];
            $params['current_dept_id'] = $user['dept_id'];
        }

        if ($user['role'] === 'vendor') {
            $sql .= " AND 1=0";
        }

        return ['sql' => $sql, 'params' => $params];
    }

    public function filterFieldsByRole($user, $asset) {
        if ($user['role'] === 'admin') {
            return $asset;
        }

        if ($user['role'] === 'employee') {
            unset($asset['purchase_price']);
            return $asset;
        }

        if ($user['role'] === 'vendor') {
            return [
                'facode' => $asset['facode'],
                'sn' => $asset['sn'],
                'asset_name' => $asset['asset_name'],
                'specification' => $asset['specification'],
                'location' => $asset['location'],
                'repair_status' => $asset['repair_status'],
                'last_maintenance_date' => $asset['last_maintenance_date'],
                'status' => $asset['status']
            ];
        }

        return $asset;
    }

    public function getClientIP() {
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            return $_SERVER['HTTP_CLIENT_IP'];
        }
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            return explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
        }
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    public function logAudit($user, $action, $targetFacode = null, $reason = null) {
        $ip = $this->getClientIP();
        $userId = $user ? $user['id'] : null;
        $username = $user ? $user['username'] : 'guest';
        $params = json_encode(array_merge($_GET, $_POST));

        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO audit_logs (user_id, username, ip_address, action, target_facode, reason, request_params)
                VALUES (:user_id, :username, :ip_address, :action, :target_facode, :reason, :request_params)
            ");
            $stmt->execute([
                'user_id' => $userId,
                'username' => $username,
                'ip_address' => $ip,
                'action' => $action,
                'target_facode' => $targetFacode,
                'reason' => $reason,
                'request_params' => $params
            ]);
        } catch (Exception $e) {
            error_log('Audit log failed: ' . $e->getMessage());
        }
    }

    public function login($username, $password) {
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE username = :username");
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password'])) {
            $this->logAudit(null, 'LOGIN_FAILED', null, '用户名或密码错误: ' . $username);
            return false;
        }

        $token = bin2hex(random_bytes(32));
        $ip = $this->getClientIP();
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $expiresAt = date('Y-m-d H:i:s', time() + 3600 * 8);

        $stmt = $this->pdo->prepare("
            INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at)
            VALUES (:user_id, :token, :ip_address, :user_agent, :expires_at)
        ");
        $stmt->execute([
            'user_id' => $user['id'],
            'token' => $token,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'expires_at' => $expiresAt
        ]);

        $this->logAudit(['id' => $user['id'], 'username' => $user['username']], 'LOGIN_SUCCESS');

        return [
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'real_name' => $user['real_name'],
                'role' => $user['role'],
                'dept_id' => $user['dept_id']
            ]
        ];
    }

    public function generateOneTimeLink($user, $assetId) {
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 3600 * 24);

        $stmt = $this->pdo->prepare("
            INSERT INTO one_time_links (token, asset_id, created_by, expires_at)
            VALUES (:token, :asset_id, :created_by, :expires_at)
        ");
        $stmt->execute([
            'token' => $token,
            'asset_id' => $assetId,
            'created_by' => $user['id'],
            'expires_at' => $expiresAt
        ]);

        $this->logAudit($user, 'GENERATE_LINK', $assetId, '为资产ID ' . $assetId . ' 生成一次性链接');

        return $token;
    }

    public function verifyOneTimeLink($token) {
        $stmt = $this->pdo->prepare("
            SELECT otl.*, a.*
            FROM one_time_links otl
            JOIN assets a ON otl.asset_id = a.id
            WHERE otl.token = :token 
              AND otl.used_at IS NULL 
              AND otl.expires_at > NOW()
        ");
        $stmt->execute(['token' => $token]);
        $link = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$link) {
            return false;
        }

        $updateStmt = $this->pdo->prepare("
            UPDATE one_time_links 
            SET used_at = NOW(), used_by = :used_by 
            WHERE id = :id
        ");
        $updateStmt->execute([
            'id' => $link['id'],
            'used_by' => $this->getClientIP()
        ]);

        $this->logAudit(null, 'ONE_TIME_LINK_USED', $link['facode'], '一次性链接被访问，IP: ' . $this->getClientIP());

        return $link;
    }

    public function canExport($user) {
        return $user['role'] === 'admin';
    }
}
