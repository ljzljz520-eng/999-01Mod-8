
// ==================== 认证管理器 ====================
class AuthManager {
    constructor() {
        this.tokenKey = 'fa_auth_token';
        this.userKey = 'fa_auth_user';
        this.apiBase = 'http://localhost:8080/api';
        this.currentUser = null;
        this.init();
    }

    init() {
        const token = localStorage.getItem(this.tokenKey);
        const user = localStorage.getItem(this.userKey);
        if (token && user) {
            this.currentUser = JSON.parse(user);
            this.showMainInterface();
            this.checkAuth();
        } else {
            this.showLogin();
        }

        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    }

    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!username || !password) {
            uiManager.alert('请输入用户名和密码', '登录失败');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/login.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success && data.data) {
                this.currentUser = data.data.user;
                localStorage.setItem(this.tokenKey, data.data.token);
                localStorage.setItem(this.userKey, JSON.stringify(data.data.user));
                this.showMainInterface();
                queryManager.loadList();
                uiManager.alert(`欢迎回来，${data.data.user.real_name}！`, '登录成功');
            } else {
                uiManager.alert(data.error || '登录失败', '错误');
            }
        } catch (e) {
            uiManager.alert('无法连接到服务器，请检查网络', '连接错误');
        }
    }

    async logout() {
        const token = localStorage.getItem(this.tokenKey);
        try {
            await fetch(`${this.apiBase}/logout.php`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
        } catch (e) { }

        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.currentUser = null;
        this.showLogin();
    }

    async checkAuth() {
        try {
            const response = await fetch(`${this.apiBase}/me.php`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            if (data.success && data.data) {
                this.currentUser = data.data;
                localStorage.setItem(this.userKey, JSON.stringify(data.data));
                this.updateUserUI();
            } else {
                this.logout();
            }
        } catch (e) {
            this.logout();
        }
    }

    showLogin() {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('userInfo').classList.add('hidden');
        document.getElementById('userInfo').classList.remove('flex');
    }

    showMainInterface() {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('userInfo').classList.add('flex');
        this.updateUserUI();
    }

    updateUserUI() {
        if (!this.currentUser) return;

        const roleMap = {
            'admin': '资产管理员',
            'employee': '普通员工',
            'vendor': '外包维修人员'
        };

        document.getElementById('userRealName').textContent = this.currentUser.real_name;
        document.getElementById('userRole').textContent = roleMap[this.currentUser.role] || this.currentUser.role;
        document.getElementById('userAvatar').textContent = this.currentUser.real_name.charAt(0);

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            if (this.currentUser.can_export || this.currentUser.role === 'admin') {
                exportBtn.classList.remove('hidden');
                exportBtn.classList.add('flex');
            } else {
                exportBtn.classList.add('hidden');
                exportBtn.classList.remove('flex');
            }
        }

        const generateLinkBtn = document.getElementById('generateLinkBtn');
        if (generateLinkBtn) {
            if (this.currentUser.can_generate_link || this.currentUser.role === 'admin') {
                generateLinkBtn.classList.remove('hidden');
            } else {
                generateLinkBtn.classList.add('hidden');
            }
        }
    }

    getAuthHeaders() {
        const headers = connectionManager?.getHeaders() || {};
        const token = localStorage.getItem(this.tokenKey);
        if (token) {
            headers['X-AUTH-TOKEN'] = token;
        }
        return headers;
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }
}

// ==================== UI 管理器 ====================
class UIManager {
    constructor() {
        this.overlay = document.getElementById('globalOverlay');

        this.confirmModal = document.getElementById('confirmModal');
        this.confirmTitle = document.getElementById('confirmTitle');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmOkBtn = document.getElementById('confirmOkBtn');
        this.confirmCancelBtn = document.getElementById('confirmCancelBtn');

        this.alertModal = document.getElementById('alertModal');
        this.alertMessage = document.getElementById('alertMessage');
        this.alertOkBtn = document.getElementById('alertOkBtn');

        this.init();
    }

    init() {
        if (this.confirmCancelBtn) {
            this.confirmCancelBtn.addEventListener('click', () => this.hideConfirm());
        }
        if (this.alertOkBtn) {
            this.alertOkBtn.addEventListener('click', () => this.hideAlert());
        }
    }

    showOverlay() {
        if (this.overlay) this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
        if (this.confirmModal.classList.contains('hidden') &&
            this.alertModal.classList.contains('hidden') &&
            document.getElementById('settingsModal').classList.contains('hidden')) {
            if (this.overlay) this.overlay.classList.add('hidden');
        }
    }

    confirm(message, onConfirm, title = '确认操作') {
        if (!this.confirmModal) return;

        this.confirmTitle.textContent = title;
        this.confirmMessage.textContent = message;

        const newOkBtn = this.confirmOkBtn.cloneNode(true);
        this.confirmOkBtn.parentNode.replaceChild(newOkBtn, this.confirmOkBtn);
        this.confirmOkBtn = newOkBtn;

        this.confirmOkBtn.addEventListener('click', () => {
            this.hideConfirm();
            if (onConfirm) onConfirm();
        });

        this.showOverlay();
        this.confirmModal.classList.remove('hidden');
    }

    hideConfirm() {
        if (this.confirmModal) this.confirmModal.classList.add('hidden');
        this.hideOverlay();
    }

    alert(message, title = '提示') {
        if (!this.alertModal) return;

        document.getElementById('alertTitle').textContent = title;
        this.alertMessage.textContent = message;

        this.showOverlay();
        this.alertModal.classList.remove('hidden');
    }

    hideAlert() {
        if (this.alertModal) this.alertModal.classList.add('hidden');
        this.hideOverlay();
    }
}

// ==================== 数据库连接管理器 ====================
class ConnectionManager {
    constructor() {
        this.connectionsKey = 'fa_query_connections_v5';
        this.activeIdKey = 'fa_query_active_connection_id_v5';

        this.modal = document.getElementById('settingsModal');
        this.openBtn = document.getElementById('settingsBtn');
        this.closeBtn = document.getElementById('closeSettings');

        this.init();
    }

    init() {
        this.ensureDefaultConnection();

        if (this.openBtn) this.openBtn.addEventListener('click', () => this.openConnectionsModal());
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeModal());
    }

    ensureDefaultConnection() {
        const connections = this.getConnections();
        if (!connections.find(c => c.id === 'default-mysql')) {
            const defaultConn = {
                id: 'default-mysql',
                name: '系统默认数据库 (MySQL)',
                type: 'default',
                isDefault: true,
                canDelete: false,
                createdAt: new Date().toISOString()
            };
            connections.unshift(defaultConn);
            this.saveConnections(connections);
        }

        if (!this.getActiveConnectionId()) {
            this.setActiveConnection('default-mysql');
        }
    }

    getConnections() {
        const stored = localStorage.getItem(this.connectionsKey);
        return stored ? JSON.parse(stored) : [];
    }

    saveConnections(connections) {
        localStorage.setItem(this.connectionsKey, JSON.stringify(connections));
    }

    getActiveConnectionId() {
        return localStorage.getItem(this.activeIdKey);
    }

    setActiveConnection(id) {
        localStorage.setItem(this.activeIdKey, id);
    }

    getActiveConnection() {
        const id = this.getActiveConnectionId();
        const connections = this.getConnections();
        return connections.find(c => c.id === id) || connections[0];
    }

    addConnection(config) {
        const connections = this.getConnections();
        const newConn = {
            id: 'conn-' + Date.now(),
            name: config.name || '新连接',
            type: 'mysql',
            isDefault: false,
            canDelete: true,
            createdAt: new Date().toISOString(),
            ...config
        };
        connections.push(newConn);
        this.saveConnections(connections);
        return newConn;
    }

    updateConnection(id, config) {
        const connections = this.getConnections();
        const index = connections.findIndex(c => c.id === id);
        if (index !== -1) {
            connections[index] = { ...connections[index], ...config };
            this.saveConnections(connections);
        }
    }

    deleteConnection(id) {
        uiManager.confirm('确定要删除这个连接配置吗？不可恢复。', () => {
            let connections = this.getConnections();
            const conn = connections.find(c => c.id === id);

            if (conn && !conn.canDelete) {
                uiManager.alert('系统默认连接不能删除');
                return;
            }

            connections = connections.filter(c => c.id !== id);
            this.saveConnections(connections);

            if (this.getActiveConnectionId() === id) {
                this.setActiveConnection('default-mysql');
            }

            this.renderConnectionsList();
        }, '删除连接');
    }

    parseConnectionString(connStr) {
        try {
            const mysqlMatch = connStr.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
            if (mysqlMatch) {
                return {
                    type: 'mysql',
                    user: decodeURIComponent(mysqlMatch[1]),
                    pass: decodeURIComponent(mysqlMatch[2]),
                    host: mysqlMatch[3],
                    port: mysqlMatch[4],
                    dbname: mysqlMatch[5]
                };
            }
            throw new Error('仅支持 MySQL 连接字符串');
        } catch (e) {
            throw new Error('连接字符串解析失败：' + e.message);
        }
    }

    getHeaders() {
        const conn = this.getActiveConnection();
        if (!conn || conn.type === 'default') {
            return {};
        }

        if (conn.type === 'mysql') {
            return {
                'X-DB-CONNECTION': 'mysql',
                'X-DB-HOST': conn.host || '',
                'X-DB-PORT': conn.port || '3306',
                'X-DB-NAME': conn.dbname || '',
                'X-DB-USER': conn.user || '',
                'X-DB-PASSWORD': conn.pass || ''
            };
        }

        return {};
    }

    getCurrentConnectionName() {
        const conn = this.getActiveConnection();
        return conn ? conn.name : '未知连接';
    }

    openConnectionsModal() {
        this.renderConnectionsList();
        if (this.modal) {
            this.modal.classList.remove('hidden');
            uiManager.showOverlay();
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.add('hidden');
            uiManager.hideOverlay();
        }
    }

    renderConnectionsList() {
        const connections = this.getConnections();
        const activeId = this.getActiveConnectionId();

        let html = `
            <div class="mb-6">
                <button onclick="window.connectionManager.showConnectionForm()" 
                    class="w-full py-3 px-4 bg-indigo-50 border-2 border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 hover:border-indigo-200 transition-all font-semibold flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    新增 MySQL 连接
                </button>
            </div>
            <div class="space-y-3">
        `;

        connections.forEach(conn => {
            const isActive = conn.id === activeId;
            const activeClass = isActive ? 'ring-2 ring-indigo-500 bg-indigo-50/50' : 'border border-gray-100 hover:bg-gray-50';
            const isDefault = conn.type === 'default';

            html += `
                <div class="rounded-lg p-4 transition-all duration-200 ${activeClass}">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-1">
                                <span class="text-base font-bold text-gray-800">${conn.name}</span>
                                ${isActive ? '<span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">当前使用</span>' : ''}
                            </div>
                            <div class="text-sm text-gray-500 flex items-center gap-2">
                                <span class="uppercase font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs ">${isDefault ? 'SYSTEM' : 'MYSQL'}</span>
                                ${!isDefault ? `<span class="truncate max-w-[200px]">${conn.host}:${conn.port}</span>` : '<span class="text-gray-400 italic">内置容器数据库</span>'}
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${!isActive ? `<button onclick="window.connectionManager.handleSetActive('${conn.id}')" class="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition">启用</button>` : ''}
                            
                            ${!isDefault ? `
                            <button onclick="window.connectionManager.showConnectionForm('${conn.id}')" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition" title="编辑">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button onclick="window.connectionManager.deleteConnection('${conn.id}')" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="删除">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                            ` : '<div class="px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded">系统预设</div>'}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';

        const modalBody = this.modal.querySelector('.modal-body');
        if (modalBody) modalBody.innerHTML = html;
    }

    handleSetActive(id) {
        this.setActiveConnection(id);
        this.renderConnectionsList();
    }

    showConnectionForm(editId = null) {
        const connections = this.getConnections();
        const conn = editId ? connections.find(c => c.id === editId) : null;
        const isEdit = !!conn;

        const html = `
            <form id="connectionForm" class="space-y-5" novalidate>
                <div class="flex items-center gap-2 text-gray-500 mb-2 cursor-pointer hover:text-gray-800 transition-colors w-max" onclick="window.connectionManager.renderConnectionsList()">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    <span class="text-sm font-medium">返回连接列表</span>
                </div>

                <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-md">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-amber-700">
                                <strong>注意：</strong>新增连接需配置 <span class="font-bold underline">Public (公网) 可访问的生产环境数据库</span>。配置错误可能导致无法连接，建议仅限高级技术人员尝试。
                            </p>
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-1.5">连接名称</label>
                    <input type="text" id="connName" value="${conn ? conn.name : ''}" placeholder="例如：生产环境 MySQL" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow">
                </div>
                
                <input type="hidden" id="connType" value="mysql">

                <div class="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                    <label class="block text-xs font-bold text-blue-700 uppercase mb-2">快速填充</label>
                    <div class="flex gap-2">
                        <input type="text" id="connString" placeholder="mysql://user:pass@host:port/dbname" class="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded placeholder-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <button type="button" onclick="window.connectionManager.parseAndFillForm()" class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 transition">解析</button>
                    </div>
                </div>

                <div id="mysqlFields" class="space-y-4 animate-fade-in">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">主机地址</label>
                            <input type="text" id="connHost" value="${conn && conn.host || ''}" placeholder="127.0.0.1" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">端口</label>
                            <input type="text" id="connPort" value="${conn && conn.port || '3306'}" placeholder="3306" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                            <input type="text" id="connUser" value="${conn && conn.user || ''}" placeholder="root" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">密码</label>
                            <input type="password" id="connPass" value="${conn && conn.pass || ''}" placeholder="密码" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">数据库名</label>
                        <input type="text" id="connDbname" value="${conn && conn.dbname || ''}" placeholder="fixed_assets" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                    </div>
                </div>

                <div class="flex gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onclick="window.connectionManager.renderConnectionsList()" class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">取消</button>
                    <button type="button" onclick="window.connectionManager.saveConnectionFromForm('${editId || ''}')" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold shadow-sm">${isEdit ? '保存修改' : '创建连接'}</button>
                </div>
            </form>
        `;

        const modalBody = this.modal.querySelector('.modal-body');
        if (modalBody) modalBody.innerHTML = html;

        const form = document.getElementById('connectionForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveConnectionFromForm(editId);
            });
        }
    }

    parseAndFillForm() {
        const connString = document.getElementById('connString').value.trim();
        if (!connString) {
            uiManager.alert('请输入连接字符串');
            return;
        }

        try {
            const parsed = this.parseConnectionString(connString);
            if (parsed.type === 'mysql') {
                document.getElementById('connHost').value = parsed.host || '';
                document.getElementById('connPort').value = parsed.port || '3306';
                document.getElementById('connDbname').value = parsed.dbname || '';
                document.getElementById('connUser').value = parsed.user || '';
                document.getElementById('connPass').value = parsed.pass || '';
            }
            uiManager.alert('解析成功，表单已自动填充', '操作成功');
        } catch (e) {
            uiManager.alert(e.message, '解析错误');
        }
    }

    translateError(errorMsg) {
        if (!errorMsg) return '未知错误';
        if (errorMsg.includes('Access denied')) return '数据库访问被拒绝：用户名或密码错误';
        if (errorMsg.includes('Unknown database')) return '数据库不存在：请检查数据库名称';
        if (errorMsg.includes('Connection refused')) return '连接被拒绝：请检查主机地址和端口';
        if (errorMsg.includes('timed out')) return '连接超时：服务器无响应';
        if (errorMsg.includes('getaddrinfo failed')) return '主机名解析失败：请检查主机地址';
        return errorMsg;
    }

    saveConnectionFromForm(editId) {
        const name = document.getElementById('connName').value.trim();

        if (!name) {
            uiManager.alert('请输入连接名称', '校验失败');
            return;
        }

        const config = { name, type: 'mysql' };
        config.host = document.getElementById('connHost').value.trim();
        config.port = document.getElementById('connPort').value.trim();
        config.dbname = document.getElementById('connDbname').value.trim();
        config.user = document.getElementById('connUser').value.trim();
        config.pass = document.getElementById('connPass').value.trim();

        if (!config.host) {
            uiManager.alert('请输入主机地址', '校验失败');
            return;
        }
        if (!config.port) {
            uiManager.alert('请输入端口号', '校验失败');
            return;
        }
        if (!config.user) {
            uiManager.alert('请输入数据库用户名', '校验失败');
            return;
        }
        if (!config.dbname) {
            uiManager.alert('请输入数据库名称', '校验失败');
            return;
        }

        if (editId) {
            this.updateConnection(editId, config);
            uiManager.alert('连接配置已更新', '操作成功');
        } else {
            this.addConnection(config);
            uiManager.alert('新连接已创建', '操作成功');
        }

        this.renderConnectionsList();
    }
}

// ==================== 查询管理器 ====================
class QueryManager {
    constructor() {
        this.form = document.getElementById('queryForm');
        this.resultBox = document.getElementById('resultBox');
        this.errorBox = document.getElementById('errorBox');
        this.loadingEl = document.getElementById('loading');
        this.curlCommand = document.getElementById('curlCommand');
        this.apiBase = 'http://localhost:8080/api';

        this.currentTab = 'query';
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalPages = 0;
        this.total = 0;
        this.canExport = false;

        this.init();
    }

    init() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performQuery();
            });

            const facodeInput = document.getElementById('facodeInput');
            const ipInput = document.getElementById('ipInput');
            if (facodeInput) facodeInput.addEventListener('input', () => this.updateCurlCommand());
            if (ipInput) ipInput.addEventListener('input', () => this.updateCurlCommand());
        }

        document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') authManager.login();
        });
        document.getElementById('loginUsername')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') authManager.login();
        });

        this.updateCurlCommand();
    }

    switchTab(tab) {
        this.currentTab = tab;
        const tabQuery = document.getElementById('tabQuery');
        const tabList = document.getElementById('tabList');
        const queryForm = document.getElementById('queryForm');
        const listView = document.getElementById('listView');

        if (tab === 'query') {
            tabQuery.className = 'px-6 py-3 text-sm font-bold border-b-2 border-indigo-500 text-indigo-600 transition-colors';
            tabList.className = 'px-6 py-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors';
            queryForm.classList.remove('hidden');
            listView.classList.add('hidden');
            this.resultBox?.classList.remove('hidden');
        } else {
            tabQuery.className = 'px-6 py-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors';
            tabList.className = 'px-6 py-3 text-sm font-bold border-b-2 border-indigo-500 text-indigo-600 transition-colors';
            queryForm.classList.add('hidden');
            listView.classList.remove('hidden');
            this.resultBox?.classList.add('hidden');
            this.loadList();
        }
    }

    async loadList() {
        if (!authManager.currentUser) return;

        const keyword = document.getElementById('listKeyword')?.value.trim() || '';
        const loading = document.getElementById('listLoading');
        const tableBody = document.getElementById('listTableBody');

        loading.classList.remove('hidden');
        tableBody.innerHTML = '';

        try {
            const url = `${this.apiBase}/list.php?page=${this.currentPage}&pageSize=${this.pageSize}&keyword=${encodeURIComponent(keyword)}`;
            const response = await fetch(url, { headers: authManager.getAuthHeaders() });
            const data = await response.json();

            if (data.success && data.data) {
                this.total = data.data.total;
                this.totalPages = Math.ceil(this.total / this.pageSize);
                this.canExport = data.data.can_export;

                this.renderTable(data.data.list);
                this.renderPagination();
            } else {
                uiManager.alert(data.error || '加载失败', '错误');
            }
        } catch (e) {
            uiManager.alert('无法连接到服务器', '连接错误');
        } finally {
            loading.classList.add('hidden');
        }
    }

    renderTable(list) {
        const tableBody = document.getElementById('listTableBody');
        const statusMap = {
            'in_use': { text: '使用中', class: 'bg-green-100 text-green-800' },
            'in_repair': { text: '维修中', class: 'bg-yellow-100 text-yellow-800' },
            'idle': { text: '闲置', class: 'bg-gray-100 text-gray-800' },
            'scrapped': { text: '已报废', class: 'bg-red-100 text-red-800' }
        };

        if (list.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-4 py-12 text-center text-gray-500">
                        暂无数据
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = list.map(item => {
            const status = statusMap[item.status] || { text: item.status, class: 'bg-gray-100 text-gray-800' };
            return `
                <tr class="hover:bg-gray-50 transition-colors cursor-pointer" onclick="window.queryManager.viewDetail('${item.facode}')">
                    <td class="px-4 py-3 text-sm font-mono font-semibold text-indigo-600">${item.facode}</td>
                    <td class="px-4 py-3 text-sm font-mono text-gray-900">${item.sn}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${item.asset_name}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">${item.dept_name || '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">${item.user_name || '-'}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${status.class}">${status.text}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">${item.location || '-'}</td>
                    <td class="px-4 py-3">
                        ${(authManager.currentUser?.role === 'admin') ? `
                        <button onclick="event.stopPropagation();window.queryManager.generateLink('${item.facode}')" 
                            class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition">
                            生成维修链接
                        </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderPagination() {
        document.getElementById('listTotal').textContent = `共 ${this.total} 条记录`;
        document.getElementById('pageInfo').textContent = `第 ${this.currentPage} / ${this.totalPages || 1} 页`;
        document.getElementById('prevPageBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage >= this.totalPages;
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadList();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadList();
        }
    }

    async viewDetail(facode) {
        document.getElementById('facodeInput').value = facode;
        this.switchTab('query');
        await this.performQuery();
    }

    updateCurlCommand() {
        const facode = document.getElementById('facodeInput')?.value || 'FA001';
        const ip = document.getElementById('ipInput')?.value || 'localhost';
        const headers = connectionManager?.getHeaders() || {};

        let curlCmd = `curl "http://${ip}:8080/api/query.php?facode=${facode}"`;
        Object.entries(headers).forEach(([key, value]) => {
            if (value) curlCmd += ` \\\n  -H "${key}: ${value}"`;
        });
        if (authManager?.getToken()) {
            curlCmd += ` \\\n  -H "X-AUTH-TOKEN: ${authManager.getToken()}"`;
        }

        if (this.curlCommand) this.curlCommand.textContent = curlCmd;
    }

    async performQuery() {
        const facode = document.getElementById('facodeInput')?.value.trim();
        const ip = document.getElementById('ipInput')?.value.trim() || 'localhost';

        if (!ip) {
            uiManager.alert('请输入服务器 IP 地址或域名', '缺少参数');
            return;
        }

        if (!facode) {
            uiManager.alert('请输入固定资产编码', '参数错误');
            return;
        }

        this.showLoading();
        this.hideError();
        this.hideResult();

        try {
            const headers = authManager?.getAuthHeaders() || connectionManager?.getHeaders() || {};
            const url = `http://${ip}:8080/api/query.php?facode=${encodeURIComponent(facode)}`;

            const response = await fetch(url, { method: 'GET', headers: headers });

            if (response.status === 401) {
                authManager?.logout();
                return;
            }

            if (response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                uiManager.alert(errorData.error || '权限不足，无法访问该资产', '访问被拒绝');
                this.hideLoading();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const rawError = errorData.error || `HTTP 错误！状态码: ${response.status}`;
                const translatedError = connectionManager?.translateError ? connectionManager.translateError(rawError) : rawError;
                throw new Error(translatedError);
            }

            const data = await response.json();

            if (data.success && data.data) {
                this.showResult(data.data, data.user_role);
                historyManager?.add({ facode, ip, sn: data.data.sn });
            } else if (data.success && !data.data) {
                this.showError('未找到该固定资产编码对应的序列号');
                historyManager?.add({ facode, ip, sn: null });
            } else {
                const rawError = data.error || '查询失败';
                const translatedError = connectionManager?.translateError ? connectionManager.translateError(rawError) : rawError;
                throw new Error(translatedError);
            }
        } catch (error) {
            let errorMsg = '查询出错：';
            if (error.message.includes('Failed to fetch')) {
                errorMsg += '无法连接到服务器，请检查 IP 和后端状态';
            } else {
                errorMsg += error.message;
            }
            this.showError(errorMsg);
        } finally {
            this.hideLoading();
        }
    }

    async exportData() {
        if (!authManager?.currentUser) {
            uiManager.alert('请先登录', '未登录');
            return;
        }

        if (!this.canExport && authManager.currentUser.role !== 'admin') {
            uiManager.alert('您没有导出权限', '权限不足');
            return;
        }

        try {
            const ip = document.getElementById('ipInput')?.value.trim() || 'localhost';
            const url = `http://${ip}:8080/api/export.php`;

            const headers = authManager.getAuthHeaders();
            headers['Content-Type'] = 'application/json';

            const response = await fetch(url, { headers: headers });

            if (response.status === 401) {
                authManager.logout();
                return;
            }

            if (response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                uiManager.alert(errorData.error || '您没有导出权限', '权限不足');
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '导出失败');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const filename = `固定资产清单_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            uiManager.alert('导出成功', '操作成功');
        } catch (e) {
            uiManager.alert(e.message || '导出失败', '错误');
        }
    }

    async generateLink(facode) {
        if (authManager.currentUser?.role !== 'admin') {
            uiManager.alert('仅管理员可生成维修链接', '权限不足');
            return;
        }

        try {
            const ip = document.getElementById('ipInput')?.value.trim() || 'localhost';
            const response = await fetch(`http://${ip}:8080/api/generate_link.php`, {
                method: 'POST',
                headers: {
                    ...authManager.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ facode })
            });

            const data = await response.json();
            if (data.success && data.data) {
                uiManager.confirm(`已生成一次性维修链接（24小时有效）：\n\n${data.data.link}\n\n是否复制链接？`, () => {
                    navigator.clipboard.writeText(data.data.link);
                    uiManager.alert('链接已复制到剪贴板', '操作成功');
                }, '生成成功');
            } else {
                uiManager.alert(data.error || '生成失败', '错误');
            }
        } catch (e) {
            uiManager.alert('生成失败，请稍后重试', '错误');
        }
    }

    showGenerateLinkModal() {
        const facode = prompt('请输入要生成维修链接的资产编码（FACode）：');
        if (facode?.trim()) {
            this.generateLink(facode.trim());
        }
    }

    showLoading() {
        if (this.loadingEl) this.loadingEl.classList.remove('hidden');
    }

    hideLoading() {
        if (this.loadingEl) this.loadingEl.classList.add('hidden');
    }

    showResult(data, userRole) {
        if (!this.resultBox) return;

        const resultContent = document.getElementById('resultContent');
        if (resultContent) {
            const isAdmin = userRole === 'admin';
            const priceHtml = data.purchase_price ? `
                <div class="h-px bg-emerald-200"></div>
                <div>
                    <div class="text-xs text-gray-500 uppercase font-semibold mb-1">采购价格</div>
                    <div class="text-xl font-bold text-gray-800 font-mono">¥${Number(data.purchase_price).toLocaleString()}</div>
                </div>
            ` : '';

            const extraHtml = `
                <div class="h-px bg-emerald-200"></div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-xs text-gray-500 uppercase font-semibold mb-1">资产名称</div>
                        <div class="text-sm font-medium text-gray-800">${data.asset_name || '-'}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase font-semibold mb-1">规格型号</div>
                        <div class="text-sm font-medium text-gray-800">${data.specification || '-'}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase font-semibold mb-1">所属部门</div>
                        <div class="text-sm font-medium text-gray-800">${data.dept_name || '-'}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 uppercase font-semibold mb-1">领用人</div>
                        <div class="text-sm font-medium text-gray-800">${data.user_name || '-'}</div>
                    </div>
                </div>
            `;

            resultContent.innerHTML = `
                <div class="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100 shadow-sm animate-fade-in">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-sm font-bold text-emerald-600 uppercase tracking-widest">查询结果</span>
                        <span class="bg-emerald-200 text-emerald-800 text-xs px-2 py-1 rounded-full font-bold">成功</span>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <div class="text-xs text-gray-500 uppercase font-semibold mb-1">固定资产编码</div>
                            <div class="text-2xl font-bold text-gray-800 font-mono">${data.facode}</div>
                        </div>
                        <div class="h-px bg-emerald-200"></div>
                        <div>
                            <div class="text-xs text-gray-500 uppercase font-semibold mb-1">序列号 (SN)</div>
                            <div class="text-3xl font-extrabold text-emerald-600 font-mono tracking-wide selection:bg-emerald-200">${data.sn}</div>
                        </div>
                        ${extraHtml}
                        ${priceHtml}
                    </div>
                    ${isAdmin ? `
                    <div class="mt-4 pt-4 border-t border-emerald-200">
                        <button onclick="window.queryManager.generateLink('${data.facode}')" 
                            class="w-full py-2 px-4 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                            </svg>
                            生成外包维修链接
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        this.resultBox.classList.remove('hidden');
    }

    hideResult() {
        if (this.resultBox) this.resultBox.classList.add('hidden');
    }

    showError(message) {
        if (!this.errorBox) return;
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) errorMessage.textContent = message;
        this.errorBox.classList.remove('hidden');
    }

    hideError() {
        if (this.errorBox) this.errorBox.classList.add('hidden');
    }
}

// ==================== 查询历史管理器 ====================
class HistoryManager {
    constructor() {
        this.storageKey = 'fa_query_history_v5';
        this.maxItems = 20;
        this.listEl = document.getElementById('historyList');
        this.emptyEl = document.getElementById('emptyHistory');
        this.clearBtn = document.getElementById('clearHistoryBtn');

        this.init();
    }

    init() {
        this.render();

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                uiManager.confirm('确定要清空所有历史记录吗？不可恢复。', () => {
                    this.clear();
                }, '清空历史');
            });
        }

        if (this.listEl) {
            this.listEl.addEventListener('click', (e) => {
                const item = e.target.closest('.history-item');
                if (!item) return;

                if (e.target.closest('.delete-btn')) {
                    e.stopPropagation();
                    const timestamp = parseInt(item.dataset.timestamp);
                    uiManager.confirm('确定要删除这条历史记录吗？', () => {
                        this.remove(timestamp);
                    }, '删除记录');
                    return;
                }

                const facode = item.dataset.facode;
                const ip = item.dataset.ip;
                const facodeInput = document.getElementById('facodeInput');
                const ipInput = document.getElementById('ipInput');

                if (facodeInput && ipInput) {
                    facodeInput.value = facode;
                    ipInput.value = ip;
                    queryManager.performQuery();
                }
            });
        }
    }

    getHistory() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }

    add(record) {
        const history = this.getHistory();
        record.timestamp = Date.now();
        record.connectionName = connectionManager.getCurrentConnectionName();
        history.unshift(record);
        if (history.length > this.maxItems) history.pop();

        localStorage.setItem(this.storageKey, JSON.stringify(history));
        this.render();
    }

    remove(timestamp) {
        let history = this.getHistory();
        history = history.filter(h => h.timestamp !== timestamp);
        localStorage.setItem(this.storageKey, JSON.stringify(history));
        this.render();
    }

    clear() {
        localStorage.removeItem(this.storageKey);
        this.render();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
    }

    render() {
        const history = this.getHistory();

        if (!this.listEl || !this.emptyEl) return;

        if (history.length === 0) {
            this.listEl.innerHTML = '';
            this.emptyEl.classList.remove('hidden');
            return;
        }

        this.emptyEl.classList.add('hidden');

        this.listEl.innerHTML = history.map(h => `
            <div class="history-item bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
                 data-facode="${h.facode}" data-ip="${h.ip}" data-timestamp="${h.timestamp}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-gray-800 text-lg">${h.facode}</span>
                            <span class="px-2 py-0.5 ${h.sn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} text-xs font-bold rounded-full uppercase tracking-wide">
                                ${h.sn ? '已找到' : '未找到'}
                            </span>
                        </div>
                        ${h.sn ? `<div class="text-sm font-mono text-gray-600 mb-2">SN: ${h.sn}</div>` : ''}
                        <div class="flex items-center text-xs text-gray-400 gap-2">
                            <span>${this.formatTime(h.timestamp)}</span>
                            ${h.connectionName ? `<span class="bg-gray-50 px-1 rounded text-gray-500">${h.connectionName}</span>` : ''}
                        </div>
                    </div>
                    <button class="delete-btn text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded transition-all opacity-0 group-hover:opacity-100" title="删除">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// ==================== 初始化 ====================
let authManager;
let connectionManager;
let historyManager;
let queryManager;
let uiManager;

document.addEventListener('DOMContentLoaded', () => {
    uiManager = new UIManager();
    authManager = new AuthManager();
    connectionManager = new ConnectionManager();
    historyManager = new HistoryManager();
    queryManager = new QueryManager();

    window.authManager = authManager;
    window.connectionManager = connectionManager;
    window.uiManager = uiManager;
    window.queryManager = queryManager;
});
