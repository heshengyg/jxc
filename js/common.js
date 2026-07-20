// ============================================================
// ===== 头像下拉菜单（提前定义，确保全局可用） =====
// ============================================================
function toggleAvatarDropdown() {
    var dropdown = document.getElementById('avatarDropdown');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function changeAvatar() {
    var dropdown = document.getElementById('avatarDropdown');
    if (dropdown) dropdown.style.display = 'none';
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024) {
            showMsg('❌ 图片大小不能超过50KB');
            return;
        }
        var compressed = await compressImage(file, 200, 200);
        await uploadAvatar(compressed);
    };
    input.click();
}

// ===== 用户自行更改密码（需旧密码验证） =====
function resetMyPassword() {
    var dropdown = document.getElementById('avatarDropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    var saved = sessionStorage.getItem('supabase_user') || sessionStorage.getItem('user');
    if (!saved) {
        showMsg('❌ 请先登录');
        return;
    }
    var user = JSON.parse(saved);
    if (!user || !user.id) {
        showMsg('❌ 请先登录');
        return;
    }

    // 输入旧密码
    var oldPwd = prompt('请输入当前密码：');
    if (oldPwd === null) return; // 取消
    if (oldPwd.trim() === '') {
        showMsg('❌ 旧密码不能为空');
        return;
    }

    // 输入新密码
    var newPwd = prompt('请输入新密码：');
    if (newPwd === null) return;
    if (newPwd.trim() === '') {
        showMsg('❌ 新密码不能为空');
        return;
    }

    // 确认新密码
    var confirmPwd = prompt('请再次输入新密码确认：');
    if (confirmPwd === null) return;
    if (newPwd !== confirmPwd) {
        showMsg('❌ 两次密码不一致');
        return;
    }

    // 验证旧密码并更新
    try {
        supabase
            .from('users')
            .select('password_hash')
            .eq('id', user.id)
            .then(async function(result) {
                if (result.error) {
                    showMsg('❌ 获取用户信息失败');
                    return;
                }
                if (!result.data || result.data.length === 0) {
                    showMsg('❌ 用户不存在');
                    return;
                }
                var storedHash = result.data[0].password_hash;
                // 验证旧密码
                var isValid = false;
                if (typeof bcrypt !== 'undefined' && bcrypt.compareSync) {
                    isValid = bcrypt.compareSync(oldPwd, storedHash);
                } else {
                    // 降级：明文比较（不推荐）
                    isValid = (oldPwd === storedHash);
                }
                if (!isValid) {
                    showMsg('❌ 旧密码错误');
                    return;
                }

                // 加密新密码
                var newHash = newPwd;
                if (typeof bcrypt !== 'undefined' && bcrypt.hashSync) {
                    newHash = bcrypt.hashSync(newPwd, 10);
                }

                // 更新密码
                var updateResult = await supabase
                    .from('users')
                    .update({ password_hash: newHash })
                    .eq('id', user.id);

                if (updateResult.error) {
                    showMsg('❌ 密码更新失败: ' + updateResult.error.message);
                } else {
                    showMsg('✅ 密码已更改，请重新登录');
                    // 可自动退出登录让用户重新登录
                    // 但不强制，用户可手动退出
                }
            });
    } catch (err) {
        console.error('更改密码异常:', err);
        showMsg('❌ 更改密码失败: ' + err.message);
    }
}

// ===== 图片压缩 =====
function compressImage(file, maxWidth, maxHeight) {
    return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var width = img.width;
                var height = img.height;
                if (width > maxWidth) {
                    height = height * maxWidth / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = width * maxHeight / height;
                    height = maxHeight;
                }
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(function(blob) {
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ===== 上传头像到 Supabase =====
async function uploadAvatar(fileBlob) {
    try {
        var saved = sessionStorage.getItem('supabase_user') || sessionStorage.getItem('user');
        if (!saved) {
            showMsg('❌ 请先登录');
            return;
        }
        var user = JSON.parse(saved);
        if (!user || !user.id) {
            showMsg('❌ 请先登录');
            return;
        }

        var fileName = 'avatar_' + user.id + '_' + Date.now() + '.jpg';
        
        var uploadResult = await supabase
            .storage
            .from('avatars')
            .upload(fileName, fileBlob, { contentType: 'image/jpeg' });

        if (uploadResult.error) {
            console.error('上传失败:', uploadResult.error);
            showMsg('❌ 上传头像失败: ' + uploadResult.error.message);
            return;
        }

        var publicUrlResult = supabase
            .storage
            .from('avatars')
            .getPublicUrl(fileName);

        var avatarUrl = publicUrlResult.data.publicUrl;

        var updateResult = await supabase
            .from('users')
            .update({ avatar_url: avatarUrl })
            .eq('id', user.id);

        if (updateResult.error) {
            console.error('更新头像URL失败:', updateResult.error);
            showMsg('❌ 更新头像失败');
            return;
        }

        user.avatar_url = avatarUrl;
        sessionStorage.setItem('supabase_user', JSON.stringify(user));
        sessionStorage.setItem('user', JSON.stringify(user));

        var avatarImg = document.getElementById('userAvatar');
        if (avatarImg) avatarImg.src = avatarUrl;

        showMsg('✅ 头像更新成功');
    } catch (err) {
        console.error('上传异常:', err);
        showMsg('❌ 上传失败: ' + err.message);
    }
}

// ============================================================
// ===== 暴露到全局（确保 HTML onclick 可调用） =====
// ============================================================
window.toggleAvatarDropdown = toggleAvatarDropdown;
window.changeAvatar = changeAvatar;
window.resetMyPassword = resetMyPassword;
window.uploadAvatar = uploadAvatar;
window.compressImage = compressImage;

// ===================== 全局变量区（所有模块仅在此声明） 
// 退货模块
let allReturnGoods = [];
let filteredReturnGoods = [];
// 页面缓存：存储入库、出库已加载分页数据，切换不用重新请求
let pageCache = {
    stockIn: { data: null, page: 1 },
    stockOut: { data: null, page: 1 }
};
// 新增1：库存计算全局缓存（解决每行重复循环计算库存卡顿）
let stockDataCache = new Map(); 
// key格式：`supplier|goodsName`，value存储{totalStock, batchList}

// 新增2：一次性批量预计算所有商品库存，只执行1次，渲染表格直接读缓存
function refreshAllStockCache(inList, outList) {
    stockDataCache.clear();
    const uniqueKeySet = new Set();
    // 提取所有唯一供应商+商品组合
    inList.forEach(item => {
        const key = `${item.supplier}|${item.goodsName}`;
        uniqueKeySet.add(key);
    });
    // 批量计算存入缓存
    uniqueKeySet.forEach(key => {
        const [sup, gName] = key.split('|');
        stockDataCache.set(key, {
            totalStock: getTotalStockNum(sup, gName),
            batchList: getStockBatchList(sup, gName)
        });
    });
}

// 商品模块
let allGoods = [];
let filteredGoods = [];
let currentPage = 1, pageSize = 10, totalPages = 1;
let sortField = '', sortAsc = true;

// 入库模块
let allStockIn = [];
let filteredStockIn = [];
let inCurrentPage = 1, inPageSize = 10, inTotalPages = 1;
let inSortField = '', inSortAsc = true;

// ========== 新增：出库模块全局变量 ==========
let allStockOut = [];
let filteredStockOut = [];
let outCurrentPage = 1, outPageSize = 10, outTotalPages = 1;
let outSortField = '', outSortAsc = true;

// 公共通用变量
const shelfToExpireDays = [
    { shelf: 1, expire: 1 },{ shelf: 7, expire: 2 },{ shelf: 15, expire: 4 },
    { shelf: 30, expire: 5 },{ shelf: 90, expire: 10 },{ shelf: 180, expire: 15 },
    { shelf: 365, expire: 20 },{ shelf: 730, expire: 45 },
    { shelf: 1095, expire: 50 },  // 3年 → 50天
    { shelf: 1460, expire: 60 },  // 4年 → 60天
    { shelf: 1825, expire: 70 }   // 5年 → 70天
];
let currSupplierList = [];
let currGoodsList = [];

// ===================== 公共工具函数（全项目通用） =====================
function formatMoney(num) {
    if (isNaN(num) || num === null || num === undefined) return '￥0.00';
    return '￥' + Number(num).toFixed(2);
}

function calculateExpireDays(shelfLifeNum, shelfLifeUnit) {
    if (!shelfLifeNum || !shelfLifeUnit) return '';
    let shelfDays = 0;
    switch (shelfLifeUnit) {
        case '天': shelfDays = shelfLifeNum * 1; break;
        case '个月': shelfDays = shelfLifeNum * 30; break;
        case '年': shelfDays = shelfLifeNum * 365; break;
        default: return '';
    }
    let target = shelfToExpireDays.find(item => shelfDays <= item.shelf);
    return target ? `${target.expire}天` : '';
}

function showMsg(text) {
    document.getElementById('msgText').innerText = text;
    document.getElementById('msgModal').style.display = 'block';
}

function closeMsg() {
    document.getElementById('msgModal').style.display = 'none';
}

// 标签页切换
function switchTab(tabId) {
    console.log('切换到Tab:', tabId);
    
    // 1. 隐藏所有tab内容 - 包括 #goods 内部和外部的
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.remove('active');
        t.style.display = 'none';
    });
    
    // 2. 显示目标Tab
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
        console.log('✅ 显示Tab:', tabId);
    } else {
        console.warn('❌ 找不到Tab元素:', tabId);
        return;
    }
    
    // 3. 切换按钮样式
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tabs .tab-btn').forEach(b => {
        const onclickAttr = b.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${tabId}'`)) {
            b.classList.add('active');
        }
    });
    
    // 4. ✅ 如果切换到商品管理，重新激活默认子Tab
    if (tabId === 'goods') {
        // ========== 关键修复：先隐藏所有子版块内容 ==========
        document.querySelectorAll('#goods .finance-sub-content').forEach(function(div) {
            div.style.display = 'none';
        });
        
        // 移除所有子Tab的active状态
        document.querySelectorAll('#goods .finance-sub-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });
        
        // 激活商品信息子Tab
        const goodsInfoBtn = document.querySelector('#goods .finance-sub-btn[data-tab="goodsInfo"]');
        if (goodsInfoBtn) {
            goodsInfoBtn.classList.add('active');
        }
        
        // 显示商品信息内容
        const goodsInfoContent = document.getElementById('sub-goodsInfo');
        if (goodsInfoContent) {
            goodsInfoContent.style.display = 'block';
        }
        
        // 重新加载商品列表
        if (typeof loadGoods === 'function') {
            loadGoods();
        }
    }
    
    // 5. 加载对应数据
    try {
        console.log('加载数据:', tabId);
        switch(tabId) {
            case 'stockIn':
                if (typeof loadStockIn === 'function') loadStockIn();
                break;
            case 'returnGoods':
                if (typeof loadReturnGoods === 'function') loadReturnGoods();
                break;
            case 'stockOut':
                if (typeof loadStockOut === 'function') loadStockOut();
                break;
            case 'stockView':
                if (typeof loadStockStock === 'function') loadStockStock();
                break;
            case 'finance':
                if (typeof loadTaxRateList === 'function') loadTaxRateList();
                break;
            default:
                break;
        }
    } catch (e) {
        console.error('加载Tab数据失败:', e);
    }
    
    // ========== 新增：切换Tab后应用权限控制 ==========
    setTimeout(function() {
        if (typeof applyAllPermissions === 'function') {
            applyAllPermissions();
        }
    }, 150);
}

// ============================================================
// ===== 权限控制统一管理（新增） =====
// ============================================================

/**
 * 应用权限到当前页面所有按钮
 * 查找所有带 data-module 和 data-op 属性的按钮
 * 根据当前用户权限禁用/启用按钮
 */
function applyAllPermissions() {
    // 检查是否已登录且有用户ID
    if (typeof currentUserId === 'undefined' || !currentUserId) {
        // 如果没有当前用户，默认使用管理员（方便开发测试）
        if (typeof setCurrentUser === 'function') {
            setCurrentUser('user_1');
        }
        return;
    }
    
    // 查找所有需要权限控制的按钮
    var buttons = document.querySelectorAll('[data-module][data-op]');
    buttons.forEach(function(btn) {
        var moduleKey = btn.dataset.module;
        var opKey = btn.dataset.op;
        
        // 调用 settings.js 中的权限检查函数
        if (typeof canUserOperate === 'function') {
            var allowed = canUserOperate(currentUserId, moduleKey, opKey);
            if (!allowed) {
                btn.classList.add('btn-disabled');
                btn.disabled = true;
                btn.title = '您没有此操作权限';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.classList.remove('btn-disabled');
                btn.disabled = false;
                btn.title = '';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        }
    });
}

/**
 * 为单个元素应用权限控制
 * 在动态生成按钮后调用此函数
 */
function applyPermissionToElement(element, moduleKey, opKey) {
    if (!element) return;
    if (typeof currentUserId === 'undefined' || !currentUserId) return;
    if (typeof canUserOperate !== 'function') return;
    
    var allowed = canUserOperate(currentUserId, moduleKey, opKey);
    if (!allowed) {
        element.classList.add('btn-disabled');
        element.disabled = true;
        element.title = '您没有此操作权限';
        element.style.opacity = '0.5';
        element.style.cursor = 'not-allowed';
    } else {
        element.classList.remove('btn-disabled');
        element.disabled = false;
        element.title = '';
        element.style.opacity = '1';
        element.style.cursor = 'pointer';
    }
}

/**
 * 检查当前用户是否有某个模块的查看权限
 */
function checkViewPermission(menuKey) {
    if (typeof currentUserId === 'undefined' || !currentUserId) return true;
    if (typeof canUserView === 'function') {
        return canUserView(currentUserId, menuKey);
    }
    return true;
}

/**
 * 检查当前用户是否有某个模块的操作权限
 */
function checkOperatePermission(moduleKey, opKey) {
    if (typeof currentUserId === 'undefined' || !currentUserId) return true;
    if (typeof canUserOperate === 'function') {
        return canUserOperate(currentUserId, moduleKey, opKey);
    }
    return true;
}


// ============================================================
// ===== 初始化权限控制系统 =====
// ============================================================

// 页面加载完成后初始化权限控制
document.addEventListener('DOMContentLoaded', function() {
    // 延迟执行，确保 settings.js 已加载
    setTimeout(function() {
        // 首次应用权限
        if (typeof applyAllPermissions === 'function') {
            applyAllPermissions();
        }
        
        // 监听DOM变化，为动态添加的按钮自动应用权限
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    var addedNodes = mutation.addedNodes;
                    addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // 元素节点
                            // 检查子元素中是否有需要权限控制的按钮
                            if (node.querySelectorAll) {
                                var buttons = node.querySelectorAll('[data-module][data-op]');
                                buttons.forEach(function(btn) {
                                    if (typeof applyPermissionToElement === 'function') {
                                        applyPermissionToElement(btn, btn.dataset.module, btn.dataset.op);
                                    }
                                });
                            }
                            // 如果节点本身是需要权限控制的按钮
                            if (node.hasAttribute && node.hasAttribute('data-module') && node.hasAttribute('data-op')) {
                                if (typeof applyPermissionToElement === 'function') {
                                    applyPermissionToElement(node, node.dataset.module, node.dataset.op);
                                }
                            }
                        }
                    });
                }
            });
        });
        
        // 观察整个文档的DOM变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ 权限控制系统已启动');
    }, 500);
});


// ===================== 公共工具函数：库存计算（最终修复版） =====================
/**
 * 按【供应商+商品名+规格+入库单价+生产日期/到期日期】合并批次库存
 * 先进先出排序：生产日期早 > 到期日期早
 * 同生产/到期：按批次最早入库记录ID升序（先录入先出库）
 */
function getStockBatchList(supplier, goodsName) {
    // 1. 筛选对应商品所有入库记录
    let inList = allStockIn.filter(item => 
        item.supplier === supplier && item.goodsName === goodsName
    );

    // 2. 按批次合并
    let batchMap = {};
    inList.forEach(inItem => {
        let batchKey = `${inItem.supplier}_${inItem.goodsName}_${inItem.spec}_${inItem.in_price || 0}_${inItem.produce_date || ''}_${inItem.expire_date || ''}`;
        
        if (!batchMap[batchKey]) {
            batchMap[batchKey] = {
                supplier: inItem.supplier,
                goodsName: inItem.goodsName,
                spec: inItem.spec,
                settleType: inItem.settleType,
                produce_date: inItem.produce_date,
                expire_date: inItem.expire_date,
                inRecords: [],
                totalInNum: 0,
                batchRemain: 0
            };
        }
        batchMap[batchKey].inRecords.push(inItem);
        batchMap[batchKey].totalInNum += Number(inItem.in_num);
    });

    // 3. ✅ 统计每个批次已出库总量 + 已退货总量
    Object.values(batchMap).forEach(batch => {
        let outTotal = 0;
        let returnTotal = 0;
        
        // 统计出库
        allStockOut.forEach(out => {
            if (out.supplier === supplier && out.goodsName === goodsName) {
                if (out.outDetail) {
                    try {
                        let detailList = typeof out.outDetail === 'string' 
                            ? JSON.parse(out.outDetail) 
                            : out.outDetail;
                        if (Array.isArray(detailList)) {
                            detailList.forEach(detail => {
                                let isInBatch = batch.inRecords.some(inItem => inItem.id === detail.inRecordId);
                                if (isInBatch) {
                                    outTotal += Number(detail.useNum);
                                }
                            });
                        }
                    } catch (e) {
                        console.error('解析outDetail失败', out.outDetail, e);
                    }
                } else if (out.inRecordId) {
                    let isInBatch = batch.inRecords.some(inItem => inItem.id === out.inRecordId);
                    if (isInBatch) {
                        outTotal += Number(out.outNum);
                    }
                }
            }
        });
        
        // ✅ 新增：统计退货
        if (allReturnGoods && allReturnGoods.length > 0) {
            allReturnGoods.forEach(returnItem => {
                if (returnItem.supplier === supplier && returnItem.goods_name === goodsName) {
                    let isInBatch = batch.inRecords.some(inItem => inItem.id === returnItem.in_record_id);
                    if (isInBatch) {
                        returnTotal += Number(returnItem.return_num);
                    }
                }
            });
        }
        
        batch.batchRemain = Math.max(0, batch.totalInNum - outTotal - returnTotal);
    });

    // 4. 过滤库存为0的批次
    let batchList = Object.values(batchMap).filter(b => b.batchRemain > 0);

    // 排序
    batchList.sort((a, b) => {
        if (a.produce_date && b.produce_date) {
            let pdDiff = new Date(a.produce_date) - new Date(b.produce_date);
            if (pdDiff !== 0) return pdDiff;
        }
        if (a.produce_date) return -1;
        if (b.produce_date) return 1;

        if (a.expire_date && b.expire_date) {
            let edDiff = new Date(a.expire_date) - new Date(b.expire_date);
            if (edDiff !== 0) return edDiff;
        }

        let aFirstId = a.inRecords[0] ? Number(a.inRecords[0].id) : 0;
        let bFirstId = b.inRecords[0] ? Number(b.inRecords[0].id) : 0;
        return aFirstId - bFirstId;
    });

    return batchList;
}

/**
 * 获取商品总可用库存
 */
function getTotalStockNum(supplier, goodsName) {
    let batchList = getStockBatchList(supplier, goodsName);
    return batchList.reduce((sum, item) => sum + item.batchRemain, 0);
}

/**
 * 执行出库扣减（按合并批次先进先出，同批次内按入库录入时间FIFO）
 * 规则：
 * 1. 不同批次 → 分开生成出库单
 * 2. 同一批次多条入库，按入库记录录入时间先后扣减，汇总为一条出库单
 */
function calcFIFOOut(supplier, goodsName, outTotalNum) {
    // 获取合并后的批次列表（已按生产日期FIFO排序）
    const batchList = getStockBatchList(supplier, goodsName);
    let outDetail = [];
    let remainOut = outTotalNum;

    for (const batch of batchList) {
        if (remainOut <= 0) break;
        const batchStock = batch.batchRemain;
        if (batchStock <= 0) continue;

        // 当前批次最多可出库数量
        const takeQty = Math.min(batchStock, remainOut);
        // 取该批次任意一条入库ID关联出库
        const linkInId = batch.inRecords[0].id;
        // 生成批次唯一标识，用于分组合并出库单
        const batchKey = `${batch.supplier}_${batch.goodsName}_${batch.spec}_${batch.in_price || 0}_${batch.produce_date || ''}_${batch.expire_date || ''}`;
        
        outDetail.push({
            batchKey: batchKey,
            inRecordId: linkInId,
            useNum: takeQty
        });
        remainOut -= takeQty;
    }
    return outDetail;
}

// 确保点击外部关闭下拉
setTimeout(function() {
    document.addEventListener('click', function(e) {
        var wrapper = document.querySelector('.user-avatar-wrapper');
        var dropdown = document.getElementById('avatarDropdown');
        if (wrapper && dropdown && !wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}, 100);

// ============================================================
// ===== 保质期状态与价格匹配（新增） =====
// ============================================================

/**
 * 计算保质期状态
 * @param {string} produceDate - 生产日期
 * @param {string} expireDate - 到期日期
 * @param {number} shelfLifeNum - 保质期时长
 * @param {string} shelfLifeUnit - 保质期单位（天/个月/年）
 * @returns {string} 保质期状态（正常/临期/过期/打折状态）
 */
function calcBzStatus(produceDate, expireDate, shelfLifeNum, shelfLifeUnit) {
    // 如果都没有日期，返回'正常'
    if ((!produceDate || produceDate === '') && (!expireDate || expireDate === '')) {
        return '正常';
    }
    
    // 计算保质期天数
    let shelfDays = 0;
    if (shelfLifeNum && shelfLifeUnit) {
        switch (shelfLifeUnit) {
            case '天': shelfDays = Number(shelfLifeNum); break;
            case '个月': shelfDays = Number(shelfLifeNum) * 30; break;
            case '年': shelfDays = Number(shelfLifeNum) * 365; break;
        }
    }
    
    // 如果没有保质期信息，无法计算状态，返回'正常'
    if (shelfDays === 0) {
        return '正常';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 如果有到期日期
    if (expireDate && expireDate !== '') {
        const expire = new Date(expireDate);
        expire.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((expire - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) return '过期';
        
        // 从配置读取打折状态
        const config = window.settingsData?.discountConfig?.items || [];
        for (let i = 0; i < config.length; i++) {
            const item = config[i];
            const threshold = Math.ceil(shelfDays * item.multiplier);
            if (daysDiff <= threshold) {
                return 'discount_' + (i + 1);
            }
        }
        return '正常';
    }
    
    // 如果有生产日期（没有到期日期，用生产日期+保质期计算）
    if (produceDate && produceDate !== '') {
        const produce = new Date(produceDate);
        produce.setHours(0, 0, 0, 0);
        const expire = new Date(produce);
        expire.setDate(expire.getDate() + shelfDays);
        const daysDiff = Math.ceil((expire - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) return '过期';
        
        const config = window.settingsData?.discountConfig?.items || [];
        for (let i = 0; i < config.length; i++) {
            const item = config[i];
            const threshold = Math.ceil(shelfDays * item.multiplier);
            if (daysDiff <= threshold) {
                return 'discount_' + (i + 1);
            }
        }
        return '正常';
    }
    
    return '正常';
}

/**
 * 根据商品ID和保质期状态获取销售价
 * 优先级：正常状态→商品信息表 sale_price
 *         过期状态→商品信息表 sale_price
 *         折扣/临期状态→price_temp_state表查询，有则返回，无则返回 null
 * @param {number} goodsId - 商品ID
 * @param {string} bzStatus - 保质期状态
 * @param {number} defaultPrice - 默认价格（商品信息表的价格）
 * @returns {Promise<number|null>} 销售价，如果未找到则返回 null
 */
async function getSalePriceByBzStatus(goodsId, bzStatus, defaultPrice) {
    // 正常状态 → 返回默认价格
    if (bzStatus === '正常') {
        return Number(defaultPrice) || 0;
    }

    // 过期状态 → 返回默认价格
    if (bzStatus === '过期') {
        return Number(defaultPrice) || 0;
    }

    // ✅ 状态映射：字段名使用正确的名称（有下划线）
    const fieldMap = {
        '临期': 'expire_price',
        'discount_1': 'discount_1_price',
        'discount_2': 'discount_2_price',
        'discount_3': 'discount_3_price',
        'discount_4': 'discount_4_price'
    };

    const labelToKey = {
        '打6.5折': 'discount_1',
        '打7折': 'discount_2',
        '打8折': 'discount_3',
        '打9.5折': 'discount_4'
    };

    let statusKey = bzStatus;
    if (labelToKey[bzStatus]) {
        statusKey = labelToKey[bzStatus];
    }

    const fieldName = fieldMap[statusKey];
    if (!fieldName) {
        // 未知状态，返回 null（不再降级）
        return null;
    }

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&select=${fieldName}`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const data = await res.json();
        if (data && data.length > 0 && data[0][fieldName] !== null && data[0][fieldName] !== undefined) {
            return Number(data[0][fieldName]);
        }
        // 数据库中该字段为 null 或不存在 → 返回 null
        return null;
    } catch (e) {
        console.warn('获取临时价格失败:', e);
        // 查询失败也返回 null
        return null;
    }
}

/**
 * 根据入库记录的日期计算保质期状态并匹配价格
 * @param {Object} inRecord - 入库记录对象（包含 goods_id, produce_date, expire_date）
 * @param {Object} goodsItem - 商品对象（包含 shelf_life_num, shelf_life_unit, sale_price）
 * @returns {Promise<Object>} { bzStatus, salePrice }
 */
async function calcPriceByInRecord(inRecord, goodsItem) {
    if (!inRecord || !goodsItem) {
        return { bzStatus: '正常', salePrice: Number(goodsItem?.sale_price) || 0 };
    }
    
    const bzStatus = calcBzStatus(
        inRecord.produce_date,
        inRecord.expire_date,
        goodsItem.shelf_life_num,
        goodsItem.shelf_life_unit
    );
    
    const salePrice = await getSalePriceByBzStatus(
        goodsItem.id,
        bzStatus,
        goodsItem.sale_price
    );
    
    return { bzStatus, salePrice };
}

/**
 * 将状态key转换为显示名称
 * @param {string} bzStatusKey - 状态key（如 discount_1, 正常, 临期, 过期）
 * @returns {string} 显示名称
 */
function getBzStatusLabel(bzStatusKey) {
    if (!bzStatusKey) return '正常';
    if (bzStatusKey === '正常') return '正常';
    if (bzStatusKey === '临期') return '临期';
    if (bzStatusKey === '过期') return '过期';
    
    // 提取序号：discount_1 → 1
    const match = bzStatusKey.match(/discount_(\d+)/);
    if (match) {
        const index = parseInt(match[1]) - 1;
        const config = window.settingsData?.discountConfig?.items || [];
        if (config[index] && config[index].label) {
            return config[index].label;
        }
        return bzStatusKey;
    }
    return bzStatusKey;
}

/**
 * 根据显示名称获取状态key
 * @param {string} label - 显示名称（如 打6.5折）
 * @returns {string} 状态key（如 discount_1）
 */
function getBzStatusKeyByLabel(label) {
    if (!label) return '正常';
    if (label === '正常') return '正常';
    if (label === '临期') return '临期';
    if (label === '过期') return '过期';
    
    const config = window.settingsData?.discountConfig?.items || [];
    const index = config.findIndex(item => item.label === label);
    if (index !== -1) {
        return 'discount_' + (index + 1);
    }
    return label;
}

/**
 * 计算保质期天数
 */
function getBzTotalDay(val, unit) {
    if (!val) return 0;
    switch (unit) {
        case 'year': return val * 365;
        case 'month': return val * 30;
        case 'day':
        default: return val;
    }
}

/**
 * 统一保质期状态计算（与 stockStock.js 保持一致）
 * @param {string} sc - 生产日期
 * @param {string} dq - 到期日期
 * @param {number} bzVal - 保质期数值
 * @param {string} bzUnit - 保质期单位 (year/month/day)
 * @param {number} warnDay - 临期天数
 * @returns {Object} { statusText: string, countDownText: string }
 */
function calcBzStatus(sc, dq, bzVal, bzUnit, warnDay) {
    const bzq = getBzTotalDay(bzVal, bzUnit);
    if (bzq <= 0) {
        return { statusText: '', countDownText: '' };
    }
    const lq = warnDay;
    if (lq <= 0) {
        return { statusText: '', countDownText: '' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let hsdq;
    if (dq) {
        hsdq = new Date(dq);
        hsdq.setHours(0, 0, 0, 0);
    } else if (sc) {
        const scDate = new Date(sc);
        scDate.setHours(0, 0, 0, 0);
        hsdq = new Date(scDate.getTime() + bzq * 24 * 60 * 60 * 1000);
    } else {
        return { statusText: '', countDownText: '' };
    }

    if (today >= hsdq) {
        return { statusText: '过期', countDownText: '' };
    }

    const config = window.settingsData?.discountConfig?.items || [
        { label: '打7折', multiplier: 2 },
        { label: '打8折', multiplier: 3 },
        { label: '打9折', multiplier: 4 }
    ];
    const sorted = config.slice().sort((a, b) => a.multiplier - b.multiplier);

    const halfBz = bzq / 2;

    const discountPoints = [];
    for (let item of sorted) {
        const days = item.multiplier * lq;
        if (days > halfBz) break;
        const date = new Date(hsdq.getTime() - days * 24 * 60 * 60 * 1000);
        discountPoints.push({
            label: item.label,
            date: date,
            days: days
        });
    }

    const lqDate = new Date(hsdq.getTime() - lq * 24 * 60 * 60 * 1000);

    if (today >= lqDate) {
        const remain = Math.floor((hsdq - today) / (1000 * 60 * 60 * 24));
        return { statusText: '临期', countDownText: `${remain}` };
    }

    for (let i = 0; i < discountPoints.length; i++) {
        const point = discountPoints[i];
        const upperDate = (i === 0) ? lqDate : discountPoints[i-1].date;
        if (today >= point.date && today < upperDate) {
            const remain = Math.floor((upperDate - today) / (1000 * 60 * 60 * 24));
            return { statusText: point.label, countDownText: `${remain}` };
        }
    }

    if (discountPoints.length > 0) {
        const lastPoint = discountPoints[discountPoints.length - 1];
        const remain = Math.floor((lastPoint.date - today) / (1000 * 60 * 60 * 24));
        return { statusText: '正常', countDownText: `${remain}` };
    } else {
        const remain = Math.floor((lqDate - today) / (1000 * 60 * 60 * 24));
        return { statusText: '正常', countDownText: `${remain}` };
    }
}

// 暴露到全局
window.getBzTotalDay = getBzTotalDay;
window.calcBzStatus = calcBzStatus;

// 暴露到全局
window.calcBzStatus = calcBzStatus;
window.getSalePriceByBzStatus = getSalePriceByBzStatus;
window.calcPriceByInRecord = calcPriceByInRecord;
window.getBzStatusLabel = getBzStatusLabel;
window.getBzStatusKeyByLabel = getBzStatusKeyByLabel;