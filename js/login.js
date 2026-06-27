function login() {
    let u = document.getElementById('username').value.trim();
    let p = document.getElementById('password').value.trim();
    if (!users.find(x => x.user === u && x.pwd === p)) {
        showMsg('账号密码错误');
        return;
    }
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('mainBox').style.display = 'block';
    document.getElementById('roleText').innerText = users[0].name;
    loadGoods();
}

function logout() {
    document.getElementById('loginBox').style.display = 'block';
    document.getElementById('mainBox').style.display = 'none';
}

// 在 login.js 中添加
function checkAdmin() {
    const role = localStorage.getItem('userRole');
    const settingsTab = document.getElementById('settingsTab');
    if (role === '管理员') {
        settingsTab.style.display = 'inline-block';
    } else {
        settingsTab.style.display = 'none';
    }
}