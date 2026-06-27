// ===================== ERP 系统设置 =====================
let settingsData = {
    companyName: '',
    departments: [],
    members: [],
    permissions: {}
};

// 加载设置
function loadSettings() {
    // 从 localStorage 或后端加载
    const saved = localStorage.getItem('erp_settings');
    if (saved) {
        settingsData = JSON.parse(saved);
    }
    renderSettings();
}

// 渲染设置页面
function renderSettings() {
    // 公司名称
    document.getElementById('companyName').value = settingsData.companyName || '';
    // 部门列表
    renderDepartments();
    // 成员列表
    renderMembers();
    // 权限列表
    renderPermissions();
}

// ===== 部门管理 =====
function renderDepartments() {
    const container = document.getElementById('departmentList');
    container.innerHTML = '';
    settingsData.departments.forEach((dept, index) => {
        const div = document.createElement('div');
        div.className = 'dept-item';
        div.innerHTML = `
            <span class="dept-name">${dept}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteDepartment(${index})">删除</button>
        `;
        container.appendChild(div);
    });
    // 更新部门下拉
    const select = document.getElementById('deptSelect');
    select.innerHTML = '<option value="">选择部门</option>';
    settingsData.departments.forEach(dept => {
        select.innerHTML += `<option value="${dept}">${dept}</option>`;
    });
}

function addDepartment() {
    const input = document.getElementById('newDeptName');
    const name = input.value.trim();
    if (!name) return alert('请输入部门名称');
    if (settingsData.departments.includes(name)) return alert('部门已存在');
    settingsData.departments.push(name);
    saveSettings();
    renderDepartments();
    input.value = '';
}

function deleteDepartment(index) {
    if (!confirm('确定删除该部门？')) return;
    settingsData.departments.splice(index, 1);
    // 同时删除该部门的成员
    settingsData.members = settingsData.members.filter(m => m.department !== settingsData.departments[index]);
    saveSettings();
    renderDepartments();
    renderMembers();
}

// ===== 成员管理 =====
function renderMembers() {
    const container = document.getElementById('memberList');
    container.innerHTML = '';
    settingsData.members.forEach((member, index) => {
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
            <span class="member-name">${member.name}</span>
            <span style="color:#888;font-size:12px;">${member.department || '未分配'}</span>
            <span style="color:#888;font-size:12px;">${member.role || '普通用户'}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteMember(${index})">删除</button>
        `;
        container.appendChild(div);
    });
}

function addMember() {
    const name = document.getElementById('newMemberName').value.trim();
    const pwd = document.getElementById('newMemberPwd').value.trim();
    const dept = document.getElementById('deptSelect').value;
    if (!name || !pwd) return alert('请填写完整信息');
    settingsData.members.push({
        name: name,
        password: pwd,
        department: dept,
        role: '普通用户'
    });
    saveSettings();
    renderMembers();
    document.getElementById('newMemberName').value = '';
    document.getElementById('newMemberPwd').value = '';
}

function deleteMember(index) {
    if (!confirm('确定删除该成员？')) return;
    settingsData.members.splice(index, 1);
    saveSettings();
    renderMembers();
}

// ===== 数据管理 =====
function backupData() {
    const data = JSON.stringify({
        goods: allGoods || [],
        stockIn: allStockInList || [],
        stockOut: window.allStockOut || [],
        returnGoods: allReturnGoods || [],
        settings: settingsData
    }, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ERP_备份_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg('✅ 数据备份成功！');
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
                // 导入数据
                if (data.goods) { allGoods = data.goods; }
                if (data.stockIn) { allStockInList = data.stockIn; }
                if (data.stockOut) { window.allStockOut = data.stockOut; }
                if (data.returnGoods) { allReturnGoods = data.returnGoods; }
                if (data.settings) { settingsData = data.settings; }
                saveSettings();
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
    // 清空数据
    allGoods = [];
    allStockInList = [];
    window.allStockOut = [];
    allReturnGoods = [];
    localStorage.clear();
    showMsg('✅ 所有数据已清空');
    location.reload();
}

// ===== 权限管理 =====
function renderPermissions() {
    const container = document.getElementById('permissionList');
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

// ===== 保存设置 =====
function saveSettings() {
    localStorage.setItem('erp_settings', JSON.stringify(settingsData));
}

// ===== 初始化 =====
// 在页面加载时调用
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否为管理员
    const isAdmin = true; // 根据登录用户角色判断
    if (isAdmin) {
        loadSettings();
    }
});

// 选择备份路径（浏览器模拟）
function selectBackupPath() {
    showMsg('请在备份时选择保存位置');
}