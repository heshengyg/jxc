//===================== 系统设置模块（完整权限版） =====================
let settingsData = {
    companyName: '',
    departments: ['管理员', '商品部', '库管员', '财务部', 'APP部'],
    members: []
};

// ============================================================
// ===== 子版块菜单定义（查看权限细化到子版块） =====
// ============================================================
const ALL_MENUS = [
    // ===== 商品管理（3个子版块） =====
    { key: 'goodsInfo', label: '商品信息', module: 'goods', moduleLabel: '商品管理' },
    { key: 'settleType', label: '供应商管理', module: 'goods', moduleLabel: '商品管理' },
    { key: 'dateChange', label: '后台更换日期', module: 'goods', moduleLabel: '商品管理' },
    // ===== 入库管理 =====
    { key: 'stockInList', label: '入库记录', module: 'stockIn', moduleLabel: '入库管理' },
    // ===== 退货管理 =====
    { key: 'returnList', label: '退货记录', module: 'returnGoods', moduleLabel: '退货管理' },
    // ===== 出库管理 =====
    { key: 'stockOutList', label: '出库记录', module: 'stockOut', moduleLabel: '出库管理' },
    // ===== 库存查看 =====
    { key: 'stockList', label: '库存列表', module: 'stockView', moduleLabel: '库存查看' },
    // ===== 财务综合（9个子版块） =====
    { key: 'taxRate', label: '税率录入', module: 'finance', moduleLabel: '财务综合' },
    { key: 'stockInPrint', label: '入库单打印', module: 'finance', moduleLabel: '财务综合' },
    { key: 'payRecord', label: '财务付款记录', module: 'finance', moduleLabel: '财务综合' },
    { key: 'invoiceBack', label: '发票返回记录', module: 'finance', moduleLabel: '财务综合' },
    { key: 'paymentBoard', label: '收付款看板', module: 'finance', moduleLabel: '财务综合' },
    { key: 'monthInvoiceBalance', label: '发票月结余', module: 'finance', moduleLabel: '财务综合' },
    { key: 'stockInCheck', label: '入库对账', module: 'finance', moduleLabel: '财务综合' },
    { key: 'stockOutCheck', label: '出库对账', module: 'finance', moduleLabel: '财务综合' },
    { key: 'monthBeginStock', label: '月期初数', module: 'finance', moduleLabel: '财务综合' },
    // ===== 系统设置（3个子版块） =====
    { key: 'basic', label: '基础设置', module: 'settings', moduleLabel: '系统设置' },
    { key: 'data', label: '数据管理', module: 'settings', moduleLabel: '系统设置' },
    { key: 'permission', label: '权限管理', module: 'settings', moduleLabel: '系统设置' }
];

// ===== 大模块分组（用于界面显示） =====
const MODULE_GROUPS = {
    goods: '商品管理',
    stockIn: '入库管理',
    returnGoods: '退货管理',
    stockOut: '出库管理',
    stockView: '库存查看',
    finance: '财务综合',
    settings: '系统设置'
};

// 大模块对应的子版块 key 列表
const MODULE_SUB_KEYS = {
    goods: ['goodsInfo', 'settleType', 'dateChange'],
    stockIn: ['stockInList'],
    returnGoods: ['returnList'],
    stockOut: ['stockOutList'],
    stockView: ['stockList'],
    finance: ['taxRate', 'stockInPrint', 'payRecord', 'invoiceBack', 'paymentBoard', 'monthInvoiceBalance', 'stockInCheck', 'stockOutCheck', 'monthBeginStock'],
    settings: ['basic', 'data', 'permission']
};


// ============================================================
// ===== 旧 Key → 新 Key 映射表（兼容历史数据） =====
// ============================================================
const KEY_MIGRATION_MAP = {
    'supplier': 'settleType',
    'expireDate': 'dateChange',
    'paymentRecord': 'payRecord',
    'invoiceReturn': 'invoiceBack',
    'invoiceBalance': 'monthInvoiceBalance',
    'monthStart': 'stockOutCheck',
    'financeReport': 'monthBeginStock',
    'settingsBasic': 'basic',
    'settingsData': 'data',
    'settingsPerm': 'permission'
};

function migrateKeys(oldKeys) {
    if (!Array.isArray(oldKeys)) return [];
    return oldKeys.map(function(key) {
        return KEY_MIGRATION_MAP[key] || key;
    });
}

// ============================================================
// ===== 权限数据 =====
// ============================================================
let permissionData = {
    roles: [],
    users: []
};

let currentUserId = null;

// ============================================================
// ===== 工具函数 =====
// ============================================================
function isCurrentUserAdmin() {
    if (!currentUserId) return false;
    var currentUser = permissionData.users.find(function(u) { return u.id === currentUserId; });
    if (!currentUser) return false;
    var currentRole = permissionData.roles.find(function(r) { return r.id === currentUser.roleId; });
    return currentRole && currentRole.name === '管理员';
}

// ============================================================
// ===== 权限检查函数 =====
// ============================================================
function getUserPermissions(userId) {
    var user = permissionData.users.find(function(u) { return u.id === userId; });
    if (!user) {
        user = permissionData.users.find(function(u) { return u.name === 'admin'; });
        if (user) {
            console.log('🔄 通过用户名找到用户:', user.name);
        }
    }
    if (!user) {
        console.warn('⚠️ 用户不在 permissionData.users 中，使用默认管理员权限');
        return {
            view: ALL_MENUS.map(function(m) { return m.key; }),
            banned: []
        };
    }
    var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
    if (!role) {
        console.warn('⚠️ 角色不存在，使用默认管理员权限');
        return {
            view: ALL_MENUS.map(function(m) { return m.key; }),
            banned: user.bannedOperations || []
        };
    }
    return {
        view: role.viewPermissions || [],
        banned: user.bannedOperations || []
    };
}

function canUserView(userId, menuKey) {
    var perms = getUserPermissions(userId);
    return perms.view.includes(menuKey);
}

function canUserOperate(userId, moduleKey, operationKey) {
    if (!userId) return false;
    var perms = getUserPermissions(userId);
    var fullKey = moduleKey + '_' + operationKey;
    return !(perms.banned && perms.banned.includes(fullKey));
}

// ============================================================
// ===== 应用权限到页面按钮 =====
// ============================================================
function applyAllPermissions() {
    if (!currentUserId) {
        console.warn('⚠️ currentUserId 为空，跳过权限应用');
        return;
    }
    document.querySelectorAll('[data-module][data-op]').forEach(function(btn) {
        var moduleKey = btn.dataset.module;
        var opKey = btn.dataset.op;
        var allowed = canUserOperate(currentUserId, moduleKey, opKey);
        if (!allowed) {
            btn.classList.add('btn-disabled');
            btn.disabled = true;
            btn.title = '您没有此操作权限';
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.classList.remove('btn-disabled');
            btn.disabled = false;
            btn.title = '';
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
}

// ============================================================
// ===== 设置当前用户 =====
// ============================================================
function setCurrentUser(userId) {
    currentUserId = userId;
    if (!userId) return;

    console.log('🔑 setCurrentUser 被调用，用户ID:', userId);

    var perms = getUserPermissions(userId);
    console.log('📊 用户权限:', perms.view);

    var moduleMenuMap = {
        'goods': ['goodsInfo', 'settleType', 'dateChange'],
        'stockIn': ['stockInList'],
        'returnGoods': ['returnList'],
        'stockOut': ['stockOutList'],
        'stockView': ['stockList'],
        'finance': ['taxRate', 'stockInPrint', 'payRecord', 'invoiceBack', 'paymentBoard', 'monthInvoiceBalance', 'stockInCheck', 'stockOutCheck', 'monthBeginStock'],
        'settings': ['basic', 'data', 'permission']
    };

    // ===== 关键修复：管理员显示所有 Tab，非管理员根据权限显示 =====
    var isAdmin = false;
    var currentUser = permissionData.users.find(function(u) { return u.id === userId; });
    if (currentUser) {
        var currentRole = permissionData.roles.find(function(r) { return r.id === currentUser.roleId; });
        if (currentRole && currentRole.name === '管理员') {
            isAdmin = true;
        }
    }

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        var onclick = btn.getAttribute('onclick');
        if (!onclick) return;
        var match = onclick.match(/switchTab\('([^']+)'\)/);
        if (!match) return;
        var menuKey = match[1];

        // 管理员：显示所有 Tab
        if (isAdmin) {
            btn.style.display = 'inline-block';
            return;
        }

        // 非管理员：根据权限显示
        var subKeys = moduleMenuMap[menuKey] || [];
        var hasPermission = subKeys.some(function(k) {
            return perms.view.includes(k);
        });
        btn.style.display = hasPermission ? 'inline-block' : 'none';
    });

    applyAllPermissions();
    applySubTabPermissions();
    
    // ===== 强制显示系统设置Tab（如果有权限） =====
    var settingsTab = document.getElementById('settingsTab');
    if (settingsTab) {
        if (isAdmin || perms.view.some(function(k) { return k === 'basic' || k === 'data' || k === 'permission'; })) {
            settingsTab.style.display = 'inline-block';
        }
    }
}

// ============================================================
// ===== 子版块权限应用函数 =====
// ============================================================
function applySubTabPermissions() {
    var activeTab = document.querySelector('.tab-btn.active');
    if (!activeTab) return;

    var match = activeTab.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/);
    if (!match) return;
    var moduleKey = match[1];

    var perms = getUserPermissions(currentUserId);
    var subBtns = [];

    if (moduleKey === 'goods') {
        subBtns = document.querySelectorAll('#goods .finance-sub-btn');
    } else if (moduleKey === 'finance') {
        subBtns = document.querySelectorAll('#finance .finance-sub-btn');
    } else if (moduleKey === 'settings') {
        subBtns = document.querySelectorAll('#settings .settings-sub-btn');
    } else {
        return;
    }

    var firstVisible = null;
    subBtns.forEach(function(btn) {
        var tabKey = btn.dataset.tab;
        var hasPerm = perms.view.includes(tabKey);
        btn.style.display = hasPerm ? '' : 'none';
        if (hasPerm && !firstVisible) firstVisible = btn;
    });

    var activeSub = document.querySelector('#' + moduleKey + ' .finance-sub-btn.active') ||
                    document.querySelector('#' + moduleKey + ' .settings-sub-btn.active');
    if (activeSub && activeSub.style.display === 'none') {
        if (firstVisible) firstVisible.click();
    } else if (!activeSub && firstVisible) {
        firstVisible.click();
    }

    applyAllPermissions();
}

// ============================================================
// ===== Supabase 角色同步 =====
// ============================================================
async function loadRolesFromSupabase() {
    try {
        console.log('📡 从 Supabase 加载角色...');
        const result = await supabase
            .from('roles')
            .select('id, name, view_permissions')
            .order('name');

        if (result.error) {
            console.error('❌ 加载角色失败:', result.error);
            return false;
        }

        if (result.data && result.data.length > 0) {
            permissionData.roles = result.data.map(function(role) {
                var migrated = migrateKeys(role.view_permissions || []);
                return {
                    id: role.id,
                    name: role.name,
                    viewPermissions: migrated
                };
            });
            console.log('✅ 从 Supabase 加载了 ' + permissionData.roles.length + ' 个角色（已迁移 Key）');
            return true;
        }
        return false;
    } catch (err) {
        console.error('❌ 加载角色异常:', err);
        return false;
    }
}

async function saveRoleToSupabase(role) {
    try {
        const data = {
            name: role.name,
            view_permissions: role.viewPermissions || []
        };

        const isNew = !role.id || role.id.toString().startsWith('role_');

        let result;
        if (isNew) {
            result = await supabase
                .from('roles')
                .insert([data])
                .select();
        } else {
            result = await supabase
                .from('roles')
                .update(data)
                .eq('id', role.id)
                .select();
        }

        if (result.error) {
            console.error('❌ 保存角色失败:', result.error);
            showMsg('❌ 保存失败: ' + result.error.message);
            return false;
        }

        if (result.data && result.data.length > 0) {
            var savedRole = result.data[0];
            role.id = savedRole.id;
            role.name = savedRole.name;
            role.viewPermissions = savedRole.view_permissions || [];
        }

        console.log('✅ 角色保存到 Supabase 成功:', role.name);
        return true;

    } catch (err) {
        console.error('❌ 保存角色异常:', err);
        showMsg('❌ 保存异常: ' + err.message);
        return false;
    }
}

async function deleteRoleFromSupabase(roleId) {
    try {
        const result = await supabase
            .from('roles')
            .delete()
            .eq('id', roleId);

        if (result.error) {
            console.error('❌ 删除角色失败:', result.error);
            showMsg('❌ 删除失败: ' + result.error.message);
            return false;
        }

        console.log('✅ 角色已从 Supabase 删除');
        return true;

    } catch (err) {
        console.error('❌ 删除角色异常:', err);
        return false;
    }
}

async function syncRolePermissions(roleName, viewPermissions) {
    try {
        await supabase
            .from('role_permissions')
            .delete()
            .eq('role', roleName);

        var permissions = viewPermissions.map(function(menuKey) {
            return {
                role: roleName,
                menu_key: menuKey,
                can_view: true,
                can_add: true,
                can_edit: true,
                can_delete: true
            };
        });

        if (permissions.length > 0) {
            const result = await supabase
                .from('role_permissions')
                .insert(permissions);

            if (result.error) {
                console.error('❌ 同步权限失败:', result.error);
            } else {
                console.log('✅ 权限同步成功:', permissions.length + ' 条');
            }
        }
    } catch (err) {
        console.error('❌ 同步权限异常:', err);
    }
}

async function deleteRolePermissions(roleName) {
    try {
        await supabase
            .from('role_permissions')
            .delete()
            .eq('role', roleName);
        console.log('✅ 角色权限已删除');
    } catch (err) {
        console.error('❌ 删除权限异常:', err);
    }
}

// ============================================================
// ===== Supabase 用户同步 =====
// ============================================================
async function syncUserToSupabase(userData) {
    try {
        const checkResult = await supabase
            .from('users')
            .select('id')
            .eq('username', userData.name);

        if (checkResult.data && checkResult.data.length > 0) {
            const result = await supabase
                .from('users')
                .update({
                    password_hash: userData.passwordHash,
                    role: userData.roleName,
                    status: 'active'
                })
                .eq('username', userData.name);

            if (result.error) {
                console.error('❌ 更新用户失败:', result.error);
                return false;
            }
            return true;
        }

        const result = await supabase
            .from('users')
            .insert([{
                username: userData.name,
                email: userData.name + '@company.com',
                password_hash: userData.passwordHash,
                role: userData.roleName,
                status: 'active',
                avatar_url: null
            }]);

        if (result.error) {
            console.error('❌ 创建用户失败:', result.error);
            return false;
        }
        return true;

    } catch (err) {
        console.error('❌ 同步用户异常:', err);
        return false;
    }
}

async function deleteUserFromSupabase(userId) {
    try {
        const result = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (result.error) {
            console.error('❌ 删除用户失败:', result.error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('❌ 删除用户异常:', err);
        return false;
    }
}

// ============================================================
// ===== 初始化 =====
// ============================================================
function loadSettings() {
    try {
        const saved = localStorage.getItem('erp_settings');
        if (saved) settingsData = JSON.parse(saved);
    } catch(e) {}
}

function saveSettings() {
    try {
        localStorage.setItem('erp_settings', JSON.stringify(settingsData));
    } catch(e) {}
}

function loadPermissionData() {
    try {
        const saved = localStorage.getItem('permissionData');
        if (saved) {
            permissionData = JSON.parse(saved);
        } else {
            initDefaultPermissionData();
        }
    } catch(e) {
        initDefaultPermissionData();
    }
}

function savePermissionData() {
    try {
        localStorage.setItem('permissionData', JSON.stringify(permissionData));
    } catch(e) {}
}

function initDefaultPermissionData() {
    var allKeys = ALL_MENUS.map(function(m) { return m.key; });

    permissionData = {
        roles: [
            { id: 'role_1', name: '管理员', viewPermissions: allKeys },
            { id: 'role_2', name: '商品部', viewPermissions: ['goodsInfo', 'settleType', 'dateChange', 'stockList'] },
            { id: 'role_3', name: '库管员', viewPermissions: ['stockInList', 'stockOutList', 'stockList'] },
            { id: 'role_4', name: '财务部', viewPermissions: ['taxRate', 'payRecord', 'invoiceBack', 'stockInCheck', 'stockList'] },
            { id: 'role_5', name: 'APP部', viewPermissions: ['returnList', 'stockList'] }
        ],
        users: [
            { id: 'user_1', name: 'admin', password: '123', roleId: 'role_1', bannedOperations: [] }
        ]
    };
    savePermissionData();
}

function applyUserPermissions() {
    var saved = sessionStorage.getItem('supabase_user') || sessionStorage.getItem('user');
    if (saved) {
        try {
            var user = JSON.parse(saved);
            if (user && user.id) {
                if (permissionData.roles.length === 0) {
                    loadRolesFromSupabase().then(function() {
                        loadAllUsersFromSupabase().then(function() {
                            setCurrentUser(user.id);
                            console.log('✅ 应用 Supabase 用户权限（角色已加载）:', user.name);
                        });
                    });
                } else {
                    loadAllUsersFromSupabase().then(function() {
                        setCurrentUser(user.id);
                        console.log('✅ 应用 Supabase 用户权限（刷新列表）:', user.name);
                    });
                }
                return;
            }
        } catch(e) {
            console.warn('应用用户权限失败:', e);
        }
    }
    setCurrentUser('user_1');
}

// 重写 switchTab
var originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'settings') {
        loadRolesFromSupabase().then(function() {
            loadAllUsersFromSupabase().then(function() {
                renderAll();
                applyAllPermissions();
                applySubTabPermissions();
                console.log('✅ 数据已同步');
            });
        });
    } else {
        setTimeout(applySubTabPermissions, 50);
    }
};

function initSettings() {
    loadSettings();
    loadPermissionData();

    loadRolesFromSupabase().then(function(success) {
        renderAll();
        if (success) {
            savePermissionData();
        }
        applyUserPermissions();
        setTimeout(applySubTabPermissions, 100);
    });

    const settingsTab = document.getElementById('settingsTab');
    if (settingsTab) settingsTab.style.display = 'inline-block';

    const companyNameEl = document.getElementById('companyName');
    if (companyNameEl) {
        companyNameEl.addEventListener('change', saveCompanyName);
        companyNameEl.addEventListener('blur', saveCompanyName);
    }

    const logoInput = document.getElementById('companyLogo');
    const logoPreview = document.getElementById('logoPreview');
    if (logoInput && logoPreview) {
        logoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    logoPreview.src = ev.target.result;
                    logoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function renderAll() {
    renderCompanyName();
    renderRoles();
    renderUsers();
    updateRoleSelect();
}

function updateRoleSelect() {
    var select = document.getElementById('roleSelect');
    if (!select) return;
    select.innerHTML = '<option value="">请选择角色</option>';
    permissionData.roles.forEach(function(role) {
        select.innerHTML += '<option value="' + role.id + '">' + role.name + '</option>';
    });
}

function renderCompanyName() {
    const el = document.getElementById('companyName');
    if (el) el.value = settingsData.companyName || '';
}

function saveCompanyName() {
    const el = document.getElementById('companyName');
    if (el) {
        settingsData.companyName = el.value.trim();
        saveSettings();
        showMsg('✅ 公司名称已保存');
    }
}

function switchSettingsTab(tabKey) {
    document.querySelectorAll('.settings-sub-content').forEach(function(el) {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    var target = document.getElementById('sub-' + tabKey);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
    document.querySelectorAll('.settings-sub-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    var targetBtn = document.querySelector('.settings-sub-btn[data-tab="' + tabKey + '"]');
    if (targetBtn) targetBtn.classList.add('active');
}

// ============================================================
// ===== 角色管理 =====
// ============================================================
function renderRoles() {
    var container = document.getElementById('roleList');
    if (!container) return;
    container.innerHTML = '';
    permissionData.roles.forEach(function(role) {
        var viewLabels = role.viewPermissions.map(function(k) {
            var found = ALL_MENUS.find(function(m) { return m.key === k; });
            return found ? found.label : k;
        }).join('、');
        var div = document.createElement('div');
        div.className = 'role-card';
        div.innerHTML = `
            <span class="role-name">${role.name}</span>
            <span class="role-perms">👁 ${viewLabels || '无'}</span>
            <span class="role-badge">${role.viewPermissions?.length || 0}个子版块</span>
            <div>
                <button class="btn btn-primary btn-sm" data-module="settings" data-op="editRole" onclick="editRole('${role.id}')">编辑</button>
                <button class="btn btn-danger btn-sm" data-module="settings" data-op="deleteRole" onclick="deleteRole('${role.id}')">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// 全选/取消全选（点击大模块复选框时触发）
function toggleModuleAll(checkbox) {
    var groupContainer = checkbox.closest('.perm-group');
    var subCheckboxes = groupContainer.querySelectorAll('.perm-group-items input[type="checkbox"]');
    subCheckboxes.forEach(function(sub) {
        sub.checked = checkbox.checked;
    });
}

function updateModuleAll(checkbox) {
    var groupContainer = checkbox.closest('.perm-group');
    var allCheckbox = groupContainer.querySelector('.perm-group-title input[data-group]');
    var subCheckboxes = groupContainer.querySelectorAll('.perm-group-items input[type="checkbox"]');
    var allChecked = true;
    subCheckboxes.forEach(function(sub) {
        if (!sub.checked) allChecked = false;
    });
    allCheckbox.checked = allChecked;
}

// ===== 打开新增角色弹窗 =====
function openAddRoleModal() {
    document.getElementById('roleNameInput').value = '';
    document.getElementById('addRoleModal').dataset.editId = '';

    var container = document.getElementById('roleViewPermissions');
    container.innerHTML = '';

    var groups = {};
    ALL_MENUS.forEach(function(item) {
        if (!groups[item.module]) groups[item.module] = [];
        groups[item.module].push(item);
    });

    var html = '';
    for (var moduleKey in groups) {
        html += '<div class="perm-group">';
        html += '<div class="perm-group-title">';
        html += '<label><input type="checkbox" data-group="' + moduleKey + '" onchange="toggleModuleAll(this)"> 📁 ' + (MODULE_GROUPS[moduleKey] || moduleKey) + '</label>';
        html += '</div>';
        html += '<div class="perm-group-items">';
        groups[moduleKey].forEach(function(item) {
            html += '<label><input type="checkbox" value="' + item.key + '" onchange="updateModuleAll(this)"> ' + item.label + '</label>';
        });
        html += '</div></div>';
    }
    container.innerHTML = html;

    document.getElementById('addRoleModal').style.display = 'flex';
}

// ===== 打开编辑角色弹窗 =====
function editRole(roleId) {
    var role = permissionData.roles.find(function(r) { return r.id === roleId; });
    if (!role) return;

    document.getElementById('roleNameInput').value = role.name;
    document.getElementById('addRoleModal').dataset.editId = roleId;

    var container = document.getElementById('roleViewPermissions');
    container.innerHTML = '';

    var groups = {};
    ALL_MENUS.forEach(function(item) {
        if (!groups[item.module]) groups[item.module] = [];
        groups[item.module].push(item);
    });

    var html = '';
    for (var moduleKey in groups) {
        // 判断该模块下所有子项是否都被选中
        var allChecked = groups[moduleKey].every(function(item) {
            return role.viewPermissions.includes(item.key);
        });
        html += '<div class="perm-group">';
        html += '<div class="perm-group-title">';
        html += '<label><input type="checkbox" data-group="' + moduleKey + '" ' + (allChecked ? 'checked' : '') + ' onchange="toggleModuleAll(this)"> 📁 ' + (MODULE_GROUPS[moduleKey] || moduleKey) + '</label>';
        html += '</div>';
        html += '<div class="perm-group-items">';
        groups[moduleKey].forEach(function(item) {
            var checked = role.viewPermissions.includes(item.key) ? 'checked' : '';
            html += '<label><input type="checkbox" value="' + item.key + '" ' + checked + ' onchange="updateModuleAll(this)"> ' + item.label + '</label>';
        });
        html += '</div></div>';
    }
    container.innerHTML = html;

    document.getElementById('addRoleModal').style.display = 'flex';
}

// ===== 保存角色（新增或编辑） =====
saveRole = async function() {
    var editId = document.getElementById('addRoleModal').dataset.editId;
    var name = document.getElementById('roleNameInput').value.trim();
    if (!name) {
        showMsg('请输入角色名称');
        return;
    }

    // 只收集子版块复选框（排除全选复选框）
    var subCheckboxes = document.querySelectorAll('#roleViewPermissions .perm-group-items input[type="checkbox"]:checked');
    var viewPermissions = Array.from(subCheckboxes).map(function(cb) { return cb.value; });
    
    if (viewPermissions.length === 0) {
        showMsg('请至少勾选一个查看权限');
        return;
    }

    // 无论成功失败，都要关闭弹窗
    var closeModal = function() {
        document.getElementById('addRoleModal').style.display = 'none';
    };

    if (editId) {
        var role = permissionData.roles.find(function(r) { return r.id === editId; });
        if (role) {
            if (role.name === '管理员') {
                showMsg('不能修改管理员角色');
                closeModal();
                return;
            }

            role.name = name;
            role.viewPermissions = viewPermissions;

            var success = await saveRoleToSupabase(role);
            if (success) {
                await syncRolePermissions(role.name, viewPermissions);
                savePermissionData();
                renderRoles();
                updateRoleSelect();
                showMsg('✅ 角色已更新');
                document.getElementById('addRoleModal').dataset.editId = '';
                applySubTabPermissions();
            }
            closeModal();
        } else {
            showMsg('角色不存在');
            closeModal();
        }
    } else {
        if (permissionData.roles.some(function(r) { return r.name === name; })) {
            showMsg('角色已存在');
            closeModal();
            return;
        }

        var newRole = {
            id: 'role_' + Date.now(),
            name: name,
            viewPermissions: viewPermissions
        };

        var success = await saveRoleToSupabase(newRole);
        if (success) {
            permissionData.roles.push(newRole);
            await syncRolePermissions(newRole.name, viewPermissions);
            savePermissionData();
            renderRoles();
            updateRoleSelect();
            showMsg('✅ 角色添加成功');
            applySubTabPermissions();
        }
        closeModal();
    }
};

function closeAddRoleModal() {
    document.getElementById('addRoleModal').style.display = 'none';
}

function deleteRole(roleId) {
    if (!confirm('确定删除该角色？')) return;
    var role = permissionData.roles.find(function(r) { return r.id === roleId; });
    if (role && role.name === '管理员') return showMsg('不能删除管理员角色');

    deleteRoleFromSupabase(roleId).then(function(success) {
        if (success) {
            permissionData.roles = permissionData.roles.filter(function(r) { return r.id !== roleId; });
            permissionData.users = permissionData.users.filter(function(u) { return u.roleId !== roleId; });
            if (role) {
                deleteRolePermissions(role.name);
            }
            savePermissionData();
            renderRoles();
            renderUsers();
            updateRoleSelect();
            showMsg('✅ 角色已删除');
            applySubTabPermissions();
        }
    });
}

// ============================================================
// ===== 用户管理 =====
// ============================================================
function toggleUserGroup(groupId) {
    var content = document.getElementById(groupId);
    if (content) {
        content.style.display = (content.style.display === 'none') ? 'block' : 'none';
    }
}

window.resetUserPassword = async function(userId) {
    try {
        var user = permissionData.users.find(function(u) { return u.id === userId; });
        if (!user) {
            showMsg('❌ 用户不存在');
            return;
        }

        if (!isCurrentUserAdmin()) {
            showMsg('⚠️ 只有管理员可以重置密码');
            return;
        }

        var newPwd = prompt('请输入 ' + user.name + ' 的新密码：');
        if (newPwd === null) return;
        newPwd = newPwd.trim();
        if (newPwd === '') {
            showMsg('⚠️ 密码不能为空');
            return;
        }

        var confirmPwd = prompt('请再次输入新密码确认：');
        if (confirmPwd === null) return;
        confirmPwd = confirmPwd.trim();
        if (newPwd !== confirmPwd) {
            showMsg('❌ 两次密码不一致，重置失败');
            return;
        }

        var passwordHash = newPwd;
        if (typeof bcrypt !== 'undefined' && bcrypt.hashSync) {
            passwordHash = bcrypt.hashSync(newPwd, 10);
        } else {
            console.warn('⚠️ bcrypt 未加载，使用明文存储（不推荐）');
        }

        var result = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('id', userId);

        if (result.error) {
            console.error('❌ 重置密码失败:', result.error);
            showMsg('❌ 重置失败：' + result.error.message);
            return;
        }

        showMsg('✅ 用户 ' + user.name + ' 密码已重置');
    } catch (err) {
        console.error('重置密码异常:', err);
        showMsg('❌ 重置过程发生错误：' + err.message);
    }
};

function renderUsers() {
    var container = document.getElementById('userList');
    if (!container) return;
    container.innerHTML = '';

    var groups = {};
    permissionData.users.forEach(function(user) {
        var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
        var roleName = role ? role.name : '未分配';
        if (!groups[roleName]) groups[roleName] = [];
        groups[roleName].push(user);
    });

    Object.keys(groups).sort().forEach(function(roleName) {
        var users = groups[roleName];
        if (users.length === 0) return;
        var groupId = 'userGroup_' + roleName.replace(/\s/g, '_');

        var headerDiv = document.createElement('div');
        headerDiv.className = 'user-group-header';
        headerDiv.style.cssText = 'cursor:pointer;font-weight:bold;padding:8px 14px;background:#f0f2f5;border-radius:4px;margin:6px 0 4px 0;display:flex;justify-content:space-between;align-items:center;user-select:none;';
        headerDiv.onclick = function() { toggleUserGroup(groupId); };
        headerDiv.innerHTML = '<span>👥 ' + roleName + '（' + users.length + '人）</span><span style="font-size:12px;color:#888;">点击折叠/展开</span>';
        container.appendChild(headerDiv);

        var contentDiv = document.createElement('div');
        contentDiv.id = groupId;
        contentDiv.className = 'user-group-content';
        contentDiv.style.cssText = 'padding-left:16px;border-left:2px solid #e8e8e8;margin-bottom:8px;display:block;';

        users.forEach(function(user) {
            var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
            var bannedCount = user.bannedOperations ? user.bannedOperations.length : 0;
            var div = document.createElement('div');
            div.className = 'user-card';
            div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-bottom:1px solid #f5f5f5;';
            div.innerHTML = `
                var avatarSrc = user.avatar_url || './images/logo.png';
div.innerHTML = `
    <img src="${avatarSrc}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-right:8px;">
    <span class="user-name" style="min-width:80px;">${user.name}</span>
    <span class="user-info" style="flex:1; margin:0 10px;">🎭 ${role ? role.name : '未分配'} | 🚫 禁止 ${bannedCount}项</span>
    <div>
        <button class="btn btn-warning btn-sm" onclick="resetUserPassword('${user.id}')">重置密码</button>
        <button class="btn btn-primary btn-sm" onclick="editUserPerm('${user.id}')">权限</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')">删除</button>
    </div>
`;
            contentDiv.appendChild(div);
        });
        container.appendChild(contentDiv);
    });
}

async function addMember() {
    var nameEl = document.getElementById('newMemberName');
    var pwdEl = document.getElementById('newMemberPwd');
    var roleSelect = document.getElementById('roleSelect');
    if (!nameEl || !pwdEl || !roleSelect) return;

    var name = nameEl.value.trim();
    var pwd = pwdEl.value.trim();
    var roleId = roleSelect.value;
    if (!name || !pwd) return showMsg('请填写完整信息');
    if (!roleId) return showMsg('请选择角色');

    var checkResult = await supabase
        .from('users')
        .select('username')
        .eq('username', name);

    if (checkResult.error) {
        console.error('❌ 检查用户失败:', checkResult.error);
    } else if (checkResult.data && checkResult.data.length > 0) {
        return showMsg('❌ 用户名已存在');
    }

    var selectedRole = permissionData.roles.find(function(r) { return r.id === roleId; });
    if (!selectedRole) return showMsg('❌ 角色不存在');
    var roleName = selectedRole.name;

    var passwordHash = pwd;
    if (typeof bcrypt !== 'undefined' && bcrypt.hashSync) {
        passwordHash = bcrypt.hashSync(pwd, 10);
    }

    var result = await supabase
        .from('users')
        .insert([{
            username: name,
            email: name + '@company.com',
            password_hash: passwordHash,
            role: roleName,
            status: 'active',
            avatar_url: null
        }])
        .select();

    if (result.error) {
        console.error('❌ 创建用户失败:', result.error);
        showMsg('❌ 创建用户失败: ' + result.error.message);
        return;
    }

    if (!result.data || result.data.length === 0) {
        showMsg('❌ 创建用户失败');
        return;
    }

    var savedUser = result.data[0];

    var localUser = {
        id: savedUser.id,
        name: savedUser.username,
        password: pwd,
        roleId: roleId,
        bannedOperations: []
    };

    permissionData.users.push(localUser);
    settingsData.members.push({
        id: savedUser.id,
        name: savedUser.username,
        password: pwd,
        department: roleName,
        roleId: roleId,
        bannedOperations: []
    });

    savePermissionData();
    saveSettings();
    renderUsers();
    renderMembers();
    updateRoleSelect();

    nameEl.value = '';
    pwdEl.value = '';
    roleSelect.value = '';

    showMsg('✅ 用户添加成功！用户名: ' + savedUser.username);
    await loadAllUsersFromSupabase();
    renderUsers();
    renderMembers();
    updateRoleSelect();
}

async function deleteUser(userId) {
    if (!confirm('确定删除该用户？')) return;

    var user = permissionData.users.find(function(u) { return u.id === userId; });
    if (user && user.name === 'admin') return showMsg('不能删除管理员账号');

    var result = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

    if (result.error) {
        console.error('❌ 删除用户失败:', result.error);
        showMsg('❌ 删除失败: ' + result.error.message);
        return;
    }

    console.log('✅ Supabase 删除成功');
    await loadAllUsersFromSupabase();
    renderUsers();
    renderMembers();
    updateRoleSelect();
    showMsg('✅ 用户已删除');
}

// ============================================================
// ===== loadAllUsersFromSupabase - 加强版 admin 处理 =====
// ============================================================
async function loadAllUsersFromSupabase() {
    try {
        // 先确保角色列表已加载
        if (permissionData.roles.length === 0) {
            await loadRolesFromSupabase();
        }

        var result = await supabase
    .from('users')
    .select('id, username, role, status, avatar_url');

        if (result.error) {
            console.error('❌ 加载用户失败:', result.error);
            // 如果加载失败，使用本地默认 admin
            fallbackCreateAdmin();
            return;
        }

        permissionData.users = [];
        settingsData.members = [];

        // 如果没有用户，创建默认 admin
        if (!result.data || result.data.length === 0) {
            console.warn('⚠️ Supabase 无用户，创建默认 admin');
            fallbackCreateAdmin();
            return;
        }

        // 检查 admin 是否存在
        var hasAdmin = false;
        for (var user of result.data) {
            if (user.username === 'admin') {
                hasAdmin = true;
                break;
            }
        }

        // 如果 admin 不存在，强制添加
        if (!hasAdmin) {
            console.warn('⚠️ admin 用户不存在，强制创建');
            // 先尝试创建到 Supabase
            var adminRole = permissionData.roles.find(function(r) { return r.name === '管理员'; });
            if (adminRole) {
                var insertResult = await supabase
                    .from('users')
                    .insert([{
                        username: 'admin',
                        email: 'admin@company.com',
                        password_hash: bcrypt.hashSync('123', 10),
                        role: '管理员',
                        status: 'active',
                        avatar_url: null
                    }])
                    .select();
                if (!insertResult.error && insertResult.data && insertResult.data.length > 0) {
                    // 重新加载
                    result = await supabase
                        .from('users')
                        .select('id, username, role, status');
                }
            }
        }

        // 重新遍历用户
        for (var user of (result.data || [])) {
    console.log('同步用户:', user.username, '角色:', user.role);
    var role = null;
    
    // ===== 关键修复：用户角色名直接匹配，不做转换 =====
    role = permissionData.roles.find(function(r) {
        return r.name === user.role;
    });

    // admin 用户特殊处理
    if (!role && user.username === 'admin') {
        role = permissionData.roles.find(function(r) { return r.name === '管理员'; });
        if (role) {
            console.log('🔧 admin 用户强制分配管理员角色');
        }
    }

    if (!role) {
        console.warn('⚠️ 未找到角色：' + user.role + '，跳过用户：' + user.username);
        continue;
    }

    permissionData.users.push({
        id: user.id,
        name: user.username,
        password: '',
        roleId: role.id,
        bannedOperations: [],
        avatar_url: user.avatar_url || ''
    });

    settingsData.members.push({
        id: user.id,
        name: user.username,
        password: '',
        department: user.role,
        roleId: role.id,
        bannedOperations: [],
        avatar_url: user.avatar_url || ''
    });
}

        // 如果同步后还是没有用户，强制创建
        if (permissionData.users.length === 0) {
            fallbackCreateAdmin();
        }

        savePermissionData();
        saveSettings();
        console.log('✅ 已同步', permissionData.users.length, '个用户');

    } catch (err) {
        console.error('❌ 加载用户异常:', err);
        fallbackCreateAdmin();
    }
}

// ===== 兜底函数：强制创建 admin =====
function fallbackCreateAdmin() {
    var adminRole = permissionData.roles.find(function(r) { return r.name === '管理员'; });
    if (!adminRole) {
        // 如果连管理员角色都没有，创建默认角色
        permissionData.roles = [
            { id: 'role_default', name: '管理员', viewPermissions: ALL_MENUS.map(function(m) { return m.key; }) }
        ];
        adminRole = permissionData.roles[0];
    }
    
    // 检查是否已有 admin
    var existing = permissionData.users.find(function(u) { return u.name === 'admin'; });
    if (!existing) {
        permissionData.users = [{
            id: 'user_default_admin',
            name: 'admin',
            password: '123',
            roleId: adminRole.id,
            bannedOperations: []
        }];
        settingsData.members = [{
            id: 'user_default_admin',
            name: 'admin',
            password: '123',
            department: '管理员',
            roleId: adminRole.id,
            bannedOperations: []
        }];
        savePermissionData();
        saveSettings();
        console.log('✅ 已创建默认 admin 用户');
    }
}

// ============================================================
// ===== 编辑用户操作权限 =====
// ============================================================
var editingUserId = null;

function editUserPerm(userId) {
    var user = permissionData.users.find(function(u) { return u.id === userId; });
    if (!user) {
        showMsg('用户不存在');
        return;
    }

    editingUserId = userId;
    var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
    document.getElementById('editUserName').textContent = user.name;
    document.getElementById('editUserRole').textContent = role ? role.name : '未分配';

    renderUserOpsContainer(user.bannedOperations || []);
    document.getElementById('editUserPermModal').style.display = 'flex';
}

function toggleSubGroupOps(checkbox) {
    var subGroup = checkbox.closest('.op-sub-group');
    if (!subGroup) return;
    var itemsContainer = subGroup.querySelector('.op-items');
    if (!itemsContainer) return;
    var subCheckboxes = itemsContainer.querySelectorAll('input[type="checkbox"]');
    subCheckboxes.forEach(function(cb) {
        cb.checked = checkbox.checked;
    });
}

function renderUserOpsContainer(bannedOps) {
    var container = document.getElementById('userOpsContainer');
    if (!container) return;
    container.innerHTML = '';

    var user = permissionData.users.find(function(u) { return u.id === editingUserId; });
    if (!user) {
        container.innerHTML = '<div class="op-empty">用户不存在</div>';
        return;
    }

    var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
    if (!role) {
        container.innerHTML = '<div class="op-empty">用户未分配角色，请先分配角色</div>';
        return;
    }

    if (!role.viewPermissions || role.viewPermissions.length === 0) {
        container.innerHTML = '<div class="op-empty">角色没有查看权限，请先配置角色权限</div>';
        return;
    }

    for (var moduleKey in OPERATION_PERMISSIONS) {
        var moduleData = OPERATION_PERMISSIONS[moduleKey];
        var subKeys = Object.keys(moduleData.subModules);
        var hasAnyView = subKeys.some(function(subKey) {
            return role.viewPermissions.includes(subKey);
        });
        if (!hasAnyView) continue;

        var moduleDiv = document.createElement('div');
        moduleDiv.className = 'op-module-group';
        moduleDiv.innerHTML = '<div class="op-module-title">📁 ' + moduleData.label + '</div>';

        var subHtml = '';
        for (var subKey in moduleData.subModules) {
            if (!role.viewPermissions.includes(subKey)) continue;
            var subData = moduleData.subModules[subKey];
            if (!subData.operations || subData.operations.length === 0) continue;

            var opsHtml = '';
            subData.operations.forEach(function(op) {
                var opKey = moduleKey + '_' + subKey + '_' + op.key;
                var checked = bannedOps && bannedOps.indexOf(opKey) !== -1 ? 'checked' : '';
                opsHtml += '<label><input type="checkbox" value="' + opKey + '" ' + checked + '> ' + op.label + '</label>';
            });

            var allChecked = subData.operations.every(function(op) {
                var opKey = moduleKey + '_' + subKey + '_' + op.key;
                return bannedOps && bannedOps.indexOf(opKey) !== -1;
            });

            subHtml += '<div class="op-sub-group">';
            subHtml += '<div class="op-sub-title">';
            subHtml += '<label><input type="checkbox" data-subgroup="' + moduleKey + '_' + subKey + '" ' + (allChecked ? 'checked' : '') + ' onchange="toggleSubGroupOps(this)"> └─ ' + subData.label + '</label>';
            subHtml += '</div>';
            subHtml += '<div class="op-items" data-subgroup="' + moduleKey + '_' + subKey + '">' + opsHtml + '</div>';
            subHtml += '</div>';
        }

        if (subHtml) {
            moduleDiv.innerHTML += subHtml;
            container.appendChild(moduleDiv);
        }
    }

    if (container.innerHTML === '') {
        container.innerHTML = '<div class="op-empty">该角色没有可操作的功能</div>';
    }
}

function closeEditUserPermModal() {
    document.getElementById('editUserPermModal').style.display = 'none';
    editingUserId = null;
}

function saveUserPermissions() {
    var checkboxes = document.querySelectorAll('#userOpsContainer input:checked');
    var bannedOperations = Array.from(checkboxes).map(function(cb) { return cb.value; });

    var user = permissionData.users.find(function(u) { return u.id === editingUserId; });
    if (user) {
        user.bannedOperations = bannedOperations;
        savePermissionData();
    }
    var member = settingsData.members.find(function(m) { return m.id === editingUserId; });
    if (member) {
        member.bannedOperations = bannedOperations;
        saveSettings();
    }
    renderUsers();
    closeEditUserPermModal();
    showMsg('✅ 权限已更新');
}

// ============================================================
// ===== renderMembers =====
// ============================================================
function renderMembers() {
    var container = document.getElementById('memberList') || document.getElementById('userList');
    if (!container) {
        console.warn('⚠️ memberList 或 userList 容器不存在');
        return;
    }

    if (container.tagName === 'TBODY') {
        renderMemberTable(container);
    } else {
        renderMemberCards(container);
    }
}

function renderMemberTable(tbody) {
    if (!tbody) return;
    tbody.innerHTML = '';
    permissionData.users.forEach(function(user) {
        var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
        var member = settingsData.members.find(function(m) { return m.id === user.id; });
        var tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${member && member.department ? member.department : '-'}</td>
            <td>${role ? role.name : '未分配'}</td>
            <td>${user.bannedOperations ? user.bannedOperations.length : 0}项</td>
            <td>
                <button class="btn btn-sm btn-primary" data-module="settings" data-op="editUserPerm" onclick="editUserPerm('${user.id}')">权限</button>
                <button class="btn btn-sm btn-danger" data-module="settings" data-op="deleteUser" onclick="deleteUser('${user.id}')">删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMemberCards(container) {
    if (!container) return;
    container.innerHTML = '';
    permissionData.users.forEach(function(user) {
        var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
        var member = settingsData.members.find(function(m) { return m.id === user.id; });
        var div = document.createElement('div');
        div.className = 'user-card';
        div.innerHTML = `
            <span class="user-name">${user.name}</span>
            <span class="user-info">🏢 ${member && member.department ? member.department : '未分配'} | 🎭 ${role ? role.name : '未分配'}</span>
            <div>
                <button class="btn btn-primary btn-sm" data-module="settings" data-op="editUserPerm" onclick="editUserPerm('${user.id}')">权限</button>
                <button class="btn btn-danger btn-sm" data-module="settings" data-op="deleteUser" onclick="deleteUser('${user.id}')">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// ============================================================
// ===== 数据管理 =====
// ============================================================
function backupData() {
    try {
        var data = JSON.stringify({
            goods: window.allGoods || [],
            stockIn: window.allStockInList || [],
            stockOut: window.allStockOut || [],
            returnGoods: window.allReturnGoods || [],
            settings: settingsData,
            permissionData: permissionData
        }, null, 2);
        var blob = new Blob([data], {type: 'application/json'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'ERP_备份_' + new Date().toISOString().slice(0,10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMsg('✅ 数据备份成功！');
    } catch(e) {
        showMsg('❌ 备份失败：' + e.message);
    }
}

function importData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            try {
                var data = JSON.parse(ev.target.result);
                if (data.goods) { window.allGoods = data.goods; }
                if (data.stockIn) { window.allStockInList = data.stockIn; }
                if (data.stockOut) { window.allStockOut = data.stockOut; }
                if (data.returnGoods) { window.allReturnGoods = data.returnGoods; }
                if (data.settings) { settingsData = data.settings; saveSettings(); }
                if (data.permissionData) { permissionData = data.permissionData; savePermissionData(); }
                showMsg('✅ 数据导入成功！请刷新页面查看');
                setTimeout(function() { location.reload(); }, 1500);
            } catch(err) {
                showMsg('❌ 导入失败：文件格式错误');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function clearAllData() {
    if (!confirm('⚠️ 清空前请确保数据已备份！确定要清空所有数据吗？')) return;
    if (!confirm('再次确认：此操作不可恢复！')) return;
    window.allGoods = [];
    window.allStockInList = [];
    window.allStockOut = [];
    window.allReturnGoods = [];
    localStorage.clear();
    showMsg('✅ 所有数据已清空');
    setTimeout(function() { location.reload(); }, 1500);
}

// ============================================================
// ===== 页面加载初始化 =====
// ============================================================
setTimeout(function() {
    if (document.getElementById('settings')) {
        initSettings();
        console.log('✅ 系统设置模块已加载（完整权限版）');
    }
}, 800);