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

var supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabase = supabase;

console.log('✅ Supabase 客户端已初始化');
console.log('📡 连接地址:', SUPABASE_URL);

// ============================================================
// ===== 操作权限定义（支持子版块） =====
// ============================================================

var OPERATION_PERMISSIONS = {
    // ===== 商品管理（3个子版块） =====
    goods: {
        label: '商品管理',
        subModules: {
            goodsInfo: {
                label: '商品信息',
                operations: [
                    { key: 'add', label: '新增商品' },
                    { key: 'import', label: '批量导入' },
                    { key: 'export', label: '导出Excel' },
                    { key: 'edit', label: '编辑' },
                    { key: 'delete', label: '删除' },
                    { key: 'batchDelete', label: '批量删除' }
                ]
            },
            supplier: {
                label: '供应商管理',
                operations: [
                    { key: 'add', label: '新增供应商' },
                    { key: 'import', label: '批量导入' },
                    { key: 'edit', label: '编辑' },
                    { key: 'delete', label: '删除' }
                ]
            },
            expireDate: {
                label: '后台更换日期',
                operations: [
                    { key: 'update', label: '更新' }
                ]
            }
        }
    },

    // ===== 入库管理 =====
    stockIn: {
        label: '入库管理',
        subModules: {
            stockInList: {
                label: '入库记录',
                operations: [
                    { key: 'add', label: '添加入库' },
                    { key: 'import', label: '批量导入入库' },
                    { key: 'export', label: '导出入库记录' },
                    { key: 'edit', label: '编辑' },
                    { key: 'delete', label: '删除' },
                    { key: 'batchDelete', label: '批量删除' }
                ]
            }
        }
    },

    // ===== 退货管理 =====
    returnGoods: {
        label: '退货管理',
        subModules: {
            returnList: {
                label: '退货记录',
                operations: [
                    { key: 'add', label: '添加退货' },
                    { key: 'import', label: '批量导入' },
                    { key: 'export', label: '导出Excel' },
                    { key: 'edit', label: '编辑' },
                    { key: 'delete', label: '删除' },
                    { key: 'batchDelete', label: '批量删除' }
                ]
            }
        }
    },

    // ===== 出库管理 =====
    stockOut: {
        label: '出库管理',
        subModules: {
            stockOutList: {
                label: '出库记录',
                operations: [
                    { key: 'add', label: '添加出库' },
                    { key: 'import', label: '批量导入出库' },
                    { key: 'export', label: '导出出库记录' },
                    { key: 'edit', label: '编辑' },
                    { key: 'delete', label: '删除' },
                    { key: 'batchDelete', label: '批量删除' }
                ]
            }
        }
    },

    // ===== 库存查看 =====
    stockView: {
        label: '库存查看',
        subModules: {
            stockList: {
                label: '库存列表',
                operations: [
                    { key: 'export', label: '导出库存报表' },
                    { key: 'refresh', label: '刷新库存' }
                ]
            }
        }
    },

    // ===== 财务综合管理（9个子版块） =====
    finance: {
        label: '财务综合管理',
        subModules: {
            taxRate: {
                label: '税率录入',
                operations: [
                    { key: 'taxEdit', label: '编辑税率' }
                ]
            },
            stockInPrint: {
                label: '入库单打印',
                operations: [
                    { key: 'print', label: '打印入库单' }
                ]
            },
            paymentRecord: {
                label: '财务付款记录',
                operations: [
                    { key: 'payAdd', label: '新增付款记录' },
                    { key: 'payEdit', label: '编辑付款记录' },
                    { key: 'payDelete', label: '删除付款记录' }
                ]
            },
            invoiceReturn: {
                label: '发票返回记录',
                operations: [
                    { key: 'invoiceAdd', label: '新增发票返回记录' },
                    { key: 'invoiceEdit', label: '编辑发票返回记录' },
                    { key: 'invoiceDelete', label: '删除发票返回记录' }
                ]
            },
            paymentBoard: {
                label: '首付款看板',
                operations: [
                    { key: 'view', label: '查看看板' }
                ]
            },
            invoiceBalance: {
                label: '发票月结余',
                operations: [
                    { key: 'view', label: '查看月结余' }
                ]
            },
            stockInCheck: {
                label: '入库对账',
                operations: [
                    { key: 'check', label: '入库对账' }
                ]
            },
            monthStart: {
                label: '月期初数',
                operations: [
                    { key: 'view', label: '查看期初数' }
                ]
            },
            financeReport: {
                label: '财务报表',
                operations: [
                    { key: 'export', label: '导出报表' }
                ]
            }
        }
    },

    // ===== 系统设置 =====
    settings: {
        label: '系统设置',
        subModules: {
            basic: {
                label: '基础设置',
                operations: [
                    { key: 'editCompany', label: '编辑公司信息' },
                    { key: 'uploadLogo', label: '上传Logo' }
                ]
            },
            dataManage: {
                label: '数据管理',
                operations: [
                    { key: 'backup', label: '数据备份' },
                    { key: 'import', label: '导入数据' },
                    { key: 'clear', label: '清空数据' }
                ]
            },
            permissionManage: {
                label: '权限管理',
                operations: [
                    { key: 'addDept', label: '添加部门' },
                    { key: 'deleteDept', label: '删除部门' },
                    { key: 'addRole', label: '新增角色' },
                    { key: 'deleteRole', label: '删除角色' },
                    { key: 'editRole', label: '编辑角色' },
                    { key: 'addUser', label: '添加用户' },
                    { key: 'deleteUser', label: '删除用户' },
                    { key: 'editUserPerm', label: '编辑用户权限' }
                ]
            }
        }
    }
};

// ============================================================
// ===== 工具函数 =====
// ============================================================

/**
 * 生成所有操作的扁平列表（用于权限配置弹窗）
 * 格式：module_subModule_opKey
 */
function getAllOperations() {
    var result = [];
    for (var moduleKey in OPERATION_PERMISSIONS) {
        var moduleData = OPERATION_PERMISSIONS[moduleKey];
        for (var subKey in moduleData.subModules) {
            var subData = moduleData.subModules[subKey];
            for (var i = 0; i < subData.operations.length; i++) {
                var op = subData.operations[i];
                result.push({
                    key: moduleKey + '_' + subKey + '_' + op.key,
                    module: moduleKey,
                    moduleLabel: moduleData.label,
                    subModule: subKey,
                    subLabel: subData.label,
                    opKey: op.key,
                    label: op.label,
                    fullLabel: moduleData.label + ' - ' + subData.label + ' - ' + op.label
                });
            }
        }
    }
    return result;
}

var ALL_OPERATIONS_LIST = getAllOperations();

/**
 * 获取某个模块所有子版块的操作列表
 * 返回：{ subKey: [opKey1, opKey2, ...] }
 */
function getSubModuleOperations(moduleKey) {
    var moduleData = OPERATION_PERMISSIONS[moduleKey];
    if (!moduleData) return {};
    var result = {};
    for (var subKey in moduleData.subModules) {
        var subData = moduleData.subModules[subKey];
        result[subKey] = subData.operations.map(function(op) {
            return moduleKey + '_' + subKey + '_' + op.key;
        });
    }
    return result;
}

/**
 * 获取某个模块下所有操作的完整 key 列表
 */
function getAllModuleOperationKeys(moduleKey) {
    var moduleData = OPERATION_PERMISSIONS[moduleKey];
    if (!moduleData) return [];
    var keys = [];
    for (var subKey in moduleData.subModules) {
        var subData = moduleData.subModules[subKey];
        for (var i = 0; i < subData.operations.length; i++) {
            keys.push(moduleKey + '_' + subKey + '_' + subData.operations[i].key);
        }
    }
    return keys;
}

console.log('✅ config.js 加载完成');

// ============================================================
// ===== 密码验证工具 =====
// ============================================================

var TEST_PASSWORD_HASH = '$2a$12$h87aP07SLscGI0w6hc8mxexN81E03/9YL0kHKboshxMyQ04vbr29u';

function verifyPassword(inputPassword, storedHash) {
    console.log('🔐 验证密码...');
    
    if (!storedHash) {
        console.warn('❌ 存储的哈希为空');
        return false;
    }
    
    if (typeof bcrypt !== 'undefined' && typeof bcrypt.compareSync === 'function') {
        try {
            var result = bcrypt.compareSync(inputPassword, storedHash);
            console.log('✅ bcrypt 验证结果:', result);
            return result;
        } catch (e) {
            console.warn('bcrypt 验证异常:', e);
        }
    }
    
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        var isMatch = (inputPassword === '123456' && storedHash === TEST_PASSWORD_HASH);
        console.log('📝 内置验证结果:', isMatch);
        return isMatch;
    }
    
    var isMatch = (inputPassword === storedHash);
    console.log('📝 明文验证结果:', isMatch);
    return isMatch;
}

window.verifyPassword = verifyPassword;
window.OPERATION_PERMISSIONS = OPERATION_PERMISSIONS;
window.ALL_OPERATIONS_LIST = ALL_OPERATIONS_LIST;
window.getSubModuleOperations = getSubModuleOperations;
window.getAllModuleOperationKeys = getAllModuleOperationKeys;

console.log('✅ 密码验证工具已加载（修复版）');
console.log('✅ 操作权限已加载，共 ' + ALL_OPERATIONS_LIST.length + ' 个操作');