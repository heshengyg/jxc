// ===================== ERP 系统设置（轻量版） =====================
let settingsData = {
    companyName: '',
    departments: ['管理员', '商品部', '库管员', '财务部', 'APP部'],
    members: [],
    permissions: {}
};

// ===== 初始化设置页面 =====
function initSettingsPage() {
    console.log('加载设置页面...');
    loadSettings();
    renderSettings();
    // 管理员显示设置Tab
    const settingsTab = document.getElementById('settingsTab');
    if (settingsTab) {
        settingsTab.style.display = 'inline-block';
    }
}

// 加载设置
function loadSettings() {
    try {
        const saved = localStorage.getItem('erp_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            settingsData = parsed;
        }
    } catch(e) {
        console.warn('加载设置失败，使用默认配置');
    }
}

// 渲染设置页面
function renderSettings() {
    const companyNameEl = document.getElementById('companyName');
    if (companyNameEl) {
        companyNameEl.value = settingsData.companyName || '';
    }
    renderDepartments();
    renderMembers();
    renderPermissions();
}

// 保存设置
function saveSettings() {
    try {
        localStorage.setItem('erp_settings', JSON.stringify(settingsData));
    } catch(e) {
        console.warn('保存设置失败');
    }
}

// ===== 部门管理 =====
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
    showMsg('部门添加成功');
}

function deleteDepartment(index) {
    if (!confirm('确定删除该部门？')) return;
    settingsData.departments.splice(index, 1);
    saveSettings();
    renderDepartments();
    showMsg('部门已删除');
}

// ===== 成员管理 =====
function renderMembers() {
    const container = document.getElementById('memberList');
    if (!container) return;
    container.innerHTML = '';
    if (!settingsData.members) settingsData.members = [];
    settingsData.members.forEach((member, index) => {
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
            <span class="member-name">${member.name || '未知'}</span>
            <span style="color:#888;font-size:12px;">${member.department || '未分配'}</span>
            <span style="color:#888;font-size:12px;">${member.role || '普通用户'}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteMember(${index})">删除</button>
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
    if (!settingsData.members) settingsData.members = [];
    settingsData.members.push({
        name: name,
        password: pwd,
        department: dept,
        role: '普通用户'
    });
    saveSettings();
    renderMembers();
    nameEl.value = '';
    pwdEl.value = '';
    showMsg('成员添加成功');
}

function deleteMember(index) {
    if (!confirm('确定删除该成员？')) return;
    settingsData.members.splice(index, 1);
    saveSettings();
    renderMembers();
    showMsg('成员已删除');
}

function loadDeptMembers() {
    renderMembers();
}

// ===== 数据管理 =====
function backupData() {
    try {
        const data = JSON.stringify({
            goods: window.allGoods || [],
            stockIn: window.allStockInList || [],
            stockOut: window.allStockOut || [],
            returnGoods: window.allReturnGoods || [],
            settings: settingsData
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
                if (data.settings) { 
                    settingsData = data.settings;
                    saveSettings();
                }
                showMsg('✅ 数据导入成功！请刷新页面查看');
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

function selectBackupPath() {
    showMsg('请在备份时选择保存位置');
}

// ===== 权限管理 =====
function renderPermissions() {
    const container = document.getElementById('permissionList');
    if (!container) return;
    container.innerHTML = `
        <div class="permission-item">
            <span>管理员</span>
            <span style="color:#ff4d4f;">全部权限</span>
        </div>
        <div class="permission-item">
            <span>商品部</span>
            <span>商品管理（查看、新增、编辑、删除、导入导出）</span>
        </div>
        <div class="permission-item">
            <span>库管员</span>
            <span>入库管理、出库管理（查看、新增、编辑、删除）</span>
        </div>
        <div class="permission-item">
            <span>财务部</span>
            <span>财务综合管理（查看、录入、编辑、删除）</span>
        </div>
        <div class="permission-item">
            <span>APP部</span>
            <span>退货管理、库存查看（查看、新增）</span>
        </div>
    `;
}

// ===== 页面加载完成后初始化 =====
// 使用 setTimeout 延迟初始化，避免阻塞主页面加载
setTimeout(function() {
    // 检查设置页面是否存在
    if (document.getElementById('settings')) {
        // 先加载保存的数据
        loadSettings();
        // 然后渲染
        renderSettings();
        // 管理员显示设置Tab
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab) {
            settingsTab.style.display = 'inline-block';
        }
        console.log('✅ 系统设置模块已加载');
    }
}, 1000);