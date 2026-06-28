// ===================== 系统设置模块（完整权限版） =====================
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

// ===== 当前登录用户 =====
let currentUserId = null;

// ============================================================
// ===== Supabase 角色同步函数 =====
// ============================================================

/**
 * 从 Supabase 加载角色数据
 */
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
                return {
                    id: role.id,
                    name: role.name,
                    viewPermissions: role.view_permissions || []
                };
            });
            console.log('✅ 从 Supabase 加载了 ' + permissionData.roles.length + ' 个角色');
            return true;
        }
        return false;
    } catch (err) {
        console.error('❌ 加载角色异常:', err);
        return false;
    }
}

/**
 * 保存角色到 Supabase
 */
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
            const savedRole = result.data[0];
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

/**
 * 从 Supabase 删除角色
 */
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

/**
 * 同步角色权限到 role_permissions 表
 */
async function syncRolePermissions(roleName, viewPermissions) {
    try {
        await supabase
            .from('role_permissions')
            .delete()
            .eq('role', roleName);
        
        const permissions = viewPermissions.map(function(menuKey) {
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

/**
 * 删除角色的所有权限
 */
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
// ===== Supabase 用户同步函数 =====
// ============================================================

/**
 * 同步用户到 Supabase
 */
async function syncUserToSupabase(userData) {
    try {
        // 检查用户是否已存在
        const checkResult = await supabase
            .from('users')
            .select('id')
            .eq('username', userData.name);
        
        if (checkResult.data && checkResult.data.length > 0) {
            // 用户已存在，更新
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
        
        // 用户不存在，插入
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

/**
 * 从 Supabase 删除用户
 */
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
function initSettings() {
    loadSettings();
    loadPermissionData();
    
    loadRolesFromSupabase().then(function(success) {
        renderAll();
        if (success) {
            savePermissionData();
        }
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
    
    applyAllPermissions();
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
            { id: 'role_1', name: '管理员', viewPermissions: ALL_MENUS.map(m => m.key) },
            { id: 'role_2', name: '商品部', viewPermissions: ['goods', 'stockView'] },
            { id: 'role_3', name: '库管员', viewPermissions: ['stockIn', 'stockOut', 'stockView'] },
            { id: 'role_4', name: '财务部', viewPermissions: ['finance', 'stockView'] },
            { id: 'role_5', name: 'APP部', viewPermissions: ['returnGoods', 'stockView'] }
        ],
        users: [
            { id: 'user_1', name: 'admin', password: '123', roleId: 'role_1', bannedOperations: [] }
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
// ===== 角色管理（查看权限） =====
// ============================================================
function renderRoles() {
    const container = document.getElementById('roleList');
    if (!container) return;
    container.innerHTML = '';
    permissionData.roles.forEach(function(role) {
        const viewLabels = role.viewPermissions.map(function(k) {
            const found = ALL_MENUS.find(function(m) { return m.key === k; });
            return found ? found.label : k;
        }).join('、');
        const div = document.createElement('div');
        div.className = 'role-card';
        div.innerHTML = `
            <span class="role-name">${role.name}</span>
            <span class="role-perms">👁 ${viewLabels || '无'}</span>
            <span class="role-badge">${role.viewPermissions?.length || 0}个模块</span>
            <div>
                <button class="btn btn-primary btn-sm" data-module="settings" data-op="editRole" onclick="editRole('${role.id}')">编辑</button>
                <button class="btn btn-danger btn-sm" data-module="settings" data-op="deleteRole" onclick="deleteRole('${role.id}')">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function openAddRoleModal() {
    document.getElementById('roleNameInput').value = '';
    document.querySelectorAll('#roleViewPermissions input').forEach(cb => cb.checked = false);
    document.getElementById('addRoleModal').style.display = 'flex';
}

function closeAddRoleModal() {
    document.getElementById('addRoleModal').style.display = 'none';
}

// ===== saveRole 支持 Supabase =====
saveRole = async function() {
    const editId = document.getElementById('addRoleModal').dataset.editId;
    const name = document.getElementById('roleNameInput').value.trim();
    if (!name) return showMsg('请输入角色名称');
    
    const viewCheckboxes = document.querySelectorAll('#roleViewPermissions input:checked');
    const viewPermissions = Array.from(viewCheckboxes).map(function(cb) { return cb.value; });
    if (viewPermissions.length === 0) return showMsg('请至少勾选一个查看权限');
    
    if (editId) {
        const role = permissionData.roles.find(function(r) { return r.id === editId; });
        if (role) {
            if (role.name === '管理员') return showMsg('不能修改管理员角色');
            
            role.name = name;
            role.viewPermissions = viewPermissions;
            
            const success = await saveRoleToSupabase(role);
            if (success) {
                await syncRolePermissions(role.name, viewPermissions);
                savePermissionData();
                renderRoles();
                closeAddRoleModal();
                showMsg('✅ 角色已更新');
                delete document.getElementById('addRoleModal').dataset.editId;
            }
        }
    } else {
        if (permissionData.roles.some(function(r) { return r.name === name; })) {
            return showMsg('角色已存在');
        }
        
        const newRole = {
            id: 'role_' + Date.now(),
            name: name,
            viewPermissions: viewPermissions
        };
        
        const success = await saveRoleToSupabase(newRole);
        if (success) {
            permissionData.roles.push(newRole);
            await syncRolePermissions(newRole.name, viewPermissions);
            savePermissionData();
            renderRoles();
            closeAddRoleModal();
            showMsg('✅ 角色添加成功');
        }
    }
};

// ===== deleteRole 支持 Supabase =====
function deleteRole(roleId) {
    if (!confirm('确定删除该角色？')) return;
    const role = permissionData.roles.find(function(r) { return r.id === roleId; });
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
            showMsg('✅ 角色已删除');
        }
    });
}

function editRole(roleId) {
    const role = permissionData.roles.find(r => r.id === roleId);
    if (!role) return;
    document.getElementById('roleNameInput').value = role.name;
    document.querySelectorAll('#roleViewPermissions input').forEach(cb => {
        cb.checked = role.viewPermissions.includes(cb.value);
    });
    document.getElementById('addRoleModal').dataset.editId = roleId;
    document.getElementById('addRoleModal').style.display = 'flex';
}

// ============================================================
// ===== 用户管理（同步到 Supabase） =====
// ============================================================
function renderUsers() {
    const container = document.getElementById('userList');
    if (!container) return;
    container.innerHTML = '';
    permissionData.users.forEach((user) => {
        const role = permissionData.roles.find(r => r.id === user.roleId);
        const dept = settingsData.members.find(m => m.id === user.id)?.department || '';
        const bannedCount = user.bannedOperations?.length || 0;
        const div = document.createElement('div');
        div.className = 'user-card';
        div.innerHTML = `
            <span class="user-name">${user.name}</span>
            <span class="user-info">🏢 ${dept || '未分配'} | 🎭 ${role?.name || '未分配'} | 🚫 禁止 ${bannedCount}项</span>
            <div>
                <button class="btn btn-primary btn-sm" data-module="settings" data-op="editUserPerm" onclick="editUserPerm('${user.id}')">权限</button>
                <button class="btn btn-danger btn-sm" data-module="settings" data-op="deleteUser" onclick="deleteUser('${user.id}')">删除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// ===== addMember 同步到 Supabase =====
async function addMember() {
    const nameEl = document.getElementById('newMemberName');
    const pwdEl = document.getElementById('newMemberPwd');
    const deptEl = document.getElementById('deptSelect');
    if (!nameEl || !pwdEl || !deptEl) return;
    
    const name = nameEl.value.trim();
    const pwd = pwdEl.value.trim();
    const dept = deptEl.value;
    if (!name || !pwd) return showMsg('请填写完整信息');
    
    // 检查用户名是否已存在
    const checkResult = await supabase
        .from('users')
        .select('username')
        .eq('username', name);
    
    if (checkResult.data && checkResult.data.length > 0) {
        return showMsg('❌ 用户名已存在');
    }
    
    // 生成密码哈希
    let passwordHash = pwd;
    if (typeof bcrypt !== 'undefined' && bcrypt.hashSync) {
        passwordHash = bcrypt.hashSync(pwd, 10);
    }
    
    const defaultRole = permissionData.roles.find(function(r) { return r.name !== '管理员'; }) || permissionData.roles[0];
    
    // 插入到 Supabase
    const result = await supabase
        .from('users')
        .insert([{
            username: name,
            email: name + '@company.com',
            password_hash: passwordHash,
            role: defaultRole ? defaultRole.name : 'user',
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
    
    const savedUser = result.data[0];
    
    // 同步到本地
    const localUser = {
        id: savedUser.id,
        name: savedUser.username,
        password: pwd,
        roleId: defaultRole ? defaultRole.id : '',
        bannedOperations: []
    };
    
    permissionData.users.push(localUser);
    settingsData.members.push({
        id: savedUser.id,
        name: savedUser.username,
        password: pwd,
        department: dept,
        roleId: defaultRole ? defaultRole.id : '',
        bannedOperations: []
    });
    
    savePermissionData();
    saveSettings();
    renderUsers();
    renderMembers();
    nameEl.value = '';
    pwdEl.value = '';
    showMsg('✅ 用户添加成功！用户名: ' + savedUser.username);
}

// ===== deleteUser 支持 Supabase =====
async function deleteUser(userId) {
    if (!confirm('确定删除该用户？')) return;
    const user = permissionData.users.find(function(u) { return u.id === userId; });
    if (user && user.name === 'admin') return showMsg('不能删除管理员账号');
    
    const success = await deleteUserFromSupabase(userId);
    if (success) {
        permissionData.users = permissionData.users.filter(function(u) { return u.id !== userId; });
        settingsData.members = settingsData.members.filter(function(m) { return m.id !== userId; });
        savePermissionData();
        saveSettings();
        renderUsers();
        renderMembers();
        showMsg('✅ 用户已删除');
    }
}

// ============================================================
// ===== 编辑用户操作权限（勾选即禁止） =====
// ============================================================
let editingUserId = null;

function editUserPerm(userId) {
    const user = permissionData.users.find(u => u.id === userId);
    if (!user) return showMsg('用户不存在');
    editingUserId = userId;
    const role = permissionData.roles.find(r => r.id === user.roleId);
    document.getElementById('editUserName').textContent = user.name;
    document.getElementById('editUserRole').textContent = role?.name || '未分配';
    
    renderUserOpsContainer(user.bannedOperations || []);
    document.getElementById('editUserPermModal').style.display = 'flex';
}

function renderUserOpsContainer(bannedOps) {
    var container = document.getElementById('userOpsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    var user = permissionData.users.find(function(u) { return u.id === editingUserId; });
    var role = permissionData.roles.find(function(r) { return r.id === user?.roleId; });
    if (!role) {
        container.innerHTML = '<div class="op-empty">请先为用户分配角色</div>';
        return;
    }
    
    // 遍历所有模块
    for (var moduleKey in OPERATION_PERMISSIONS) {
        var moduleData = OPERATION_PERMISSIONS[moduleKey];
        
        // 检查该用户是否有该模块的查看权限
        if (!role.viewPermissions.includes(moduleKey)) continue;
        
        var moduleDiv = document.createElement('div');
        moduleDiv.className = 'op-module-group';
        moduleDiv.innerHTML = '<div class="op-module-title">📁 ' + moduleData.label + '</div>';
        
        var subHtml = '';
        // 遍历子版块
        for (var subKey in moduleData.subModules) {
            var subData = moduleData.subModules[subKey];
            var opsHtml = '';
            for (var i = 0; i < subData.operations.length; i++) {
                var op = subData.operations[i];
                var opKey = moduleKey + '_' + subKey + '_' + op.key;
                var checked = bannedOps && bannedOps.indexOf(opKey) !== -1 ? 'checked' : '';
                opsHtml += '<label><input type="checkbox" value="' + opKey + '" ' + checked + '> ' + op.label + '</label>';
            }
            subHtml += '<div class="op-sub-group">';
            subHtml += '<div class="op-sub-title">└─ ' + subData.label + '</div>';
            subHtml += '<div class="op-items">' + opsHtml + '</div>';
            subHtml += '</div>';
        }
        moduleDiv.innerHTML += subHtml;
        container.appendChild(moduleDiv);
    }
}

function closeEditUserPermModal() {
    document.getElementById('editUserPermModal').style.display = 'none';
    editingUserId = null;
}

function saveUserPermissions() {
    const checkboxes = document.querySelectorAll('#userOpsContainer input:checked');
    const bannedOperations = Array.from(checkboxes).map(cb => cb.value);
    
    const user = permissionData.users.find(u => u.id === editingUserId);
    if (user) {
        user.bannedOperations = bannedOperations;
        savePermissionData();
    }
    const member = settingsData.members.find(m => m.id === editingUserId);
    if (member) {
        member.bannedOperations = bannedOperations;
        saveSettings();
    }
    renderUsers();
    closeEditUserPermModal();
    showMsg('✅ 权限已更新');
}

// ============================================================
// ===== renderMembers 函数 =====
// ============================================================
function renderMembers() {
    const container = document.getElementById('memberList') || document.getElementById('userList');
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
        const role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
        const member = settingsData.members.find(function(m) { return m.id === user.id; });
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${member?.department || '-'}</td>
            <td>${role?.name || '未分配'}</td>
            <td>${user.bannedOperations?.length || 0}项</td>
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
        const role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
        const member = settingsData.members.find(function(m) { return m.id === user.id; });
        const div = document.createElement('div');
        div.className = 'user-card';
        div.innerHTML = `
            <span class="user-name">${user.name}</span>
            <span class="user-info">🏢 ${member?.department || '未分配'} | 🎭 ${role?.name || '未分配'}</span>
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
// ===== 权限检查函数 =====
// ============================================================
function getUserPermissions(userId) {
    const user = permissionData.users.find(u => u.id === userId);
    if (!user) return { view: [], banned: [] };
    const role = permissionData.roles.find(r => r.id === user.roleId);
    if (!role) return { view: [], banned: [] };
    return {
        view: role.viewPermissions || [],
        banned: user.bannedOperations || []
    };
}

function canUserView(userId, menuKey) {
    const perms = getUserPermissions(userId);
    return perms.view.includes(menuKey);
}

function canUserOperate(userId, moduleKey, operationKey) {
    var user = permissionData.users.find(function(u) { return u.id === userId; });
    if (!user) return false;
    var role = permissionData.roles.find(function(r) { return r.id === user.roleId; });
    // 管理员默认全部可操作
    if (role && role.name === '管理员') return true;
    var banned = user.bannedOperations || [];
    // 检查是否在禁用列表中
    // operationKey 格式: module_sub_op
    var fullKey = moduleKey + '_' + operationKey;
    // 检查精确匹配
    if (banned.includes(fullKey)) return false;
    // 检查是否整个子版块被禁用（如果子版块的所有操作都被禁用，也视为禁用）
    return true;
}

function setCurrentUser(userId) {
    currentUserId = userId;
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
    applyAllPermissions();
}

// ============================================================
// ===== 应用权限到页面按钮 =====
// ============================================================
function applyAllPermissions() {
    if (!currentUserId) return;
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
// ===== 页面加载初始化 =====
// ============================================================
setTimeout(function() {
    if (document.getElementById('settings')) {
        initSettings();
        // 从 sessionStorage 获取 Supabase 用户
        var saved = sessionStorage.getItem('supabase_user') || sessionStorage.getItem('user');
        if (saved) {
            try {
                var user = JSON.parse(saved);
                if (user && user.id) {
                    setCurrentUser(user.id);
                    console.log('✅ 使用 Supabase 用户:', user.name, 'ID:', user.id);
                } else {
                    setCurrentUser('user_1');
                }
            } catch(e) {
                setCurrentUser('user_1');
            }
        } else {
            setCurrentUser('user_1');
        }
        console.log('✅ 系统设置模块已加载（完整权限版）');
    }
}, 800);