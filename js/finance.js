// 加载全部退货记录
async function loadAllReturnGoods() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        allReturnGoods = await res.json();
        window.allReturnGoods = allReturnGoods;
    } catch(e) {
        console.error('加载退货记录失败:', e);
        allReturnGoods = [];
        window.allReturnGoods = allReturnGoods;
    }
}

// ===================== 格式化金额函数 =====================
function formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '￥0.00';
    }
    return '￥' + Number(value).toFixed(2);
}

// ===================== 累计余额计算引擎 =====================

// ===================== 累计余额计算引擎（保留先录先核销） =====================

/**
 * 重新计算单个供应商的累计余额（按日期正序，先录先核销）
 * @param {string} supplier - 供应商名称
 * @returns {Promise<Object>} 计算结果
 */
async function recalculateSupplierCumulativeBalances(supplier) {
    if (!supplier) return null;

    // ===== 1. 获取该供应商的所有入库记录（线下，按日期正序） =====
    const inRecords = allStockInList
        .filter(i => i.supplier === supplier && i.settleType === '线下')
        .sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

    if (inRecords.length === 0) {
        return { payable: 0, invoiceBalance: 0 };
    }

    // ===== 2. 获取该供应商的所有退货记录 =====
    const returnRecords = (allReturnGoods || [])
        .filter(r => r.supplier === supplier && r.settle_type === '线下');

    // ===== 3. 获取该供应商的所有付款记录 =====
    const totalPay = allPayList
        .filter(p => p.supplier === supplier)
        .reduce((sum, p) => sum + Number(p.payment_amount), 0);

    // ===== 4. 获取该供应商的所有发票返回记录 =====
    const totalInvoice = allInvoiceBackList
        .filter(b => b.supplier === supplier)
        .reduce((sum, b) => sum + Number(b.invoice_amount), 0);

    // ===== 5. 构建退货映射表：按 in_record_id 精确匹配 =====
    const returnMap = {};
    returnRecords.forEach(r => {
        const inId = r.in_record_id;
        if (!inId) return;  // 如果没有关联ID，跳过
        if (!returnMap[inId]) returnMap[inId] = 0;
        returnMap[inId] += Number(r.in_price) * Number(r.return_num);
    });

    // ===== 6. 按录入日期正序计算累计净入库 =====
    const sortedInRecords = [...inRecords].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));
    
    let cumNetIn = 0;
    const updates = [];
    let totalIn = 0;
    let totalReturn = 0;

    for (const record of sortedInRecords) {
        const amount = Number(record.in_price) * Number(record.in_num);
        const returnAmount = returnMap[record.id] || 0;
        const netAmount = amount - returnAmount;
        
        totalIn += amount;
        totalReturn += returnAmount;
        cumNetIn += netAmount;
        
        // ✅ 每条入库记录存储其核销后的累计结余
        updates.push({
            id: record.id,
            cumulative_invoice_balance: totalInvoice - cumNetIn,
            cumulative_pay_balance: cumNetIn - totalPay
        });
    }

    // ===== 7. 批量更新 stock_in 表 =====
    for (const update of updates) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${update.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cumulative_invoice_balance: update.cumulative_invoice_balance,
                    cumulative_pay_balance: update.cumulative_pay_balance
                })
            });
        } catch (e) {
            console.error(`更新入库记录 ${update.id} 失败:`, e);
        }
    }

    // ===== 8. 返回计算结果 =====
    const payable = totalIn - totalReturn - totalPay;
    const invoiceBalance = totalInvoice - totalIn + totalReturn;

    return {
        payable: payable,
        invoiceBalance: invoiceBalance,
        totalIn: totalIn,
        totalReturn: totalReturn,
        totalPay: totalPay,
        totalInvoice: totalInvoice
    };
}
/**
 * 重新计算所有供应商的累计余额
 * 用于初始化或数据迁移
 */
async function recalculateAllSuppliersBalances() {
    const suppliers = [...new Set(allStockInList
        .filter(i => i.settleType === '线下')
        .map(i => i.supplier)
        .filter(Boolean)
    )];
    
    if (suppliers.length === 0) {
        console.log('没有需要计算的供应商');
        return;
    }
    
    console.log(`开始计算 ${suppliers.length} 个供应商的累计余额...`);
    
    let count = 0;
    for (const supplier of suppliers) {
        await recalculateSupplierCumulativeBalances(supplier);
        count++;
        if (count % 10 === 0) {
            console.log(`已计算 ${count}/${suppliers.length} 个供应商`);
        }
    }
    
    console.log(`累计余额计算完成！共 ${count} 个供应商`);
}

// ===================== 手写签名配置 =====================
const SIGNATURE_CONFIG = {
    // 库管员签字（留空则不显示图片，显示下划线）
    storeKeeper: 'images/storeKeeper.png',
    // 业务员签字（留空则不显示图片，显示下划线）
    business: 'images/business.png',
    // 财务审核签字（留空则不显示图片，显示下划线）
    finance: 'images/finance.png'
};
// ===================== 全局公共变量 =====================
let currFinanceSub = 'taxRate';
let offlineSupplierList = [];
let monthDistinctList = [];

// 安全兼容全局商品，防止页面加载顺序报错
let allGoodsList = window.allGoods || [];
let allStockInList = [];
let allPayList = [];
let allInvoiceBackList = [];

// 新增：税率页面下拉缓存变量
let currTaxSupplierList = [];
let currTaxGoodsList = [];
let currTaxRateOptionList = [
    {val:'',text:'全部税率'},
    {val:null,text:'未设置'},
    {val:'0',text:'0%'},
    {val:'9',text:'9%'},
    {val:'13',text:'13%'}
];

// ✅ 添加缓存变量
let stockInCheckCache = {
    displayData: [],
    filterKey: '',
    total: 0
};

// 财务全局分页公共变量（9个页面独立分页参数，互不干扰）
const financePageConfig = {
    taxRate: { pageSize: 10, current: 1, total: 0 },
    stockInPrint: { pageSize: 10, current: 1, total: 0, sortField: 'record_date', sortType: 'desc' },
    payRecord: { pageSize: 10, current: 1, total: 0 },
    invoiceBack: { pageSize: 10, current: 1, total: 0 },
    paymentBoard: { pageSize: 10, current: 1, total: 0 },
    monthInvoiceBalance: { pageSize: 10, current: 1, total: 0 },
    stockInCheck: { pageSize: 10, current: 1, total: 0 },
    stockOutCheck: { pageSize: 10, current: 1, total: 0 },
    monthBeginStock: { pageSize: 10, current: 1, total: 0 }
};

// 打印筛选下拉缓存
let printSupplierSearchList = [];
let printGoodsSearchList = [];
let printSpecSearchList = [];
let selectedPrintIds = new Set();
let skipPrintAllChange = false;


// 重写Tab切换，进入财务页先强制关闭税率弹窗，避免自动弹出
const originSwitchTab = switchTab;
switchTab = async function (tabName) {
    originSwitchTab(tabName);
    if (tabName === 'finance') {
        const taxModal = document.getElementById('taxModal');
        if (taxModal) taxModal.style.display = 'none';
        await initFinanceBaseData();
        await switchFinanceSubTab('taxRate');
        document.querySelector('.finance-sub-btn').classList.add('active');
    }
}

// 财务子Tab切换
async function switchFinanceSubTab(tabKey) {
    try {
        currFinanceSub = tabKey;

        // 切换子版块时强制关闭所有弹窗
        const modals = ['payModal', 'invoiceBackModal', 'taxModal'];
        modals.forEach(id => {
            try {
                const modal = document.getElementById(id);
                if (modal) {
                    modal.style.display = 'none';
                }
            } catch(e) {
                console.warn('关闭弹窗失败:', id, e);
            }
        });

        // 切换子页面前，清空所有9个财务分页，杜绝分页叠加
        const paginationIds = [
            'page_taxRate',
            'page_stockInPrint',
            'page_payRecord',
            'page_invoiceBack',
            'page_paymentBoard',
            'page_monthInvoiceBalance',
            'page_stockInCheck',
            'page_stockOutCheck',
            'page_monthBeginStock'
        ];
        paginationIds.forEach(id => {
            try {
                const pageDom = document.getElementById(id);
                if (pageDom) {
                    pageDom.innerHTML = '';
                }
            } catch(e) {
                console.warn('清空分页失败:', id, e);
            }
        });

        // 隐藏所有子内容
        const contents = document.querySelectorAll('.finance-sub-content');
        contents.forEach(el => {
            try {
                el.style.display = 'none';
            } catch(e) {
                console.warn('隐藏子内容失败:', e);
            }
        });
        
        // 显示目标子内容
        const targetContent = document.getElementById(`sub-${tabKey}`);
        if (targetContent) {
            targetContent.style.display = 'block';
        }

        // 移除所有按钮的激活状态
        const btns = document.querySelectorAll('.finance-sub-btn');
        btns.forEach(btn => {
            try {
                btn.classList.remove('active');
            } catch(e) {
                console.warn('移除按钮激活状态失败:', e);
            }
        });
        
        // 激活目标按钮
        const targetBtn = document.querySelector(`.finance-sub-btn[data-tab="${tabKey}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }

        // 修复父容器高度，确保所有子版块都能显示
        const financeContainer = document.getElementById('finance');
        if (financeContainer) {
            financeContainer.style.height = 'auto';
            financeContainer.style.minHeight = '600px';
            financeContainer.style.overflow = 'visible';
        }
        
        // 初始化子页面
        await initCurrentSubPage();
        
    } catch(e) {
        console.error('switchFinanceSubTab 执行失败:', e);
    }
}
 
// 财务分页公共渲染函数（统一分页底部UI：每页显示下拉、当前/总页数，复用项目现有pagination样式）
function renderFinancePagination(pageKey) {
    const cfg = financePageConfig[pageKey];
    const totalPages = Math.ceil(cfg.total / cfg.pageSize) || 1;
    const pageHtml = `
        <div class="page-info">
            每页显示 <select onchange="changeFinancePageSize('${pageKey}',this.value)">
                <option value="10" ${cfg.pageSize===10?'selected':''}>10</option>
                <option value="20" ${cfg.pageSize===20?'selected':''}>20</option>
                <option value="50" ${cfg.pageSize===50?'selected':''}>50</option>
            </select> 条，当前第 <span>${cfg.current}</span> / <span>${totalPages}</span> 页
        </div>
        <div class="page-controls">
            <button class="page-btn" onclick="financeGoToPage('${pageKey}',1)" ${cfg.current===1?'disabled':''}>首页</button>
            <button class="page-btn" onclick="financeGoToPage('${pageKey}',${cfg.current-1})" ${cfg.current===1?'disabled':''}>上一页</button>
            <button class="page-btn" onclick="financeGoToPage('${pageKey}',${cfg.current+1})" ${cfg.current>=totalPages?'disabled':''}>下一页</button>
            <button class="page-btn" onclick="financeGoToPage('${pageKey}',${totalPages})" ${cfg.current>=totalPages?'disabled':''}>末页</button>
        </div>
    `;
    const pageWrap = document.getElementById(`page_${pageKey}`);
    if(pageWrap) pageWrap.innerHTML = pageHtml;
}

// 切换每页条数
function changeFinancePageSize(pageKey, size) {
    financePageConfig[pageKey].pageSize = Number(size);
    financePageConfig[pageKey].current = 1;
    if(pageKey === 'stockInPrint'){
        searchPrintStockIn(true);
    } else if(pageKey === 'stockInCheck'){
        searchStockInCheck(true);
    } else if(pageKey === 'stockOutCheck'){
        searchStockOutCheck(true);
    } else if(pageKey === 'monthInvoiceBalance'){
        searchMonthInvoiceBalance(true);
    } else if(pageKey === 'taxRate'){
        refreshTaxList(true);
    } else if(pageKey === 'payRecord'){
        refreshPayRecordList(true);
    } else if(pageKey === 'invoiceBack'){
        refreshInvoiceBackList(true);
    } else if(pageKey === 'monthBeginStock'){
        searchMonthBeginStock(true);
    }else{
        initCurrentSubPage();
    }
}

// 跳转指定页
function financeGoToPage(pageKey, targetPage) {
    const cfg = financePageConfig[pageKey];
    const totalPages = Math.ceil(cfg.total / cfg.pageSize) || 1;
    if(targetPage < 1 || targetPage > totalPages) return;
    cfg.current = targetPage;
    if(pageKey === 'stockInPrint'){
        searchPrintStockIn(false);
    } else if(pageKey === 'stockInCheck'){
        searchStockInCheck(false);
    } else if(pageKey === 'stockOutCheck'){
        searchStockOutCheck(false);
    } else if(pageKey === 'monthInvoiceBalance'){
        searchMonthInvoiceBalance(false);
    } else if(pageKey === 'taxRate'){
        refreshTaxList(false);
    } else if(pageKey === 'payRecord'){
        refreshPayRecordList(false);
    } else if(pageKey === 'invoiceBack'){
        refreshInvoiceBackList(false);
    } else if(pageKey === 'monthBeginStock'){
        searchMonthBeginStock(false);
    }else{
        initCurrentSubPage();
    }
}
// 财务基础数据初始化（全局只加载一次）
async function initFinanceBaseData() {
    await Promise.all([
        loadOfflineSupplier(),
        loadDistinctMonth(),
        loadAllGoods(),
        loadAllStockIn(),
        loadAllPayment(),
        loadAllInvoiceBack(),
        loadAllStockOut(),
        loadAllReturnGoods()  // ✅ 包含 loadAllReturnGoods
    ]);
    
    // ✅ 数据加载完成后，计算所有供应商的累计余额
    await recalculateAllSuppliersBalances();
}
// 加载线下去重供应商
async function loadOfflineSupplier() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/goods?select=supplier&channel=eq.线下`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    const set = new Set();
    data.forEach(item => item.supplier && set.add(item.supplier));
    offlineSupplierList = Array.from(set);
}

// 加载入库去重月份
async function loadDistinctMonth() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?select=record_date`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    const set = new Set();
    data.forEach(item => {
        if (item.record_date) set.add(item.record_date.substring(0, 7));
    });
    monthDistinctList = Array.from(set).sort().reverse();
}

// 加载全部商品，同步更新window全局，实现双向数据同步
async function loadAllGoods() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    window.allGoods = await res.json();
    allGoodsList = window.allGoods;
}

// 加载全部入库单
async function loadAllStockIn() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    allStockInList = await res.json();
}

// 加载全部付款记录
async function loadAllPayment() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/finance_payment`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    allPayList = await res.json();
}

// 加载全部发票返回记录
async function loadAllInvoiceBack() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    allInvoiceBackList = await res.json();
}

// 加载全部出库记录
async function loadAllStockOut() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    window.allStockOut = await res.json();
}

// 当前子页面初始化分发
async function initCurrentSubPage() {
    try {
        switch (currFinanceSub) {
            case 'taxRate': 
                initTaxRatePage(); 
                break;
            case 'stockInPrint': 
                initStockInPrintPage(); 
                break;
            case 'payRecord': 
                await initPayRecordPage(); 
                break;
            case 'invoiceBack': 
                await initInvoiceBackPage(); 
                break;
            case 'paymentBoard': 
                initPaymentBoardPage(); 
                break;
            case 'monthInvoiceBalance': 
                initMonthBalancePage(); 
                break;
            case 'stockInCheck': 
                initStockInCheckPage(); 
                break;
            case 'stockOutCheck': 
                initStockOutCheckPage(); 
                break;
            case 'monthBeginStock': 
                initMonthBeginPage(); 
                break;
            default:
                console.error('未知的 subTab:', currFinanceSub);
        }
    } catch(e) {
        console.error('initCurrentSubPage 执行失败:', e);
    }
}

// ===================== ①税率录入模块：仅线下商品、进入页面自动关闭弹窗、自动加载列表 =====================
function initTaxRatePage() {
    const taxModal = document.getElementById('taxModal');
    if(taxModal) taxModal.style.display = 'none';
    initTaxSupplierFilter();
    // 重置搜索框
    document.getElementById('taxSupplierSearch').value = '';
    document.getElementById('taxGoodsSearch').value = '';
    document.getElementById('taxRateSearch').value = '';
    refreshTaxList(true);
}

function initTaxSupplierFilter() {
    const supplierSet = new Set();
    allGoodsList.filter(g => g.channel === '线下').forEach(g => supplierSet.add(g.supplier));
    currTaxSupplierList = Array.from(supplierSet);

    currTaxGoodsList = allGoodsList.filter(g => g.channel === '线下');

    document.getElementById('taxSupplierSearch').value = '';
    document.getElementById('taxGoodsSearch').value = '';
    document.getElementById('taxRateSearch').value = '';

    document.getElementById('taxSupplierListBox').style.display = 'none';
    document.getElementById('taxGoodsListBox').style.display = 'none';
    document.getElementById('taxRateListBox').style.display = 'none';
}

// 供应商下拉相关函数
function showTaxSupplierList(){
    renderTaxSupplierList(currTaxSupplierList);
    document.getElementById('taxSupplierListBox').style.display = 'block';
}
function filterTaxSupplierList(){
    let kw = document.getElementById('taxSupplierSearch').value.toLowerCase();
    let filterList = currTaxSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderTaxSupplierList(filterList);
    document.getElementById('taxSupplierListBox').style.display = 'block';
}
function renderTaxSupplierList(list){
    let box = document.getElementById('taxSupplierListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(sup=>{
        let div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = sup;
        div.onclick = function(){
            document.getElementById('taxSupplierSearch').value = sup;
            document.getElementById('taxSupplierListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// 商品名称下拉相关函数
function showTaxGoodsList(){
    renderTaxGoodsList(currTaxGoodsList);
    document.getElementById('taxGoodsListBox').style.display = 'block';
}
function filterTaxGoodsList(){
    let kw = document.getElementById('taxGoodsSearch').value.toLowerCase();
    let filterList = currTaxGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderTaxGoodsList(filterList);
    document.getElementById('taxGoodsListBox').style.display = 'block';
}
function renderTaxGoodsList(list){
    let box = document.getElementById('taxGoodsListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(goods=>{
        let div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = goods.name;
        div.onclick = function(){
            document.getElementById('taxGoodsSearch').value = goods.name;
            document.getElementById('taxGoodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// 税率下拉相关函数
function showTaxRateList(){
    renderTaxRateList(currTaxRateOptionList);
    document.getElementById('taxRateListBox').style.display = 'block';
}
function filterTaxRateList(){
    let kw = document.getElementById('taxRateSearch').value.toLowerCase();
    let filterList = currTaxRateOptionList.filter(item => item.text.toLowerCase().includes(kw));
    renderTaxRateList(filterList);
    document.getElementById('taxRateListBox').style.display = 'block';
}
function renderTaxRateList(list){
    let box = document.getElementById('taxRateListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(item=>{
        let div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = item.text;
        div.dataset.taxVal = item.val;
        div.onclick = function(){
            document.getElementById('taxRateSearch').value = this.innerText;
            document.getElementById('taxRateListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// 多条件筛选刷新表格
function refreshTaxList(resetPage = true) {
if(resetPage){
    financePageConfig.taxRate.current = 1;
}
    const selectSupplier = document.getElementById('taxSupplierSearch').value.trim();
    const selectGoodsName = document.getElementById('taxGoodsSearch').value.trim();
    const selectTaxText = document.getElementById('taxRateSearch').value.trim();

    let list = [...allGoodsList.filter(g => g.channel === '线下')];

    // 模糊匹配
    if (selectSupplier) {
        list = list.filter(g => (g.supplier || '').toLowerCase().includes(selectSupplier.toLowerCase()));
    }
    if (selectGoodsName) {
        list = list.filter(g => (g.name || '').toLowerCase().includes(selectGoodsName.toLowerCase()));
    }
    if (selectTaxText) {
        const targetTax = currTaxRateOptionList.find(item => item.text === selectTaxText);
        if (targetTax) {
            if (targetTax.val === null) {
                list = list.filter(g => g.tax_rate === null || g.tax_rate === undefined || g.tax_rate === '');
            } else if (targetTax.val !== '') {
                list = list.filter(g => String(g.tax_rate) === targetTax.val);
            }
        }
    }

    // 排序：未设置优先，再按 id 降序
    list.sort((a, b) => {
        const aUnset = (a.tax_rate === null || a.tax_rate === undefined || a.tax_rate === '') ? 0 : 1;
        const bUnset = (b.tax_rate === null || b.tax_rate === undefined || b.tax_rate === '') ? 0 : 1;
        if (aUnset !== bUnset) return aUnset - bUnset;
        return b.id - a.id;
    });

    const cfg = financePageConfig.taxRate;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('taxRateList');
    tbody.innerHTML = '';
    pageData.forEach((item, idx) => {
        const isUnset = (item.tax_rate === null || item.tax_rate === undefined || item.tax_rate === '');
        const taxDisplay = isUnset ? '未设置' : item.tax_rate + '%';
        const taxStyle = isUnset ? 'style="color:red;"' : '';
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.name}</td>
            <td>${item.spec || ''}</td>
            <td>${item.channel}</td>
            <td ${taxStyle}>${taxDisplay}</td>
            <td><button class="btn btn-primary" onclick="openTaxEdit(${item.id})">编辑税率</button></td>
        </tr>`;
    });
    renderFinancePagination('taxRate');
}

// ========== 税率录入实时搜索（输入即搜索） ==========
function onTaxFilterInput() {
    refreshTaxList(true);
    
    const supplierInput = document.getElementById('taxSupplierSearch');
    const goodsInput = document.getElementById('taxGoodsSearch');
    const rateInput = document.getElementById('taxRateSearch');
    
    if (document.activeElement === supplierInput) {
        const kw = supplierInput.value.toLowerCase().trim();
        const filtered = currTaxSupplierList.filter(s => s.toLowerCase().includes(kw));
        renderTaxSupplierList(filtered);
        document.getElementById('taxSupplierListBox').style.display = 'block';
    } else if (document.activeElement === goodsInput) {
        const kw = goodsInput.value.toLowerCase().trim();
        const filtered = currTaxGoodsList.filter(g => g.name.toLowerCase().includes(kw));
        renderTaxGoodsList(filtered);
        document.getElementById('taxGoodsListBox').style.display = 'block';
    } else if (document.activeElement === rateInput) {
        const kw = rateInput.value.toLowerCase().trim();
        const filtered = currTaxRateOptionList.filter(item => item.text.toLowerCase().includes(kw));
        renderTaxRateList(filtered);
        document.getElementById('taxRateListBox').style.display = 'block';
    }
}

// ========== 税率录入重置搜索 ==========
function resetTaxSearch() {
    document.getElementById('taxSupplierSearch').value = '';
    document.getElementById('taxGoodsSearch').value = '';
    document.getElementById('taxRateSearch').value = '';
    document.getElementById('taxSupplierListBox').style.display = 'none';
    document.getElementById('taxGoodsListBox').style.display = 'none';
    document.getElementById('taxRateListBox').style.display = 'none';
    refreshTaxList(true);
}

function openTaxEdit(id) {
    document.getElementById('taxEditId').value = id;
    const row = allGoodsList.find(g => g.id === id);
    document.getElementById('taxRateSelect').value = row.tax_rate || '0';
    const modalDom = document.getElementById('taxModal');
    modalDom.style.display = 'flex';
    modalDom.style.zIndex = '9999';
}
function closeTaxModal() {
    document.getElementById('taxModal').style.display = 'none';
}
async function saveTaxData() {
    const id = document.getElementById('taxEditId').value;
    const taxRate = document.getElementById('taxRateSelect').value;
    await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tax_rate: taxRate })
    });
    await loadAllGoods();
    if(typeof loadGoods === 'function'){
        await loadGoods();
    }
    closeTaxModal();
    refreshTaxList(true);
    showMsg('税率保存成功，商品管理页面数据已同步更新');
}

// ===================== ②入库单打印模块 =====================
let printStockInData = [];
const printStyle = `
<style media="print">
body{margin:0;padding:0;}
body *{visibility:hidden;}
#printPreviewWrap, #printPreviewWrap *{visibility:visible;}
#printPreviewWrap{width:100%;}
@page{
  size:A5 landscape;
  margin:1.5cm;
  marks:none;
  break-before:avoid;
  break-after:avoid;
}
.supplier-bill{
  width:100%;
  margin-top:0 !important;
  padding-top:0 !important;
  page-break-inside:avoid;
  font-family:"SimSun",宋体;
  text-align:center;
}
.bill-title{
  font-size:20pt;
  font-weight:bold;
  margin:0 0 6px;
}
.bill-header{
  display:flex;
  justify-content:space-between;
  font-size:12px;
  margin-bottom:8px;
}
.goods-table{
  width:clamp(100%,130%,140%);
  margin:0 auto;
  border-collapse:collapse;
  table-layout:fixed;
}
.goods-table th:nth-child(1),.goods-table td:nth-child(1){width:14%}
.goods-table th:nth-child(2),.goods-table td:nth-child(2){width:14%}
.goods-table th:nth-child(3),.goods-table td:nth-child(3){width:26%}
.goods-table th:nth-child(4),.goods-table td:nth-child(4){width:14%}
.goods-table th:nth-child(5),.goods-table td:nth-child(5){width:16%}
.goods-table th:nth-child(6),.goods-table td:nth-child(6){width:16%}
.goods-table th{border:2px solid #000;padding:5px 2px;background:#f5f5f5;}
.goods-table td{border:1px solid #000;padding:4px 2px;}
.total-row td{border-top:2px solid #000;font-weight:bold;}
.bill-footer{
  display:flex;
  justify-content:space-between;
  margin-top:12px;
  font-size:11px;
}
</style>
`;

function initStockInPrintPage() {
    const cfg = financePageConfig.stockInPrint;
    cfg.sortField = 'record_date';
    cfg.sortType = 'desc';

    printSupplierSearchList = [...new Set(allStockInList.filter(i=>i.settleType==='线下').map(i=>i.supplier))];
    printGoodsSearchList = [...new Set(allStockInList.filter(i=>i.settleType==='线下').map(i=>i.goodsName))];
    printSpecSearchList = [...new Set(allStockInList.filter(i=>i.settleType==='线下').map(i=>i.spec).filter(Boolean))];

    document.getElementById('printSupplierSearch').value = '';
    document.getElementById('printGoodsNameSearch').value = '';
    document.getElementById('printSpecSearch').value = '';
    document.getElementById('printStartDate').value = '';
    document.getElementById('printEndDate').value = '';
    document.getElementById('printSupplierListBox').style.display = 'none';
    document.getElementById('printGoodsListBox').style.display = 'none';
    document.getElementById('printSpecListBox').style.display = 'none';

    document.getElementById('printStockInList').innerHTML = '';
    printStockInData = [];
    renderFinancePagination('stockInPrint');
}

// 供应商搜索下拉
function showPrintSupplierList(){
    renderPrintSupplierList(printSupplierSearchList);
    document.getElementById('printSupplierListBox').style.display = 'block';
}
function filterPrintSupplierList(){
    const kw = document.getElementById('printSupplierSearch').value.toLowerCase();
    const filter = printSupplierSearchList.filter(s=>s.toLowerCase().includes(kw));
    renderPrintSupplierList(filter);
    document.getElementById('printSupplierListBox').style.display = 'block';
}
function renderPrintSupplierList(list){
    const box = document.getElementById('printSupplierListBox');
    box.innerHTML = '';
    if(!list.length){
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配</div>';
        return;
    }
    list.forEach(s=>{
        const div = document.createElement('div');
        div.style.padding='6px 10px';
        div.style.cursor='pointer';
        div.style.borderBottom='1px solid #eee';
        div.innerText = s;
        div.onclick = ()=>{
            document.getElementById('printSupplierSearch').value = s;
            document.getElementById('printSupplierListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// 商品名称搜索下拉
function showPrintGoodsList(){
    renderPrintGoodsList(printGoodsSearchList);
    document.getElementById('printGoodsListBox').style.display = 'block';
}
function filterPrintGoodsList(){
    const kw = document.getElementById('printGoodsNameSearch').value.toLowerCase();
    const filter = printGoodsSearchList.filter(s=>s.toLowerCase().includes(kw));
    renderPrintGoodsList(filter);
    document.getElementById('printGoodsListBox').style.display = 'block';
}
function renderPrintGoodsList(list){
    const box = document.getElementById('printGoodsListBox');
    box.innerHTML = '';
    if(!list.length){
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配</div>';
        return;
    }
    list.forEach(s=>{
        const div = document.createElement('div');
        div.style.padding='6px 10px';
        div.style.cursor='pointer';
        div.style.borderBottom='1px solid #eee';
        div.innerText = s;
        div.onclick = ()=>{
            document.getElementById('printGoodsNameSearch').value = s;
            document.getElementById('printGoodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// 规格搜索下拉
function showPrintSpecList(){
    renderPrintSpecList(printSpecSearchList);
    document.getElementById('printSpecListBox').style.display = 'block';
}
function filterPrintSpecList(){
    const kw = document.getElementById('printSpecSearch').value.toLowerCase();
    const filter = printSpecSearchList.filter(s=>s.toLowerCase().includes(kw));
    renderPrintSpecList(filter);
    document.getElementById('printSpecListBox').style.display = 'block';
}
function renderPrintSpecList(list){
    const box = document.getElementById('printSpecListBox');
    box.innerHTML = '';
    if(!list.length){
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配</div>';
        return;
    }
    list.forEach(s=>{
        const div = document.createElement('div');
        div.style.padding='6px 10px';
        div.style.cursor='pointer';
        div.style.borderBottom='1px solid #eee';
        div.innerText = s;
        div.onclick = ()=>{
            document.getElementById('printSpecSearch').value = s;
            document.getElementById('printSpecListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// 全局点击空白关闭三个下拉框
document.addEventListener('click',e=>{
    if(!e.target.closest('#printSupplierSearch') && !e.target.closest('#printSupplierListBox')){
        document.getElementById('printSupplierListBox').style.display='none';
    }
    if(!e.target.closest('#printGoodsNameSearch') && !e.target.closest('#printGoodsListBox')){
        document.getElementById('printGoodsListBox').style.display='none';
    }
    if(!e.target.closest('#printSpecSearch') && !e.target.closest('#printSpecListBox')){
        document.getElementById('printSpecListBox').style.display='none';
    }
});

function sortPrintTable(field){
    const cfg = financePageConfig.stockInPrint;
    if(cfg.sortField === field){
        cfg.sortType = cfg.sortType === 'desc' ? 'asc' : 'desc';
    }else{
        cfg.sortField = field;
        cfg.sortType = 'desc';
    }
    searchPrintStockIn();
}
function clearPrintSort(){
    const cfg = financePageConfig.stockInPrint;
    cfg.sortField = 'record_date';
    cfg.sortType = 'desc';
    searchPrintStockIn();
}

// ========== 入库单打印实时搜索（输入即搜索） ==========
function onPrintFilterInput() {
    searchPrintStockIn(false);
}
// ========== 入库单打印重置搜索 ==========
function resetPrintSearch() {
    document.getElementById('printSupplierSearch').value = '';
    document.getElementById('printGoodsNameSearch').value = '';
    document.getElementById('printSpecSearch').value = '';
    document.getElementById('printStartDate').value = '';
    document.getElementById('printEndDate').value = '';
    // 关闭所有下拉
    document.getElementById('printSupplierListBox').style.display = 'none';
    document.getElementById('printGoodsListBox').style.display = 'none';
    document.getElementById('printSpecListBox').style.display = 'none';
    searchPrintStockIn(true);
}

function searchPrintStockIn(resetPage = true) {
    if (resetPage) {
        selectedPrintIds.clear();
        financePageConfig.stockInPrint.current = 1;
    }
    const supplier = document.getElementById('printSupplierSearch').value.trim();
    const goodsName = document.getElementById('printGoodsNameSearch').value.trim().toLowerCase();
    const spec = document.getElementById('printSpecSearch').value.trim().toLowerCase();
    const start = document.getElementById('printStartDate').value;
    const end = document.getElementById('printEndDate').value;

    // ✅ 入库记录：只取线下
    let inList = allStockInList.filter(item => item.settleType === '线下');
    // ✅ 退货记录：只取线下（settle_type === '线下'）
    let returnList = (allReturnGoods || []).filter(item => item.settle_type === '线下');

    // 对入库记录应用筛选
    if (supplier) inList = inList.filter(i => (i.supplier || '').toLowerCase().includes(supplier.toLowerCase()));
    if (goodsName) inList = inList.filter(i => (i.goodsName || '').toLowerCase().includes(goodsName));
    if (spec) inList = inList.filter(i => (i.spec || '').toLowerCase().includes(spec));
    if (start) inList = inList.filter(i => i.record_date >= start);
    if (end) inList = inList.filter(i => i.record_date <= end);

    // 对退货记录应用筛选（使用相同的筛选条件）
    if (supplier) returnList = returnList.filter(i => (i.supplier || '').toLowerCase().includes(supplier.toLowerCase()));
    if (goodsName) returnList = returnList.filter(i => (i.goods_name || '').toLowerCase().includes(goodsName));
    if (spec) returnList = returnList.filter(i => (i.spec || '').toLowerCase().includes(spec));
    if (start) returnList = returnList.filter(i => i.record_date >= start);
    if (end) returnList = returnList.filter(i => i.record_date <= end);

    // ✅ 合并入库和退货记录，退货记录转成负数和负金额
    let list = [];

    // 入库记录（正数）
    inList.forEach(item => {
        list.push({
            id: item.id,
            supplier: item.supplier,
            goodsName: item.goodsName,
            spec: item.spec || '',
            in_price: Number(item.in_price),
            in_num: Number(item.in_num),
            record_date: item.record_date || '',
            _isReturn: false,
            amount: Number(item.in_price) * Number(item.in_num)
        });
    });

    // 退货记录（负数和负金额）
    returnList.forEach(item => {
        const qty = -Number(item.return_num);
        const price = Number(item.in_price);
        list.push({
            id: -item.id,  // 用负ID区分
            supplier: item.supplier,
            goodsName: item.goods_name,
            spec: item.spec || '',
            in_price: price,
            in_num: qty,  // 负数量
            record_date: item.record_date || '',
            _isReturn: true,
            amount: price * qty  // 负金额
        });
    });

    // 排序逻辑保持不变
    const cfg = financePageConfig.stockInPrint;
    list.sort((a, b) => {
        let val1 = a[cfg.sortField], val2 = b[cfg.sortField];
        if (typeof val1 === 'string' && !/^\d+$/.test(val1)) {
            val1 = val1.toLowerCase();
            val2 = val2.toLowerCase();
        }
        if (val1 > val2) return cfg.sortType === 'desc' ? -1 : 1;
        if (val1 < val2) return cfg.sortType === 'desc' ? 1 : -1;
        return 0;
    });
    printStockInData = list;

    // ✅ 更新总条数提示（入库条数 + 退货条数）
    const totalTipDom = document.getElementById('stockTotalTip');
    if (totalTipDom) {
        totalTipDom.innerText = `共${list.length}条记录（入库${inList.length}条，退货${returnList.length}条），当前搜索结果${list.length}条`;
    }

    const startIdx = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(startIdx, startIdx + cfg.pageSize);

    const tbody = document.getElementById('printStockInList');
    tbody.innerHTML = '';
    pageData.forEach((item, idx) => {
        const isChecked = selectedPrintIds.has(item.id);
        // ✅ 退货记录红色显示
        const rowStyle = item._isReturn ? 'style="color:red;"' : '';
        const qtyDisplay = item.in_num;
        const amountDisplay = item.amount;
        tbody.innerHTML += `
        <tr ${rowStyle}>
            <td><input type="checkbox" class="print-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
            <td>${startIdx + idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.goodsName}</td>
            <td>${item.spec || ''}</td>
            <td>${Number(item.in_price).toFixed(2)}</td>
            <td>${qtyDisplay}</td>
            <td>${amountDisplay.toFixed(2)}</td>
            <td>${item.record_date}</td>
        </tr>`;
    });

    // 底部汇总（保持不变）
    const groupMap = {};
    list.forEach(row => {
        if (!groupMap[row.supplier]) groupMap[row.supplier] = { num: 0, amount: 0 };
        groupMap[row.supplier].num += Number(row.in_num);
        groupMap[row.supplier].amount += Number(row.amount);
    });
    let totalTpl = '';
    Object.entries(groupMap).forEach(([sup, data]) => {
        const colorStyle = data.num < 0 ? 'style="color:red;"' : '';
        totalTpl += `
        <tr style="background:#f5f5f5;font-weight:bold;" ${colorStyle}>
            <td colspan="2">${sup} 汇总</td>
            <td colspan="5">入库总数量：${data.num}</td>
            <td colspan="2">入库总金额：${data.amount.toFixed(2)}</td>
        </tr>`;
    });
    tbody.innerHTML += totalTpl;

    cfg.total = list.length;
    renderFinancePagination('stockInPrint');

    // 全选逻辑保持不变
    document.getElementById('printAllCheck').onchange = function () {
        if (skipPrintAllChange) {
            skipPrintAllChange = false;
            return;
        }
        if (this.checked) {
            printStockInData.forEach(item => selectedPrintIds.add(item.id));
            document.querySelectorAll('.print-checkbox').forEach(cb => cb.checked = true);
        } else {
            selectedPrintIds.clear();
            document.querySelectorAll('.print-checkbox').forEach(cb => cb.checked = false);
        }
    };

    document.querySelectorAll('.print-checkbox').forEach(checkbox => {
        checkbox.onchange = function () {
            const id = Number(this.dataset.id);
            if (this.checked) {
                selectedPrintIds.add(id);
            } else {
                selectedPrintIds.delete(id);
            }
            const allChecked = selectedPrintIds.size === printStockInData.length;
            skipPrintAllChange = true;
            document.getElementById('printAllCheck').checked = allChecked;
            skipPrintAllChange = false;
        };
    });

    skipPrintAllChange = true;
    document.getElementById('printAllCheck').checked = (selectedPrintIds.size === printStockInData.length && printStockInData.length > 0);
    skipPrintAllChange = false;
}

function previewAndPrint() {
    if (selectedPrintIds.size === 0) {
        showMsg('请选择需要打印的入库记录');
        return;
    }

    const groupMap = {};
    printStockInData.forEach(row => {
        if (selectedPrintIds.has(row.id)) {
            if (!groupMap[row.supplier]) groupMap[row.supplier] = [];
            groupMap[row.supplier].push(row);
        }
    });

    if (Object.keys(groupMap).length === 0) {
        showMsg('请选择需要打印的入库记录');
        return;
    }

    const ROWS_PER_PAGE = 12;
    let allPagesHTML = '';
    const supplierNames = Object.keys(groupMap);

    supplierNames.forEach(supplier => {
        const rows = groupMap[supplier];
        rows.sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''));

        const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
        let supTotalQty = 0, supTotalAmount = 0;
        rows.forEach(r => {
            supTotalQty += Number(r.in_num);
            supTotalAmount += Number(r.amount);
        });

        for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
            const chunk = rows.slice(i, i + ROWS_PER_PAGE);
            const pageNum = Math.floor(i / ROWS_PER_PAGE) + 1;
            const isLastPage = (pageNum === totalPages);

            let tableRows = '';
            chunk.forEach(row => {
                const price = Number(row.in_price) || 0;
                const qty = Number(row.in_num) || 0;
                const amount = Number(row.amount) || 0;
                const date = row.record_date ? row.record_date.replace(/-/g, '/') : '';
                // ✅ 退货记录红色显示
                const rowStyle = row._isReturn ? 'style="color:red;"' : '';
                tableRows += `
                    <tr ${rowStyle}>
                        <td>${date}</td>
                        <td>${supplier}</td>
                        <td>${row.goodsName || ''}</td>
                        <td>${row.spec || ''}</td>
                        <td>￥${price.toFixed(2)}</td>
                        <td>${qty}</td>
                        <td>￥${amount.toFixed(2)}</td>
                    </tr>
                `;
            });

            if (isLastPage) {
                // ✅ 汇总行颜色根据金额正负决定
                const totalColor = supTotalAmount < 0 ? 'style="color:red;"' : '';
                tableRows += `
                    <tr class="total-row" ${totalColor}>
                        <td colspan="5" class="total-label">${supplier} 汇总</td>
                        <td class="total-qty">${supTotalQty}</td>
                        <td class="total-amount">￥${supTotalAmount.toFixed(2)}</td>
                    </tr>
                `;
            }

            const pageBreak = (i + ROWS_PER_PAGE >= rows.length && supplier === supplierNames[supplierNames.length - 1]) ? '' : 'page-break-after: always;';

            allPagesHTML += `
                <div class="page-block" style="${pageBreak}">
                    <div class="bill-title">商品入库单</div>
                    <div class="bill-header">
                        <span><span class="label">供应商：</span>${supplier}</span>
                        <span><span class="label">打印日期：</span>${new Date().toLocaleDateString('zh-CN')}</span>
                    </div>
                    <table class="goods-table">
                        <thead>
                            <tr>
                                <th>发生日期</th><th>供应商</th><th>商品名称</th><th>规格</th>
                                <th>入库价</th><th>数量</th><th>金额（含税）</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="bill-footer">
    <span>库管员签字：${SIGNATURE_CONFIG.storeKeeper ? `<img src="${SIGNATURE_CONFIG.storeKeeper}" style="height:30px;vertical-align:middle;">` : '___________'}</span>
    <span>业务员签字：${SIGNATURE_CONFIG.business ? `<img src="${SIGNATURE_CONFIG.business}" style="height:30px;vertical-align:middle;">` : '___________'}</span>
    <span>财务审核签字：${SIGNATURE_CONFIG.finance ? `<img src="${SIGNATURE_CONFIG.finance}" style="height:30px;vertical-align:middle;">` : '___________'}</span>
    <span style="font-weight:normal;text-align:right;">第${pageNum}页/共${totalPages}页</span>
</div>
                </div>
            `;
        }
    });

    // ... 后续的 fullHTML 保持不变（样式部分不变）
    const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>入库单打印</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #fff;
            font-family: "SimSun", "宋体", serif;
        }
        @page {
            size: A5 landscape;
            margin: 1.6cm 1.1cm 1.2cm 1.0cm;
        }
        .print-container {
            width: 100%;
            height: 100%;
        }
        .page-block {
            width: 100%;
            height: 100%;
            position: relative;
            padding-bottom: 2.2cm;
            page-break-after: always;
            margin: 0;
            padding-left: 0;
            padding-right: 0;
        }
        .page-block:last-child {
            page-break-after: avoid;
        }
        .bill-title {
            text-align: center;
            font-size: 22pt;
            font-weight: bold;
            letter-spacing: 6px;
            margin: 0 0 4px 0;
            padding: 0;
        }
        .bill-header {
            display: flex;
            justify-content: space-between;
            font-size: 12pt;
            margin-bottom: 4px;
            padding: 0 2px;
        }
        .bill-header .label { font-weight: bold; }
        .goods-table {
            width: 100% !important;
            border-collapse: collapse;
            font-size: 11pt;
            table-layout: fixed;
            margin-bottom: 0;
            border: 1px solid #000;
        }
        .goods-table th, .goods-table td {
            border: 1px solid #000;
            padding: 4px 3px;
            text-align: center;
            font-size: 11pt;
            word-break: break-word;
            height: auto;
        }
        .goods-table th {
            border: 1px solid #000;
            background: #f5f5f5;
            font-weight: bold;
            font-size: 12pt;
        }
        /* ✅ 新增：强制所有边框统一 */
.goods-table th:last-child,
.goods-table td:last-child {
    border-right: 1px solid #000;
}
.goods-table th:first-child,
.goods-table td:first-child {
    border-left: 1px solid #000;
}
.goods-table th:last-child {
    border-right: 1px solid #000;
}

        .goods-table th:nth-child(1), .goods-table td:nth-child(1) { width: 13%; }
        .goods-table th:nth-child(2), .goods-table td:nth-child(2) { width: 14%; }
        .goods-table th:nth-child(3), .goods-table td:nth-child(3) { width: 22%; }
        .goods-table th:nth-child(4), .goods-table td:nth-child(4) { width: 14%; }
        .goods-table th:nth-child(5), .goods-table td:nth-child(5) { width: 11%; }
        .goods-table th:nth-child(6), .goods-table td:nth-child(6) { width: 10%; }
        .goods-table th:nth-child(7), .goods-table td:nth-child(7) { width: 16%; }
        .goods-table .total-row td {
            border-top: 1px solid #000;
            font-weight: bold;
            background: #fafafa;
            font-size: 12pt;
        }
        .goods-table .total-label {
            text-align: right;
            padding-right: 8px;
        }
        .bill-footer {
            position: absolute;
            bottom: 0.6cm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            font-size: 12pt;
            padding: 4px 4px 0 4px;
        }
        .bill-footer span {
            min-width: 80px;
        }
        .bill-footer span:last-child {
            min-width: 120px;
            text-align: right;
        }
        @media screen {
            .page-block {
                border: 1px dashed #ccc;
                padding: 12px 18px 2.2cm 18px;
                margin: 20px auto;
                max-width: 1100px;
                min-height: 600px;
                background: #fefefe;
                position: relative;
            }
            body { padding: 20px; background: #f0f2f5; }
            .print-container { max-width: 1100px; margin: 0 auto; }
            .bill-footer { position: absolute; bottom: 0.6cm; left: 18px; right: 18px; }
        }
        @media print {
            html, body, .print-container, .page-block {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                width: 100% !important;
                height: 100% !important;
            }
            .page-block {
                border: none !important;
                page-break-after: always;
                padding-bottom: 2.2cm !important;
            }
            .page-block:last-child { page-break-after: avoid; }
            .bill-title { margin-top: 0 !important; padding-top: 0 !important; }
            .goods-table { width: 100% !important; }
            .bill-footer { bottom: 0.6cm !important; }
            .goods-table td, .goods-table th { height: auto !important; }
        }
        /* ✅ 打印时退货记录红色显示 */
        @media print {
            .goods-table tr[style*="color:red"] td,
            .goods-table tr[style*="color:red"] td * {
                color: red !important;
            }
        }
    </style>
    </head>
    <body>
        <div class="print-container">
            ${allPagesHTML}
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 300);
            };
            window.onafterprint = function() { window.close(); };
        <\/script>
    </body>
    </html>
    `;

    const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes,resizable=yes');
    if (!win) { showMsg('请允许弹出窗口'); return; }
    win.document.write(fullHTML);
    win.document.close();
    win.focus();
}
// ===================== ③财务付款记录模块 =====================
let currentPayEditId = null;
// 付款记录下拉缓存变量
let paySupplierList = [];
let paySearchTimer = null;

async function initPayRecordPage() {
    try {
        const payModal = document.getElementById('payModal');
        if (payModal) {
            payModal.style.display = 'none';
        }
        
        if (offlineSupplierList.length === 0) {
            await loadOfflineSupplier();
        }
        financePageConfig.payRecord.current = 1;
        initPaySupplierSelect();
        
        // 初始化搜索下拉数据
        paySupplierList = [...offlineSupplierList];
        
        // 重置搜索框
        document.getElementById('paySupplierSearchInput').value = '';
        document.getElementById('paySupplierListBox').style.display = 'none';
        
        refreshPayRecordList(true);
    } catch(e) {
        console.error('initPayRecordPage 执行失败:', e);
    }
}

function initPaySupplierSelect() {
    const editSel = document.getElementById('paySupplier');
    editSel.innerHTML = '<option value="">请选择供应商</option>';
    offlineSupplierList.forEach(s => {
        editSel.innerHTML += `<option value="${s}">${s}</option>`;
    });
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
    
    editSel.onchange = function() {
        updatePayPayableDisplay(this.value);
    };
}

// ========== 付款记录 - 供应商搜索下拉 ==========
function showPaySupplierList() {
    renderPaySupplierList(paySupplierList);
    document.getElementById('paySupplierListBox').style.display = 'block';
}

function filterPaySupplierList() {
    const kw = document.getElementById('paySupplierSearchInput').value.toLowerCase();
    const filtered = paySupplierList.filter(s => s.toLowerCase().includes(kw));
    renderPaySupplierList(filtered);
    document.getElementById('paySupplierListBox').style.display = 'block';
}

function renderPaySupplierList(list) {
    const box = document.getElementById('paySupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('paySupplierSearchInput').value = s;
            document.getElementById('paySupplierListBox').style.display = 'none';
            // 输入即搜索
            refreshPayRecordList(true);
        };
        box.appendChild(div);
    });
}

// ========== 付款记录实时搜索（输入即搜索） ==========
function onPayFilterInput() {
    // 清除之前的定时器
    if (paySearchTimer) {
        clearTimeout(paySearchTimer);
    }
    // 防抖处理，500ms后执行搜索
    paySearchTimer = setTimeout(() => {
        refreshPayRecordList(true);
        // 显示下拉列表
        const input = document.getElementById('paySupplierSearchInput');
        if (document.activeElement === input) {
            const kw = input.value.toLowerCase().trim();
            const filtered = paySupplierList.filter(s => s.toLowerCase().includes(kw));
            renderPaySupplierList(filtered);
            document.getElementById('paySupplierListBox').style.display = 'block';
        }
    }, 300);
}

// ========== 付款记录重置搜索 ==========
function resetPaySearch() {
    document.getElementById('paySupplierSearchInput').value = '';
    document.getElementById('paySupplierListBox').style.display = 'none';
    // ✅ 新增：清空日期筛选
    document.getElementById('payStartDate').value = '';
    document.getElementById('payEndDate').value = '';
    refreshPayRecordList(true);
}
// ========== 付款记录刷新列表（含日期筛选和汇总） ==========
function refreshPayRecordList(resetPage = true) {
    if (resetPage) {
        financePageConfig.payRecord.current = 1;
    }
    const filterSupplier = document.getElementById('paySupplierSearchInput').value.trim();
    // ✅ 获取日期筛选条件
    const startDate = document.getElementById('payStartDate').value;
    const endDate = document.getElementById('payEndDate').value;
    
    let list = [...allPayList];
    list.sort((a, b) => b.id - a.id);
    
    // 模糊匹配供应商
    if (filterSupplier) {
        list = list.filter(p => (p.supplier || '').toLowerCase().includes(filterSupplier.toLowerCase()));
    }
    
    // ✅ 日期筛选
    if (startDate) {
        list = list.filter(p => p.payment_date >= startDate);
    }
    if (endDate) {
        list = list.filter(p => p.payment_date <= endDate);
    }

    const cfg = financePageConfig.payRecord;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('payRecordList');
    tbody.innerHTML = '';
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
        // ✅ 隐藏汇总行
        document.getElementById('payRecordFoot').style.display = 'none';
        renderFinancePagination('payRecord');
        return;
    }
    
    // ✅ 计算汇总金额（基于当前筛选后的全部数据）
    let totalAmount = 0;
    list.forEach(item => {
        totalAmount += Number(item.payment_amount) || 0;
    });
    
    pageData.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${item.payment_date}</td>
            <td>${item.supplier}</td>
            <td>${Number(item.payment_amount).toFixed(2)}</td>
            <td>${item.remark || ''}</td>
            <td>
                <button class="btn btn-primary" onclick="openPayEdit(${item.id})">编辑</button>
                <button class="btn btn-danger" onclick="deletePayRecord(${item.id})">删除</button>
            </td>
        </tr>`;
    });
    
    // ✅ 显示汇总行并更新汇总金额
    const foot = document.getElementById('payRecordFoot');
    foot.style.display = 'table-footer-group';
    document.getElementById('payTotalAmount').textContent = '￥' + totalAmount.toFixed(2);
    
    renderFinancePagination('payRecord');
}

function openPayAddModal() {
    currentPayEditId = null;
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('payAmount').value = '';
    document.getElementById('payRemark').value = '';
    // ✅ 修复：重置供应商下拉框为默认值
    document.getElementById('paySupplier').value = '';
    const displayEl = document.getElementById('payPayableDisplay');
    if (displayEl) {
        displayEl.textContent = '请选择供应商';
        displayEl.style.color = '#999';
    }
    const modal = document.getElementById('payModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
}

function openPayEdit(id) {
    currentPayEditId = id;
    const row = allPayList.find(p => p.id === id);
    document.getElementById('payDate').value = row.payment_date;
    document.getElementById('paySupplier').value = row.supplier;
    document.getElementById('payAmount').value = row.payment_amount;
    document.getElementById('payRemark').value = row.remark || '';
    updatePayPayableDisplay(row.supplier);
    const modal = document.getElementById('payModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
}

// ========== 更新应付账款显示（包含退货） ==========
function updatePayPayableDisplay(supplier) {
    const displayEl = document.getElementById('payPayableDisplay');
    if (!displayEl) return;
    
    if (!supplier) {
        displayEl.textContent = '请选择供应商';
        displayEl.style.color = '#999';
        return;
    }
    
    // ✅ 从 allStockInList 中获取最新数据（包含累计字段）
    const inRecords = allStockInList.filter(i => i.settleType === '线下' && i.supplier === supplier);
    let totalIn = 0;
    inRecords.forEach(item => {
        totalIn += Number(item.in_price) * Number(item.in_num);
    });
    
    // 计算退货总额
    let totalReturn = 0;
    if (allReturnGoods && allReturnGoods.length > 0) {
        allReturnGoods.filter(r => r.supplier === supplier).forEach(item => {
            totalReturn += Number(item.in_price) * Number(item.return_num);
        });
    }
    
    // 计算已付款
    let totalPay = 0;
    allPayList.filter(p => p.supplier === supplier).forEach(p => {
        totalPay += Number(p.payment_amount);
    });
    
    // 应付账款 = 入库总额 - 退货总额 - 已付款
    const payable = totalIn - totalReturn - totalPay;
    
    displayEl.textContent = `￥${payable.toFixed(2)}`;
    displayEl.style.color = payable < 0 ? '#ff4d4f' : '#333';
}

// ========== 更新发票结余显示（包含退货） ==========
function updateInvoiceBackBalance(supplier) {
    const displayEl = document.getElementById('invoiceBackBalanceDisplay');
    if (!displayEl) return;
    
    if (!supplier) {
        displayEl.textContent = '请选择供应商';
        displayEl.style.color = '#999';
        return;
    }
    
    // ✅ 从 allStockInList 中获取最新数据
    const inRecords = allStockInList.filter(i => i.settleType === '线下' && i.supplier === supplier);
    let totalIn = 0;
    inRecords.forEach(item => {
        totalIn += Number(item.in_price) * Number(item.in_num);
    });
    
    // 计算退货总额（退货减少应开票金额）
    let totalReturn = 0;
    if (allReturnGoods && allReturnGoods.length > 0) {
        allReturnGoods.filter(r => r.supplier === supplier).forEach(item => {
            totalReturn += Number(item.in_price) * Number(item.return_num);
        });
    }
    
    // 计算已返回发票金额
    let totalBack = 0;
    allInvoiceBackList.filter(b => b.supplier === supplier).forEach(b => {
        totalBack += Number(b.invoice_amount);
    });
    
    // 发票结余 = 发票返回总额 - 入库总额 + 退货总额
    const balance = totalBack - totalIn + totalReturn;
    
    displayEl.textContent = `￥${balance.toFixed(2)}`;
    displayEl.style.color = balance < 0 ? '#ff4d4f' : '#333';
}

// ===================== 👆 添加结束 =====================

function closePayModal() {
    document.getElementById('payModal').style.display = 'none';
}

// 修改 savePayRecord 函数
async function savePayRecord() {
    const payDate = document.getElementById('payDate').value;
    const supplier = document.getElementById('paySupplier').value;
    const amount = Number(document.getElementById('payAmount').value);
    const remark = document.getElementById('payRemark').value.trim();
    
    if (!payDate || !supplier || isNaN(amount) || amount <= 0) {
        return showMsg('请完善必填项，付款金额必须大于0');
    }
    
    const body = { payment_date: payDate, supplier, payment_amount: amount, remark };
    
    try {
        if (currentPayEditId) {
            await fetch(`${SUPABASE_URL}/rest/v1/finance_payment?id=eq.${currentPayEditId}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/finance_payment`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        }
        
        // ===== 重新加载数据 =====
        await loadAllPayment();
        // ===== 关键：重新计算该供应商的累计余额 =====
        await recalculateSupplierCumulativeBalances(supplier);
        await loadAllStockIn();  // 重新加载以获取最新累计字段        
        // ===== 刷新所有相关页面 =====
        refreshPayRecordList(true);
        
        // 如果当前在入库对账页面，刷新
        if (currFinanceSub === 'stockInCheck') {
            searchStockInCheck(true);
        }
        // 如果当前在收付款看板，刷新
        if (currFinanceSub === 'paymentBoard') {
            renderPaymentBoard();
        }
        // 如果当前在发票月结余，刷新
        if (currFinanceSub === 'monthInvoiceBalance') {
            searchMonthInvoiceBalance(true);
        }
        
        showMsg(currentPayEditId ? '付款记录更新成功' : '付款记录保存成功');
        closePayModal();
        currentPayEditId = null;
    } catch (e) {
        console.error('保存付款记录失败:', e);
        showMsg('保存失败：' + e.message);
    }
}

// 修改 deletePayRecord 函数
async function deletePayRecord(id) {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除付款记录');
        return;
    }
    if (!confirm('确定删除该付款记录？')) return;
    
    const record = allPayList.find(p => p.id === id);
    if (!record) {
        showMsg('记录不存在');
        return;
    }
    const supplier = record.supplier;
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/finance_payment?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        
        await loadAllPayment();      
        // ===== 重新计算该供应商的累计余额 =====
        await recalculateSupplierCumulativeBalances(supplier);
        await loadAllStockIn();

        refreshPayRecordList(true);
        if (currFinanceSub === 'stockInCheck') searchStockInCheck(true);
        if (currFinanceSub === 'paymentBoard') renderPaymentBoard();
        if (currFinanceSub === 'monthInvoiceBalance') searchMonthInvoiceBalance(true);
        
        showMsg('删除成功');
    } catch (e) {
        console.error('删除付款记录失败:', e);
        showMsg('删除失败：' + e.message);
    }
}

// ===================== ④发票返回记录模块 =====================
let currentInvoiceBackEditId = null;
// 发票返回记录下拉缓存变量
let invoiceBackSupplierList = [];
let invoiceBackSearchTimer = null;

async function initInvoiceBackPage() {
    try {
        const invoiceBackModal = document.getElementById('invoiceBackModal');
        if (invoiceBackModal) {
            invoiceBackModal.style.display = 'none';
        }
        
        if (offlineSupplierList.length === 0) {
            await loadOfflineSupplier();
        }
        financePageConfig.invoiceBack.current = 1;
        initInvoiceBackSupplierSelect();
        
        // 初始化搜索下拉数据
        invoiceBackSupplierList = [...offlineSupplierList];
        
        // 重置搜索框
        document.getElementById('invoiceBackSupplierSearchInput').value = '';
        document.getElementById('invoiceBackSupplierListBox').style.display = 'none';
        
        refreshInvoiceBackList(true);

    } catch(e) {
        console.error('initInvoiceBackPage 执行失败:', e);
    }
}

function initInvoiceBackSupplierSelect() {
    const editSel = document.getElementById('invoiceBackSupplier');
    editSel.innerHTML = '<option value="">请选择供应商</option>';
    offlineSupplierList.forEach(s => {
        editSel.innerHTML += `<option value="${s}">${s}</option>`;
    });
    document.getElementById('invoiceBackDate').value = new Date().toISOString().split('T')[0];
    
    editSel.onchange = function() {
        updateInvoiceBackBalance(this.value);
    };
}

// ========== 发票返回记录 - 供应商搜索下拉 ==========
function showInvoiceBackSupplierList() {
    renderInvoiceBackSupplierList(invoiceBackSupplierList);
    document.getElementById('invoiceBackSupplierListBox').style.display = 'block';
}

function filterInvoiceBackSupplierList() {
    const kw = document.getElementById('invoiceBackSupplierSearchInput').value.toLowerCase();
    const filtered = invoiceBackSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderInvoiceBackSupplierList(filtered);
    document.getElementById('invoiceBackSupplierListBox').style.display = 'block';
}

function renderInvoiceBackSupplierList(list) {
    const box = document.getElementById('invoiceBackSupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('invoiceBackSupplierSearchInput').value = s;
            document.getElementById('invoiceBackSupplierListBox').style.display = 'none';
            // 输入即搜索
            refreshInvoiceBackList(true);

        };
        box.appendChild(div);
    });
}

// ========== 发票返回记录实时搜索（输入即搜索） ==========
function onInvoiceBackFilterInput() {
    // 清除之前的定时器
    if (invoiceBackSearchTimer) {
        clearTimeout(invoiceBackSearchTimer);
    }
    // 防抖处理，300ms后执行搜索
    invoiceBackSearchTimer = setTimeout(() => {
        refreshInvoiceBackList(true);

        // 显示下拉列表
        const input = document.getElementById('invoiceBackSupplierSearchInput');
        if (document.activeElement === input) {
            const kw = input.value.toLowerCase().trim();
            const filtered = invoiceBackSupplierList.filter(s => s.toLowerCase().includes(kw));
            renderInvoiceBackSupplierList(filtered);
            document.getElementById('invoiceBackSupplierListBox').style.display = 'block';
        }
    }, 300);
}

// ========== 发票返回记录重置搜索 ==========
function resetInvoiceBackSearch() {
    document.getElementById('invoiceBackSupplierSearchInput').value = '';
    document.getElementById('invoiceBackSupplierListBox').style.display = 'none';
    // ✅ 新增：清空日期筛选
    document.getElementById('invoiceBackStartDate').value = '';
    document.getElementById('invoiceBackEndDate').value = '';
    refreshInvoiceBackList(true);
}
function refreshInvoiceBackList(resetPage = true) {
    if (resetPage) {
        financePageConfig.invoiceBack.current = 1;
    }
    const filterSupplier = document.getElementById('invoiceBackSupplierSearchInput').value.trim();
    // ✅ 新增：获取日期筛选条件
    const startDate = document.getElementById('invoiceBackStartDate').value;
    const endDate = document.getElementById('invoiceBackEndDate').value;
    
    let list = [...allInvoiceBackList];
    list.sort((a, b) => b.id - a.id);
    
    // 模糊匹配供应商
    if (filterSupplier) {
        list = list.filter(i => (i.supplier || '').toLowerCase().includes(filterSupplier.toLowerCase()));
    }
    
    // ✅ 新增：日期筛选
    if (startDate) {
        list = list.filter(i => i.return_date >= startDate);
    }
    if (endDate) {
        list = list.filter(i => i.return_date <= endDate);
    }

    const cfg = financePageConfig.invoiceBack;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('invoiceBackList');
    tbody.innerHTML = '';
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
        // ✅ 隐藏汇总行
        document.getElementById('invoiceBackFoot').style.display = 'none';
        renderFinancePagination('invoiceBack');
        return;
    }
    
    // ✅ 计算汇总金额（基于当前筛选后的全部数据，而非分页数据）
    let totalAmount = 0;
    list.forEach(item => {
        totalAmount += Number(item.invoice_amount) || 0;
    });
    
    pageData.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${item.return_date}</td>
            <td>${item.supplier}</td>
            <td>${Number(item.invoice_amount).toFixed(2)}</td>
            <td>${item.invoice_no || ''}</td>
            <td>${item.remark || ''}</td>
            <td>
                <button class="btn btn-primary" onclick="openInvoiceBackEdit(${item.id})">编辑</button>
                <button class="btn btn-danger" onclick="deleteInvoiceBackRecord(${item.id})">删除</button>
            </td>
        </tr>`;
    });
    
    // ✅ 显示汇总行并更新汇总金额
    const foot = document.getElementById('invoiceBackFoot');
    foot.style.display = 'table-footer-group';
    document.getElementById('invoiceBackTotalAmount').textContent = '￥' + totalAmount.toFixed(2);
    
    renderFinancePagination('invoiceBack');
}
function openInvoiceBackAddModal() {
    currentInvoiceBackEditId = null;
    document.getElementById('invoiceBackDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceBackAmount').value = '';
    document.getElementById('invoiceBackNo').value = '';
    document.getElementById('invoiceBackRemark').value = '';
    // ✅ 修复：重置供应商下拉框为默认值
    document.getElementById('invoiceBackSupplier').value = '';
    const displayEl = document.getElementById('invoiceBackBalanceDisplay');
    if (displayEl) {
        displayEl.textContent = '请选择供应商';
        displayEl.style.color = '#999';
    }
    const modal = document.getElementById('invoiceBackModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
}

function openInvoiceBackEdit(id) {
    currentInvoiceBackEditId = id;
    const row = allInvoiceBackList.find(i => i.id === id);
    document.getElementById('invoiceBackDate').value = row.return_date;
    document.getElementById('invoiceBackSupplier').value = row.supplier;
    document.getElementById('invoiceBackAmount').value = row.invoice_amount;
    document.getElementById('invoiceBackNo').value = row.invoice_no || '';
    document.getElementById('invoiceBackRemark').value = row.remark || '';
    // 🔧 编辑时更新发票结余
    updateInvoiceBackBalance(row.supplier);
    const modal = document.getElementById('invoiceBackModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
}

function closeInvoiceBackModal() {
    document.getElementById('invoiceBackModal').style.display = 'none';
}
// 修改 saveInvoiceBackRecord 函数
async function saveInvoiceBackRecord() {
    const backDate = document.getElementById('invoiceBackDate').value;
    const supplier = document.getElementById('invoiceBackSupplier').value;
    const amount = Number(document.getElementById('invoiceBackAmount').value);
    const invNo = document.getElementById('invoiceBackNo').value.trim();
    const remark = document.getElementById('invoiceBackRemark').value.trim();
    
    if (!backDate || !supplier || isNaN(amount) || amount <= 0) {
        return showMsg('请完善必填项（日期、供应商、金额必须大于0）');
    }
    
    const body = {
        return_date: backDate,
        supplier: supplier,
        invoice_amount: amount,
        invoice_no: invNo || null,
        remark: remark || ''
    };
    
    try {
        if (currentInvoiceBackEditId) {
            await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice?id=eq.${currentInvoiceBackEditId}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        }
        
        // ===== 重新加载数据 =====
        await loadAllInvoiceBack();
        // ===== 关键：重新计算该供应商的累计余额 =====
        await recalculateSupplierCumulativeBalances(supplier);
        await loadAllStockIn();
        // ===== 刷新所有相关页面 =====
        refreshInvoiceBackList(true);
        if (currFinanceSub === 'stockInCheck') searchStockInCheck(true);
        if (currFinanceSub === 'paymentBoard') renderPaymentBoard();
        if (currFinanceSub === 'monthInvoiceBalance') searchMonthInvoiceBalance(true);
        
        showMsg(currentInvoiceBackEditId ? '发票记录更新成功' : '发票退回记录保存成功');
        closeInvoiceBackModal();
        currentInvoiceBackEditId = null;
    } catch (e) {
        console.error('保存发票返回记录失败:', e);
        showMsg('保存失败：' + e.message);
    }
}

// 修改 deleteInvoiceBackRecord 函数
async function deleteInvoiceBackRecord(id) {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除发票返回记录');
        return;
    }
    if (!confirm('确定删除该发票返回记录？')) return;
    
    const record = allInvoiceBackList.find(i => i.id === id);
    if (!record) {
        showMsg('记录不存在');
        return;
    }
    const supplier = record.supplier;
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        
        await loadAllInvoiceBack();
        
        // ===== 重新计算该供应商的累计余额 =====
        await recalculateSupplierCumulativeBalances(supplier);
        await loadAllStockIn();     
        refreshInvoiceBackList(true);
        if (currFinanceSub === 'stockInCheck') searchStockInCheck(true);
        if (currFinanceSub === 'paymentBoard') renderPaymentBoard();
        if (currFinanceSub === 'monthInvoiceBalance') searchMonthInvoiceBalance(true);
        
        showMsg('删除成功');
    } catch (e) {
        console.error('删除发票返回记录失败:', e);
        showMsg('删除失败：' + e.message);
    }
}
// ===================== 发票核销引擎 =====================
async function autoWriteOffInvoice(supplier, invoiceAmount, invoiceNo) {
    if (!supplier || invoiceAmount <= 0) return;
    await recalculateInvoiceStatus(supplier);
}

async function recalculateInvoiceStatus(supplier) {
    if (!supplier) return;

    const headers = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };

    // 1. 获取该供应商所有线下入库记录（按日期正序）
    const inRecords = allStockInList
        .filter(item => 
            item.supplier === supplier && 
            item.settleType === '线下'
        )
        .sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

    if (inRecords.length === 0) {
        return;
    }

    // 2. 获取该供应商所有退货记录
    let returnRecords = [];
    if (allReturnGoods && allReturnGoods.length > 0) {
        returnRecords = allReturnGoods
            .filter(item => item.supplier === supplier)
            .sort((a, b) => new Date(a.record_date) - new Date(b.record_date));
    }

    // 3. 获取该供应商所有发票返回记录
    const supplierInvoices = allInvoiceBackList
        .filter(inv => inv.supplier === supplier)
        .sort((a, b) => new Date(a.return_date) - new Date(b.return_date));

    // 4. 先将所有入库记录重置为"未开票"
    for (let record of inRecords) {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${record.id}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({
                invoice_status: '未开票',
                invoice_no: null
            })
        });
    }

    if (supplierInvoices.length === 0) {
        // 没有发票返回记录，所有入库保持"未开票"
        return;
    }

    // 5. 构建核销队列：入库为正，退货为负
    let queue = [];
    
    // 入库记录（正数）
    inRecords.forEach(record => {
        const amount = Number(record.in_price) * Number(record.in_num);
        queue.push({
            type: 'in',
            id: record.id,
            amount: amount,
            date: record.record_date,
            record: record
        });
    });
    
    // 退货记录（负数）
    returnRecords.forEach(record => {
        const amount = Number(record.in_price) * Number(record.return_num);
        queue.push({
            type: 'return',
            id: record.id,
            amount: -amount, // 负数
            date: record.record_date,
            record: record
        });
    });

    // 按日期排序
    queue.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 6. 逐张发票核销
    let remainingInRecords = [...inRecords];
    let processedReturnIds = new Set();

    for (let invoice of supplierInvoices) {
        const invoiceAmount = Number(invoice.invoice_amount) || 0;
        if (invoiceAmount <= 0) continue;

        let remainingAmount = invoiceAmount;
        const updatedInIds = [];
        const matchedReturnIds = [];

        // 遍历队列（已排序）
        for (let item of queue) {
            if (remainingAmount <= 0) break;
            if (item.amount > 0) {
                // 入库记录
                const record = item.record;
                if (remainingAmount >= item.amount) {
                    remainingAmount -= item.amount;
                    updatedInIds.push({ id: record.id, status: '已开票' });
                } else {
                    // 部分核销，这条入库记录标记为"未开票"
                    updatedInIds.push({ id: record.id, status: '未开票' });
                    remainingAmount = 0;
                }
            } else if (item.amount < 0) {
                // 退货记录（冲减核销金额）
                const absReturn = Math.abs(item.amount);
                // 退货冲减当前剩余待核销金额
                const usedAmount = Math.min(remainingAmount, absReturn);
                remainingAmount -= usedAmount;
                matchedReturnIds.push(item.id);
                // 退货记录已被处理
                if (usedAmount >= absReturn) {
                    processedReturnIds.add(item.id);
                }
            }
        }

        // 更新入库记录的发票状态
        for (let item of updatedInIds) {
            await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${item.id}`, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({
                    invoice_status: item.status,
                    invoice_no: invoice.invoice_no || null
                })
            });
            if (item.status === '已开票') {
                remainingInRecords = remainingInRecords.filter(r => r.id !== item.id);
            }
        }
    }

    // 7. 更新所有未核销的入库记录为"未开票"
    for (let record of remainingInRecords) {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${record.id}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({
                invoice_status: '未开票',
                invoice_no: null
            })
        });
    }

    // 重新加载最新数据
    await loadAllStockIn();
}
// 删除发票返回记录
async function deleteInvoiceBackRecord(id) {
    // ===== 检查是否管理员 =====
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除发票返回记录');
        return;
    }
    if (!confirm('确定删除该发票返回记录？')) return;
    
    const recordToDelete = allInvoiceBackList.find(i => i.id === id);
    if (!recordToDelete) {
        showMsg('记录不存在');
        return;
    }
    const supplier = recordToDelete.supplier;
    
    await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    
    await loadAllInvoiceBack();
    await recalculateInvoiceStatus(supplier);
    refreshInvoiceBackList(true);

    
    if (typeof window.loadStockIn === 'function') {
        await window.loadStockIn();
    } else if (typeof loadStockIn === 'function') {
        await loadStockIn();
    }
    
    showMsg('删除成功，已重新计算发票核销状态');
}

// ===================== ⑤收付款看板 =====================
function initPaymentBoardPage() {
    financePageConfig.paymentBoard.current = 1;
    renderPaymentBoard();
}
function renderPaymentBoard() {
    const supplierGroup = {};
    
    offlineSupplierList.forEach(s => {
        supplierGroup[s] = {
            totalIn: 0,
            totalReturn: 0,
            totalPay: 0,
            totalBack: 0,
            payable: 0,
            invoiceBalance: 0
        };
    });
    
    // 计算入库总额
    allStockInList.filter(i => i.settleType === '线下').forEach(item => {
        if (supplierGroup[item.supplier]) {
            supplierGroup[item.supplier].totalIn += Number(item.in_price) * Number(item.in_num);
        }
    });
    
    // 计算退货总额
    if (allReturnGoods && allReturnGoods.length > 0) {
        allReturnGoods.filter(r => r.settle_type === '线下').forEach(item => {
            if (supplierGroup[item.supplier]) {
                supplierGroup[item.supplier].totalReturn += Number(item.in_price) * Number(item.return_num);
            }
        });
    }
    
    allPayList.forEach(p => {
        if (supplierGroup[p.supplier]) {
            supplierGroup[p.supplier].totalPay += Number(p.payment_amount);
        }
    });
    
    allInvoiceBackList.forEach(b => {
        if (supplierGroup[b.supplier]) {
            supplierGroup[b.supplier].totalBack += Number(b.invoice_amount);
        }
    });
    
    let list = Object.entries(supplierGroup)
        .filter(([supplier, data]) => data.totalIn > 0 || data.totalReturn > 0)
        .map(([supplier, data]) => {
            // ✅ 净入库 = 入库 - 退货
            const netIn = data.totalIn - data.totalReturn;
            const payable = netIn - data.totalPay;
            const invoiceBalance = data.totalBack - netIn;
            return {
                supplier,
                totalIn: netIn,  // ✅ 显示净入库
                totalReturn: data.totalReturn,
                totalPay: data.totalPay,
                totalBack: data.totalBack,
                payable: payable,
                invoiceBalance: invoiceBalance
            };
        });
    
    list.sort((a, b) => b.payable - a.payable);
    
    const cfg = financePageConfig.paymentBoard;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);
    
    const tbody = document.getElementById('paymentBoardList');
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
        renderFinancePagination('paymentBoard');
        return;
    }
    
    pageData.forEach((row, idx) => {
        const payableColor = row.payable < 0 ? 'color:red;' : '';
        const balanceColor = row.invoiceBalance < 0 ? 'color:red;' : '';
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${row.supplier}</td>
            <td>${formatMoney(row.totalIn)}</td>
            <td>${formatMoney(row.totalPay)}</td>
            <td>${formatMoney(row.totalBack)}</td>
            <td style="${payableColor}">${formatMoney(row.payable)}</td>
            <td style="${balanceColor}">${formatMoney(row.invoiceBalance)}</td>
        </tr>`;
    });
    
    renderFinancePagination('paymentBoard');
}

// ===================== ⑥发票月结余 =====================
// 发票月结余下拉缓存变量
let monthBalanceSupplierList = [];
let monthBalanceSearchTimer = null;

function initMonthBalancePage() {
    financePageConfig.monthInvoiceBalance.current = 1;
    const sel = document.getElementById('monthBalanceSelect');
    sel.innerHTML = '<option value="">请选择月份</option>';
    monthDistinctList.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
    
    // 初始化供应商下拉数据
    const suppliers = [...new Set(allStockInList.map(item => item.supplier).filter(Boolean))];
    monthBalanceSupplierList = suppliers;
    
    // 重置搜索框
    document.getElementById('monthBalanceSupplierSearchInput').value = '';
    document.getElementById('monthBalanceSupplierListBox').style.display = 'none';
    
    const tbody = document.getElementById('monthBalanceList');
    tbody.innerHTML = '';
    renderFinancePagination('monthInvoiceBalance');
    searchMonthInvoiceBalance(true);
}

// ========== 发票月结余 - 供应商搜索下拉 ==========
function showMonthBalanceSupplierList() {
    renderMonthBalanceSupplierList(monthBalanceSupplierList);
    document.getElementById('monthBalanceSupplierListBox').style.display = 'block';
}

function filterMonthBalanceSupplierList() {
    const kw = document.getElementById('monthBalanceSupplierSearchInput').value.toLowerCase();
    const filtered = monthBalanceSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderMonthBalanceSupplierList(filtered);
    document.getElementById('monthBalanceSupplierListBox').style.display = 'block';
}

function renderMonthBalanceSupplierList(list) {
    const box = document.getElementById('monthBalanceSupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('monthBalanceSupplierSearchInput').value = s;
            document.getElementById('monthBalanceSupplierListBox').style.display = 'none';
            // 输入即搜索
            searchMonthInvoiceBalance(true);
        };
        box.appendChild(div);
    });
}

// ========== 发票月结余实时搜索（输入即搜索） ==========
function onMonthBalanceFilterInput() {
    // 清除之前的定时器
    if (monthBalanceSearchTimer) {
        clearTimeout(monthBalanceSearchTimer);
    }
    // 防抖处理，300ms后执行搜索
    monthBalanceSearchTimer = setTimeout(() => {
        searchMonthInvoiceBalance(true);
        // 显示下拉列表
        const input = document.getElementById('monthBalanceSupplierSearchInput');
        if (document.activeElement === input) {
            const kw = input.value.toLowerCase().trim();
            const filtered = monthBalanceSupplierList.filter(s => s.toLowerCase().includes(kw));
            renderMonthBalanceSupplierList(filtered);
            document.getElementById('monthBalanceSupplierListBox').style.display = 'block';
        }
    }, 300);
}

// ========== 发票月结余重置搜索 ==========
function resetMonthBalanceSearch() {
    document.getElementById('monthBalanceSupplierSearchInput').value = '';
    document.getElementById('monthBalanceSupplierListBox').style.display = 'none';
    // 不重置月份选择，只重置供应商搜索
    searchMonthInvoiceBalance(true);
}

function searchMonthInvoiceBalance(resetPage = true) {
    if (resetPage) {
        financePageConfig.monthInvoiceBalance.current = 1;
    }
    
    const month = document.getElementById('monthBalanceSelect').value;
    const searchKey = document.getElementById('monthBalanceSupplierSearchInput').value.trim().toLowerCase();
    
    if (!month) {
        const tbody = document.getElementById('monthBalanceList');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px;">请选择统计月份</td></tr>';
        renderFinancePagination('monthInvoiceBalance');
        return;
    }
    
    const supplierMap = {};
    
    // ===== 统计该月入库金额（线下） =====
    const monthStock = allStockInList.filter(i => {
        return i.settleType === '线下' && i.record_date && i.record_date.substring(0, 7) === month;
    });
    monthStock.forEach(item => {
        const total = Number(item.in_price) * Number(item.in_num);
        if (!supplierMap[item.supplier]) {
            supplierMap[item.supplier] = { inTotal: 0, returnTotal: 0, backTotal: 0 };
        }
        supplierMap[item.supplier].inTotal += total;
    });
    
    // ===== 统计该月退货金额 =====
    if (allReturnGoods && allReturnGoods.length > 0) {
        const monthReturn = allReturnGoods.filter(i => {
            return i.settle_type === '线下' && i.record_date && i.record_date.substring(0, 7) === month;
        });
        monthReturn.forEach(item => {
            const total = Number(item.in_price) * Number(item.return_num);
            if (!supplierMap[item.supplier]) {
                supplierMap[item.supplier] = { inTotal: 0, returnTotal: 0, backTotal: 0 };
            }
            supplierMap[item.supplier].returnTotal += total;
        });
    }
    
    // ===== 统计该月发票返回金额 =====
    const monthBack = allInvoiceBackList.filter(b => b.return_date && b.return_date.substring(0, 7) === month);
    monthBack.forEach(item => {
        if (!supplierMap[item.supplier]) {
            supplierMap[item.supplier] = { inTotal: 0, returnTotal: 0, backTotal: 0 };
        }
        supplierMap[item.supplier].backTotal += Number(item.invoice_amount);
    });
    
    // ===== 计算发票结余 = 发票返回 - 入库 + 退货 =====
    let list = [];
    for (const s in supplierMap) {
        const data = supplierMap[s];
        const balance = data.backTotal - data.inTotal + data.returnTotal;
        list.push({ supplier: s, month, balance });
    }
    
    // 模糊匹配供应商
    if (searchKey) {
        list = list.filter(row => row.supplier.toLowerCase().includes(searchKey));
    }
    
    list.sort((a, b) => a.supplier.localeCompare(b.supplier));
    
    // ===== 分页渲染 =====
    const cfg = financePageConfig.monthInvoiceBalance;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);
    
    const tbody = document.getElementById('monthBalanceList');
    tbody.innerHTML = '';
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px;">暂无匹配数据</td></tr>';
        renderFinancePagination('monthInvoiceBalance');
        return;
    }
    pageData.forEach((item, idx) => {
        const balanceColor = item.balance < 0 ? 'style="color:red;"' : '';
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.month}</td>
            <td ${balanceColor}>${formatMoney(item.balance)}</td>
        </tr>`;
    });
    renderFinancePagination('monthInvoiceBalance');
}
// ===================== ⑦入库对账 =====================
// 入库对账下拉缓存变量
let checkInSupplierList = [];
let checkInGoodsList = [];
let checkInSearchTimer = null;

function initStockInCheckPage() {
    financePageConfig.stockInCheck.current = 1;
    initCheckMonthSelect('checkInMonth');
    
    // 初始化供应商和商品下拉数据
    const suppliers = [...new Set(allStockInList.map(item => item.supplier).filter(Boolean))];
    checkInSupplierList = suppliers;
    window._checkInSupplierList = suppliers;
    
    const goodsNames = [...new Set(allStockInList.map(item => item.goodsName).filter(Boolean))];
    checkInGoodsList = goodsNames;
    window._checkInGoodsList = goodsNames;
    
    // 重置搜索框
    document.getElementById('checkInSupplierSearchInput').value = '';
    document.getElementById('checkInGoodsSearchInput').value = '';
    document.getElementById('checkInSupplierListBox').style.display = 'none';
    document.getElementById('checkInGoodsListBox').style.display = 'none';
    
    const tbody = document.getElementById('stockInCheckList');
    if (tbody) tbody.innerHTML = '';
    
    renderFinancePagination('stockInCheck');
    searchStockInCheck(true);
}

function initCheckMonthSelect(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">全部月份</option>';
    monthDistinctList.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
}

// ========== 入库对账 - 供应商搜索下拉 ==========
function showCheckInSupplierList() {
    renderCheckInSupplierList(checkInSupplierList);
    document.getElementById('checkInSupplierListBox').style.display = 'block';
}

function filterCheckInSupplierList() {
    const kw = document.getElementById('checkInSupplierSearchInput').value.toLowerCase();
    const filtered = checkInSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderCheckInSupplierList(filtered);
    document.getElementById('checkInSupplierListBox').style.display = 'block';
}

function renderCheckInSupplierList(list) {
    const box = document.getElementById('checkInSupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('checkInSupplierSearchInput').value = s;
            document.getElementById('checkInSupplierListBox').style.display = 'none';
            // 输入即搜索
            searchStockInCheck(true);
        };
        box.appendChild(div);
    });
}

// ========== 入库对账 - 商品名称搜索下拉 ==========
function showCheckInGoodsList() {
    renderCheckInGoodsList(checkInGoodsList);
    document.getElementById('checkInGoodsListBox').style.display = 'block';
}

function filterCheckInGoodsList() {
    const kw = document.getElementById('checkInGoodsSearchInput').value.toLowerCase();
    const filtered = checkInGoodsList.filter(s => s.toLowerCase().includes(kw));
    renderCheckInGoodsList(filtered);
    document.getElementById('checkInGoodsListBox').style.display = 'block';
}

function renderCheckInGoodsList(list) {
    const box = document.getElementById('checkInGoodsListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('checkInGoodsSearchInput').value = s;
            document.getElementById('checkInGoodsListBox').style.display = 'none';
            // 输入即搜索
            searchStockInCheck(true);
        };
        box.appendChild(div);
    });
}

// ========== 入库对账实时搜索（输入即搜索） ==========
function onCheckInFilterInput() {
    // 清除之前的定时器
    if (checkInSearchTimer) {
        clearTimeout(checkInSearchTimer);
    }
    // 防抖处理，300ms后执行搜索
    checkInSearchTimer = setTimeout(() => {
        searchStockInCheck(true);
        // 显示下拉列表
        const supplierInput = document.getElementById('checkInSupplierSearchInput');
        const goodsInput = document.getElementById('checkInGoodsSearchInput');
        
        if (document.activeElement === supplierInput) {
            const kw = supplierInput.value.toLowerCase().trim();
            const filtered = checkInSupplierList.filter(s => s.toLowerCase().includes(kw));
            renderCheckInSupplierList(filtered);
            document.getElementById('checkInSupplierListBox').style.display = 'block';
        } else if (document.activeElement === goodsInput) {
            const kw = goodsInput.value.toLowerCase().trim();
            const filtered = checkInGoodsList.filter(s => s.toLowerCase().includes(kw));
            renderCheckInGoodsList(filtered);
            document.getElementById('checkInGoodsListBox').style.display = 'block';
        }
    }, 300);
}

// ========== 入库对账重置搜索 ==========
function resetStockInCheck() {
    document.getElementById('checkInSettle').value = '';
    document.getElementById('checkInInvoice').value = '';
    document.getElementById('checkInMonth').value = '';
    document.getElementById('checkInSupplierSearchInput').value = '';
    document.getElementById('checkInGoodsSearchInput').value = '';
    document.getElementById('checkInTaxRateSearch').value = '';
    document.getElementById('checkInSupplierGroup').checked = false;
    document.getElementById('checkInGoodsGroup').checked = false;
    document.getElementById('checkInSupplierListBox').style.display = 'none';
    document.getElementById('checkInGoodsListBox').style.display = 'none';
    // 重置分页到第一页
    financePageConfig.stockInCheck.current = 1;
    searchStockInCheck(true);
}

function searchStockInCheck(resetPage = true) {
    if (resetPage) {
        financePageConfig.stockInCheck.current = 1;
    }
    
    // 获取筛选条件
    const settle = document.getElementById('checkInSettle').value;
    const invStatus = document.getElementById('checkInInvoice').value;
    const payStatus = document.getElementById('checkInPayStatus').value; 
    const month = document.getElementById('checkInMonth').value;
    const supplier = document.getElementById('checkInSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('checkInGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('checkInTaxRateSearch').value;
    const groupSupplier = document.getElementById('checkInSupplierGroup').checked;
    const groupGoods = document.getElementById('checkInGoodsGroup').checked;

    // ============================================================
    // 【第一步】获取全量入库数据（只按 settle 过滤，其他筛选不影响结余计算）
    // ============================================================
    let baseInList = [...allStockInList];
    if (settle) {
        baseInList = baseInList.filter(i => i.settleType === settle);
    }

    // ============================================================
    // 【第二步】按供应商分组，计算每个供应商的付款和发票返回总额
    // ============================================================
    const supplierGroups = {};
    baseInList.forEach(item => {
        if (!supplierGroups[item.supplier]) {
            supplierGroups[item.supplier] = { 
                inRecords: [], 
                totalPay: 0, 
                totalInvoice: 0 
            };
        }
        supplierGroups[item.supplier].inRecords.push(item);
    });

    Object.keys(supplierGroups).forEach(sup => {
        supplierGroups[sup].totalPay = allPayList
            .filter(p => p.supplier === sup)
            .reduce((sum, p) => sum + Number(p.payment_amount), 0);
        supplierGroups[sup].totalInvoice = allInvoiceBackList
            .filter(b => b.supplier === sup)
            .reduce((sum, b) => sum + Number(b.invoice_amount), 0);
    });

    // ============================================================
    // 【第三步】构建全量退货映射表（按 in_record_id）
    // ============================================================
    const returnMap = {};
    if (allReturnGoods && allReturnGoods.length > 0) {
        allReturnGoods.forEach(r => {
            const inId = r.in_record_id;
            if (!inId) return;
            if (!returnMap[inId]) returnMap[inId] = 0;
            returnMap[inId] += Number(r.in_price) * Number(r.return_num);
        });
    }

    // ============================================================
    // 【第四步】计算所有入库记录的结余（全量数据，不受筛选影响）
    // ============================================================
    let allRecords = [];

    for (const sup of Object.keys(supplierGroups)) {
        const group = supplierGroups[sup];
        const inRecords = [...group.inRecords];

        // 按日期正序排序
        const sortedInRecords = inRecords.sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

        let remainingPay = group.totalPay;
        let remainingInvoice = group.totalInvoice;
        let cumNetIn = 0;

        for (const record of sortedInRecords) {
            const amount = Number(record.in_price) * Number(record.in_num);
            const returnAmount = returnMap[record.id] || 0;
            const netAmount = amount - returnAmount;

            cumNetIn += netAmount;

            // ✅ 计算结余（基于全量数据）
let invoiceBalance = remainingInvoice - cumNetIn;
let payBalance = cumNetIn - remainingPay;

            // 获取税率和渠道
const goods = allGoodsList.find(g => 
    g.name === record.goodsName && 
    g.supplier === record.supplier && 
    (g.spec || '') === (record.spec || '')
);
const channel = record.settleType || (goods ? goods.channel : '');

// ✅ 正确区分未设置和0%
let taxRateVal = 0;
let taxRateDisplay = '';

if (channel === '线上') {
    taxRateVal = -1;  // 线上用 -1 表示无税率
    taxRateDisplay = '';
} else if (goods && goods.tax_rate !== null && goods.tax_rate !== undefined && goods.tax_rate !== '') {
    taxRateVal = Number(goods.tax_rate);
    taxRateDisplay = taxRateVal + '%';
} else {
    // 线下但未设置税率
    taxRateVal = null;  // 用 null 表示未设置
    taxRateDisplay = '';
}

            // 判断状态（基于全量数据计算）
let invoiceStatus = invoiceBalance >= 0 ? '已开票' : '未开票';
let payStatus = payBalance <= 0 ? '已付清' : '未付清';
if (channel === '线上') {
    invoiceStatus = '-';
    payStatus = '-';
    // ✅ 线上供应商的结余设为 null，页面显示为 "-"
    invoiceBalance = null;
    payBalance = null;
}

            // 计算金额

            let inPriceDisplay = '';
            let noTaxTotal = 0;
            let taxTotal = 0;

            if (channel === '线上') {
                taxRateDisplay = '';
                inPriceDisplay = formatMoney(record.in_price);
                noTaxTotal = 0;
                taxTotal = 0;
            } else {
                taxRateDisplay = (taxRateVal > 0 ? taxRateVal + '%' : '0%');
                inPriceDisplay = formatMoney(record.in_price);

                const taxDecimal = taxRateVal / 100;
                if (taxDecimal > 0) {
                    const noTaxPrice = Number(record.in_price) / (1 + taxDecimal);
                    noTaxTotal = noTaxPrice * Number(record.in_num);
                    taxTotal = amount - noTaxTotal;
                } else {
                    noTaxTotal = amount;
                    taxTotal = 0;
                }
            }

            allRecords.push({
                id: record.id,
                supplier: record.supplier,
                goodsName: record.goodsName,
                spec: record.spec || '',
                tax_rate_val: taxRateVal,
                tax_rate_display: taxRateDisplay,
                invoice_status: invoiceStatus,
                in_price_display: inPriceDisplay,
                in_num: Number(record.in_num),
                isPay: payStatus,
                totalAmount: amount,
                noTaxTotal: noTaxTotal,
                taxTotal: taxTotal,
                cumulative_invoice_balance: invoiceBalance,
                cumulative_pay_balance: payBalance,
                record_date: record.record_date || '',
                _isReturn: false,
                channel: channel
            });
        }
    }

    // ============================================================
    // 【第五步】获取退货数据（应用所有筛选条件）
    // ============================================================
    let returnList = [];
    let returnRecordsForDisplay = [];

    if (allReturnGoods && allReturnGoods.length > 0) {
        returnList = allReturnGoods.filter(item => {
            let match = true;
            if (settle && item.settle_type !== settle) match = false;
            if (month && item.record_date && item.record_date.substring(0, 7) !== month) match = false;
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.goods_name || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (taxRate !== '') {
                const goods = allGoodsList.find(g => 
                    g.name === item.goods_name && 
                    g.supplier === item.supplier && 
                    (g.spec || '') === (item.spec || '')
                );
                const rate = goods ? String(goods.tax_rate || '') : '';
                if (rate !== taxRate) match = false;
            }
            if (payStatus && payStatus !== '全部' && payStatus !== '退货') match = false;
            return match;
        });

        // 构建退货展示数据
        // 构建退货展示数据
returnList.forEach(record => {
    const goods = allGoodsList.find(g => 
        g.name === record.goods_name && 
        g.supplier === record.supplier && 
        (g.spec || '') === (record.spec || '')
    );
    const taxRateVal = goods ? Number(goods.tax_rate || 0) : 0;
    const channel = record.settle_type || (goods ? goods.channel : '');
    const returnAmount = Number(record.in_price) * Number(record.return_num);

    let taxRateDisplay = '';
    let inPriceDisplay = '';
    let noTaxTotal = 0;
    let taxTotal = 0;

    if (channel === '线上') {
        taxRateDisplay = '';
        inPriceDisplay = formatMoney(record.in_price);
        noTaxTotal = 0;
        taxTotal = 0;
    } else {
        taxRateDisplay = (taxRateVal > 0 ? taxRateVal + '%' : '0%');
        inPriceDisplay = formatMoney(record.in_price);

        const taxDecimal = taxRateVal / 100;
        if (taxDecimal > 0) {
            const noTaxPrice = Number(record.in_price) / (1 + taxDecimal);
            noTaxTotal = noTaxPrice * Number(record.return_num);
            taxTotal = returnAmount - noTaxTotal;
        } else {
            noTaxTotal = returnAmount;
            taxTotal = 0;
        }
    }

    returnRecordsForDisplay.push({
        id: -record.id,
        supplier: record.supplier,
        goodsName: record.goods_name,
        spec: record.spec || '',
        tax_rate_val: taxRateVal,
        tax_rate_display: taxRateDisplay,
        invoice_status: '退货',
        in_price_display: inPriceDisplay,
        in_num: -Number(record.return_num),
        isPay: '退货',
        // ✅ 修改：所有金额取负值
        totalAmount: -returnAmount,
        noTaxTotal: -noTaxTotal,
        taxTotal: -taxTotal,
        cumulative_invoice_balance: null,
        cumulative_pay_balance: null,
        record_date: record.record_date || '',
        _isReturn: true,
        channel: channel
    });
});
    }

    // ============================================================
    // 【第六步】合并入库数据和退货数据
    // ============================================================
    let displayData = [...allRecords];

    // ============================================================
    // 【第七步】对入库数据应用筛选条件（月份、供应商、商品名、税率）
    //          这些筛选只影响展示，不影响结余计算
    // ============================================================

    // 月份筛选
    if (month) {
        displayData = displayData.filter(row => 
            row.record_date && row.record_date.substring(0, 7) === month
        );
    }

    // 供应商筛选（模糊匹配）
    if (supplier) {
        displayData = displayData.filter(row => 
            (row.supplier || '').toLowerCase().includes(supplier.toLowerCase())
        );
    }

    // 商品名筛选（模糊匹配）
    if (goodsName) {
        displayData = displayData.filter(row => 
            (row.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())
        );
    }

    // 税率筛选
if (taxRate !== '') {
    displayData = displayData.filter(row => {
        // 未设置税率的商品不匹配任何税率选项
        if (row.tax_rate_val === null || row.tax_rate_val === undefined || row.tax_rate_val === '') {
            return false;
        }
        // 线上商品（tax_rate_val === -1）也不匹配
        if (row.tax_rate_val === -1) {
            return false;
        }
        const rate = String(row.tax_rate_val);
        return rate === taxRate;
    });
}

    // ============================================================
    // 【第八步】发票状态筛选（基于计算出的状态）
    // ============================================================
    if (invStatus && invStatus !== '全部') {
        displayData = displayData.filter(row => {
            // 线上供应商不参与筛选
            if (row.channel === '线上') return false;
            return row.invoice_status === invStatus;
        });
    }
// 【第八步B】是否付清筛选（基于计算出的状态）
// ============================================================
if (payStatus && payStatus !== '全部') {
    displayData = displayData.filter(row => {
        if (row.channel === '线上') return false;
        // 退货记录只有在筛选"退货"时才显示
        if (row._isReturn) {
            return payStatus === '退货';
        }
        return row.isPay === payStatus;
    });
}
    // ============================================================
    // 【第九步】加入退货数据
    // ============================================================
    // 如果发票状态筛选的是"退货"，只显示退货
    if (invStatus === '退货') {
        displayData = returnRecordsForDisplay;
    } else {
        // 否则把退货数据加入（全部状态下显示退货，已开票/未开票状态下不显示退货）
        if (!invStatus || invStatus === '全部') {
            displayData = [...displayData, ...returnRecordsForDisplay];
        }
        // 如果 invStatus 是 '已开票' 或 '未开票'，不加入退货
    }

    // ============================================================
    // 【第十步】按日期倒序排列
    // ============================================================
    displayData.sort((a, b) => (b.record_date || '').localeCompare(a.record_date || ''));

    // ============================================================
    // 【第十一步】分组汇总（按供应商或按商品）
    // ============================================================
    if (groupSupplier || groupGoods) {
        const groupMap = {};
        displayData.forEach(row => {
            const key = groupSupplier ? row.supplier : `${row.supplier}_${row.goodsName}_${row.spec}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    supplier: row.supplier,
                    goodsName: row.goodsName,
                    spec: row.spec || '',
                    tax_rate_display: row.tax_rate_display,
                    invoice_status: row.invoice_status,
                    in_price_display: row.in_price_display,
                    in_num: 0,
                    isPay: row.isPay,
                    totalAmount: 0,
                    noTaxTotal: 0,
                    taxTotal: 0,
                    cumulative_invoice_balance: null,
                    cumulative_pay_balance: null,
                    record_date: row.record_date || '',
                    count: 0,
                    _isReturn: row._isReturn || false,
                    latestDate: row.record_date || '',
                    hasInRecord: false
                };
            }
            const g = groupMap[key];
            g.in_num += Number(row.in_num);
            g.totalAmount += Number(row.totalAmount);
            g.noTaxTotal += Number(row.noTaxTotal);
            g.taxTotal += Number(row.taxTotal);
            g.count++;
            if (g.count === 1) {
                g.record_date = row.record_date;
            }

            // 只从非退货记录取结余
            if (!row._isReturn && row.cumulative_invoice_balance !== null && row.cumulative_invoice_balance !== undefined) {
                g.hasInRecord = true;
                if (row.record_date && row.record_date > g.latestDate) {
                    g.latestDate = row.record_date;
                    g.cumulative_invoice_balance = Number(row.cumulative_invoice_balance);
                    g.cumulative_pay_balance = Number(row.cumulative_pay_balance);
                }
                if (g.cumulative_invoice_balance === null) {
                    g.cumulative_invoice_balance = Number(row.cumulative_invoice_balance);
                    g.cumulative_pay_balance = Number(row.cumulative_pay_balance);
                    g.latestDate = row.record_date;
                }
            }
        });
        displayData = Object.values(groupMap);

        // 对于没有入库记录只有退货记录的组，结余设为 0
        displayData.forEach(row => {
            if (!row.hasInRecord) {
                row.cumulative_invoice_balance = 0;
                row.cumulative_pay_balance = 0;
            }
        });

        displayData.sort((a, b) => (b.record_date || '').localeCompare(a.record_date || ''));
    }

// ============================================================
// 【第十二步】计算汇总
// ============================================================
let summary = {
    in_num: 0,
    totalAmount: 0,
    noTaxTotal: 0,
    taxTotal: 0,
    cumulative_invoice_balance: 0,
    cumulative_pay_balance: 0
};

// ✅ 根据筛选条件决定取哪些供应商的结余
// 如果筛选了特定供应商，只取该供应商的结余；否则取所有线下供应商
let baseForBalance = allStockInList.filter(i => i.settleType === '线下');

// 如果供应商筛选框有值，只取该供应商
if (supplier) {
    baseForBalance = baseForBalance.filter(i => 
        (i.supplier || '').toLowerCase().includes(supplier.toLowerCase())
    );
}

const supplierLastBalance = {};
baseForBalance.forEach(item => {
    const sup = item.supplier;
    const currentDate = item.record_date || '';
    if (!supplierLastBalance[sup] || currentDate > supplierLastBalance[sup].record_date) {
        supplierLastBalance[sup] = {
            record_date: currentDate,
            cumulative_invoice_balance: Number(item.cumulative_invoice_balance) || 0,
            cumulative_pay_balance: Number(item.cumulative_pay_balance) || 0
        };
    }
});

// 汇总各供应商的最后结余
for (const supplier in supplierLastBalance) {
    summary.cumulative_invoice_balance += supplierLastBalance[supplier].cumulative_invoice_balance || 0;
    summary.cumulative_pay_balance += supplierLastBalance[supplier].cumulative_pay_balance || 0;
}

// 数量、金额汇总（从 displayData 累加）
displayData.forEach(row => {
    summary.in_num += Number(row.in_num);
    summary.totalAmount += Number(row.totalAmount);
    summary.noTaxTotal += Number(row.noTaxTotal);
    summary.taxTotal += Number(row.taxTotal);
});
    // ============================================================
    // 【第十三步】更新总条数提示
    // ============================================================
    const totalTip = document.getElementById('stockInCheckTotalTip');
    if (totalTip) {
        // 计算符合条件的入库记录数（用于显示）
        let totalInCount = allStockInList.filter(i => {
            let match = true;
            if (settle && i.settleType !== settle) match = false;
            if (month && i.record_date && i.record_date.substring(0, 7) !== month) match = false;
            if (supplier && !(i.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(i.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (taxRate !== '') {
                const goods = allGoodsList.find(g => 
                    g.name === i.goodsName && 
                    g.supplier === i.supplier && 
                    (g.spec || '') === (i.spec || '')
                );
                const rate = goods ? String(goods.tax_rate || '') : '';
                if (rate !== taxRate) match = false;
            }
            return match;
        }).length;

        const totalReturnCount = returnList.length;
        totalTip.innerText = `共 ${totalInCount + totalReturnCount} 条记录（入库 ${totalInCount} 条，退货 ${totalReturnCount} 条），当前搜索结果 ${displayData.length} 条`;
    }

    // ============================================================
    // ============================================================
    // 【第十四步】分页渲染
    // ============================================================
    const cfg = financePageConfig.stockInCheck;
    cfg.total = displayData.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = displayData.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('stockInCheckList');
    tbody.innerHTML = '';

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
        renderFinancePagination('stockInCheck');
        return;
    }

    pageData.forEach((row, index) => {
        let invoiceClass = '';
        let payClass = '';
        let remainColor = '';
        let qtyColor = '';

        if (row._isReturn) {
            invoiceClass = 'bg-return-invoice';
            payClass = 'bg-return-invoice';
            qtyColor = 'style="color:red;font-weight:bold;"';
        } else if (row.invoice_status === '已开票') {
            invoiceClass = 'bg-green-invoice';
        } else if (row.invoice_status === '未开票') {
            invoiceClass = 'bg-yellow-invoice';
        }

        if (row.isPay === '已付清' && !row._isReturn) {
            payClass = 'bg-green-invoice';
        } else if (row.isPay === '未付清' && !row._isReturn) {
            payClass = 'bg-yellow-invoice';
        }

        // ✅ 发票结余显示：null 或 undefined 显示为 "-"
        let balanceDisplay = '';
        if (row.cumulative_invoice_balance === null || row.cumulative_invoice_balance === undefined) {
            balanceDisplay = '-';
        } else {
            balanceDisplay = formatMoney(row.cumulative_invoice_balance);
        }

        // ✅ 红色样式判断（只有非 null 且小于0才标红）
        if (row.cumulative_invoice_balance !== null && row.cumulative_invoice_balance !== undefined && row.cumulative_invoice_balance < 0 && !row._isReturn) {
            remainColor = 'style="color:red;"';
        }

        const seq = start + index + 1;

        tbody.innerHTML += `
        <tr>
            <td>${seq}</td>
            <td>${row.supplier}</td>
            <td>${row.goodsName}</td>
            <td>${row.spec || ''}</td>
            <td>${row.tax_rate_display}</td>
            <td class="${invoiceClass}">${row.invoice_status}</td>
            <td>${row.in_price_display}</td>
            <td ${qtyColor}>${row.in_num}</td>
            <td class="${payClass}">${row.isPay}</td>
            <td>${formatMoney(row.totalAmount)}</td>
            <td>${formatMoney(row.noTaxTotal)}</td>
            <td>${formatMoney(row.taxTotal)}</td>
            <td ${remainColor}>${balanceDisplay}</td>
            <td>${row.record_date}</td>
        </tr>`;
    });

    // 汇总行
    const totalRemainColor = summary.cumulative_invoice_balance < 0 ? 'style="color:red;"' : '';
    const totalQtyColor = summary.in_num < 0 ? 'style="color:red;font-weight:bold;"' : '';
    const totalBalanceDisplay = summary.cumulative_invoice_balance === null || summary.cumulative_invoice_balance === undefined 
        ? '-' 
        : formatMoney(summary.cumulative_invoice_balance);
    tbody.innerHTML += `
    <tr style="background:#e8f0fe;font-weight:bold;font-size:14px;">
        <td colspan="7" style="text-align:right;">总汇总：</td>
        <td ${totalQtyColor}>${summary.in_num}</td>
        <td></td>
        <td>${formatMoney(summary.totalAmount)}</td>
        <td>${formatMoney(summary.noTaxTotal)}</td>
        <td>${formatMoney(summary.taxTotal)}</td>
        <td ${totalRemainColor}>${totalBalanceDisplay}</td>
        <td></td>
    </tr>`;

    renderFinancePagination('stockInCheck');
}

// 移除之前重复定义的函数，使用上面的新版本
// 注意：之前已经定义了 showCheckInSupplierList、filterCheckInSupplierList、renderCheckInSupplierList
// 以及 showCheckInGoodsList、filterCheckInGoodsList、renderCheckInGoodsList
// 需要确保上面的新版本覆盖了旧版本
// ===================== resetStockInCheck 函数 =====================
function resetStockInCheck() {
    document.getElementById('checkInSettle').value = '';
    document.getElementById('checkInInvoice').value = '';
    document.getElementById('checkInPayStatus').value = '';
    document.getElementById('checkInMonth').value = '';
    document.getElementById('checkInSupplierSearchInput').value = '';
    document.getElementById('checkInGoodsSearchInput').value = '';
    document.getElementById('checkInTaxRateSearch').value = '';
    document.getElementById('checkInSupplierGroup').checked = false;
    document.getElementById('checkInGoodsGroup').checked = false;
    document.getElementById('checkInSupplierListBox').style.display = 'none';
    document.getElementById('checkInGoodsListBox').style.display = 'none';
    searchStockInCheck(true);
}
// ===================== 入库对账 - 供应商搜索下拉 =====================
function showCheckInSupplierList() {
    const list = window._checkInSupplierList || [];
    renderCheckInSupplierList(list);
    document.getElementById('checkInSupplierListBox').style.display = 'block';
}

function filterCheckInSupplierList() {
    const kw = document.getElementById('checkInSupplierSearchInput').value.toLowerCase();
    const list = (window._checkInSupplierList || []).filter(s => s.toLowerCase().includes(kw));
    renderCheckInSupplierList(list);
    document.getElementById('checkInSupplierListBox').style.display = 'block';
}

function renderCheckInSupplierList(list) {
    const box = document.getElementById('checkInSupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('checkInSupplierSearchInput').value = s;
            document.getElementById('checkInSupplierListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// ===================== 入库对账 - 商品名称搜索下拉 =====================
function showCheckInGoodsList() {
    const list = window._checkInGoodsList || [];
    renderCheckInGoodsList(list);
    document.getElementById('checkInGoodsListBox').style.display = 'block';
}

function filterCheckInGoodsList() {
    const kw = document.getElementById('checkInGoodsSearchInput').value.toLowerCase();
    const list = (window._checkInGoodsList || []).filter(s => s.toLowerCase().includes(kw));
    renderCheckInGoodsList(list);
    document.getElementById('checkInGoodsListBox').style.display = 'block';
}

function renderCheckInGoodsList(list) {
    const box = document.getElementById('checkInGoodsListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('checkInGoodsSearchInput').value = s;
            document.getElementById('checkInGoodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// ===================== 入库对账 - 点击空白关闭下拉 =====================
document.addEventListener('click', function(e) {
    if (!e.target.closest('#checkInSupplierSearchInput') && !e.target.closest('#checkInSupplierListBox')) {
        document.getElementById('checkInSupplierListBox').style.display = 'none';
    }
    if (!e.target.closest('#checkInGoodsSearchInput') && !e.target.closest('#checkInGoodsListBox')) {
        document.getElementById('checkInGoodsListBox').style.display = 'none';
    }
});

/**
 * 导出入库对账表（包含退货数据）
 */
function exportStockInCheckExcel() {
    // 获取筛选条件（与 searchStockInCheck 保持一致）
    const settle = document.getElementById('checkInSettle').value;
    const invStatus = document.getElementById('checkInInvoice').value;
    const month = document.getElementById('checkInMonth').value;
    const supplier = document.getElementById('checkInSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('checkInGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('checkInTaxRateSearch').value;
    const groupSupplier = document.getElementById('checkInSupplierGroup').checked;
    const groupGoods = document.getElementById('checkInGoodsGroup').checked;

    // ===== 1. 获取入库数据 =====
    let inList = [...allStockInList];
    
    if (settle) inList = inList.filter(i => i.settleType === settle);
    if (invStatus) inList = inList.filter(i => i.invoice_status === invStatus);
    if (month) inList = inList.filter(i => i.record_date && i.record_date.substring(0, 7) === month);
    if (supplier) inList = inList.filter(i => (i.supplier || '').toLowerCase().includes(supplier.toLowerCase()));
    if (goodsName) inList = inList.filter(i => (i.goodsName || '').toLowerCase().includes(goodsName.toLowerCase()));
    if (taxRate !== '') {
        inList = inList.filter(i => {
            const goods = allGoodsList.find(g => 
                g.name === i.goodsName && 
                g.supplier === i.supplier && 
                g.spec === i.spec
            );
            const rate = goods ? String(goods.tax_rate || '') : '';
            return rate === taxRate;
        });
    }

   // ===== 2. 获取退货数据（✅ 所有商品，不区分线上线下） =====
let returnList = [];
if (allReturnGoods && allReturnGoods.length > 0) {
    returnList = allReturnGoods.filter(item => {
        let match = true;
        // ✅ 移除 settle_type 限制，显示所有退货
        // if (settle && item.settle_type !== settle) match = false;
        if (month && item.record_date && item.record_date.substring(0, 7) !== month) match = false;
        if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
        if (goodsName && !(item.goods_name || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
        if (taxRate !== '') {
            const goods = allGoodsList.find(g => 
                g.name === item.goods_name && 
                g.supplier === item.supplier && 
                g.spec === item.spec
            );
            const rate = goods ? String(goods.tax_rate || '') : '';
            if (rate !== taxRate) match = false;
        }
        return match;
    });
}

    // ===== 3. 合并入库和退货数据，按日期排序 =====
    let allRecords = [];

    inList.forEach(item => {
        allRecords.push({
            id: item.id,
            supplier: item.supplier,
            goodsName: item.goodsName,
            spec: item.spec || '',
            settleType: item.settleType,
            in_price: item.in_price || 0,
            in_num: item.in_num || 0,
            record_date: item.record_date || '',
            invoice_status: item.invoice_status || '',
            type: 'in',
            amount: Number(item.in_price) * Number(item.in_num)
        });
    });

    returnList.forEach(item => {
        const amount = Number(item.in_price) * Number(item.return_num);
        allRecords.push({
            id: -item.id,
            supplier: item.supplier,
            goodsName: item.goods_name,
            spec: item.spec || '',
            settleType: item.settle_type || '',
            in_price: item.in_price || 0,
            in_num: -item.return_num,
            record_date: item.record_date || '',
            invoice_status: '退货',
            type: 'return',
            amount: -amount,
            _isReturn: true
        });
    });

    allRecords.sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''));

    // ===== 4. 按供应商分组处理 =====
    const supplierGroups = {};
    allRecords.forEach(record => {
        if (!supplierGroups[record.supplier]) {
            supplierGroups[record.supplier] = [];
        }
        supplierGroups[record.supplier].push(record);
    });

    let processedList = [];

    for (const sup of Object.keys(supplierGroups)) {
        const records = supplierGroups[sup];
        
        const totalPay = allPayList
            .filter(p => p.supplier === sup)
            .reduce((sum, p) => sum + Number(p.payment_amount), 0);
        
        const totalInvoiceBack = allInvoiceBackList
            .filter(b => b.supplier === sup)
            .reduce((sum, b) => sum + Number(b.invoice_amount), 0);

        // ===== 发票结余（滚动计算） =====
        let remainingInvoice = totalInvoiceBack;
        // ===== 付款结余（滚动计算） =====
        let remainingPay = totalPay;

        records.forEach(record => {
            const isReturn = record.type === 'return';
            const amount = Math.abs(record.amount);

            const goods = allGoodsList.find(g => 
                g.name === record.goodsName && 
                g.supplier === record.supplier && 
                g.spec === record.spec
            );
            
            const taxRateVal = goods ? Number(goods.tax_rate || 0) : 0;
            const channel = record.settleType || (goods ? goods.channel : '');
            const inPrice = Number(record.in_price) || 0;
            const qty = Number(record.in_num) || 0;
            const totalAmount = inPrice * qty;
            
            let noTaxTotal = 0;
            let taxTotal = 0;
            let taxRateDisplay = '';
            let inPriceDisplay = '';
            
            if (channel === '线上') {
                taxRateDisplay = '';
                inPriceDisplay = formatMoney(inPrice);
                noTaxTotal = 0;
                taxTotal = 0;
            } else {
                taxRateDisplay = (taxRateVal > 0 ? taxRateVal + '%' : '0%');
                inPriceDisplay = formatMoney(inPrice);
                
                const taxDecimal = taxRateVal / 100;
                if (taxDecimal > 0) {
                    const noTaxPrice = inPrice / (1 + taxDecimal);
                    noTaxTotal = noTaxPrice * qty;
                    taxTotal = totalAmount - noTaxTotal;
                } else {
                    noTaxTotal = totalAmount;
                    taxTotal = 0;
                }
            }

            // ===== 发票结余（滚动计算） =====
            let remainAmount = 0;
            let invoiceStatus = '';
            if (isReturn) {
                remainingInvoice += amount;
                remainAmount = remainingInvoice;
                invoiceStatus = '退货';
            } else {
                remainingInvoice -= amount;
                remainAmount = remainingInvoice;
                invoiceStatus = remainingInvoice >= 0 ? '已开票' : '未开票';
            }

            // ===== 付款结余（滚动计算） =====
            let isPay = '';
            if (isReturn) {
                remainingPay += amount;
                isPay = '退货';
            } else {
                remainingPay -= amount;
                isPay = remainingPay >= 0 ? '已付清' : '未付清';
            }

            processedList.push({
                supplier: record.supplier,
                goodsName: record.goodsName,
                spec: record.spec || '',
                tax_rate_display: taxRateDisplay,
                invoice_status: invoiceStatus,
                in_price_display: inPriceDisplay,
                in_num: qty,
                isPay: isPay,
                totalAmount: totalAmount,
                noTaxTotal: noTaxTotal,
                taxTotal: taxTotal,
                remainAmount: remainAmount,
                record_date: record.record_date,
                _isReturn: isReturn
            });
        });
    }

    // ===== 5. 分组汇总 =====
    if (groupSupplier || groupGoods) {
        const groupMap = {};
        processedList.forEach(row => {
            const key = groupSupplier ? row.supplier : `${row.supplier}_${row.goodsName}_${row.spec}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    supplier: row.supplier,
                    goodsName: row.goodsName,
                    spec: row.spec || '',
                    tax_rate_display: row.tax_rate_display,
                    invoice_status: row.invoice_status || '',
                    in_price_display: '￥0.00',
                    in_num: 0,
                    isPay: row.isPay,
                    totalAmount: 0,
                    noTaxTotal: 0,
                    taxTotal: 0,
                    remainAmount: 0,
                    record_date: row.record_date || '',
                    count: 0,
                    _isReturn: row._isReturn || false
                };
            }
            const g = groupMap[key];
            g.in_num += Number(row.in_num);
            g.totalAmount += Number(row.totalAmount);
            g.noTaxTotal += Number(row.noTaxTotal);
            g.taxTotal += Number(row.taxTotal);
            g.remainAmount = row.remainAmount;
            g.count++;
            if (g.count === 1) {
                g.in_price_display = row.in_price_display;
                g.record_date = row.record_date;
                g._isReturn = row._isReturn || false;
            }
        });
        processedList = Object.values(groupMap);
    }

    // ===== 6. 汇总 =====
    let summary = {
        in_num: 0,
        totalAmount: 0,
        noTaxTotal: 0,
        taxTotal: 0,
        remainAmount: 0
    };
    processedList.forEach(row => {
        summary.in_num += Number(row.in_num);
        summary.totalAmount += Number(row.totalAmount);
        summary.noTaxTotal += Number(row.noTaxTotal);
        summary.taxTotal += Number(row.taxTotal);
        summary.remainAmount = row.remainAmount;
    });

    // ===== 7. 构建导出数据 =====
    const header = ["序号", "供应商", "商品名称", "规格", "税率", "发票状态", "入库单价", "入库数量", "是否付清", "含税入库金额", "不含税金额", "税额", "发票结余", "录入日期", "备注"];
    const expData = processedList.map((row, idx) => {
        const note = row._isReturn ? '退货' : '';
        return [
            idx + 1,
            row.supplier,
            row.goodsName,
            row.spec,
            row.tax_rate_display,
            row.invoice_status || '',
            row.in_price_display,
            row.in_num,
            row.isPay,
            formatMoney(row.totalAmount),
            formatMoney(row.noTaxTotal),
            formatMoney(row.taxTotal),
            formatMoney(row.remainAmount),
            row.record_date,
            note
        ];
    });

    expData.push([
        "汇总", "", "", "", "", "",
        "",
        summary.in_num, "",
        formatMoney(summary.totalAmount),
        formatMoney(summary.noTaxTotal),
        formatMoney(summary.taxTotal),
        formatMoney(summary.remainAmount),
        "",
        ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库对账表");
    XLSX.writeFile(wb, `入库对账表_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ===================== ⑧出库对账 =====================
// 出库对账下拉缓存变量
let checkOutSupplierList = [];
let checkOutGoodsList = [];
let checkOutSearchTimer = null;

function initStockOutCheckPage() {
    financePageConfig.stockOutCheck.current = 1;
    initCheckOutMonthSelect('checkOutMonth');
    
    const outData = window.allStockOut || [];
    
    // 初始化供应商和商品下拉数据
    const suppliers = [...new Set(outData.map(item => item.supplier).filter(Boolean))];
    checkOutSupplierList = suppliers;
    window._checkOutSupplierList = suppliers;
    
    const goodsNames = [...new Set(outData.map(item => item.goodsName).filter(Boolean))];
    checkOutGoodsList = goodsNames;
    window._checkOutGoodsList = goodsNames;
    
    // 重置搜索框
    document.getElementById('checkOutSupplierSearchInput').value = '';
    document.getElementById('checkOutGoodsSearchInput').value = '';
    document.getElementById('checkOutSupplierListBox').style.display = 'none';
    document.getElementById('checkOutGoodsListBox').style.display = 'none';
    
    const tbody = document.getElementById('stockOutCheckList');
    if (tbody) tbody.innerHTML = '';
    
    renderFinancePagination('stockOutCheck');
    searchStockOutCheck(true);
}

function initCheckOutMonthSelect(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">全部月份</option>';
    const outData = window.allStockOut || [];
    const monthSet = new Set();
    outData.forEach(item => {
        if (item.recordDate) {
            monthSet.add(item.recordDate.substring(0, 7));
        }
    });
    const monthList = Array.from(monthSet).sort().reverse();
    monthList.forEach(m => {
        sel.innerHTML += `<option value="${m}">${m}</option>`;
    });
}

// ========== 出库对账 - 供应商搜索下拉 ==========
function showCheckOutSupplierList() {
    renderCheckOutSupplierList(checkOutSupplierList);
    document.getElementById('checkOutSupplierListBox').style.display = 'block';
}

function filterCheckOutSupplierList() {
    const kw = document.getElementById('checkOutSupplierSearchInput').value.toLowerCase();
    const filtered = checkOutSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderCheckOutSupplierList(filtered);
    document.getElementById('checkOutSupplierListBox').style.display = 'block';
}

function renderCheckOutSupplierList(list) {
    const box = document.getElementById('checkOutSupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('checkOutSupplierSearchInput').value = s;
            document.getElementById('checkOutSupplierListBox').style.display = 'none';
            // 输入即搜索
            searchStockOutCheck(true);
        };
        box.appendChild(div);
    });
}

// ========== 出库对账 - 商品名称搜索下拉 ==========
function showCheckOutGoodsList() {
    renderCheckOutGoodsList(checkOutGoodsList);
    document.getElementById('checkOutGoodsListBox').style.display = 'block';
}

function filterCheckOutGoodsList() {
    const kw = document.getElementById('checkOutGoodsSearchInput').value.toLowerCase();
    const filtered = checkOutGoodsList.filter(s => s.toLowerCase().includes(kw));
    renderCheckOutGoodsList(filtered);
    document.getElementById('checkOutGoodsListBox').style.display = 'block';
}

function renderCheckOutGoodsList(list) {
    const box = document.getElementById('checkOutGoodsListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('checkOutGoodsSearchInput').value = s;
            document.getElementById('checkOutGoodsListBox').style.display = 'none';
            // 输入即搜索
            searchStockOutCheck(true);
        };
        box.appendChild(div);
    });
}

// ========== 出库对账实时搜索（输入即搜索） ==========
function onCheckOutFilterInput() {
    // 清除之前的定时器
    if (checkOutSearchTimer) {
        clearTimeout(checkOutSearchTimer);
    }
    // 防抖处理，300ms后执行搜索
    checkOutSearchTimer = setTimeout(() => {
        searchStockOutCheck(true);
        // 显示下拉列表
        const supplierInput = document.getElementById('checkOutSupplierSearchInput');
        const goodsInput = document.getElementById('checkOutGoodsSearchInput');
        
        if (document.activeElement === supplierInput) {
            const kw = supplierInput.value.toLowerCase().trim();
            const filtered = checkOutSupplierList.filter(s => s.toLowerCase().includes(kw));
            renderCheckOutSupplierList(filtered);
            document.getElementById('checkOutSupplierListBox').style.display = 'block';
        } else if (document.activeElement === goodsInput) {
            const kw = goodsInput.value.toLowerCase().trim();
            const filtered = checkOutGoodsList.filter(s => s.toLowerCase().includes(kw));
            renderCheckOutGoodsList(filtered);
            document.getElementById('checkOutGoodsListBox').style.display = 'block';
        }
    }, 300);
}

// ========== 出库对账重置搜索 ==========
function resetStockOutCheck() {
    document.getElementById('checkOutSettle').value = '';
    document.getElementById('checkOutMonth').value = '';
    document.getElementById('checkOutSupplierSearchInput').value = '';
    document.getElementById('checkOutGoodsSearchInput').value = '';
    document.getElementById('checkOutTaxRateSearch').value = '';
    document.getElementById('checkOutSupplierGroup').checked = false;
    document.getElementById('checkOutGoodsGroup').checked = false;
    document.getElementById('checkOutSupplierListBox').style.display = 'none';
    document.getElementById('checkOutGoodsListBox').style.display = 'none';
    // 重置分页到第一页
    financePageConfig.stockOutCheck.current = 1;
    searchStockOutCheck(true);
}

function searchStockOutCheck(resetPage = true) {
if(resetPage){
    financePageConfig.stockOutCheck.current = 1;
}
    const settle = document.getElementById('checkOutSettle').value;
    const month = document.getElementById('checkOutMonth').value;
    const supplier = document.getElementById('checkOutSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('checkOutGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('checkOutTaxRateSearch').value;
    const groupSupplier = document.getElementById('checkOutSupplierGroup').checked;
    const groupGoods = document.getElementById('checkOutGoodsGroup').checked;
    
    let list = window.allStockOut ? [...window.allStockOut] : [];
    
    if (settle) list = list.filter(i => i.settleType === settle);
    if (month) list = list.filter(i => i.recordDate && i.recordDate.substring(0, 7) === month);
    // 模糊匹配供应商
    if (supplier) list = list.filter(i => (i.supplier || '').toLowerCase().includes(supplier.toLowerCase()));
    // 模糊匹配商品名
    if (goodsName) list = list.filter(i => (i.goodsName || '').toLowerCase().includes(goodsName.toLowerCase()));
    if (taxRate !== '') {
        list = list.filter(i => {
            const goods = allGoodsList.find(g => 
                g.name === i.goodsName && 
                g.supplier === i.supplier && 
                (g.spec || '') === (i.spec || '')
            );
            const rate = goods ? String(goods.tax_rate || '') : '';
            return rate === taxRate;
        });
    }
    
    let processedList = list.map(row => {
        let goods = allGoodsList.find(g => {
            const gSpec = g.spec || '';
            const rowSpec = row.spec || '';
            return g.name === row.goodsName && 
                   g.supplier === row.supplier && 
                   gSpec === rowSpec;
        });
        
        let taxRateVal = 0;
        if (goods) {
            taxRateVal = Number(goods.tax_rate || 0);
        } else {
            const goodsNoSpec = allGoodsList.find(g => 
                g.name === row.goodsName && 
                g.supplier === row.supplier
            );
            taxRateVal = goodsNoSpec ? Number(goodsNoSpec.tax_rate || 0) : 0;
        }
        
        const channel = row.settleType || (goods ? goods.channel : '');
        const outPrice = Number(row.outPrice) || 0;
        const salePrice = Number(row.salePrice) || 0;
        const qty = Number(row.outNum) || 0;
        const outAmount = outPrice * qty;
        const saleAmount = salePrice * qty;
        
        let outNoTaxAmount = 0;
        let outTax = 0;
        let saleNoTaxAmount = 0;
        let saleTax = 0;
        let taxRateDisplay = '';
        let outPriceDisplay = '';
        let salePriceDisplay = '';
        const recordDate = row.recordDate || '';
        
        const taxDecimal = taxRateVal / 100;
        
        if (taxDecimal > 0) {
            outNoTaxAmount = outAmount / (1 + taxDecimal);
            outTax = outAmount - outNoTaxAmount;
            saleNoTaxAmount = saleAmount / (1 + taxDecimal);
            saleTax = saleAmount - saleNoTaxAmount;
        } else {
            outNoTaxAmount = outAmount;
            outTax = 0;
            saleNoTaxAmount = saleAmount;
            saleTax = 0;
        }
        
        if (channel === '线上') {
            taxRateDisplay = '';
        } else {
            taxRateDisplay = (taxRateVal > 0 ? taxRateVal + '%' : '0%');
        }
        outPriceDisplay = formatMoney(outPrice);
        salePriceDisplay = formatMoney(salePrice);
        
        return {
            supplier: row.supplier,
            goodsName: row.goodsName,
            spec: row.spec || '',
            tax_rate_display: taxRateDisplay,
            outNum: qty,
            outPrice: outPriceDisplay,
            salePrice: salePriceDisplay,
            outAmount: outAmount,
            outNoTaxAmount: outNoTaxAmount,
            outTax: outTax,
            saleAmount: saleAmount,
            saleNoTaxAmount: saleNoTaxAmount,
            saleTax: saleTax,
            recordDate: recordDate
        };
    });
    
    // ===== 按录入日期倒序排列（最新在前） =====
    processedList.sort((a, b) => (b.recordDate || '').localeCompare(a.recordDate || ''));
      
    if (groupSupplier || groupGoods) {
        const groupMap = {};
        processedList.forEach(row => {
            const key = groupSupplier ? row.supplier : `${row.supplier}_${row.goodsName}_${row.spec}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    supplier: row.supplier,
                    goodsName: row.goodsName,
                    spec: row.spec || '',
                    tax_rate_display: row.tax_rate_display,
                    outNum: 0,
                    outPrice: row.outPrice,
                    salePrice: row.salePrice,
                    outAmount: 0,
                    outNoTaxAmount: 0,
                    outTax: 0,
                    saleAmount: 0,
                    saleNoTaxAmount: 0,
                    saleTax: 0,
                    recordDate: row.recordDate || '',
                    count: 0
                };
            }
            const g = groupMap[key];
            g.outNum += Number(row.outNum);
            g.outAmount += row.outAmount;
            g.outNoTaxAmount += row.outNoTaxAmount;
            g.outTax += row.outTax;
            g.saleAmount += row.saleAmount;
            g.saleNoTaxAmount += row.saleNoTaxAmount;
            g.saleTax += row.saleTax;
            g.count++;
            if (g.count === 1) {
                g.recordDate = row.recordDate;
            }
        });
        processedList = Object.values(groupMap);
        // 分组后再次按日期倒序排列
        processedList.sort((a, b) => (b.recordDate || '').localeCompare(a.recordDate || ''));
    }
    
    let summary = {
        outNum: 0,
        outAmount: 0,
        outNoTaxAmount: 0,
        outTax: 0,
        saleAmount: 0,
        saleNoTaxAmount: 0,
        saleTax: 0
    };
    processedList.forEach(row => {
        summary.outNum += Number(row.outNum);
        summary.outAmount += Number(row.outAmount);
        summary.outNoTaxAmount += Number(row.outNoTaxAmount);
        summary.outTax += Number(row.outTax);
        summary.saleAmount += Number(row.saleAmount);
        summary.saleNoTaxAmount += Number(row.saleNoTaxAmount);
        summary.saleTax += Number(row.saleTax);
    });
    
    const totalTip = document.getElementById('stockOutCheckTotalTip');
    if (totalTip) {
        totalTip.innerText = `共 ${window.allStockOut ? window.allStockOut.length : 0} 条出库记录，当前搜索结果 ${processedList.length} 条`;
    }
    
    const cfg = financePageConfig.stockOutCheck;
    cfg.total = processedList.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = processedList.slice(start, start + cfg.pageSize);
    
    const tbody = document.getElementById('stockOutCheckList');
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
        renderFinancePagination('stockOutCheck');
        return;
    }
    
    pageData.forEach((row, index) => {
        const seq = start + index + 1;
        
        tbody.innerHTML += `
        <tr>
            <td>${seq}</td>
            <td>${row.supplier}</td>
            <td>${row.goodsName}</td>
            <td>${row.spec || ''}</td>
            <td>${row.tax_rate_display}</td>
            <td>${row.outNum}</td>
            <td>${row.outPrice}</td>
            <td>${row.salePrice}</td>
            <td>${formatMoney(row.outAmount)}</td>
            <td>${formatMoney(row.outNoTaxAmount)}</td>
            <td>${formatMoney(row.outTax)}</td>
            <td>${formatMoney(row.saleAmount)}</td>
            <td>${formatMoney(row.saleNoTaxAmount)}</td>
            <td>${formatMoney(row.saleTax)}</td>
            <td>${row.recordDate}</td>
        </tr>`;
    });
    
    tbody.innerHTML += `
    <tr style="background:#f0f4f8;font-weight:bold;">
        <td colspan="5" style="text-align:right;">汇总：</td>
        <td>${summary.outNum}</td>
        <td></td>
        <td></td>
        <td>${formatMoney(summary.outAmount)}</td>
        <td>${formatMoney(summary.outNoTaxAmount)}</td>
        <td>${formatMoney(summary.outTax)}</td>
        <td>${formatMoney(summary.saleAmount)}</td>
        <td>${formatMoney(summary.saleNoTaxAmount)}</td>
        <td>${formatMoney(summary.saleTax)}</td>
        <td></td>
    </tr>`;
    
    renderFinancePagination('stockOutCheck');
}
// 移除之前重复定义的函数 showCheckOutSupplierList、filterCheckOutSupplierList、renderCheckOutSupplierList
// 以及 showCheckOutGoodsList、filterCheckOutGoodsList、renderCheckOutGoodsList
// 使用上面的新版本覆盖

function exportStockOutCheckExcel() {
    searchStockOutCheck(true);
    
    const settle = document.getElementById('checkOutSettle').value;
    const month = document.getElementById('checkOutMonth').value;
    const supplier = document.getElementById('checkOutSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('checkOutGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('checkOutTaxRateSearch').value;
    const groupSupplier = document.getElementById('checkOutSupplierGroup').checked;
    const groupGoods = document.getElementById('checkOutGoodsGroup').checked;
    
    let list = window.allStockOut ? [...window.allStockOut] : [];
    
    if (settle) list = list.filter(i => i.settleType === settle);
    if (month) list = list.filter(i => i.recordDate && i.recordDate.substring(0, 7) === month);
    if (supplier) list = list.filter(i => i.supplier === supplier);
    if (goodsName) list = list.filter(i => i.goodsName === goodsName);
    if (taxRate !== '') {
        list = list.filter(i => {
            const goods = allGoodsList.find(g => 
                g.name === i.goodsName && 
                g.supplier === i.supplier && 
                g.spec === i.spec
            );
            const rate = goods ? String(goods.tax_rate || '') : '';
            return rate === taxRate;
        });
    }
    
    let processedList = list.map(row => {
        const goods = allGoodsList.find(g => 
            g.name === row.goodsName && 
            g.supplier === row.supplier && 
            g.spec === row.spec
        );
        
        const taxRateVal = goods ? Number(goods.tax_rate || 0) : 0;
        const outPrice = Number(row.outPrice) || 0;
        const salePrice = Number(row.salePrice) || 0;
        const qty = Number(row.outNum) || 0;
        const outAmount = outPrice * qty;
        const saleAmount = salePrice * qty;
        
        let outNoTaxAmount = 0, outTax = 0, saleNoTaxAmount = 0, saleTax = 0;
        const taxDecimal = taxRateVal / 100;
        
        if (taxDecimal > 0) {
            outNoTaxAmount = outAmount / (1 + taxDecimal);
            outTax = outAmount - outNoTaxAmount;
            saleNoTaxAmount = saleAmount / (1 + taxDecimal);
            saleTax = saleAmount - saleNoTaxAmount;
        } else {
            outNoTaxAmount = outAmount;
            outTax = 0;
            saleNoTaxAmount = saleAmount;
            saleTax = 0;
        }
        
        return {
            supplier: row.supplier,
            goodsName: row.goodsName,
            spec: row.spec || '',
            tax_rate_display: (row.settleType === '线上' ? '' : (taxRateVal > 0 ? taxRateVal + '%' : '0%')),
            outNum: qty,
            outPrice: formatMoney(outPrice),
            salePrice: formatMoney(salePrice),
            outAmount: outAmount,
            outNoTaxAmount: outNoTaxAmount,
            outTax: outTax,
            saleAmount: saleAmount,
            saleNoTaxAmount: saleNoTaxAmount,
            saleTax: saleTax,
            recordDate: row.recordDate || ''
        };
    });
    
    if (groupSupplier || groupGoods) {
        const groupMap = {};
        processedList.forEach(row => {
            const key = groupSupplier ? row.supplier : `${row.supplier}_${row.goodsName}_${row.spec}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    supplier: row.supplier,
                    goodsName: row.goodsName,
                    spec: row.spec || '',
                    tax_rate_display: row.tax_rate_display,
                    outNum: 0,
                    outPrice: row.outPrice,
                    salePrice: row.salePrice,
                    outAmount: 0,
                    outNoTaxAmount: 0,
                    outTax: 0,
                    saleAmount: 0,
                    saleNoTaxAmount: 0,
                    saleTax: 0,
                    recordDate: row.recordDate || '',
                    count: 0
                };
            }
            const g = groupMap[key];
            g.outNum += Number(row.outNum);
            g.outAmount += row.outAmount;
            g.outNoTaxAmount += row.outNoTaxAmount;
            g.outTax += row.outTax;
            g.saleAmount += row.saleAmount;
            g.saleNoTaxAmount += row.saleNoTaxAmount;
            g.saleTax += row.saleTax;
            g.count++;
            if (g.count === 1) {
                g.recordDate = row.recordDate;
            }
        });
        processedList = Object.values(groupMap);
    }
    
    let summary = { outNum: 0, outAmount: 0, outNoTaxAmount: 0, outTax: 0, saleAmount: 0, saleNoTaxAmount: 0, saleTax: 0 };
    processedList.forEach(row => {
        summary.outNum += Number(row.outNum);
        summary.outAmount += Number(row.outAmount);
        summary.outNoTaxAmount += Number(row.outNoTaxAmount);
        summary.outTax += Number(row.outTax);
        summary.saleAmount += Number(row.saleAmount);
        summary.saleNoTaxAmount += Number(row.saleNoTaxAmount);
        summary.saleTax += Number(row.saleTax);
    });
    
    const header = ["序号", "供应商", "商品名称", "规格", "税率", "出库数量", "出库单价", "销售单价", "出库金额(含税)", "出库金额(不含税)", "出库税额", "销售金额(含税)", "销售金额(不含税)", "销售税额", "出库日期"];
    const expData = processedList.map((row, idx) => [
        idx + 1,
        row.supplier,
        row.goodsName,
        row.spec,
        row.tax_rate_display,
        row.outNum,
        row.outPrice,
        row.salePrice,
        formatMoney(row.outAmount),
        formatMoney(row.outNoTaxAmount),
        formatMoney(row.outTax),
        formatMoney(row.saleAmount),
        formatMoney(row.saleNoTaxAmount),
        formatMoney(row.saleTax),
        row.recordDate
    ]);
    
    expData.push([
        "汇总", "", "", "", "",
        summary.outNum, "", "",
        formatMoney(summary.outAmount),
        formatMoney(summary.outNoTaxAmount),
        formatMoney(summary.outTax),
        formatMoney(summary.saleAmount),
        formatMoney(summary.saleNoTaxAmount),
        formatMoney(summary.saleTax),
        ""
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库对账表");
    XLSX.writeFile(wb, `出库对账表_${new Date().toISOString().slice(0,10)}.xlsx`);
    // showMsg('导出成功');
}

// ===================== ⑨月期初库存 =====================
// 月期初库存下拉缓存变量
let beginSupplierList = [];
let beginGoodsList = [];
let beginSearchTimer = null;

function initMonthBeginPage() {
    financePageConfig.monthBeginStock.current = 1;
    
    initBeginMonthSelect('beginMonth');
    
    const inData = allStockInList || [];
    
    // 初始化供应商和商品下拉数据
    const suppliers = [...new Set(inData.map(item => item.supplier).filter(Boolean))];
    beginSupplierList = suppliers;
    window._beginSupplierList = suppliers;
    
    const goodsNames = [...new Set(inData.map(item => item.goodsName).filter(Boolean))];
    beginGoodsList = goodsNames;
    window._beginGoodsList = goodsNames;
    
    // 重置搜索框
    document.getElementById('beginSupplierSearchInput').value = '';
    document.getElementById('beginGoodsSearchInput').value = '';
    document.getElementById('beginSupplierListBox').style.display = 'none';
    document.getElementById('beginGoodsListBox').style.display = 'none';
    
    const tbody = document.getElementById('monthBeginStockList');
    if (tbody) tbody.innerHTML = '';
    
    renderFinancePagination('monthBeginStock');
}

function initBeginMonthSelect(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">请选择月份</option>';
    
    const monthSet = new Set();
    allStockInList.forEach(item => {
        if (item.record_date) {
            monthSet.add(item.record_date.substring(0, 7));
        }
    });
    const outData = window.allStockOut || [];
    outData.forEach(item => {
        if (item.recordDate) {
            monthSet.add(item.recordDate.substring(0, 7));
        }
    });
    const monthList = Array.from(monthSet).sort().reverse();
    monthList.forEach(m => {
        sel.innerHTML += `<option value="${m}">${m}</option>`;
    });
}

// ========== 月期初库存 - 供应商搜索下拉 ==========
function showBeginSupplierList() {
    renderBeginSupplierList(beginSupplierList);
    document.getElementById('beginSupplierListBox').style.display = 'block';
}

function filterBeginSupplierList() {
    const kw = document.getElementById('beginSupplierSearchInput').value.toLowerCase();
    const filtered = beginSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderBeginSupplierList(filtered);
    document.getElementById('beginSupplierListBox').style.display = 'block';
}

function renderBeginSupplierList(list) {
    const box = document.getElementById('beginSupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('beginSupplierSearchInput').value = s;
            document.getElementById('beginSupplierListBox').style.display = 'none';
            // 输入即搜索
            searchMonthBeginStock(true);
        };
        box.appendChild(div);
    });
}

// ========== 月期初库存 - 商品名称搜索下拉 ==========
function showBeginGoodsList() {
    renderBeginGoodsList(beginGoodsList);
    document.getElementById('beginGoodsListBox').style.display = 'block';
}

function filterBeginGoodsList() {
    const kw = document.getElementById('beginGoodsSearchInput').value.toLowerCase();
    const filtered = beginGoodsList.filter(s => s.toLowerCase().includes(kw));
    renderBeginGoodsList(filtered);
    document.getElementById('beginGoodsListBox').style.display = 'block';
}

function renderBeginGoodsList(list) {
    const box = document.getElementById('beginGoodsListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('beginGoodsSearchInput').value = s;
            document.getElementById('beginGoodsListBox').style.display = 'none';
            // 输入即搜索
            searchMonthBeginStock(true);
        };
        box.appendChild(div);
    });
}

// ========== 月期初库存实时搜索（输入即搜索） ==========
function onBeginFilterInput() {
    // 清除之前的定时器
    if (beginSearchTimer) {
        clearTimeout(beginSearchTimer);
    }
    // 防抖处理，300ms后执行搜索
    beginSearchTimer = setTimeout(() => {
        searchMonthBeginStock(true);
        // 显示下拉列表
        const supplierInput = document.getElementById('beginSupplierSearchInput');
        const goodsInput = document.getElementById('beginGoodsSearchInput');
        
        if (document.activeElement === supplierInput) {
            const kw = supplierInput.value.toLowerCase().trim();
            const filtered = beginSupplierList.filter(s => s.toLowerCase().includes(kw));
            renderBeginSupplierList(filtered);
            document.getElementById('beginSupplierListBox').style.display = 'block';
        } else if (document.activeElement === goodsInput) {
            const kw = goodsInput.value.toLowerCase().trim();
            const filtered = beginGoodsList.filter(s => s.toLowerCase().includes(kw));
            renderBeginGoodsList(filtered);
            document.getElementById('beginGoodsListBox').style.display = 'block';
        }
    }, 300);
}

// ========== 月期初库存重置搜索 ==========
function resetMonthBeginStock() {
    document.getElementById('beginSettle').value = '';
    document.getElementById('beginMonth').value = '';
    document.getElementById('beginSupplierSearchInput').value = '';
    document.getElementById('beginGoodsSearchInput').value = '';
    document.getElementById('beginTaxRateSearch').value = '';
    document.getElementById('beginSupplierGroup').checked = false;
    document.getElementById('beginGoodsGroup').checked = false;
    document.getElementById('beginSupplierListBox').style.display = 'none';
    document.getElementById('beginGoodsListBox').style.display = 'none';
    // 重置分页到第一页
    financePageConfig.monthBeginStock.current = 1;
    searchMonthBeginStock(true);
}

function searchMonthBeginStock(resetPage = true) {
if(resetPage){
    financePageConfig.monthBeginStock.current = 1;
}
    // 注意：不在这里重置分页，由调用方决定
    // 重置按钮会重置分页，下拉点击和实时搜索保持当前分页
    
    const settle = document.getElementById('beginSettle').value;
    const month = document.getElementById('beginMonth').value;
    const supplier = document.getElementById('beginSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('beginGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('beginTaxRateSearch').value;
    const groupSupplier = document.getElementById('beginSupplierGroup').checked;
    const groupGoods = document.getElementById('beginGoodsGroup').checked;
    
    if (!month) {
        showMsg('请先选择统计月份');
        const tbody = document.getElementById('monthBeginStockList');
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;padding:20px;">请选择统计月份</td></tr>';
        renderFinancePagination('monthBeginStock');
        return;
    }
    
    const year = parseInt(month.substring(0, 4));
    const monthNum = parseInt(month.substring(5, 7));
    const endDate = new Date(year, monthNum - 1, 0);
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const batchMap = new Map();
    allStockInList.forEach(item => {
        if (!item.record_date || item.record_date > endDateStr) return;
        
        if (settle && item.settleType !== settle) return;
        // 模糊匹配供应商
        if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) return;
        // 模糊匹配商品名
        if (goodsName && !(item.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) return;
        
        let taxRateVal = 0;
        if (taxRate !== '') {
            const goods = allGoodsList.find(g => 
                g.name === item.goodsName && 
                g.supplier === item.supplier && 
                (g.spec || '') === (item.spec || '')
            );
            taxRateVal = goods ? String(goods.tax_rate || '') : '';
            if (taxRateVal !== taxRate) return;
        }
        
        const batchKey = `${item.supplier}|${item.goodsName}|${item.spec || ''}|${item.in_price || 0}|${item.produce_date || ''}|${item.expire_date || ''}`;
        
        if (!batchMap.has(batchKey)) {
            batchMap.set(batchKey, {
                supplier: item.supplier,
                goodsName: item.goodsName,
                spec: item.spec || '',
                inPrice: item.in_price || 0,
                produceDate: item.produce_date || '',
                expireDate: item.expire_date || '',
                totalIn: 0,
                inRecordIds: []
            });
        }
        const batch = batchMap.get(batchKey);
        batch.totalIn += Number(item.in_num || 0);
        batch.inRecordIds.push(item.id);
    });
    
    const outData = window.allStockOut || [];
    const batchResults = [];
    
    batchMap.forEach((batch, key) => {
        let totalOut = 0;
        outData.forEach(out => {
            if (out.recordDate && out.recordDate <= endDateStr && batch.inRecordIds.includes(out.inRecordId)) {
                totalOut += Number(out.outNum || 0);
            }
        });
        
        const monthEndStock = Math.max(0, batch.totalIn - totalOut);
        if (monthEndStock > 0) {
            batchResults.push({
                ...batch,
                monthEndStock: monthEndStock
            });
        }
    });
    
    let processedList = batchResults.map(row => {
        const goods = allGoodsList.find(g => 
            g.name === row.goodsName && 
            g.supplier === row.supplier && 
            (g.spec || '') === (row.spec || '')
        );
        
        const taxRateVal = goods ? Number(goods.tax_rate || 0) : 0;
        const channel = row.settleType || (goods ? goods.channel : '');
        const inPrice = row.inPrice;
        const qty = row.monthEndStock;
        const totalAmount = inPrice * qty;
        
        let noTaxTotal = 0;
        let taxTotal = 0;
        let taxRateDisplay = '';
        
        if (channel === '线上') {
            taxRateDisplay = '';
            noTaxTotal = totalAmount;
            taxTotal = 0;
        } else {
            taxRateDisplay = (taxRateVal > 0 ? taxRateVal + '%' : '0%');
            const taxDecimal = taxRateVal / 100;
            if (taxDecimal > 0) {
                noTaxTotal = totalAmount / (1 + taxDecimal);
                taxTotal = totalAmount - noTaxTotal;
            } else {
                noTaxTotal = totalAmount;
                taxTotal = 0;
            }
        }
        
        return {
            supplier: row.supplier,
            goodsName: row.goodsName,
            spec: row.spec,
            tax_rate_display: taxRateDisplay,
            inPrice: formatMoney(inPrice),
            monthEndStock: qty,
            totalAmount: totalAmount,
            noTaxTotal: noTaxTotal,
            taxTotal: taxTotal
        };
    });
    
    if (groupSupplier || groupGoods) {
        const groupMap = {};
        processedList.forEach(row => {
            const key = groupSupplier ? row.supplier : `${row.supplier}_${row.goodsName}_${row.spec}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    supplier: row.supplier,
                    goodsName: row.goodsName,
                    spec: row.spec || '',
                    tax_rate_display: row.tax_rate_display,
                    inPrice: row.inPrice,
                    monthEndStock: 0,
                    totalAmount: 0,
                    noTaxTotal: 0,
                    taxTotal: 0,
                    count: 0
                };
            }
            const g = groupMap[key];
            g.monthEndStock += Number(row.monthEndStock);
            g.totalAmount += Number(row.totalAmount);
            g.noTaxTotal += Number(row.noTaxTotal);
            g.taxTotal += Number(row.taxTotal);
            g.count++;
            if (g.count === 1) {
                g.inPrice = row.inPrice;
            }
        });
        processedList = Object.values(groupMap);
    }
    
    let summary = {
        monthEndStock: 0,
        totalAmount: 0,
        noTaxTotal: 0,
        taxTotal: 0
    };
    processedList.forEach(row => {
        summary.monthEndStock += Number(row.monthEndStock);
        summary.totalAmount += Number(row.totalAmount);
        summary.noTaxTotal += Number(row.noTaxTotal);
        summary.taxTotal += Number(row.taxTotal);
    });
    
    const totalTip = document.getElementById('monthBeginStockTotalTip');
    if (totalTip) {
        totalTip.innerText = `截止 ${endDateStr}，共 ${processedList.length} 条库存记录，当前搜索结果 ${processedList.length} 条`;
    }
    
    const cfg = financePageConfig.monthBeginStock;
    cfg.total = processedList.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = processedList.slice(start, start + cfg.pageSize);
    
    const tbody = document.getElementById('monthBeginStockList');
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;padding:20px;">暂无匹配数据</td></tr>';
        renderFinancePagination('monthBeginStock');
        return;
    }
    
    pageData.forEach((row, index) => {
        const seq = start + index + 1;
        
        tbody.innerHTML += `
        <tr>
            <td>${seq}</td>
            <td>${row.supplier}</td>
            <td>${row.goodsName}</td>
            <td>${row.spec || ''}</td>
            <td>${row.tax_rate_display}</td>
            <td>${row.inPrice}</td>
            <td>${row.monthEndStock}</td>
            <td>${formatMoney(row.totalAmount)}</td>
            <td>${formatMoney(row.noTaxTotal)}</td>
            <td>${formatMoney(row.taxTotal)}</td>
        </tr>`;
    });
    
    tbody.innerHTML += `
    <tr style="background:#f0f4f8;font-weight:bold;">
        <td colspan="6" style="text-align:right;">汇总：</td>
        <td>${summary.monthEndStock}</td>
        <td>${formatMoney(summary.totalAmount)}</td>
        <td>${formatMoney(summary.noTaxTotal)}</td>
        <td>${formatMoney(summary.taxTotal)}</td>
    </tr>`;
    
    renderFinancePagination('monthBeginStock');
}

function exportMonthBeginStockExcel() {
    searchMonthBeginStock(true);
    
    const settle = document.getElementById('beginSettle').value;
    const month = document.getElementById('beginMonth').value;
    const supplier = document.getElementById('beginSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('beginGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('beginTaxRateSearch').value;
    const groupSupplier = document.getElementById('beginSupplierGroup').checked;
    const groupGoods = document.getElementById('beginGoodsGroup').checked;
    
    if (!month) {
        showMsg('请先选择统计月份');
        return;
    }
    
    const year = parseInt(month.substring(0, 4));
    const monthNum = parseInt(month.substring(5, 7));
    const endDate = new Date(year, monthNum - 1, 0);
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const batchMap = new Map();
    allStockInList.forEach(item => {
        if (!item.record_date || item.record_date > endDateStr) return;
        if (settle && item.settleType !== settle) return;
        // 模糊匹配供应商
        if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) return;
        // 模糊匹配商品名
        if (goodsName && !(item.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) return;
        
        let taxRateVal = 0;
        if (taxRate !== '') {
            const goods = allGoodsList.find(g => 
                g.name === item.goodsName && 
                g.supplier === item.supplier && 
                (g.spec || '') === (item.spec || '')
            );
            taxRateVal = goods ? String(goods.tax_rate || '') : '';
            if (taxRateVal !== taxRate) return;
        }
        
        const batchKey = `${item.supplier}|${item.goodsName}|${item.spec || ''}|${item.in_price || 0}|${item.produce_date || ''}|${item.expire_date || ''}`;
        if (!batchMap.has(batchKey)) {
            batchMap.set(batchKey, {
                supplier: item.supplier,
                goodsName: item.goodsName,
                spec: item.spec || '',
                inPrice: item.in_price || 0,
                produceDate: item.produce_date || '',
                expireDate: item.expire_date || '',
                totalIn: 0,
                inRecordIds: []
            });
        }
        const batch = batchMap.get(batchKey);
        batch.totalIn += Number(item.in_num || 0);
        batch.inRecordIds.push(item.id);
    });
    
    const outData = window.allStockOut || [];
    const batchResults = [];
    batchMap.forEach((batch) => {
        let totalOut = 0;
        outData.forEach(out => {
            if (out.recordDate && out.recordDate <= endDateStr && batch.inRecordIds.includes(out.inRecordId)) {
                totalOut += Number(out.outNum || 0);
            }
        });
        const monthEndStock = Math.max(0, batch.totalIn - totalOut);
        if (monthEndStock > 0) {
            batchResults.push({ ...batch, monthEndStock });
        }
    });
    
    let processedList = batchResults.map(row => {
        const goods = allGoodsList.find(g => 
            g.name === row.goodsName && 
            g.supplier === row.supplier && 
            (g.spec || '') === (row.spec || '')
        );
        const taxRateVal = goods ? Number(goods.tax_rate || 0) : 0;
        const channel = row.settleType || (goods ? goods.channel : '');
        const inPrice = row.inPrice;
        const qty = row.monthEndStock;
        const totalAmount = inPrice * qty;
        let noTaxTotal = 0, taxTotal = 0;
        let taxRateDisplay = '';
        
        if (channel === '线上') {
            taxRateDisplay = '';
            noTaxTotal = totalAmount;
            taxTotal = 0;
        } else {
            taxRateDisplay = (taxRateVal > 0 ? taxRateVal + '%' : '0%');
            const taxDecimal = taxRateVal / 100;
            if (taxDecimal > 0) {
                noTaxTotal = totalAmount / (1 + taxDecimal);
                taxTotal = totalAmount - noTaxTotal;
            } else {
                noTaxTotal = totalAmount;
                taxTotal = 0;
            }
        }
        return {
            supplier: row.supplier,
            goodsName: row.goodsName,
            spec: row.spec,
            tax_rate_display: taxRateDisplay,
            inPrice: formatMoney(inPrice),
            monthEndStock: qty,
            totalAmount: totalAmount,
            noTaxTotal: noTaxTotal,
            taxTotal: taxTotal
        };
    });
    
    if (groupSupplier || groupGoods) {
        const groupMap = {};
        processedList.forEach(row => {
            const key = groupSupplier ? row.supplier : `${row.supplier}_${row.goodsName}_${row.spec}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    supplier: row.supplier,
                    goodsName: row.goodsName,
                    spec: row.spec || '',
                    tax_rate_display: row.tax_rate_display,
                    inPrice: row.inPrice,
                    monthEndStock: 0,
                    totalAmount: 0,
                    noTaxTotal: 0,
                    taxTotal: 0,
                    count: 0
                };
            }
            const g = groupMap[key];
            g.monthEndStock += Number(row.monthEndStock);
            g.totalAmount += Number(row.totalAmount);
            g.noTaxTotal += Number(row.noTaxTotal);
            g.taxTotal += Number(row.taxTotal);
            g.count++;
            if (g.count === 1) {
                g.inPrice = row.inPrice;
            }
        });
        processedList = Object.values(groupMap);
    }
    
    let summary = { monthEndStock: 0, totalAmount: 0, noTaxTotal: 0, taxTotal: 0 };
    processedList.forEach(row => {
        summary.monthEndStock += Number(row.monthEndStock);
        summary.totalAmount += Number(row.totalAmount);
        summary.noTaxTotal += Number(row.noTaxTotal);
        summary.taxTotal += Number(row.taxTotal);
    });
    
    const header = ["序号", "供应商", "商品名称", "规格", "税率", "入库单价", "月末库存", "含税库存金额", "不含税金额", "税额"];
    const expData = processedList.map((row, idx) => [
        idx + 1,
        row.supplier,
        row.goodsName,
        row.spec,
        row.tax_rate_display,
        row.inPrice,
        row.monthEndStock,
        formatMoney(row.totalAmount),
        formatMoney(row.noTaxTotal),
        formatMoney(row.taxTotal)
    ]);
    
    expData.push([
        "汇总", "", "", "", "",
        "",
        summary.monthEndStock,
        formatMoney(summary.totalAmount),
        formatMoney(summary.noTaxTotal),
        formatMoney(summary.taxTotal)
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "期初库存表");
    XLSX.writeFile(wb, `期初库存表_${endDateStr}.xlsx`);
    // showMsg('导出成功');
}
window.resetTaxSearch = resetTaxSearch;
window.onTaxFilterInput = onTaxFilterInput;
window.onPrintFilterInput = onPrintFilterInput;
window.resetPrintSearch = resetPrintSearch;
window.switchFinanceSubTab = switchFinanceSubTab;
window.initFinanceBaseData = initFinanceBaseData;
window.renderFinancePagination = renderFinancePagination;
window.changeFinancePageSize = changeFinancePageSize;
window.financeGoToPage = financeGoToPage;
window.initCurrentSubPage = initCurrentSubPage;