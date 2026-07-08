// ============================================================
// ===== 头像下拉菜单（提前定义，确保全局可用） =====
// ============================================================
function toggleAvatarDropdown() { ... }
function changeAvatar() { ... }
function resetMyPassword() { ... }
function compressImage(file, maxWidth, maxHeight) { ... }
async function uploadAvatar(fileBlob) { ... }

// ============================================================
// ===== 暴露到全局（确保 HTML onclick 可调用） =====
// ============================================================
window.toggleAvatarDropdown = toggleAvatarDropdown;
window.changeAvatar = changeAvatar;
window.resetMyPassword = resetMyPassword;
window.uploadAvatar = uploadAvatar;
window.compressImage = compressImage;

// ===================== 全局变量区 =====================
let allReturnGoods = [];
let filteredReturnGoods = [];
let pageCache = { stockIn: { data: null, page: 1 }, stockOut: { data: null, page: 1 } };
let stockDataCache = new Map();
// ... 其他全局变量 ...

// ===================== 公共工具函数 =====================
function formatMoney(num) { ... }
function calculateExpireDays(shelfLifeNum, shelfLifeUnit) { ... }
function showMsg(text) { ... }
function closeMsg() { ... }

// ===================== 标签页切换 =====================
function switchTab(tabId) {
    console.log('切换到Tab:', tabId);
    // ... 所有 switchTab 代码 ...
    // 最后不要忘记闭合这个函数
}  // ← ✅ 这里闭合 switchTab 函数

// ===================== 权限控制 =====================
function applyAllPermissions() { ... }
function applyPermissionToElement(element, moduleKey, opKey) { ... }
function checkViewPermission(menuKey) { ... }
function checkOperatePermission(moduleKey, opKey) { ... }

// ============================================================
// ===== 初始化权限控制系统 =====
// ============================================================
document.addEventListener('DOMContentLoaded', function() { ... });

// ===================== 公共工具函数：库存计算 =====================
function getStockBatchList(supplier, goodsName) { ... }
function getTotalStockNum(supplier, goodsName) { ... }
function calcFIFOOut(supplier, goodsName, outNum) { ... }
function refreshAllStockCache(inList, outList) { ... }

// ============================================================
// ===== 保质期状态与价格匹配（新增） =====
// ============================================================

/**
 * 计算保质期状态
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
 */
async function getSalePriceByBzStatus(goodsId, bzStatus, defaultPrice) {
    if (bzStatus === '正常') {
        return Number(defaultPrice) || 0;
    }
    if (bzStatus === '过期') {
        return 0;
    }
    
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&bz_status=eq.${bzStatus}&select=sale_price`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const data = await res.json();
        if (data && data.length > 0 && data[0].sale_price !== null) {
            return Number(data[0].sale_price);
        }
    } catch (e) {
        console.warn('获取临时价格失败:', e);
    }
    
    return Number(defaultPrice) || 0;
}

/**
 * 根据入库记录计算保质期状态并匹配价格
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
 */
function getBzStatusLabel(bzStatusKey) {
    if (!bzStatusKey) return '正常';
    if (bzStatusKey === '正常') return '正常';
    if (bzStatusKey === '临期') return '临期';
    if (bzStatusKey === '过期') return '过期';
    
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

// ============================================================
// ===== 暴露新增函数到全局 =====
// ============================================================
window.calcBzStatus = calcBzStatus;
window.getSalePriceByBzStatus = getSalePriceByBzStatus;
window.calcPriceByInRecord = calcPriceByInRecord;
window.getBzStatusLabel = getBzStatusLabel;
window.getBzStatusKeyByLabel = getBzStatusKeyByLabel;

// ============================================================
// ===== 确保点击外部关闭下拉 =====
// ============================================================
setTimeout(function() {
    document.addEventListener('click', function(e) {
        var wrapper = document.querySelector('.user-avatar-wrapper');
        var dropdown = document.getElementById('avatarDropdown');
        if (wrapper && dropdown && !wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}, 100);