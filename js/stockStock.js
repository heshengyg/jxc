// ====================== 库存查看页面 stockStock.js 完整代码 ======================
// 全局变量
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
    await preLoadStockOutData();
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取入库批次失败');
        const inAllList = await res.json();
        allStockBatchList = [];

        inAllList.forEach(inItem => {
            // 匹配商品基础信息
            const goodsBase = allGoods.find(g =>
                g.supplier === inItem.supplier
                && g.name === inItem.goodsName
                && g.spec === inItem.spec
            );
            if (!goodsBase) return;

            // 业务计算值
            const totalAllStock = getTotalStockNum(inItem.supplier, inItem.goodsName);
            const warnStockThreshold = goodsBase.warnStockThreshold || 0;
            const batchRemain = getInItemRemain(inItem.id);
            const batchAmount = getBatchStockAmount(inItem.id, inItem.in_price);
            const bzResult = calcBzStatus(
                inItem.produce_date,
                inItem.expire_date,
                goodsBase.bzVal,
                goodsBase.bzUnit,
                goodsBase.warnDay
            );
            const stockWarnText = calcStockWarnStatus(totalAllStock, warnStockThreshold);
            // 格式化保质期展示文本
            let unitText = '天';
            if (goodsBase.bzUnit === 'year') unitText = '年';
            if (goodsBase.bzUnit === 'month') unitText = '月';
            const bzText = `${goodsBase.bzVal}${unitText}`;

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
        if(totalEl) totalEl.textContent = allStockBatchList.length;
        filterStockStock();
    } catch (e) {
        showMsg('加载库存数据失败：' + e.message);
    }
}

/**
 * 搜索筛选
 */
function filterStockStock() {
    const field = document.getElementById('stockSearchField').value;
    const kw = document.getElementById('stockSearchKeyword').value.toLowerCase();
    filteredStockBatch = allStockBatchList.filter(item => String(item[field] || '').toLowerCase().includes(kw));
    
    const searchCountEl = document.getElementById('stockSearchCount');
    if(searchCountEl) searchCountEl.textContent = filteredStockBatch.length;
    
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
 * 渲染表格（含底部汇总行，一次性渲染无逐行卡顿）
 */
function renderStockTable() {
    const start = (stockCurrentPage - 1) * stockPageSize;
    const pageData = filteredStockBatch.slice(start, start + stockPageSize);
    const tb = document.getElementById('stockStockList');
    if (!tb) return;
    tb.innerHTML = '';
    let htmlStr = '';

    // 计算全筛选数据汇总
    stockSummary = { totalAmount: 0, totalBatchStock: 0, totalAllStock: 0 };
    filteredStockBatch.forEach(item => {
        stockSummary.totalAmount += item.batchAmount;
        stockSummary.totalBatchStock += item.batchRemain;
        stockSummary.totalAllStock += item.totalAllStock;
    });

    // 渲染分页行
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

// ========== 分页函数（与入库出库完全统一） ==========
function renderStockPagination() {
    stockTotalPages = Math.ceil(filteredStockBatch.length / stockPageSize) || 1;
    
    const currPageEl = document.getElementById('stockCurrentPage');
    const totalPageEl = document.getElementById('stockTotalPages');
    const pgBox = document.getElementById('stockPageNumbers');
    
    if(currPageEl) currPageEl.textContent = stockCurrentPage;
    if(totalPageEl) totalPageEl.textContent = stockTotalPages;
    if(pgBox) pgBox.innerHTML = '';

    const startPage = Math.max(1, stockCurrentPage - 2);
    const endPage = Math.min(stockTotalPages, startPage + 4);
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === stockCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => stockGoToPage(i);
        pgBox.appendChild(btn);
    }
    const btns = document.querySelectorAll('#stockStock .page-controls .page-btn');
    btns[0].disabled = stockCurrentPage === 1;
    btns[1].disabled = stockCurrentPage === 1;
    btns[3].disabled = stockCurrentPage === stockTotalPages;
    btns[4].disabled = stockCurrentPage === stockTotalPages;
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
    renderStockTable();
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