CREATE DATABASE IF NOT EXISTS fixed_assets;
USE fixed_assets;

-- ============================================
-- 1. 部门表
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dept_code VARCHAR(20) NOT NULL UNIQUE,
    dept_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO departments (dept_code, dept_name) VALUES
('IT001', '信息技术部'),
('ADM001', '行政部'),
('FIN001', '财务部'),
('HR001', '人力资源部');

-- ============================================
-- 2. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    real_name VARCHAR(50) NOT NULL,
    role ENUM('employee', 'admin', 'vendor') NOT NULL DEFAULT 'employee',
    dept_id INT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dept_id) REFERENCES departments(id)
);

-- 插入测试用户 (密码都是 123456)
INSERT INTO users (username, password, real_name, role, dept_id, email) VALUES
('zhangsan', '$2y$12$Tu/JFL6zsMESPieiOH8L2eJlKd/oEDmuISyKVOmWGvAfoX4FoJiwO', '张三', 'employee', 1, 'zhangsan@company.com'),
('lisi', '$2y$12$Tu/JFL6zsMESPieiOH8L2eJlKd/oEDmuISyKVOmWGvAfoX4FoJiwO', '李四', 'employee', 2, 'lisi@company.com'),
('wangwu', '$2y$12$Tu/JFL6zsMESPieiOH8L2eJlKd/oEDmuISyKVOmWGvAfoX4FoJiwO', '王五', 'admin', NULL, 'wangwu@company.com'),
('vendor001', '$2y$12$Tu/JFL6zsMESPieiOH8L2eJlKd/oEDmuISyKVOmWGvAfoX4FoJiwO', '维修员A', 'vendor', NULL, 'vendor_a@repair.com');

-- ============================================
-- 3. 资产主表（扩展原 facode2sn，增加权限相关字段
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    facode VARCHAR(50) NOT NULL UNIQUE,
    sn VARCHAR(100) NOT NULL,
    asset_name VARCHAR(200) NOT NULL,
    asset_type VARCHAR(50),
    specification VARCHAR(200),
    purchase_price DECIMAL(12,2),
    purchase_date DATE,
    dept_id INT NULL,
    user_id INT NULL,
    status ENUM('in_use', 'in_repair', 'idle', 'scrapped') DEFAULT 'in_use',
    location VARCHAR(200),
    repair_status VARCHAR(50),
    last_maintenance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dept_id) REFERENCES departments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 插入测试资产数据
INSERT INTO assets (facode, sn, asset_name, asset_type, specification, purchase_price, purchase_date, dept_id, user_id, status, location) VALUES
('FA001', 'SN2024001', 'MacBook Pro 14寸', '电脑', 'M3/16G/512G', 14999.00, '2024-01-15', 1, 1, 'in_use', 'A座301'),
('FA002', 'SN2024002', 'Dell 显示器 27寸', '显示器', '4K/IPS', 3299.00, '2024-02-20', 1, 1, 'in_use', 'A座301'),
('FA003', 'SN2024003', 'iPhone 15 Pro', '手机', '256G', 8999.00, '2024-03-10', 2, 2, 'in_use', 'B座102'),
('FA004', 'SN2024004', 'HP 打印机', '外设', 'LaserJet Pro', 1599.00, '2024-01-20', 1, NULL, 'in_repair', 'A座302'),
('FA005', 'SN2024005', 'ThinkPad X1 Carbon', '电脑', 'i7/32G/1T', 12999.00, '2024-04-05', 3, NULL, 'in_use', 'C座201'),
('FA006', 'SN2024006', '办公椅', '家具', '人体工学椅', 899.00, '2024-02-10', 4, NULL, 'idle', '仓库A区'),
('TEST-01', 'SN-TEST-001', '测试设备', '其他', '测试规格', 100.00, '2024-01-01', NULL, NULL, 'in_use', '测试室');

-- 兼容原表名查询
CREATE TABLE IF NOT EXISTS facode2sn (
    id INT AUTO_INCREMENT PRIMARY KEY,
    facode VARCHAR(50) NOT NULL UNIQUE,
    sn VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO facode2sn (facode, sn) VALUES 
('FA001', 'SN2024001'),
('FA002', 'SN2024002'),
('FA003', 'SN2024003'),
('TEST-01', 'SN-TEST-001');

-- ============================================
-- 4. 会话表
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 5. 一次性链接表（外包维修人员用）
-- ============================================
CREATE TABLE IF NOT EXISTS one_time_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    asset_id INT NOT NULL,
    created_by INT NOT NULL,
    used_by VARCHAR(50),
    used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 6. 审计日志表（越权查询记录）
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(50),
    ip_address VARCHAR(45) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_facode VARCHAR(50),
    reason VARCHAR(500),
    request_params TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 索引优化
-- ============================================
CREATE INDEX idx_assets_dept ON assets(dept_id);
CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_assets_facode ON assets(facode);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_one_time_links_token ON one_time_links(token);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);

-- 创建 api 用户 (适配用户测试场景)
CREATE USER IF NOT EXISTS 'api'@'%' IDENTIFIED BY 'FJzzCT#api';
GRANT SELECT, INSERT, UPDATE ON fixed_assets.* TO 'api'@'%';
FLUSH PRIVILEGES;
