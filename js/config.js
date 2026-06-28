const SUPABASE_URL = "https://otofufnndqbhserxpayo.supabase.co";
const SUPABASE_KEY = "sb_publishable_hSCJfWIQXFi5Ft-qXq_0Qg_HzVfn5_2";
const users = [{ user: 'admin', pwd: '123', name: '管理员' }];

// 在 HTML 中引入 supabase-js 后使用
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== 操作权限定义 =====================
// 每个模块下的操作按钮，用于用户级别的权限控制
const OPERATION_PERMISSIONS = {
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
    const result = [];
    for (const [moduleKey, moduleData] of Object.entries(OPERATION_PERMISSIONS)) {
        for (const op of moduleData.operations) {
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

const ALL_OPERATIONS_LIST = getAllOperations();

=========================================================
// ===== 初始化 Supabase 客户端 =====
// ============================================================

// 使用 config.js 中已有的 SUPABASE_URL 和 SUPABASE_KEY
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 将 supabase 暴露为全局变量，供其他 JS 文件使用
window.supabase = supabase;

console.log('✅ Supabase 客户端已初始化');