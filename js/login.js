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
        console.log('🔍 Supabase 登录:', username);
        
        var result = await supabase
            .from('users')
            .select('id, username, password_hash, role, status, avatar_url')
            .eq('username', username);
        
        if (result.error || !result.data || result.data.length === 0) {
            console.warn('⚠️ 用户不存在，尝试本地登录');
            loginLocal(username, password);
            return;
        }
        
        var user = result.data[0];
        console.log('✅ 找到用户:', user.username, '角色:', user.role);
        
        // ===== 🔥 新增：强制 admin 用户角色为"管理员" =====
        if (user.username === 'admin') {
            user.role = '管理员';
            console.log('🔧 admin 用户强制修正角色为: 管理员');
        }
        
        if (user.status !== 'active') {
            showMsg('账号已被禁用');
            return;
        }
        
        // 验证密码
        var isValid = false;
        if (password === user.password_hash) {
            isValid = true;
        }
        if (!isValid && typeof bcrypt !== 'undefined' && bcrypt.compareSync) {
            isValid = bcrypt.compareSync(password, user.password_hash);
        }
        
        if (!isValid) {
            showMsg('账号密码错误');
            return;
        }
        
        console.log('✅ 登录成功！');

// 保存用户信息
var userData = {
    id: user.id,
    name: user.username,
    role: '管理员',  // ← 强制设置为"管理员"
    avatar_url: user.avatar_url || '',
    fromSupabase: true
};
sessionStorage.setItem('supabase_user', JSON.stringify(userData));
sessionStorage.setItem('user', JSON.stringify(userData));

// 同步到本地权限系统
syncUserToLocalSystem(user, []);

// ===== 加载角色和用户（确保 permissionData.users 有数据） =====
if (typeof loadRolesFromSupabase === 'function') {
    await loadRolesFromSupabase();
} else {
    console.warn('⚠️ loadRolesFromSupabase 未定义，跳过');
}
if (typeof loadAllUsersFromSupabase === 'function') {
    await loadAllUsersFromSupabase();
} else {
    console.warn('⚠️ loadAllUsersFromSupabase 未定义，跳过');
}

// ===== 关键修复：使用 Supabase 用户 ID，不是 user_1 =====
if (typeof setCurrentUser === 'function') {
    setCurrentUser(user.id);
    console.log('✅ 使用 Supabase 用户权限，用户ID:', user.id);
} else {
    console.warn('⚠️ setCurrentUser 未定义');
}

// 显示主界面
document.getElementById('loginBox').style.display = 'none';
document.getElementById('mainBox').style.display = 'block';

var roleTextEl = document.getElementById('roleText');
var userNameTextEl = document.getElementById('userNameText');

if (roleTextEl) {
    roleTextEl.innerText = user.role || '管理员';
}
if (userNameTextEl) {
    userNameTextEl.innerText = user.username;
}

// 加载头像
var avatarImg = document.getElementById('userAvatar');
if (avatarImg) {
    avatarImg.src = user.avatar_url || './images/logo.png';
}

if (typeof loadGoods === 'function') loadGoods();
showMsg('✅ 登录成功！');
        
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
        // ===== 检查 permissionData 是否存在 =====
        if (typeof permissionData === 'undefined') {
            console.warn('⚠️ permissionData 未定义，等待初始化');
            setTimeout(function() {
                syncUserToLocalSystem(user, permissions);
            }, 500);
            return;
        }
        
        var existingUser = permissionData.users.find(function(u) {
            return u.id === user.id;
        });
        
        if (existingUser) {
            existingUser.name = user.username;
            savePermissionData();
            console.log('✅ 用户已存在，更新名称:', user.username);
            return;
        }
        
        // ===== 关键修复：使用用户实际角色名 =====
        var roleName = user.role || '用户';
        
        // 查找角色
        var role = permissionData.roles.find(function(r) {
            return r.name === roleName;
        });
        
        // 如果角色不存在，创建它
        if (!role) {
            var allKeys = ALL_MENUS ? ALL_MENUS.map(function(m) { return m.key; }) : [];
            var newRole = {
                id: 'role_' + Date.now(),
                name: roleName,
                viewPermissions: allKeys
            };
            permissionData.roles.push(newRole);
            role = newRole;
            console.log('✅ 创建角色:', roleName);
        }
        
        // 添加用户
        permissionData.users.push({
            id: user.id,
            name: user.username,
            password: '',
            roleId: role.id,
            bannedOperations: [],
            avatar_url: user.avatar_url || ''
        });
        
        savePermissionData();
        console.log('✅ 用户已同步到本地权限系统:', user.username, '角色:', roleName);
        
    } catch (err) {
        console.error('同步用户失败:', err);
    }
}

/**
 * 本地登录（降级方案）
 */
function loginLocal(username, password) {
    // 本地验证
    var found = users.find(function(x) {
        return x.user === username && x.pwd === password;
    });
    if (!found) {
        showMsg('账号密码错误');
        return;
    }
    
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('mainBox').style.display = 'block';
    var roleTextEl = document.getElementById('roleText');
    if (roleTextEl) roleTextEl.innerText = found.name || username;
    
    // ===== 本地登录也设置权限 =====
    if (typeof setCurrentUser === 'function') {
        setCurrentUser('user_1');
    }
    
    if (typeof loadGoods === 'function') loadGoods();
}

/**
 * 登出函数
 */
function logout() {
    // 清除 sessionStorage
    sessionStorage.removeItem('supabase_user');
    sessionStorage.removeItem('user');
    
    // 重置当前用户
    currentUserId = null;
    
    // 显示登录界面，隐藏主界面
    document.getElementById('loginBox').style.display = 'block';
    document.getElementById('mainBox').style.display = 'none';
    
    // 重置页面状态：隐藏所有子Tab内容
    document.querySelectorAll('.tab-content').forEach(function(el) {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    
    // 重置所有按钮状态
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.remove('active');
        btn.style.display = 'inline-block';
    });
    
    // 清空表单
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    console.log('✅ 已登出');
}