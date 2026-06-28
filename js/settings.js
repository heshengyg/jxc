// ===================== 系统设置模块（优化版） =====================
let settingsData = {
    companyName: '',
    departments: ['管理员', '商品部', '库管员', '财务部', 'APP部'],
    members: []
};

const ALL_MENUS = [
    { key: 'goods', label: '商品管理' },
    { key: 'stockIn', label: '入库管理' },
    { key: 'returnGoods', label: '退货管理' },
    { key: 'stockOut', label: '出库管理' },
    { key: 'stockView', label: '库存查看' },
    { key: 'finance', label: '财务综合' },
    { key: 'settings', label: '系统设置' }
];

let permissionData = {
    roles: [],
    users: []
};

// ===== 初始化 =====
function initSettings() {
    loadSettings();
    loadPermissionData();
    renderAll();
    
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
    permissionData = {
        roles: [
            { id: 'role_1', name: '管理员', viewPermissions: ALL_MENUS.map(m => m.key), defaultOperatePermissions: ALL_MENUS.map(m => m.key) },
            { id: 'role_2', name: '商品部', viewPermissions: ['goods', 'stockView'], defaultOperatePermissions: ['goods'] },
            { id: 'role_3', name: '库管员', viewPermissions: ['stockIn', 'stockOut', 'stockView'], defaultOperatePermissions: ['stockIn', 'stockOut'] },
            { id: 'role_4', name: '财务部', viewPermissions: ['finance', 'stockView'], defaultOperatePermissions: ['finance'] },
            { id: 'role_5', name: 'APP部', viewPermissions: ['returnGoods', 'stockView'], defaultOperatePermissions: ['returnGoods'] }
        ],
        users: [
            { id: 'user_1', name: 'admin', password: '123', roleId: 'role_1', operatePermissions: ALL_MENUS.map(m => m.key) }
        ]
    };
    savePermissionData();
}

function renderAll() {
    renderCompanyName();
    renderDepartments();
    renderRoles();
    renderUsers();
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
    document.querySelectorAll('.settings-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    const target = document.getElementById('sub-' + tabKey);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
    document.querySelectorAll('.settings-sub-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.querySelector(`.settings-sub-btn[data-tab="${tabKey}"]`);
    if (targetBtn) targetBtn.classList.add('active');
}

// ============================================================
// ===== 部门管理 =====
// ============================================================
function renderDepartments() {
    const container = document.getElementById('departmentTags');
    if (!container) return;
    container.innerHTML = '';
    settingsData.departments.forEach((dept, index) => {
        const tag = document.createElement('span');
        tag.className = 'dept-tag';
        tag.innerHTML = `${dept} <span class="del" onclick="deleteDepartment(${index})">×</span>`;
        container.appendChild(tag);
    });
    updateDeptSelect();
}

function updateDeptSelect() {
    const select = document.getElementById('deptSelect');
    if (!select) return;
    select.innerHTML = '<option value="">选择部门</option>';
    settingsData.departments.forEach(dept => {
        select.innerHTML += `<option value="${dept}">${dept}</option>`;
    });
}

function addDepartment() {
    const input = document.getElementById('newDeptName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return showMsg('请输入部门名称');
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
    settingsData.members = settingsData.members.filter(m => m.department !== deptName);
    saveSettings();
    renderAll();
    showMsg('✅ 部门已删除');
}

// ============================================================
// ===== 角色管理 =====
// ============================================================
function renderRoles() {
    const container = document.getElementById('roleList');
    if (!container) return;
    container.innerHTML = '';
    permissionData.roles.forEach((role) => {
        const viewLabels = role.viewPermissions.map(k => ALL_MENUS.find(m => m.key === k)?.label || k).join('、');
        const div = document.createElement('div');
        div.className = 'role-card';
        div.innerHTML = `
            <span class="role-name">${role.name}</span>
            <span class="role-perms">👁 ${viewLabels || '无'}</span>
            <span class="role-badge">操作 ${role.defaultOperatePermissions?.length || 0}项</span>
            <div>
                <button class="btn btn-primary btn-sm" onclick="editRole('${role.id}')">编辑</button>
                <button class="btn btn-danger btn-sm" onclick="deleteRole('${role.id}')">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function openAddRoleModal() {
    document.getElementById('roleNameInput').value = '';
    document.querySelectorAll('#roleViewPermissions input').forEach(cb => cb.checked = false);
    document.querySelectorAll('#roleOperatePermissions input').forEach(cb => cb.checked = false);
    document.getElementById('addRoleModal').style.display = 'flex';
}

function closeAddRoleModal() {
    document.getElementById('addRoleModal').style.display = 'none';
}

function saveRole() {
    const name = document.getElementById('roleNameInput').value.trim();
    if (!name) return showMsg('请输入角色名称');
    if (permissionData.roles.some(r => r.name === name)) return showMsg('角色已存在');
    const viewCheckboxes = document.querySelectorAll('#roleViewPermissions input:checked');
    const viewPermissions = Array.from(viewCheckboxes).map(cb => cb.value);
    const operateCheckboxes = document.querySelectorAll('#roleOperatePermissions input:checked');
    const operatePermissions = Array.from(operateCheckboxes).map(cb => cb.value);
    if (viewPermissions.length === 0) return showMsg('请至少勾选一个查看权限');
    
    permissionData.roles.push({
        id: 'role_' + Date.now(),
        name: name,
        viewPermissions: viewPermissions,
        defaultOperatePermissions: operatePermissions
    });
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
    permissionData.users = permissionData.users.filter(u => u.roleId !== roleId);
    savePermissionData();
    renderRoles();
    renderUsers();
    showMsg('✅ 角色已删除');
}

function editRole(roleId) {
    showMsg('编辑功能：在角色列表中点击"编辑"，可修改角色的查看权限');
}

// ============================================================
// ===== 用户管理 =====
// ============================================================
function renderUsers() {
    const container = document.getElementById('userList');
    if (!container) return;
    container.innerHTML = '';
    permissionData.users.forEach((user) => {
        const role = permissionData.roles.find(r => r.id === user.roleId);
        const dept = settingsData.members.find(m => m.id === user.id)?.department || '';
        const div = document.createElement('div');
        div.className = 'user-card';
        div.innerHTML = `
            <span class="user-name">${user.name}</span>
            <span class="user-info">🏢 ${dept || '未分配'} | 🎭 ${role?.name || '未分配'} | 操作 ${user.operatePermissions?.length || 0}项</span>
            <div>
                <button class="btn btn-primary btn-sm" onclick="editUserPerm('${user.id}')">权限</button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')">删除</button>
            </div>
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
    
    const defaultRole = permissionData.roles.find(r => r.name !== '管理员') || permissionData.roles[0];
    const newUser = {
        id: 'user_' + Date.now(),
        name: name,
        password: pwd,
        roleId: defaultRole?.id || '',
        operatePermissions: defaultRole?.defaultOperatePermissions || []
    };
    
    permissionData.users.push(newUser);
    settingsData.members.push({
        id: newUser.id,
        name: name,
        password: pwd,
        department: dept,
        roleId: newUser.roleId,
        operatePermissions: newUser.operatePermissions
    });
    
    savePermissionData();
    saveSettings();
    renderUsers();
    renderMembers();
    nameEl.value = '';
    pwdEl.value = '';
    showMsg('✅ 用户添加成功');
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
// ===== 编辑用户操作权限 =====
// ============================================================
let editingUserId = null;

function editUserPerm(userId) {
    const user = permissionData.users.find(u => u.id === userId);
    if (!user) return showMsg('用户不存在');
    editingUserId = userId;
    const role = permissionData.roles.find(r => r.id === user.roleId);
    document.getElementById('editUserName').textContent = user.name;
    document.getElementById('editUserRole').textContent = role?.name || '未分配';
    
    const perms = user.operatePermissions || role?.defaultOperatePermissions || [];
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
    
    const user = permissionData.users.find(u => u.id === editingUserId);
    if (user) {
        user.operatePermissions = operatePermissions;
        savePermissionData();
    }
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

// ============================================================
// ===== 数据管理 =====
// ============================================================
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
                setTimeout(() => location.reload(), 1500);
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
    setTimeout(() => location.reload(), 1500);
}

// ============================================================
// ===== 权限检查工具 =====
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

function setCurrentUser(userId) {
    if (!userId) return;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (!onclick) return;
        const match = onclick.match(/switchTab\('([^']+)'\)/);
        if (!match) return;
        const key = match[1];
        const menuKeys = ['goods', 'stockIn', 'returnGoods', 'stockOut', 'stockView', 'finance', 'settings'];
        if (menuKeys.includes(key)) {
            btn.style.display = canUserView(userId, key) ? 'inline-block' : 'none';
        }
    });
}

// ============================================================
// ===== 页面加载初始化 =====
// ============================================================
setTimeout(function() {
    if (document.getElementById('settings')) {
        initSettings();
        setCurrentUser('user_1');
        console.log('✅ 系统设置模块已加载');
    }
}, 800);