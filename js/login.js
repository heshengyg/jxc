// ============================================================
// ===== 登录模块（支持 Supabase + 本地降级） =====
// ============================================================

/**
 * 登录入口函数（保持与原有 HTML 兼容）
 * 按钮调用：onclick="login()"
 */
function login() {
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        showMsg('请输入用户名和密码');
        return;
    }
    
    // 优先尝试 Supabase 登录
    loginWithSupabase(username, password);
}

/**
 * Supabase 登录
 */
async function loginWithSupabase(username, password) {
    try {
        console.log('🔍 开始 Supabase 登录:', username);
        
        // 1. 查询用户
        var result = await supabase
            .from('users')
            .select('id, username, password_hash, role, status, avatar_url')
            .eq('username', username);
        
        console.log('📊 查询结果:', result);
        
        // 检查是否有错误
        if (result.error) {
            console.error('❌ 查询错误:', result.error);
            loginLocal(username, password);
            return;
        }
        
        // 检查是否有数据
        if (!result.data || result.data.length === 0) {
            console.warn('⚠️ 用户不存在');
            loginLocal(username, password);
            return;
        }
        
        var user = result.data[0]; // 取第一个用户
        console.log('📊 找到用户:', user.username, '角色:', user.role);
        
        // 检查用户状态
        if (user.status !== 'active') {
            console.warn('⚠️ 用户未激活');
            showMsg('账号已被禁用');
            return;
        }
        
        // 2. 验证密码（使用 verifyPassword）
        console.log('🔑 验证密码...');
        var isValid = verifyPassword(password, user.password_hash);
        console.log('🔑 验证结果:', isValid);
        
        if (!isValid) {
            console.warn('❌ 密码错误');
            showMsg('账号密码错误');
            return;
        }
        
        // 3. ✅ 登录成功！
        console.log('✅ 登录成功！');
        
        // 4. 获取用户权限
        var permResult = await supabase
            .from('role_permissions')
            .select('menu_key, can_view, can_add, can_edit, can_delete')
            .eq('role', user.role);
        
        var permissions = permResult.data || [];
        console.log('📊 权限数量:', permissions.length);
        
        // 5. 保存用户信息
        var userData = {
            id: user.id,
            name: user.username,
            role: user.role,
            avatar_url: user.avatar_url,
            permissions: permissions,
            fromSupabase: true
        };
        sessionStorage.setItem('supabase_user', JSON.stringify(userData));
        
        // 6. 同步到本地权限系统
        syncUserToLocalSystem(user, permissions);
        
        // 7. 设置当前用户
        if (typeof setCurrentUser === 'function') {
            setCurrentUser(user.id);
        }
        
        // 8. 显示主界面
        document.getElementById('loginBox').style.display = 'none';
        document.getElementById('mainBox').style.display = 'block';
        
        var roleTextEl = document.getElementById('roleText');
        if (roleTextEl) {
            roleTextEl.innerText = user.username;
        }
        
        // 9. 加载数据
        if (typeof loadGoods === 'function') {
            loadGoods();
        }
        
        showMsg('✅ 登录成功！欢迎 ' + user.username);
        
    } catch (err) {
        console.error('❌ 登录异常:', err);
        loginLocal(username, password);
    }
}


/**
 * 将 Supabase 用户同步到本地权限系统
 */
function syncUserToLocalSystem(user, permissions) {
    try {
        // 检查是否已存在
        var existingUser = permissionData.users.find(function(u) {
            return u.id === user.id;
        });
        
        if (existingUser) {
            // 更新已有用户信息
            existingUser.name = user.username;
            existingUser.roleId = 'supabase_' + user.role;
            return;
        }
        
        // 创建对应的角色（如果不存在）
        var roleId = 'supabase_' + user.role;
        var existingRole = permissionData.roles.find(function(r) {
            return r.id === roleId;
        });
        
        if (!existingRole) {
            // 从 permissions 构建菜单权限
            var viewPermissions = [];
            if (permissions && permissions.length > 0) {
                viewPermissions = permissions
                    .filter(function(p) { return p.can_view; })
                    .map(function(p) { return p.menu_key; });
            } else {
                // 默认权限
                if (user.role === 'admin') {
                    viewPermissions = ['goods', 'stockIn', 'returnGoods', 'stockOut', 'stockView', 'finance', 'settings'];
                } else if (user.role === 'manager') {
                    viewPermissions = ['goods', 'stockIn', 'stockOut', 'stockView', 'finance'];
                } else {
                    viewPermissions = ['goods', 'stockView'];
                }
            }
            
            var roleNameMap = {
                'admin': '管理员',
                'manager': '经理',
                'user': '普通用户'
            };
            
            permissionData.roles.push({
                id: roleId,
                name: roleNameMap[user.role] || user.role,
                viewPermissions: viewPermissions
            });
        }
        
        // 添加到用户列表
        permissionData.users.push({
            id: user.id,
            name: user.username,
            password: '', // 不存密码
            roleId: roleId,
            bannedOperations: [],
            fromSupabase: true
        });
        
        // 同步到 settingsData.members
        var existingMember = settingsData.members.find(function(m) {
            return m.id === user.id;
        });
        if (!existingMember) {
            settingsData.members.push({
                id: user.id,
                name: user.username,
                password: '',
                department: '',
                roleId: roleId,
                bannedOperations: []
            });
        }
        
        // 保存
        savePermissionData();
        saveSettings();
        
        console.log('✅ 用户已同步到本地权限系统:', user.username);
        
    } catch (err) {
        console.error('同步用户到本地系统失败:', err);
    }
}

/**
 * 本地登录（降级方案，保留原有逻辑）
 */
function loginLocal(username, password) {
    // 使用 config.js 中的 users 数组
    var found = users.find(function(x) {
        return x.user === username && x.pwd === password;
    });
    
    if (!found) {
        showMsg('账号密码错误');
        return;
    }
    
    // 本地登录成功
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('mainBox').style.display = 'block';
    
    var roleTextEl = document.getElementById('roleText');
    if (roleTextEl) {
        roleTextEl.innerText = found.name || username;
    }
    
    if (typeof loadGoods === 'function') {
        loadGoods();
    }
    
    console.log('✅ 本地登录成功:', username);
}

/**
 * 登出函数
 */
function logout() {
    // 清除 Supabase session
    sessionStorage.removeItem('supabase_user');
    sessionStorage.removeItem('user');
    
    // 显示登录界面
    document.getElementById('loginBox').style.display = 'block';
    document.getElementById('mainBox').style.display = 'none';
    
    console.log('✅ 已登出');
}

// ============================================================
// ===== 页面加载时检查是否已登录 =====
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // 检查 sessionStorage 中是否有用户信息
    var savedUser = sessionStorage.getItem('supabase_user');
    if (savedUser) {
        try {
            var user = JSON.parse(savedUser);
            console.log('🔄 检测到已登录用户:', user.name);
            // 自动登录
            document.getElementById('loginBox').style.display = 'none';
            document.getElementById('mainBox').style.display = 'block';
            if (document.getElementById('roleText')) {
                document.getElementById('roleText').innerText = user.name;
            }
            if (typeof loadGoods === 'function') {
                loadGoods();
            }
        } catch (e) {
            console.warn('恢复登录状态失败:', e);
        }
    }
});

console.log('✅ login.js 加载完成');