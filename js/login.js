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
    .select('id, username, password_hash, role, status, avatar_url')
    .eq('username', username);
        
        if (result.error || !result.data || result.data.length === 0) {
            console.warn('⚠️ 用户不存在，尝试本地登录');
            loginLocal(username, password);
            return;
        }
        
        var user = result.data[0];
        console.log('✅ 找到用户:', user.username, '角色:', user.role);
        
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

// 保存用户信息（增加 avatar_url）
var userData = {
    id: user.id,
    name: user.username,
    role: user.role,
    avatar_url: user.avatar_url || '',
    fromSupabase: true
};
sessionStorage.setItem('supabase_user', JSON.stringify(userData));
sessionStorage.setItem('user', JSON.stringify(userData));

// 显示主界面
document.getElementById('loginBox').style.display = 'none';
document.getElementById('mainBox').style.display = 'block';

// 设置欢迎语：角色名 + 用户名
var roleTextEl = document.getElementById('roleText');
var userNameTextEl = document.getElementById('userNameText');
if (roleTextEl) {
    roleTextEl.innerText = user.role || '用户';
}
if (userNameTextEl) {
    userNameTextEl.innerText = user.username;
}

// 加载头像（默认 logo.png）
var avatarImg = document.getElementById('userAvatar');
if (avatarImg) {
    avatarImg.src = user.avatar_url || './images/logo.png';
}

// 关键：原有权限逻辑保持不变（setCurrentUser 调用）
if (typeof setCurrentUser === 'function') {
    setCurrentUser(user.id);
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
        var existingUser = permissionData.users.find(function(u) {
            return u.id === user.id;
        });
        
        if (existingUser) {
            existingUser.name = user.username;
            savePermissionData();
            console.log('✅ 用户已存在，更新名称:', user.username);
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
            console.log('✅ 创建角色:', roleId);
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

// 切换密码可见性
function togglePasswordVisibility(el) {
    var pwdInput = document.getElementById('password');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        el.textContent = '🙈';
    } else {
        pwdInput.type = 'password';
        el.textContent = '👁️';
    }
}

// ========== 回车键登录支持 ==========
// 监听用户名输入框的回车事件
document.addEventListener('DOMContentLoaded', function() {
    var usernameInput = document.getElementById('username');
    var passwordInput = document.getElementById('password');
    
    function handleEnterKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            login();
        }
    }
    
    if (usernameInput) {
        usernameInput.addEventListener('keydown', handleEnterKey);
    }
    if (passwordInput) {
        passwordInput.addEventListener('keydown', handleEnterKey);
    }
});