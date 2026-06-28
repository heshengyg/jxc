// ============================================================
// ===== 全局配置 =====
// ============================================================

// 使用 var 使其成为全局变量（可以在任何 JS 文件中访问）
var SUPABASE_URL = "https://otofufnndqbhserxpayo.supabase.co";
var SUPABASE_KEY = "sb_publishable_hSCJfWIQXFi5Ft-qXq_0Qg_HzVfn5_2";

// 原有的用户数组（兼容旧登录）
var users = [{ user: 'admin', pwd: '123', name: '管理员' }];

// ============================================================
// ===== 初始化 Supabase 客户端 =====
// ============================================================

// 使用 var 定义的 SUPABASE_URL 和 SUPABASE_KEY
var supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabase = supabase;

console.log('✅ Supabase 客户端已初始化');
console.log('📡 连接地址:', SUPABASE_URL);

// ============================================================
// ===== 以下是你原有的 OPERATION_PERMISSIONS 定义 =====
// ============================================================

var OPERATION_PERMISSIONS = {
    goods: {
        label: '商品管理',
        operations: [
            { key: 'add', label: '新增商品' },
            { key: 'import', label: '批量导入' },
            { key: 'export', label: '导出Excel' },
            { key: 'edit', label: '编辑' },
            { key: 'delete', label: '删除' },
            { key: 'batchDelete', label: '批量删除' }
        ]
    },
    stockIn: {
        label: '入库管理',
        operations: [
            { key: 'add', label: '添加入库' },
            { key: 'import', label: '批量导入入库' },
            { key: 'export', label: '导出入库记录' },
            { key: 'edit', label: '编辑' },
            { key: 'delete', label: '删除' },
            { key: 'batchDelete', label: '批量删除' }
        ]
    },
    returnGoods: {
        label: '退货管理',
        operations: [
            { key: 'add', label: '添加退货' },
            { key: 'import', label: '批量导入' },
            { key: 'export', label: '导出Excel' },
            { key: 'edit', label: '编辑' },
            { key: 'delete', label: '删除' },
            { key: 'batchDelete', label: '批量删除' }
        ]
    },
    stockOut: {
        label: '出库管理',
        operations: [
            { key: 'add', label: '添加出库' },
            { key: 'import', label: '批量导入出库' },
            { key: 'export', label: '导出出库记录' },
            { key: 'edit', label: '编辑' },
            { key: 'delete', label: '删除' },
            { key: 'batchDelete', label: '批量删除' }
        ]
    },
    stockView: {
        label: '库存查看',
        operations: [
            { key: 'export', label: '导出库存报表' },
            { key: 'refresh', label: '刷新库存' }
        ]
    },
    finance: {
        label: '财务综合管理',
        operations: [
            { key: 'taxEdit', label: '编辑税率' },
            { key: 'payAdd', label: '新增付款记录' },
            { key: 'payEdit', label: '编辑付款记录' },
            { key: 'payDelete', label: '删除付款记录' },
            { key: 'invoiceAdd', label: '新增发票返回记录' },
            { key: 'invoiceEdit', label: '编辑发票返回记录' },
            { key: 'invoiceDelete', label: '删除发票返回记录' }
        ]
    },
    settings: {
        label: '系统设置',
        operations: [
            { key: 'backup', label: '数据备份' },
            { key: 'import', label: '导入数据' },
            { key: 'clear', label: '清空数据' },
            { key: 'addDept', label: '添加部门' },
            { key: 'deleteDept', label: '删除部门' },
            { key: 'addRole', label: '新增角色' },
            { key: 'deleteRole', label: '删除角色' },
            { key: 'addUser', label: '添加用户' },
            { key: 'deleteUser', label: '删除用户' },
            { key: 'editUserPerm', label: '编辑用户权限' }
        ]
    }
};

// 生成所有操作的扁平列表（用于权限配置弹窗）
function getAllOperations() {
    var result = [];
    for (var moduleKey in OPERATION_PERMISSIONS) {
        var moduleData = OPERATION_PERMISSIONS[moduleKey];
        for (var i = 0; i < moduleData.operations.length; i++) {
            var op = moduleData.operations[i];
            result.push({
                key: moduleKey + '_' + op.key,
                module: moduleKey,
                moduleLabel: moduleData.label,
                opKey: op.key,
                label: op.label,
                fullLabel: moduleData.label + '-' + op.label
            });
        }
    }
    return result;
}

var ALL_OPERATIONS_LIST = getAllOperations();

console.log('✅ config.js 加载完成');