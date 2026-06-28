// ===================== 系统设置模块 =====================
let settingsData = {
    companyName: '',
    departments: ['管理员', '商品部', '库管员', '财务部', 'APP部'],
    members: []
};

// ===== 所有菜单列表 =====
const ALL_MENUS = [
    { key: 'goods', label: '商品管理' },
    { key: 'stockIn', label: '入库管理' },
    { key: 'returnGoods', label: '退货管理' },
    { key: 'stockOut', label: '出库管理' },
    { key: 'stockView', label: '库存查看' },
    { key: 'finance', label: '财务综合管理' },
    { key: 'settings', label: '系统设置' }
];

// ===== 权限数据 =====
let permissionData = {
    roles: [],
    users: []
};

// ===== 当前登录用户 =====
let currentUserId = null;

// ===== 初始化 =====
function initSettings() {
    console.log('🔧 加载系统设置...');
    
    // 从 localStorage 加载设置
    loadSettings();
    
    // 从 localStorage 加载权限数据
    loadPermissionData();
    
    // 渲染所有
    renderAll();
    
    // 显示设置Tab（管理员可见）
    const settingsTab = document.getElementById('settingsTab');
    if (settingsTab) {
        settingsTab.style.display = 'inline-block';
    }
    
    // 绑定公司名称保存事件
    const companyNameEl = document.getElementById('companyName');
    if (companyNameEl) {
        companyNameEl.addEventListener('change', saveCompanyName);
        companyNameEl.addEventListener('blur', saveCompanyName);
    }
    
    // LOGO 预览
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
    
    console.log('✅ 系统设置模块已加载');
}

// ===== 加载/保存设置 =====
function loadSettings() {
    try {
        const saved = localStorage.getItem('erp_settings');
        if (saved) {
            settingsData = JSON.parse(saved);
        }
    } catch(e) {
        console.warn('加载设置失败，使用默认配置');
    }
}

function saveSettings() {
    try {
        localStorage.setItem('erp_settings', JSON.stringify(settingsData));
    } catch(e) {
        console.warn('保存设置失败');
    }
}

// ===== 加载/保存权限数据 =====
function loadPermissionData() {
    try {
        const saved = localStorage.getItem('permissionData');
        if (saved) {
            permissionData = JSON.parse(saved);
        } else {
            // 初始化默认数据
            initDefaultPermissionData();
        }
    } catch(e) {
        console.warn('加载权限数据失败，使用默认配置');
        initDefaultPermissionData();
    }
}

function savePermissionData() {
    try {
        localStorage.setItem('permissionData', JSON.stringify(permissionData));
    } catch(e) {
        console.warn('保存权限数据失败');
    }
}

// ===== 初始化默认权限数据 =====
function initDefaultPermissionData() {
    permissionData = {
        roles: [
            { 
                id: 'role_1', 
                name: '管理员', 
                viewPermissions: ALL_MENUS.map(m => m.key), 
                defaultOperatePermissions: ALL_MENUS.map(m => m.key) 
            },
            { 
                id: 'role_2', 
                name: '商品部', 
                viewPermissions: ['goods', 'stockView'], 
                defaultOperatePermissions: ['goods'] 
            },
            { 
                id: 'role_3', 
                name: '库管员', 
                viewPermissions: ['stockIn', 'stockOut', 'stockView'], 
                defaultOperatePermissions: ['stockIn', 'stockOut'] 
            },
            { 
                id: 'role_4', 
                name: '财务部', 
                viewPermissions: ['finance', 'stockView'], 
                defaultOperatePermissions: ['finance'] 
            },
            { 
                id: 'role_5', 
                name: 'APP部', 
                viewPermissions: ['returnGoods', 'stockView'], 
                defaultOperatePermissions: ['returnGoods'] 
            }
        ],
        users: [
            { 
                id: 'user_1', 
                name: 'admin', 
                password: '123', 
                roleId: 'role_1', 
                operatePermissions: ALL_MENUS.map(m => m.key) 
            }
        ]
    };
    savePermissionData();
}

// ===== 渲染所有 =====
function renderAll() {
    renderCompanyName();
    renderDepartments();
    renderMembers();
    renderRoles();
    renderUsers();
}

function renderCompanyName() {
    const el = document.getElementById('companyName');
    if (el) el.value = settingsData.companyName || '';
}

// ===== 切换设置子菜单 =====
function switchSettingsTab(tabKey) {
    document.querySelectorAll('.settings-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    const target = document.getElementById('sub-' + tabKey);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
    document.querySelectorAll('.settings-sub-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const targetBtn = document.querySelector(`.settings-sub-btn[data-tab="${tabKey}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

// ============================================================
// ===== 基础设置 =====
// ============================================================
function saveCompanyName() {
    const el = document.getElementById('companyName');
    if (el) {
        settingsData.companyName = el.value.trim();
        saveSettings();
        showMsg('✅ 公司名称已保存');
    }
}

// ============================================================
// ===== 数据管理 =====
// ============================================================
function selectBackupPath() {
    showMsg('请在备份时选择保存位置');
}

function backupData() {
    try {
        const data = JSON.stringify({
            goods: window.allGoods || [],
            stockIn: window.allStockInList || [],
            stockOut: window.allStockOut || [],
            returnGoods: window.allReturnGoods || [],
            settings: settingsData,
            permissionData: permissionData
        }, null, 2);
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ERP_备份_${new Date().toISOString().slice(0,10)}.json`;
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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const data = JSON.parse(ev.target.result);
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
    if (!confirm('⚠️ 清空前请确保数据已备份！\n确定要清空所有数据吗？')) return;
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
// ===== 部门管理 =====
// ============================================================
function renderDepartments() {
    const container = document.getElementById('departmentList');
    if (!container) return;
    container.innerHTML = '';
    if (!settingsData.departments) settingsData.departments = [];
    settingsData.departments.forEach((dept, index) => {
        const div = document.createElement('div');
        div.className = 'dept-item';
        div.innerHTML = `
            <span class="dept-name">${dept}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteDepartment(${index})">删除</button>
        `;
        container.appendChild(div);
    });
    updateDeptSelect();
}

function updateDeptSelect() {
    const select = document.getElementById('deptSelect');
    if (!select) return;
    select.innerHTML = '<option value="">选择部门</option>';
    if (settingsData.departments) {
        settingsData.departments.forEach(dept => {
            select.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
    }
}

function addDepartment() {
    const input = document.getElementById('newDeptName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return showMsg('请输入部门名称');
    if (!settingsData.departments) settingsData.departments = [];
    if (settingsData.departments.includes(name)) return showMsg('部门已存在');
    settingsData.departments.push(name);
    saveSettings();
    renderDepartments();
    input.value = '';
    showMsg('✅ 部门添加成功');
}

function deleteDepartment(index) {
    if (!confirm('确定删除该部门？')) return;
    const deptName = settingsData.departments[index];
    settingsData.departments.splice(index, 1);
    // 删除该部门的成员
    if (settingsData.members) {
        settingsData.members = settingsData.members.filter(m => m.department !== deptName);
    }
    saveSettings();
    renderAll();
    showMsg('✅ 部门已删除');
}

// ============================================================
// ===== 成员管理 =====
// ============================================================
function renderMembers() {
    const container = document.getElementById('memberList');
    if (!container) return;
    container.innerHTML = '';
    if (!settingsData.members) settingsData.members = [];
    settingsData.members.forEach((member, index) => {
        const role = permissionData.roles.find(r => r.id === member.roleId);
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
            <span class="member-name">${member.name || '未知'}</span>
            <span style="color:#888;font-size:12px;">部门：${member.department || '未分配'}</span>
            <span style="color:#888;font-size:12px;">角色：${role?.name || '未分配'}</span>
            <span style="color:#888;font-size:12px;">操作权限：${member.operatePermissions?.length || 0}项</span>
            <button class="btn btn-primary btn-sm" onclick="editUserPerm('${member.id}')">权限</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMember('${member.id}')">删除</button>
        `;
        container.appendChild(div);
    });
}

function addMember() {
    const nameEl = document.getElementById('newMemberName');
    const pwdEl = document.getElementById('newMemberPwd');
    const deptEl = document.getElementById('deptSelect');
    if (!nameEl || !pwdEl || !deptEl) return;
    const name = nameEl.value.trim();
    const pwd = pwdEl.value.trim();
    const dept = deptEl.value;
    if (!name || !pwd) return showMsg('请填写完整信息');
    
    // 默认分配第一个角色（非管理员）
    const defaultRole = permissionData.roles.find(r => r.name !== '管理员') || permissionData.roles[0];
    
    if (!settingsData.members) settingsData.members = [];
    const newMember = {
        id: 'user_' + Date.now(),
        name: name,
        password: pwd,
        department: dept,
        roleId: defaultRole?.id || '',
        operatePermissions: defaultRole?.defaultOperatePermissions || []
    };
    settingsData.members.push(newMember);
    
    // 同步到权限数据
    if (!permissionData.users) permissionData.users = [];
    permissionData.users.push({
        id: newMember.id,
        name: name,
        password: pwd,
        roleId: newMember.roleId,
        operatePermissions: newMember.operatePermissions
    });
    
    saveSettings();
    savePermissionData();
    renderMembers();
    renderUsers();
    nameEl.value = '';
    pwdEl.value = '';
    showMsg('✅ 成员添加成功');
}

function deleteMember(userId) {
    if (!confirm('确定删除该成员？')) return;
    settingsData.members = settingsData.members.filter(m => m.id !== userId);
    permissionData.users = permissionData.users.filter(u => u.id !== userId);
    saveSettings();
    savePermissionData();
    renderMembers();
    renderUsers();
    showMsg('✅ 成员已删除');
}

function loadDeptMembers() {
    renderMembers();
}

// ============================================================
// ===== 角色与权限 =====
// ============================================================
function renderRoles() {
    const container = document.getElementById('roleList');
    if (!container) return;
    container.innerHTML = '';
    if (!permissionData.roles) permissionData.roles = [];
    permissionData.roles.forEach((role, index) => {
        const viewMenus = role.viewPermissions.map(k => ALL_MENUS.find(m => m.key === k)?.label || k).join('、');
        const div = document.createElement('div');
        div.className = 'role-item';
        div.innerHTML = `
            <span class="role-name">${role.name}</span>
            <span style="color:#888;font-size:12px;">查看：${viewMenus || '无'}</span>
            <span style="color:#888;font-size:12px;">操作：${role.defaultOperatePermissions?.length || 0}项</span>
            <button class="btn btn-primary btn-sm" onclick="editRole('${role.id}')">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRole('${role.id}')">删除</button>
        `;
        container.appendChild(div);
    });
}

function renderUsers() {
    const container = document.getElementById('userList');
    if (!container) return;
    container.innerHTML = '';
    if (!permissionData.users) permissionData.users = [];
    permissionData.users.forEach((user, index) => {
        const role = permissionData.roles.find(r => r.id === user.roleId);
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
            <span class="user-name">${user.name}</span>
            <span style="color:#888;font-size:12px;">角色：${role?.name || '未分配'}</span>
            <span style="color:#888;font-size:12px;">操作权限：${user.operatePermissions?.length || 0}项</span>
            <button class="btn btn-primary btn-sm" onclick="editUserPerm('${user.id}')">权限</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')">删除</button>
        `;
        container.appendChild(div);
    });
}

// ===== 新增角色弹窗 =====
function openAddRoleModal() {
    // 清空表单
    document.getElementById('newRoleName').value = '';
    document.querySelectorAll('#roleViewPermissions input').forEach(cb => cb.checked = false);
    document.querySelectorAll('#roleOperatePermissions input').forEach(cb => cb.checked = false);
    document.getElementById('addRoleModal').style.display = 'flex';
}

function closeAddRoleModal() {
    document.getElementById('addRoleModal').style.display = 'none';
}

function saveRole() {
    const name = document.getElementById('newRoleName').value.trim();
    if (!name) return showMsg('请输入角色名称');
    if (permissionData.roles.some(r => r.name === name)) return showMsg('角色已存在');
    
    const viewCheckboxes = document.querySelectorAll('#roleViewPermissions input:checked');
    const viewPermissions = Array.from(viewCheckboxes).map(cb => cb.value);
    const operateCheckboxes = document.querySelectorAll('#roleOperatePermissions input:checked');
    const operatePermissions = Array.from(operateCheckboxes).map(cb => cb.value);
    
    if (viewPermissions.length === 0) return showMsg('请至少勾选一个查看权限');
    
    const newRole = {
        id: 'role_' + Date.now(),
        name: name,
        viewPermissions: viewPermissions,
        defaultOperatePermissions: operatePermissions
    };
    permissionData.roles.push(newRole);
    savePermissionData();
    renderRoles();
    closeAddRoleModal();
    showMsg('✅ 角色添加成功');
}

function deleteRole(roleId) {
    if (!confirm('确定删除该角色？')) return;
    const role = permissionData.roles.find(r => r.id === roleId);
    if (role && role.name === '管理员') return showMsg('不能删除管理员角色');
    permissionData.roles = permissionData.roles.filter(r => r.id !== roleId);
    // 清除该角色的用户
    permissionData.users = permissionData.users.filter(u => u.roleId !== roleId);
    savePermissionData();
    renderRoles();
    renderUsers();
    showMsg('✅ 角色已删除');
}

function editRole(roleId) {
    const role = permissionData.roles.find(r => r.id === roleId);
    if (!role) return;
    // 编辑功能：可以用同样的弹窗，但填充已有数据
    // 这里简化处理，直接提示
    showMsg('编辑功能开发中，请先删除后重新添加');
}

// ===== 编辑用户操作权限 =====
let editingUserId = null;

function editUserPerm(userId) {
    const user = permissionData.users.find(u => u.id === userId);
    if (!user) {
        // 可能用户只在 settingsData.members 中，同步到 permissionData
        const member = settingsData.members.find(m => m.id === userId);
        if (member) {
            if (!permissionData.users) permissionData.users = [];
            permissionData.users.push({
                id: member.id,
                name: member.name,
                password: member.password,
                roleId: member.roleId,
                operatePermissions: member.operatePermissions || []
            });
            savePermissionData();
        } else {
            return showMsg('用户不存在');
        }
    }
    
    const userData = permissionData.users.find(u => u.id === userId);
    if (!userData) return showMsg('用户不存在');
    
    editingUserId = userId;
    const role = permissionData.roles.find(r => r.id === userData.roleId);
    document.getElementById('editUserName').textContent = userData.name;
    document.getElementById('editUserRole').textContent = role?.name || '未分配';
    
    // 获取当前用户的操作权限
    const perms = userData.operatePermissions || role?.defaultOperatePermissions || [];
    document.querySelectorAll('#userOperatePermissions input').forEach(cb => {
        cb.checked = perms.includes(cb.value);
    });
    document.getElementById('editUserPermModal').style.display = 'flex';
}

function closeEditUserPermModal() {
    document.getElementById('editUserPermModal').style.display = 'none';
}

function saveUserPermissions() {
    const checkboxes = document.querySelectorAll('#userOperatePermissions input:checked');
    const operatePermissions = Array.from(checkboxes).map(cb => cb.value);
    
    // 更新 permissionData
    const user = permissionData.users.find(u => u.id === editingUserId);
    if (user) {
        user.operatePermissions = operatePermissions;
        savePermissionData();
    }
    
    // 同步更新 settingsData.members
    const member = settingsData.members.find(m => m.id === editingUserId);
    if (member) {
        member.operatePermissions = operatePermissions;
        saveSettings();
    }
    
    renderUsers();
    renderMembers();
    closeEditUserPermModal();
    showMsg('✅ 权限已更新');
}

function deleteUser(userId) {
    if (!confirm('确定删除该用户？')) return;
    permissionData.users = permissionData.users.filter(u => u.id !== userId);
    settingsData.members = settingsData.members.filter(m => m.id !== userId);
    savePermissionData();
    saveSettings();
    renderUsers();
    renderMembers();
    showMsg('✅ 用户已删除');
}

// ============================================================
// ===== 权限检查工具函数 =====
// ============================================================
function getUserPermissions(userId) {
    const user = permissionData.users.find(u => u.id === userId);
    if (!user) return { view: [], operate: [] };
    const role = permissionData.roles.find(r => r.id === user.roleId);
    if (!role) return { view: [], operate: [] };
    return {
        view: role.viewPermissions || [],
        operate: user.operatePermissions || role.defaultOperatePermissions || []
    };
}

function canUserView(userId, menuKey) {
    const perms = getUserPermissions(userId);
    return perms.view.includes(menuKey);
}

function canUserOperate(userId, menuKey) {
    const perms = getUserPermissions(userId);
    return perms.operate.includes(menuKey);
}

function updateMenusByUser(userId) {
    if (!userId) return;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (!onclick) return;
        const match = onclick.match(/switchTab\('([^']+)'\)/);
        if (!match) return;
        const key = match[1];
        const menuKeys = ['goods', 'stockIn', 'returnGoods', 'stockOut', 'stockView', 'finance', 'settings'];
        if (menuKeys.includes(key)) {
            if (canUserView(userId, key)) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        }
    });
}

// ===== 登录后调用 =====
function setCurrentUser(userId) {
    currentUserId = userId;
    updateMenusByUser(userId);
}

// ============================================================
// ===== 延迟初始化 =====
// ============================================================
setTimeout(function() {
    if (document.getElementById('settings')) {
        initSettings();
        // 默认以管理员身份登录
        setCurrentUser('user_1');
        console.log('✅ 系统设置模块已加载（完整版）');
    }
}, 800);