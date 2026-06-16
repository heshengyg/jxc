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
 * 保质期状态计算（严格按需求：到期日期优先 / 生产日期两套规则 + 倒计时）
 * @param {string} sc 生产日期
 * @param {string} dq 到期日期
 * @param {number} bzVal 保质期数值
 * @param {string} bzUnit 保质期单位 day/month/year
 * @param {number} warnDay 临期预警天数
 * @returns {{statusText:string, countDownText:string}}
 */
function calcBzStatus(sc, dq, bzVal, bzUnit, warnDay) {
    const totalBzDay = getBzTotalDay(bzVal, bzUnit);
    // 无保质期数据
    if (totalBzDay <= 0) {
        return { statusText: '无日期', countDownText: '' };
    }
    const warnThreshold = totalBzDay - warnDay;
    let diffDay = null;
    let countDown = '';
    let statusText = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 规则1：优先 使用【到期日期】计算
    if (dq) {
        const target = new Date(dq);
        target.setHours(0, 0, 0, 0);
        diffDay = Math.floor((target - today) / (1000 * 60 * 24));
    }
    // 规则2：无到期日期，使用【生产日期】推算剩余保质期
    else if (sc) {
        const produce = new Date(sc);
        produce.setHours(0, 0, 0, 0);
        const passDay = Math.floor((today - produce) / (1000 * 24));
        diffDay = totalBzDay - passDay;
    }
    // 两者都为空
    else {
        return { statusText: '无日期', countDownText: '' };
    }

    // 分级判断：过期 → 临期 → 打折 → 剩余天数
    if (diffDay <= 0) {
        statusText = '过期';
    } else if (diffDay <= warnThreshold) {
        statusText = '临期';
        countDown = diffDay - warnThreshold;
    } else if (diffDay <= 2 * warnThreshold) {
        statusText = '打折';
    } else {
        statusText = `剩余${diffDay}天`;
    }

    // 仅临期显示倒计时
    return {
        statusText,
        countDownText: statusText === '临期' ? `${countDown}天` : ''
    };
}

/**
 * 库存报警状态
 * @param {number} totalAllStock 总库存
 * @param {number} warnStockThreshold 库存预警阈值
 * @returns {string} 正常/临界/报警
 */
function calcStockWarnStatus(totalAllStock, warnStockThreshold) {
    const diff = totalAllStock - warnStockThreshold;
    if (diff > 0) return '正常';
    if (diff === 0) return '临界';
    return '报警';
}

/**
 * 获取单个入库批次剩余库存
 */
function getInItemRemain(inRecordId) {
    let totalOut = 0;
    allStockOut.forEach(out => {
        if (out.inRecordId == inRecordId) {
            totalOut += Number(out.outNum || 0);
        }
    });
    let inItem = allStockIn.find(x => x.id == inRecordId);
    let inNum = inItem ? Number(inItem.in_num || 0) : 0;
    return Math.max(0, inNum - totalOut);
}

/**
 * 计算批次库存金额：批次剩余库存 * 入库单价
 */
function getBatchStockAmount(inRecordId, inPrice) {
    const batchRemain = getInItemRemain(inRecordId);
    return Number((batchRemain * inPrice).toFixed(2));
}

// ====================== 库存查看页面 全局变量 ======================
let allStockBatchList = [];
let filteredStockBatch = [];
let stockCurrentPage = 1;
let stockPageSize = 10;
let stockTotalPages = 1;
let stockSortField = '';
let stockSortAsc = true;
// 筛选汇总缓存
let stockSummary = {
    totalAmount: 0,
    totalBatchStock: 0,
    totalAllStock: 0
};

/**
 * 加载全部库存批次数据
 */
async function loadStockStock() {
    // 前置加载入库、出库全局数据（保证数据源存在）
    if (allStockIn.length === 0) await loadStockIn();
    await preLoadStockOutData();

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取入库批次失败');
        const inAllList = await res.json();
        allStockBatchList = [];

        inAllList.forEach(inItem => {
            // 匹配对应商品基础信息
            const goodsBase = allGoods.find(g =>
                g.supplier === inItem.supplier
                && g.name === inItem.goodsName
                && g.spec === inItem.spec
            );
            if (!goodsBase) return;

            const totalAllStock = getTotalStockNum(inItem.supplier, inItem.goodsName);
            const warnStockThreshold = goodsBase.warn_num || 0;
            const batchRemain = getInItemRemain(inItem.id);
            const batchAmount = getBatchStockAmount(inItem.id, inItem.in_price);

            // 保质期单位映射：页面中文 → 函数英文标识
            let unitCode = "day";
            if (goodsBase.shelf_life_unit === "年") unitCode = "year";
            if (goodsBase.shelf_life_unit === "个月") unitCode = "month";
            // 临期预警天数 = 商品自身配置
            const warnDay = goodsBase.warn_num || 0;

            // 调用保质期计算
            const bzResult = calcBzStatus(
                inItem.produce_date,
                inItem.expire_date,
                goodsBase.shelf_life_num || 0,
                unitCode,
                warnDay
            );
            const stockWarnText = calcStockWarnStatus(totalAllStock, warnStockThreshold);

            // 页面展示用保质期文本
            let unitText = '天';
            if (goodsBase.shelf_life_unit === '年') unitText = '年';
            if (goodsBase.shelf_life_unit === '个月') unitText = '月';
            const bzText = `${goodsBase.shelf_life_num || 0}${unitText}`;

            allStockBatchList.push({
                id: inItem.id,
                supplier: inItem.supplier,
                goodsName: inItem.goodsName,
                spec: inItem.spec || '-',
                warnStockThreshold: warnStockThreshold,
                stockWarnText: stockWarnText,
                batchAmount: batchAmount,
                produce_date: inItem.produce_date || '-',
                expire_date: inItem.expire_date || '-',
                batchRemain: batchRemain,
                totalAllStock: totalAllStock,
                bzText: bzText,
                bzStatusText: bzResult.statusText,
                countDownText: bzResult.countDownText
            });
        });

        const totalEl = document.getElementById('stockTotalCount');
        if (totalEl) totalEl.textContent = allStockBatchList.length;
        filterStockStock();
    } catch (e) {
        showMsg('加载库存数据失败：' + e.message);
        console.error("库存加载异常：", e);
    }
}

/**
 * 搜索筛选（已修复变量名错误 allStockBatch → allStockBatchList）
 */
function filterStockStock() {
    const field = document.getElementById('stockSearchField').value;
    const kw = document.getElementById('stockSearchKeyword').value.toLowerCase();
    filteredStockBatch = allStockBatchList.filter(item => String(item[field] || '').toLowerCase().includes(kw));

    const searchCountEl = document.getElementById('stockSearchCount');
    if (searchCountEl) searchCountEl.textContent = filteredStockBatch.length;

    renderStockPagination();
    renderStockTable();
}

/**
 * 重置搜索
 */
function resetStockSearch() {
    document.getElementById('stockSearchKeyword').value = '';
    document.getElementById('stockSearchField').selectedIndex = 0;
    stockCurrentPage = 1;
    filterStockStock();
}

/**
 * 表头排序
 */
function stockSortTable(field) {
    stockSortField = field;
    stockSortAsc = stockSortField === field ? !stockSortAsc : true;
    filteredStockBatch.sort((a, b) => {
        const va = a[stockSortField] || '';
        const vb = b[stockSortField] || '';
        const numFields = ['warnStockThreshold', 'batchAmount', 'batchRemain', 'totalAllStock'];
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
 * 渲染表格（含汇总行）
 */
function renderStockTable() {
    const start = (stockCurrentPage - 1) * stockPageSize;
    const pageData = filteredStockBatch.slice(start, start + stockPageSize);
    const tb = document.getElementById('stockStockList');
    if (!tb) return;
    tb.innerHTML = '';
    let htmlStr = '';

    // 计算筛选汇总
    stockSummary = { totalAmount: 0, totalBatchStock: 0, totalAllStock: 0 };
    filteredStockBatch.forEach(item => {
        stockSummary.totalAmount += item.batchAmount;
        stockSummary.totalBatchStock += item.batchRemain;
        stockSummary.totalAllStock += item.totalAllStock;
    });

    // 渲染数据行
    pageData.forEach((item, idx) => {
        const seq = start + idx + 1;
        htmlStr += `
        <tr>
            <td>${seq}</td>
            <td>${item.supplier}</td>
            <td>${item.goodsName}</td>
            <td>${item.spec}</td>
            <td>${item.warnStockThreshold}</td>
            <td>${item.stockWarnText}</td>
            <td>${formatMoney(item.batchAmount)}</td>
            <td>${item.produce_date}</td>
            <td>${item.expire_date}</td>
            <td>${item.batchRemain}</td>
            <td>${item.totalAllStock}</td>
            <td>${item.bzText}</td>
            <td>${item.bzStatusText}</td>
            <td>${item.countDownText}</td>
        </tr>
        `;
    });

    // 底部汇总行
    htmlStr += `
    <tr style="background:#f5f7fa;font-weight:bold;">
        <td colspan="6">筛选数据汇总</td>
        <td>${formatMoney(stockSummary.totalAmount)}</td>
        <td colspan="2"></td>
        <td>${stockSummary.totalBatchStock}</td>
        <td>${stockSummary.totalAllStock}</td>
        <td colspan="3"></td>
    </tr>
    `;
    tb.innerHTML = htmlStr;
}

/**
 * 分页渲染（增加DOM容错，防止报错）
 */
function renderStockPagination() {
    stockTotalPages = Math.ceil(filteredStockBatch.length / stockPageSize) || 1;

    const currPageEl = document.getElementById('stockCurrentPage');
    const totalPageEl = document.getElementById('stockTotalPages');
    const pgBox = document.getElementById('stockPageNumbers');

    if (currPageEl) currPageEl.textContent = stockCurrentPage;
    if (totalPageEl) totalPageEl.textContent = stockTotalPages;
    if (pgBox) pgBox.innerHTML = '';

    const startPage = Math.max(1, stockCurrentPage - 2);
    const endPage = Math.min(stockTotalPages, startPage + 4);
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === stockCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => stockGoToPage(i);
        pgBox.appendChild(btn);
    }

    // 容错：判断按钮存在再设置禁用
    const btns = document.querySelectorAll('.page-controls .page-btn');
    if (btns.length >= 5) {
        btns[0].disabled = stockCurrentPage === 1;
        btns[1].disabled = stockCurrentPage === 1;
        btns[3].disabled = stockCurrentPage === stockTotalPages;
        btns[4].disabled = stockCurrentPage === stockTotalPages;
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
}

/**
 * 导出库存Excel
 */
function exportStockStockExcel() {
    if (filteredStockBatch.length === 0) {
        showMsg("暂无库存数据可导出");
        return;
    }
    const header = [
        "序列", "供应商", "商品名", "规格", "库存预警阈值", "报警状态", "库存金额",
        "生产日期", "到期日期", "批次库存", "总库存", "保质期", "保质期状态", "过期倒计"
    ];
    const expData = filteredStockBatch.map((item, idx) => [
        idx + 1,
        item.supplier,
        item.goodsName,
        item.spec,
        item.warnStockThreshold,
        item.stockWarnText,
        item.batchAmount,
        item.produce_date,
        item.expire_date,
        item.batchRemain,
        item.totalAllStock,
        item.bzText,
        item.bzStatusText,
        item.countDownText
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "库存明细");
    XLSX.writeFile(wb, "库存明细.xlsx");
}