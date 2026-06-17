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
 * 2. 正常区间：状态为「剩余X天」，数值=打折日-今日
 * 3. 无日期：状态、倒计时均返回空字符串
 * 新增：打折状态同样显示【临期日期-今日】的天数倒计时
 */
function calcBzStatus(sc, dq, bzVal, bzUnit, warnDay) {
    // 1、保质期统一换算为总天数bzq
    const bzq = getBzTotalDay(bzVal, bzUnit);
    if (bzq <= 0) {
        return { statusText: '', countDownText: '' };
    }
    const lq = warnDay; // 临期天数从商品基础信息读取
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let hsdq; // 最终到期日期
    let lqrq;  // 临期日期
    let dzrq;  // 打折日期

    if (dq) {
        // 录入到期日期，直接使用dq作为最终到期日
        hsdq = new Date(dq);
        hsdq.setHours(0, 0, 0, 0);
        // 临期日期 = 到期日 - 临期天数
        lqrq = new Date(hsdq.getTime() - lq * 24 * 60 * 60 * 1000);
        // 打折日期 = 到期日 - 2*临期天数
        dzrq = new Date(hsdq.getTime() - 2 * lq * 24 * 60 * 60 * 1000);
    } else if (sc) {
        // 录入生产日期：通过生产日期+总保质期算出到期日
        const scDate = new Date(sc);
        scDate.setHours(0, 0, 0, 0);
        // 到期日期 = 生产日期 + 总保质期天数
        hsdq = new Date(scDate.getTime() + bzq * 24 * 60 * 60 * 1000);
        // 临期日期 = 生产日期 + (总保质期 - 临期天数)
        lqrq = new Date(scDate.getTime() + (bzq - lq) * 24 * 60 * 60 * 1000);
        // 打折日期 = 生产日期 + (总保质期 - 2*临期天数)
        dzrq = new Date(scDate.getTime() + (bzq - 2 * lq) * 24 * 60 * 60 * 1000);
    } else {
        // 两个日期都未填写：返回空
        return { statusText: '', countDownText: '' };
    }

    let statusText = '';
    let countDownText = '';
    // 1、今日 >= 到期日 → 过期
    if (today >= hsdq) {
        statusText = '过期';
    }
    // 2、到期日 > 今日 >= 临期日 → 临期，倒计=到期日-今日天数
    else if (today >= lqrq) {
        statusText = '临期';
        const remainDay = Math.floor((hsdq - today) / (1000 * 60 * 60 * 24));
        countDownText = `${remainDay}`;
    }
    // 3、临期日 > 今日 >= 打折日 → 打折，倒计=临期日期 - 今日天数
    else if (today >= dzrq) {
        statusText = '打折';
        const remainDay = Math.floor((lqrq - today) / (1000 * 60 * 60 * 24));
        countDownText = `${remainDay}`;
    }
    // 4、打折日 > 今日 >= 生产日期 → 正常，显示剩余【打折日-今日】天数
    else {
        const remainDay = Math.floor((dzrq - today) / (1000 * 60 * 60 * 24));
        statusText = `剩余${remainDay}天`;
    }

    return {
        statusText,
        countDownText
    };
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
 * 单个入库ID 剩余库存
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

/**
 * 加载库存数据
 * 合并规则：供应商 + 商品名 + 规格 + 入库单价 + 生产日期 + 到期日期 为同一批次
 * 修改点1：仅批次库存>0才加入列表，过滤批次库存为0的行
 */
async function loadStockStock() {
    // 前置加载全局入库、出库数据
    if (allStockIn.length === 0) await loadStockIn();
    await preLoadStockOutData();

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取入库批次失败');
        const inAllList = await res.json();

        // ========== 核心：按规则合并库存批次 ==========
        const batchMap = new Map();
        inAllList.forEach(inItem => {
            // 合并唯一键：供应商+商品名+规格+入库单价+生产日期+到期日期
            const key = `${inItem.supplier}||${inItem.goodsName}||${inItem.spec || ''}||${inItem.in_price || 0}||${inItem.produce_date || ''}||${inItem.expire_date || ''}`;

            // 计算当前单条剩余库存
            const singleRemain = getInItemRemain(inItem.id);

            if (batchMap.has(key)) {
                // 同批次：累加数量
                const batch = batchMap.get(key);
                batch.totalRemain += singleRemain;
                batch.totalInNum += Number(inItem.in_num || 0);
            } else {
                // 新批次：初始化，新增结算方式
                const goodsBase = allGoods.find(g =>
                    g.supplier === inItem.supplier
                    && g.name === inItem.goodsName
                    && g.spec === inItem.spec
                );
                batchMap.set(key, {
                    supplier: inItem.supplier,
                    goodsName: inItem.goodsName,
                    spec: inItem.spec || '-',
                    settleType: inItem.settleType || '-',
                    inPrice: inItem.in_price || 0,
                    produce_date: inItem.produce_date || '-',
                    expire_date: inItem.expire_date || '-',
                    totalInNum: Number(inItem.in_num || 0),
                    totalRemain: singleRemain,
                    goodsBase: goodsBase
                });
            }
        });

        // 转为数组，构建最终渲染数据
        allStockBatchList = [];
        batchMap.forEach(batch => {
            // 修改需求1：过滤批次库存为0的行，只保留>0的数据
            if (batch.totalRemain <= 0) return;

            const goodsBase = batch.goodsBase;
            if (!goodsBase) return;

            // 该商品【全局总库存】（所有同商品批次合计）
            const totalAllStock = getTotalStockNum(batch.supplier, batch.goodsName);
            const warnStockThreshold = goodsBase.warn_num || 0;
            const batchAmount = getBatchStockAmount(batch.totalRemain, batch.inPrice);

            // 保质期参数转换
            let unitCode = "day";
            if (goodsBase.shelf_life_unit === "年") unitCode = "year";
            if (goodsBase.shelf_life_unit === "个月") unitCode = "month";
            const warnDay = goodsBase.warn_num || 0;

            // 计算保质期状态 & 倒计时
            const bzResult = calcBzStatus(
                batch.produce_date === '-' ? '' : batch.produce_date,
                batch.expire_date === '-' ? '' : batch.expire_date,
                goodsBase.shelf_life_num || 0,
                unitCode,
                warnDay
            );
            const stockWarnText = calcStockWarnStatus(totalAllStock, warnStockThreshold);

            // 保质期单位展示：无保质期则为空，不再显示0天
            let bzText = '';
            if (goodsBase.shelf_life_num && goodsBase.shelf_life_unit) {
                bzText = `${goodsBase.shelf_life_num}${goodsBase.shelf_life_unit}`;
            }

            allStockBatchList.push({
                supplier: batch.supplier,
                goodsName: batch.goodsName,
                spec: batch.spec,
                settleType: batch.settleType,
                outPrice: batch.inPrice,
                batchRemain: batch.totalRemain,
                totalAllStock: totalAllStock,
                warnStockThreshold: warnStockThreshold,
                stockWarnText: stockWarnText,
                batchAmount: batchAmount,
                produce_date: batch.produce_date,
                expire_date: batch.expire_date,
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
 * 搜索筛选（原有点击搜索按钮依然保留可用，新增输入实时触发）
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
        // 保质期状态背景色：过期深红，临期浅红，打折浅蓝
        let bzBg = '';
        if (item.bzStatusText === '过期') {
            bzBg = 'style="background:#ff4444;color:#fff;"';
        } else if (item.bzStatusText === '临期') {
            bzBg = 'style="background:#ffdddd;"';
        } else if (item.bzStatusText === '打折') {
            bzBg = 'style="background:#ddeeff;"';
        }

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

    const btns = document.querySelectorAll('.page-controls .page-btn');
    if (btns.length >= 5) {
        btns[0].disabled = stockCurrentPage === 1;
        btns[1].disabled = stockCurrentPage === 1;
        btns[3].disabled = stockCurrentPage === stockTotalPages;
        btns[4].disabled = stockTotalPages;
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