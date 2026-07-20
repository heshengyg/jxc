// 库存模块内部依赖函数（仅本文件使用，不影响其他模块）
function getBzTotalDay(val, unit) {
    if (!val) return 0;
    switch (unit) {
        case 'year': return val * 365;
        case 'month': return val * 30;
        case 'day':
        default: return val;
    }
}

function getDateDiffDay(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diff = (target - today) / (1000 * 60 * 24);
    return Math.floor(diff);
}

/**
 * 严格按照最新修正规则重写保质期状态计算
 * 修正点：
 * 1. 临期：状态倒计 = 到期日 - 今日
 * 2. 正常区间：保质期状态固定显示【正常】，状态倒计为打折日-今日的纯数字
 * 3. 无日期：状态、倒计时均返回空字符串
 * 新增：打折状态同样显示【临期日期-今日】的天数倒计时
 */
function calcBzStatus(sc, dq, bzVal, bzUnit, warnDay) {
// 🔧 在这里添加调试日志
    console.log('=== 调试 calcBzStatus ===');
    console.log('生产日期:', sc);
    console.log('到期日期:', dq);
    console.log('保质期数值:', bzVal);
    console.log('保质期单位:', bzUnit);
    console.log('临期天数:', warnDay);
    
    const bzq = getBzTotalDay(bzVal, bzUnit);
    console.log('计算出的 bzq:', bzq);
    console.log('halfBz:', bzq/2);

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

    // 读取配置
    const config = window.settingsData?.discountConfig?.items || [
        { label: '打7折', multiplier: 2 },
        { label: '打8折', multiplier: 3 },
        { label: '打9折', multiplier: 4 }
    ];
    // 按倍率从小到大排序（近→远）
    const sorted = config.slice().sort((a, b) => a.multiplier - b.multiplier);

    const halfBz = bzq / 2;

    // 构建有效折扣点（只保留临界天数 <= 保质期一半的）
    const discountPoints = [];
    for (let item of sorted) {
        const days = item.multiplier * lq;
        if (days > halfBz) break;  // 一旦超过，后面的更远，也超过
        const date = new Date(hsdq.getTime() - days * 24 * 60 * 60 * 1000);
        discountPoints.push({
            label: item.label,
            date: date,
            days: days
        });
    }

    // 临期临界点
    const lqDate = new Date(hsdq.getTime() - lq * 24 * 60 * 60 * 1000);

    // 检查临期
    if (today >= lqDate) {
        const remain = Math.floor((hsdq - today) / (1000 * 60 * 60 * 24));
        return { statusText: '临期', countDownText: `${remain}` };
    }

    // 从近到远检查折扣
    for (let i = 0; i < discountPoints.length; i++) {
        const point = discountPoints[i];
        // 区间上限：上一个更近的临界点（或临期日期）
        const upperDate = (i === 0) ? lqDate : discountPoints[i-1].date;
        if (today >= point.date && today < upperDate) {
            const remain = Math.floor((upperDate - today) / (1000 * 60 * 60 * 24));
            return { statusText: point.label, countDownText: `${remain}` };
        }
    }

    // 正常：在最远的折扣点之前（或没有折扣）
    if (discountPoints.length > 0) {
        const lastPoint = discountPoints[discountPoints.length - 1];
        const remain = Math.floor((lastPoint.date - today) / (1000 * 60 * 60 * 24));
        return { statusText: '正常', countDownText: `${remain}` };
    } else {
        // 没有有效折扣，正常从临期开始往前
        const remain = Math.floor((lqDate - today) / (1000 * 60 * 60 * 24));
        return { statusText: '正常', countDownText: `${remain}` };
    }
}
/**
 * 库存报警：总库存 - 预警阈值
 * >0 正常  |  =0 临界  |  <0 报警
 */
function calcStockWarnStatus(totalAllStock, warnStockThreshold) {
    const diff = totalAllStock - warnStockThreshold;
    if (diff > 0) return '正常';
    if (diff === 0) return '临界';
    return '报警';
}

/**
 * 单个入库ID 剩余库存（同时减去出库和退货）
 */
function getInItemRemain(inRecordId) {
    let totalOut = 0;
    let totalReturn = 0;
    
    // 统计出库
    allStockOut.forEach(out => {
        if (out.inRecordId == inRecordId) {
            totalOut += Number(out.outNum || 0);
        }
    });
    
    // ✅ 统计退货
    if (allReturnGoods && allReturnGoods.length > 0) {
        allReturnGoods.forEach(returnItem => {
            if (returnItem.in_record_id == inRecordId) {
                totalReturn += Number(returnItem.return_num || 0);
            }
        });
    }
    
    let inItem = allStockIn.find(x => x.id == inRecordId);
    let inNum = inItem ? Number(inItem.in_num || 0) : 0;
    return Math.max(0, inNum - totalOut - totalReturn);
}

/**
 * 批次库存金额 = 批次总剩余库存 * 该批次入库单价
 */
function getBatchStockAmount(totalRemain, inPrice) {
    return Number((totalRemain * inPrice).toFixed(2));
}

// ====================== 库存查看 全局变量 ======================
let allStockBatchList = [];
let filteredStockBatch = [];
let stockCurrentPage = 1;
let stockPageSize = 10;
let stockTotalPages = 1;
let stockSortField = '';
let stockSortAsc = true;
let stockSummary = {
    totalAmount: 0,
    totalBatchStock: 0,
    totalAllStock: 0
};

/**
 * DOM完全就绪后首次自动加载库存数据
 */
document.addEventListener('DOMContentLoaded', function () {
    bindNavClickRefresh();
    if (document.getElementById('stockStockList')) {
        loadStockStock();
        const searchInput = document.getElementById('stockSearchKeyword');
        if (searchInput) {
            searchInput.addEventListener('input', filterStockStock);
        }
    }
});

/**
 * 绑定库存查看导航按钮点击事件，每次点击都重新拉取最新数据
 */
function bindNavClickRefresh() {
    const stockNavBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === '库存查看');
    if (stockNavBtn) {
        stockNavBtn.addEventListener('click', function () {
            stockCurrentPage = 1;
            loadStockStock();
        });
    }
}

// ====================== 初始化库存筛选数据源 ======================
let stockFilterData = {
    supplier: [],
    goodsName: [],
    spec: [],
    settleType: [],
    stockStatus: ['正常', '临界', '报警'],
    bzStatus: ['过期', '临期', '打折', '正常']
};

function initStockFilterSelects() {
    const list = allStockBatchList;
    const getUnique = (key) => [...new Set(list.map(item => String(item[key] || '').trim()).filter(v => v !== ''))];
    
    stockFilterData.supplier = getUnique('supplier');
    stockFilterData.goodsName = getUnique('goodsName');
    stockFilterData.spec = getUnique('spec');
    stockFilterData.settleType = getUnique('settleType');

    // 动态生成保质期状态选项
    const config = window.settingsData?.discountConfig?.items || [
        { label: '打7折', multiplier: 2 },
        { label: '打8折', multiplier: 3 },
        { label: '打9折', multiplier: 4 }
    ];
    const discountLabels = config.map(item => item.label);
    // 注意：去重，避免用户配置重复
    const allStatus = ['过期', '临期', ...discountLabels, '正常'];
    stockFilterData.bzStatus = [...new Set(allStatus)];
}

// ====================== 通用筛选下拉操作 ======================
function showStockFilterList(type) {
    const listId = `stockFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    const inputId = `stockFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderStockFilterList(type, kw);
    box.style.display = 'block';
}

function filterStockFilterList(type) {
    const inputId = `stockFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderStockFilterList(type, kw);
    const listId = `stockFilter${capitalize(type)}List`;
    document.getElementById(listId).style.display = 'block';
}

function renderStockFilterList(type, keyword = '') {
    const listId = `stockFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    let data = stockFilterData[type] || [];
    if (keyword) {
        data = data.filter(item => item.toLowerCase().includes(keyword));
    }
    box.innerHTML = '';
    if (data.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配</div>';
        return;
    }
    data.forEach(opt => {
        const div = document.createElement('div');
        div.style.padding = '4px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.textContent = opt;
        div.onclick = function() {
            const inputId = `stockFilter${capitalize(type)}Input`;
            document.getElementById(inputId).value = opt;
            box.style.display = 'none';
            filterStockStock(); // 选择后立即筛选
        };
        box.appendChild(div);
    });
}

// 辅助函数：首字母大写
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 加载库存数据
 * 合并规则：供应商 + 商品名 + 规格 + 入库单价 + 生产日期 + 到期日期 为同一批次
 * 修改点1：仅批次库存>0才加入列表，过滤批次库存为0的行
 */
async function loadStockStock() {
    // ✅ 同步最新打折配置
    if (typeof loadSettings === 'function') {
        try {
            await loadSettings();
            console.log('🔄 已同步最新打折配置');
        } catch(e) {
            console.warn('同步打折配置失败，使用缓存', e);
        }
    }

    // 前置加载数据
    if (allStockIn.length === 0) await loadStockIn();
    await preLoadStockOutData();
    if (allReturnGoods.length === 0 && typeof loadReturnGoods === 'function') {
        await loadReturnGoods();
    }

    // ✅ 确保 stockDataCache 已刷新
    refreshAllStockCache(allStockIn, allStockOut);

    try {
        allStockBatchList = [];
        
        for (const [key, cacheData] of stockDataCache) {
            if (!cacheData.batchList || cacheData.batchList.length === 0) continue;
            
            for (const batch of cacheData.batchList) {
                if (batch.batchRemain <= 0) continue;
                
                // ✅ 从第一条入库记录获取单价
                const firstRecord = batch.inRecords && batch.inRecords[0];
                if (!firstRecord) continue;
                
                const goodsBase = allGoods.find(g =>
                    g.supplier === batch.supplier &&
                    g.name === batch.goodsName &&
                    (g.spec || '') === (batch.spec || '')
                );
                if (!goodsBase) continue;
                
                const totalAllStock = cacheData.totalStock || getTotalStockNum(batch.supplier, batch.goodsName);
                const warnStockThreshold = goodsBase.warn_num || 0;
                // ✅ 使用 firstRecord.in_price
                const batchAmount = getBatchStockAmount(batch.batchRemain, firstRecord.in_price || 0);
                
                // 计算保质期状态
                let unitCode = "day";
                if (goodsBase.shelf_life_unit === "年") unitCode = "year";
                if (goodsBase.shelf_life_unit === "个月") unitCode = "month";
                
                const expireResult = typeof calculateExpireDays === 'function' 
                    ? calculateExpireDays(goodsBase.shelf_life_num, goodsBase.shelf_life_unit) 
                    : (goodsBase.warn_num || 0);
                
                let warnDay = 0;
                if (typeof expireResult === 'string' && expireResult.includes('天')) {
                    warnDay = parseInt(expireResult) || 0;
                } else if (typeof expireResult === 'number') {
                    warnDay = expireResult;
                } else {
                    warnDay = Number(expireResult) || 0;
                }
                
                const produceDate = firstRecord.produce_date || '-';
                const expireDate = firstRecord.expire_date || '-';
                const recordDate = firstRecord.record_date || '';
                
                const bzResult = calcBzStatus(
                    produceDate === '-' ? '' : produceDate,
                    expireDate === '-' ? '' : expireDate,
                    goodsBase.shelf_life_num || 0,
                    unitCode,
                    warnDay
                );
                const stockWarnText = calcStockWarnStatus(totalAllStock, warnStockThreshold);
                
                let bzText = '';
                if (goodsBase.shelf_life_num && goodsBase.shelf_life_unit) {
                    bzText = `${goodsBase.shelf_life_num}${goodsBase.shelf_life_unit}`;
                }
                
                allStockBatchList.push({
                    supplier: batch.supplier,
                    goodsName: batch.goodsName,
                    spec: batch.spec || '-',
                    settleType: batch.settleType || '-',
                    outPrice: firstRecord.in_price || 0,  // ✅ 从第一条入库记录取单价
                    batchRemain: batch.batchRemain,
                    totalAllStock: totalAllStock,
                    warnStockThreshold: warnStockThreshold,
                    stockWarnText: stockWarnText,
                    batchAmount: batchAmount,
                    produce_date: produceDate,
                    expire_date: expireDate,
                    bzText: bzText,
                    bzStatusText: bzResult.statusText,
                    countDownText: bzResult.countDownText,
                    recordDate: recordDate
                });
            }
        }

        allStockBatchList.sort((a, b) => (b.recordDate || '').localeCompare(a.recordDate || ''));

        const totalEl = document.getElementById('stockTotalCount');
        if (totalEl) totalEl.textContent = allStockBatchList.length;
        initStockFilterSelects();
        filterStockStock();
    } catch (e) {
        showMsg('加载库存数据失败：' + e.message);
        console.error("库存加载异常：", e);
    }
}

/**
 * 搜索筛选（原有点击搜索按钮依然保留可用，新增输入实时触发）
 */
function filterStockStock() {
    const supplier = document.getElementById('stockFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('stockFilterGoodsNameInput')?.value.trim() || '';
    const spec = document.getElementById('stockFilterSpecInput')?.value.trim() || '';
    const settleType = document.getElementById('stockFilterSettleTypeInput')?.value.trim() || '';
    const stockStatus = document.getElementById('stockFilterStockStatusInput')?.value.trim() || '';
    const bzStatus = document.getElementById('stockFilterBzStatusInput')?.value.trim() || '';

    if (!allStockBatchList || !Array.isArray(allStockBatchList)) {
        filteredStockBatch = [];
    } else {
        filteredStockBatch = allStockBatchList.filter(item => {
            let match = true;
            // ✅ 改为模糊匹配（includes）
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (spec && !(item.spec || '').toLowerCase().includes(spec.toLowerCase())) match = false;
            if (settleType && !(item.settleType || '').toLowerCase().includes(settleType.toLowerCase())) match = false;
            if (stockStatus && !(item.stockWarnText || '').toLowerCase().includes(stockStatus.toLowerCase())) match = false;
            if (bzStatus && !(item.bzStatusText || '').toLowerCase().includes(bzStatus.toLowerCase())) match = false;
            return match;
        });
    }

    const searchCountEl = document.getElementById('stockSearchCount');
    if (searchCountEl) searchCountEl.textContent = filteredStockBatch.length;

    stockCurrentPage = 1;
    renderStockPagination();
    renderStockTable();
}

/**
 * 重置搜索
 */
function resetStockSearch() {
    const inputIds = [
        'stockFilterSupplierInput',
        'stockFilterGoodsNameInput',
        'stockFilterSpecInput',
        'stockFilterSettleTypeInput',
        'stockFilterStockStatusInput',
        'stockFilterBzStatusInput'
    ];
    inputIds.forEach(id => {
        const inp = document.getElementById(id);
        if (inp) inp.value = '';
    });
    // 关闭所有下拉
    document.querySelectorAll('[id^="stockFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterStockStock();
}
// ========== 库存实时搜索（输入即搜索） ==========
function onStockFilterInput() {
    // 1. 实时筛选列表
    filterStockStock();
    
    // 2. 实时更新下拉列表
    const types = ['supplier', 'goodsName', 'spec', 'settleType', 'stockStatus', 'bzStatus'];
    const inputIds = {
        supplier: 'stockFilterSupplierInput',
        goodsName: 'stockFilterGoodsNameInput',
        spec: 'stockFilterSpecInput',
        settleType: 'stockFilterSettleTypeInput',
        stockStatus: 'stockFilterStockStatusInput',
        bzStatus: 'stockFilterBzStatusInput'
    };
    const listIds = {
        supplier: 'stockFilterSupplierList',
        goodsName: 'stockFilterGoodsNameList',
        spec: 'stockFilterSpecList',
        settleType: 'stockFilterSettleTypeList',
        stockStatus: 'stockFilterStockStatusList',
        bzStatus: 'stockFilterBzStatusList'
    };
    
    for (const type of types) {
        const input = document.getElementById(inputIds[type]);
        const list = document.getElementById(listIds[type]);
        if (document.activeElement === input && list) {
            renderStockFilterList(type, input.value.trim());
            list.style.display = 'block';
            break;
        }
    }
}

/**
 * 表头排序（新增结算方式、单价排序）
 */
function stockSortTable(field) {
    stockSortField = field;
    stockSortAsc = stockSortField === field ? !stockSortAsc : true;
    filteredStockBatch.sort((a, b) => {
        const va = a[stockSortField] || '';
        const vb = b[stockSortField] || '';
        const numFields = ['warnStockThreshold', 'batchAmount', 'batchRemain', 'totalAllStock', 'outPrice'];
        if (numFields.includes(stockSortField)) {
            const numA = Number(va) || 0;
            const numB = Number(vb) || 0;
            return stockSortAsc ? numA - numB : numB - numA;
        }
        return stockSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateStockSortIcon();
    renderStockTable();
}

/**
 * 更新排序箭头
 */
function updateStockSortIcon() {
    document.querySelectorAll('.stockSortIcon').forEach(i => i.innerText = '');
    const thList = document.querySelectorAll('.stock-table thead .sortable');
    const targetIdx = Array.from(thList).findIndex(th => th.onclick?.toString().includes(stockSortField));
    if (targetIdx > -1) {
        document.querySelectorAll('.stockSortIcon')[targetIdx].innerText = stockSortAsc ? '↑' : '↓';
    }
}

/**
 * 渲染表格 + 底部汇总（严格按指定列顺序渲染）
 */
function renderStockTable() {
    const start = (stockCurrentPage - 1) * stockPageSize;
    const pageData = filteredStockBatch.slice(start, start + stockPageSize);
    const tb = document.getElementById('stockStockList');
    if (!tb) return;
    tb.innerHTML = '';
    let htmlStr = '';

    // 汇总统计
    stockSummary = { totalAmount: 0, totalBatchStock: 0, totalAllStock: 0 };
    filteredStockBatch.forEach(item => {
        stockSummary.totalAmount += item.batchAmount;
        stockSummary.totalBatchStock += item.batchRemain;
        stockSummary.totalAllStock += item.totalAllStock;
    });

    // 渲染数据行：序列，供应商，商品名，规格，结算方式，单价，批次库存，总库存，库存预警阈值，库存状态，库存金额，生产日期，到期日期，保质期，保质期状态，状态倒计
    pageData.forEach((item, idx) => {
        const seq = start + idx + 1;
        // 库存状态背景色
        let warnBg = '';
        if (item.stockWarnText === '报警') {
            warnBg = 'style="background:#ffdddd;"';
        } else if (item.stockWarnText === '正常' || item.stockWarnText === '临界') {
            warnBg = 'style="background:#ddffdd;"';
        }
        // 保质期状态背景色 - 基于配置索引（第1条、第2条...）
let bzBg = '';
if (item.bzStatusText === '过期') {
    bzBg = 'style="background:#ff4444;color:#fff;"';
} else if (item.bzStatusText === '临期') {
    bzBg = 'style="background:#ffdddd;"';
} else if (item.bzStatusText === '正常') {
    bzBg = 'style="background:#d4edda;"';
} else if (item.bzStatusText && item.bzStatusText !== '') {
    // 打折状态：根据配置中的索引分配颜色
    const config = window.settingsData?.discountConfig?.items || [];
    const index = config.findIndex(c => c.label === item.bzStatusText);
    
    // 4种颜色：浅红、浅蓝、浅黄、橘色（按索引顺序）
    const colors = [
        '#ffcdd2', // 浅红（第1条）
        '#bbdefb', // 浅蓝（第2条）
        '#fff9c4', // 浅黄（第3条）
        '#ffe0b2'  // 橘色（第4条）
    ];
    const colorIndex = (index >= 0 && index < colors.length) ? index : 0;
    bzBg = `style="background:${colors[colorIndex]};"`;
}
// 如果 bzStatusText 为空字符串，bzBg 保持 ''，不添加任何背景色

        htmlStr += `
        <tr>
            <td>${seq}</td>
            <td>${item.supplier}</td>
            <td>${item.goodsName}</td>
            <td>${item.spec}</td>
            <td>${item.settleType}</td>
            <td>${formatMoney(item.outPrice)}</td>
            <td>${item.batchRemain}</td>
            <td>${item.totalAllStock}</td>
            <td>${item.warnStockThreshold}</td>
            <td ${warnBg}>${item.stockWarnText}</td>
            <td>${formatMoney(item.batchAmount)}</td>
            <td>${item.produce_date}</td>
            <td>${item.expire_date}</td>
            <td>${item.bzText}</td>
            <td ${bzBg}>${item.bzStatusText}</td>
            <td>${item.countDownText}</td>
        </tr>
        `;
    });

    // 汇总规则：
    // 1-6列合并：筛选数据汇总
    // 第7列：批次库存汇总值
    // 8-10列合并空白占位
    // 第11列：库存金额汇总值
    // 12-16列合并空白占位
    htmlStr += `
    <tr style="background:#f5f7fa;font-weight:bold;">
        <td colspan="6">筛选数据汇总</td>
        <td>${stockSummary.totalBatchStock}</td>
        <td colspan="3"></td>
        <td>${formatMoney(stockSummary.totalAmount)}</td>
        <td colspan="5"></td>
    </tr>
    `;
    tb.innerHTML = htmlStr;
}
/**
 * 分页渲染（容错）
 */
function renderStockPagination() {
    stockTotalPages = Math.ceil(filteredStockBatch.length / stockPageSize) || 1;

    document.getElementById('stockCurrentPage').textContent = stockCurrentPage;
    document.getElementById('stockTotalPages').textContent = stockTotalPages;

    const pgBox = document.getElementById('stockPageNumbers');
    pgBox.innerHTML = '';
    const startPage = Math.max(1, stockCurrentPage - 2);
    const endPage = Math.min(stockTotalPages, startPage + 4);
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === stockCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => stockGoToPage(i);
        pgBox.appendChild(btn);
    }

    // ✅ 首尾定位：第一个=首页，第二个=上一页，倒数第二个=下一页，倒数第一个=末页
    const btns = document.querySelectorAll('#stockView .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (stockCurrentPage === 1);
        btns[1].disabled = (stockCurrentPage === 1);
        btns[btns.length - 2].disabled = (stockCurrentPage === stockTotalPages);
        btns[btns.length - 1].disabled = (stockCurrentPage === stockTotalPages);
    }
}

function stockGoToPage(p) {
    if (p < 1 || p > stockTotalPages) return;
    stockCurrentPage = p;
    renderStockPagination();
    renderStockTable();
}
function stockPrevPage() { stockGoToPage(stockCurrentPage - 1); }
function stockNextPage() { stockGoToPage(stockCurrentPage + 1); }
function changeStockPageSize() {
    stockPageSize = Number(document.getElementById('stockPageSize').value);
    stockCurrentPage = 1;
    renderStockPagination();
    renderStockTable();  // ✅ 添加这行，重新渲染表格
}
/**
 * 导出库存Excel（表头严格匹配指定列名，末尾追加全局汇总行）
 */
function exportStockStockExcel() {
    if (filteredStockBatch.length === 0) {
        showMsg("暂无库存数据可导出");
        return;
    }
    // 先计算筛选后全部数据的全局汇总值
    let totalBatchStock = 0;
    let totalAmount = 0;
    filteredStockBatch.forEach(item => {
        totalBatchStock += item.batchRemain;
        totalAmount += item.batchAmount;
    });

    const header = [
        "序列", "供应商", "商品名", "规格", "结算方式", "单价", "批次库存", "总库存",
        "库存预警阈值", "库存状态", "库存金额", "生产日期", "到期日期", "保质期", "保质期状态", "状态倒计"
    ];
    const expData = filteredStockBatch.map((item, idx) => [
        idx + 1,
        item.supplier,
        item.goodsName,
        item.spec,
        item.settleType,
        item.outPrice,
        item.batchRemain,
        item.totalAllStock,
        item.warnStockThreshold,
        item.stockWarnText,
        item.batchAmount,
        item.produce_date,
        item.expire_date,
        item.bzText,
        item.bzStatusText,
        item.countDownText
    ]);

    // 新增汇总行：和页面规则一致
    // 1-6列合并文字，第7列批次库存合计，8-10空白，第11列库存金额合计，剩余列空白
    const summaryRow = [
        "筛选数据汇总", "", "", "", "", "", totalBatchStock, "", "", "", totalAmount.toFixed(2), "", "", "", "", ""
    ];
    expData.push(summaryRow);

    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "库存明细");
    XLSX.writeFile(wb, "库存明细.xlsx");
}

// 全局点击关闭库存下拉框
document.addEventListener('click', function(e) {
    const listIds = [
        'stockFilterSupplierList',
        'stockFilterGoodsNameList',
        'stockFilterSpecList',
        'stockFilterSettleTypeList',
        'stockFilterStockStatusList',
        'stockFilterBzStatusList'
    ];
    listIds.forEach(id => {
        const box = document.getElementById(id);
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${id.replace('List', 'Input')}`)) {
            box.style.display = 'none';
        }
    });
});
window.resetStockSearch = resetStockSearch;
window.onStockFilterInput = onStockFilterInput;