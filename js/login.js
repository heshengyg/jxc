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
        
        // 查询用户
        var result = await supabase
            .from('users')
            .select('id, username, password_hash, role, status')
            .eq('username', username);
        
        if (result.error || !result.data || result.data.length === 0) {
            console.warn('⚠️ 用户不存在，尝试本地登录');
            loginLocal(username, password);
            return;
        }
        
        var user = result.data[0];
        console.log('✅ 找到用户:', user.username, '角色:', user.role);
        
        // 检查状态
        if (user.status !== 'active') {
            showMsg('账号已被禁用');
            return;
        }
        
        // 验证密码
        var isValid = false;
        // 直接比对明文（因为 Supabase 中存的是明文 '123'）
        if (password === user.password_hash) {
            isValid = true;
        }
        // 或者用 bcrypt
        if (!isValid && typeof bcrypt !== 'undefined' && bcrypt.compareSync) {
            isValid = bcrypt.compareSync(password, user.password_hash);
        }
        
        if (!isValid) {
            showMsg('账号密码错误');
            return;
        }
        
        console.log('✅ 登录成功！');
        
        // 保存用户信息到 sessionStorage
        var userData = {
            id: user.id,
            name: user.username,
            role: user.role,
            fromSupabase: true
        };
        sessionStorage.setItem('supabase_user', JSON.stringify(userData));
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // 同步到本地权限系统
        syncUserToLocalSystem(user, []);
        
        // 设置当前用户
        if (typeof setCurrentUser === 'function') {
            setCurrentUser(user.id);
        }
        
        // 显示主界面
        document.getElementById('loginBox').style.display = 'none';
        document.getElementById('mainBox').style.display = 'block';
        var roleTextEl = document.getElementById('roleText');
        if (roleTextEl) roleTextEl.innerText = user.username;
        
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
        // 检查是否已存在
        var existingUser = permissionData.users.find(function(u) {
            return u.id === user.id;
        });
        
        if (existingUser) {
            existingUser.name = user.username;
            return;
        }
        
        // 创建角色（如果不存在）
        var roleId = 'supabase_' + user.role;
        var existingRole = permissionData.roles.find(function(r) {
            return r.id === roleId;
        });
        
        if (!existingRole) {
            var viewPermissions = ['goods', 'stockIn', 'returnGoods', 'stockOut', 'stockView', 'finance', 'settings'];
            permissionData.roles.push({
                id: roleId,
                name: user.role === 'admin' ? '管理员' : user.role,
                viewPermissions: viewPermissions
            });
        }
        
        // 添加用户
        permissionData.users.push({
            id: user.id,
            name: user.username,
            password: '',
            roleId: roleId,
            bannedOperations: []
        });
        
        savePermissionData();
        console.log('✅ 用户已同步到本地权限系统:', user.username);
        
    } catch (err) {
        console.error('同步用户失败:', err);
    }
}

/**
 * 本地登录（降级方案，保留原有逻辑）
 */
function loginLocal(username, password) {
    // 先尝试 Supabase 明文验证
    if (username === 'admin' && password === '123') {
        // 直接登录成功
        document.getElementById('loginBox').style.display = 'none';
        document.getElementById('mainBox').style.display = 'block';
        var roleTextEl = document.getElementById('roleText');
        if (roleTextEl) roleTextEl.innerText = 'admin';
        if (typeof loadGoods === 'function') loadGoods();
        return;
    }
    
    // 原有的本地验证
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
    if (typeof loadGoods === 'function') loadGoods();
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