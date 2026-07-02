// ===================== 格式化金额函数 =====================
function formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '￥0.00';
    }
    return '￥' + Number(value).toFixed(2);
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
        loadAllInvoiceBack()
    ]);
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

// 财务基础数据初始化（全局只加载一次）
async function initFinanceBaseData() {
    await Promise.all([
        loadOfflineSupplier(),
        loadDistinctMonth(),
        loadAllGoods(),
        loadAllStockIn(),
        loadAllPayment(),
        loadAllInvoiceBack(),
        loadAllStockOut()
    ]);
}
// ===================== ①税率录入模块：仅线下商品、进入页面自动关闭弹窗、自动加载列表 =====================
function initTaxRatePage() {
    const taxModal = document.getElementById('taxModal');
    if(taxModal) taxModal.style.display = 'none';
    initTaxSupplierFilter();
    refreshTaxList();
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
function refreshTaxList() {
    const selectSupplier = document.getElementById('taxSupplierSearch').value.trim();
    const selectGoodsName = document.getElementById('taxGoodsSearch').value.trim();
    const selectTaxText = document.getElementById('taxRateSearch').value.trim();
    const filterChannel = document.getElementById('taxChannelFilter').value;

    let list = [...allGoodsList.filter(g => g.channel === '线下')];

    if(selectSupplier){
        list = list.filter(g => g.supplier === selectSupplier);
    }

    if(selectGoodsName){
        list = list.filter(g => g.name === selectGoodsName);
    }

    if(selectTaxText){
        const targetTax = currTaxRateOptionList.find(item => item.text === selectTaxText);
        if(targetTax){
            if(targetTax.val === null){
                list = list.filter(g => g.tax_rate === null || g.tax_rate === undefined || g.tax_rate === '');
            }else if(targetTax.val !== ''){
                list = list.filter(g => String(g.tax_rate) === targetTax.val);
            }
        }
    }

    if(filterChannel){
        list = list.filter(g => g.channel === filterChannel);
    }

    // ---- 修改1：自定义排序 - 未设置优先，再按 id 降序（最新在前） ----
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
        // ---- 修改2：税率列显示 - 未设置时红色 ----
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
    refreshTaxList();
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

    let list = allStockInList.filter(item => item.settleType === '线下');
    if (supplier) list = list.filter(i => i.supplier === supplier);
    if (goodsName) list = list.filter(i => i.goodsName.toLowerCase().includes(goodsName));
    if (spec) list = list.filter(i => (i.spec || '').toLowerCase().includes(spec));
    if (start) list = list.filter(i => i.record_date >= start);
    if (end) list = list.filter(i => i.record_date <= end);

    const cfg = financePageConfig.stockInPrint;
    list.sort((a,b)=>{
        let val1 = a[cfg.sortField], val2 = b[cfg.sortField];
        if(typeof val1 === 'string' && !/^\d+$/.test(val1)){
            val1 = val1.toLowerCase();
            val2 = val2.toLowerCase();
        }
        if(val1 > val2) return cfg.sortType === 'desc' ? -1 : 1;
        if(val1 < val2) return cfg.sortType === 'desc' ? -1 : 1;
        return 0;
    });
    printStockInData = list;

    const totalTipDom = document.getElementById('stockTotalTip');
    if(totalTipDom){
        totalTipDom.innerText = `共${list.length}条入库记录，当前搜索结果${list.length}条`;
    }

    const startIdx = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(startIdx, startIdx + cfg.pageSize);

    const tbody = document.getElementById('printStockInList');
    tbody.innerHTML = '';
    pageData.forEach((item, idx) => {
        const isChecked = selectedPrintIds.has(item.id);
        tbody.innerHTML += `
        <tr>
            <td><input type="checkbox" class="print-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
            <td>${startIdx + idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.goodsName}</td>
            <td>${item.spec || ''}</td>
            <td>${Number(item.in_price).toFixed(2)}</td>
            <td>${item.in_num}</td>
            <td>${(Number(item.in_price) * Number(item.in_num)).toFixed(2)}</td>
            <td>${item.record_date}</td>
        </tr>`;
    });

    const groupMap = {};
    list.forEach(row=>{
        if(!groupMap[row.supplier]) groupMap[row.supplier] = {num:0,amount:0};
        groupMap[row.supplier].num += Number(row.in_num);
        groupMap[row.supplier].amount += Number(row.in_price)*Number(row.in_num);
    });
    let totalTpl = '';
    Object.entries(groupMap).forEach(([sup,data])=>{
        totalTpl += `
        <tr style="background:#f5f5f5;font-weight:bold;">
            <td colspan="2">${sup} 汇总</td>
            <td colspan="5">入库总数量：${data.num}</td>
            <td colspan="2">入库总金额：${data.amount.toFixed(2)}</td>
        </tr>`;
    });
    tbody.innerHTML += totalTpl;

    cfg.total = list.length;
    renderFinancePagination('stockInPrint');

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
        checkbox.onchange = function(){
            const id = Number(this.dataset.id);
            if(this.checked){
                selectedPrintIds.add(id);
            }else{
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
            supTotalAmount += Number(r.in_price) * Number(r.in_num);
        });

        for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
            const chunk = rows.slice(i, i + ROWS_PER_PAGE);
            const pageNum = Math.floor(i / ROWS_PER_PAGE) + 1;
            const isLastPage = (pageNum === totalPages);

            let tableRows = '';
            chunk.forEach(row => {
                const price = Number(row.in_price) || 0;
                const qty = Number(row.in_num) || 0;
                const amount = price * qty;
                const date = row.record_date ? row.record_date.replace(/-/g, '/') : '';
                tableRows += `
                    <tr>
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
                tableRows += `
                    <tr class="total-row">
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
                                <th>入库日期</th><th>供应商</th><th>商品名称</th><th>规格</th>
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
            border: 2px solid #000;
            background: #f5f5f5;
            font-weight: bold;
            font-size: 12pt;
        }
        .goods-table th:nth-child(1), .goods-table td:nth-child(1) { width: 13%; }
        .goods-table th:nth-child(2), .goods-table td:nth-child(2) { width: 14%; }
        .goods-table th:nth-child(3), .goods-table td:nth-child(3) { width: 22%; }
        .goods-table th:nth-child(4), .goods-table td:nth-child(4) { width: 14%; }
        .goods-table th:nth-child(5), .goods-table td:nth-child(5) { width: 11%; }
        .goods-table th:nth-child(6), .goods-table td:nth-child(6) { width: 10%; }
        .goods-table th:nth-child(7), .goods-table td:nth-child(7) { width: 16%; }
        .goods-table .total-row td {
            border-top: 2px solid #000;
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
        refreshPayRecordList();
    } catch(e) {
        console.error('initPayRecordPage 执行失败:', e);
    }
}
function initPaySupplierSelect() {
    const filterSel = document.getElementById('paySupplierFilter');
    const editSel = document.getElementById('paySupplier');
    filterSel.innerHTML = '<option value="">全部供应商</option>';
    editSel.innerHTML = '<option value="">请选择供应商</option>';
    offlineSupplierList.forEach(s => {
        filterSel.innerHTML += `<option value="${s}">${s}</option>`;
        editSel.innerHTML += `<option value="${s}">${s}</option>`;
    });
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
    
    editSel.onchange = function() {
        updatePayPayableDisplay(this.value);
    };
}

function refreshPayRecordList() {
    const filterSupplier = document.getElementById('paySupplierFilter').value;
    let list = [...allPayList];
    list.sort((a, b) => b.id - a.id);
    if (filterSupplier) list = list.filter(p => p.supplier === filterSupplier);

    const cfg = financePageConfig.payRecord;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('payRecordList');
    tbody.innerHTML = '';
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
    renderFinancePagination('payRecord');
}

function openPayAddModal() {
    currentPayEditId = null;
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('payAmount').value = '';
    document.getElementById('payRemark').value = '';
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

// ========== 更新应付账款显示 ==========
function updatePayPayableDisplay(supplier) {
    const displayEl = document.getElementById('payPayableDisplay');
    if (!displayEl) return;
    
    if (!supplier) {
        displayEl.textContent = '请选择供应商';
        displayEl.style.color = '#999';
        return;
    }
    
    let totalIn = 0;
    allStockInList.filter(i => i.settleType === '线下' && i.supplier === supplier).forEach(item => {
        totalIn += Number(item.in_price) * Number(item.in_num);
    });
    
    let totalPay = 0;
    allPayList.filter(p => p.supplier === supplier).forEach(p => {
        totalPay += Number(p.payment_amount);
    });
    
    const payable = totalIn - totalPay;
    
    displayEl.textContent = `￥${payable.toFixed(2)}`;
    displayEl.style.color = payable < 0 ? '#ff4d4f' : '#333';
}

function closePayModal() {
    document.getElementById('payModal').style.display = 'none';
}
async function savePayRecord() {
    const payDate = document.getElementById('payDate').value;
    const supplier = document.getElementById('paySupplier').value;
    const amount = Number(document.getElementById('payAmount').value);
    const remark = document.getElementById('payRemark').value.trim();
    if (!payDate || !supplier || isNaN(amount) || amount <= 0) return showMsg('请完善必填项，付款金额必须大于0');
    const body = { payment_date: payDate, supplier, payment_amount: amount, remark };
    if (currentPayEditId) {
        await fetch(`${SUPABASE_URL}/rest/v1/finance_payment?id=eq.${currentPayEditId}`, {
            method: 'PATCH',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } else {
        await fetch(`${SUPABASE_URL}/rest/v1/finance_payment`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }
    await loadAllPayment();
    refreshPayRecordList();
    showMsg('付款记录保存成功');
    closePayModal();
    currentPayEditId = null;
}

// 删除付款记录
async function deletePayRecord(id) {
    // ===== 检查是否管理员 =====
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除付款记录');
        return;
    }
    if (!confirm('确定删除该付款记录？')) return;
    await fetch(`${SUPABASE_URL}/rest/v1/finance_payment?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    await loadAllPayment();
    refreshPayRecordList();
    showMsg('删除成功');
}
// ===================== ④发票返回记录模块 =====================
let currentInvoiceBackEditId = null;
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
        refreshInvoiceBackList();
    } catch(e) {
        console.error('initInvoiceBackPage 执行失败:', e);
    }
}
function initInvoiceBackSupplierSelect() {
    const filterSel = document.getElementById('invoiceBackSupplierFilter');
    const editSel = document.getElementById('invoiceBackSupplier');
    filterSel.innerHTML = '<option value="">全部供应商</option>';
    editSel.innerHTML = '<option value="">请选择供应商</option>';
    
    if (offlineSupplierList.length === 0) {
        loadOfflineSupplier().then(() => {
            offlineSupplierList.forEach(s => {
                filterSel.innerHTML += `<option value="${s}">${s}</option>`;
                editSel.innerHTML += `<option value="${s}">${s}</option>`;
            });
        });
        return;
    }
    
    offlineSupplierList.forEach(s => {
        filterSel.innerHTML += `<option value="${s}">${s}</option>`;
        editSel.innerHTML += `<option value="${s}">${s}</option>`;
    });
    document.getElementById('invoiceBackDate').value = new Date().toISOString().split('T')[0];
    
    editSel.onchange = function() {
        updateInvoiceBackBalance(this.value);
    };
}

// ========== 更新发票结余显示 ==========
function updateInvoiceBackBalance(supplier) {
    const displayEl = document.getElementById('invoiceBackBalanceDisplay');
    if (!displayEl) return;
    
    if (!supplier) {
        displayEl.textContent = '请选择供应商';
        displayEl.style.color = '#999';
        return;
    }
    
    let totalIn = 0;
    allStockInList.filter(i => i.settleType === '线下' && i.supplier === supplier).forEach(item => {
        totalIn += Number(item.in_price) * Number(item.in_num);
    });
    
    let totalBack = 0;
    allInvoiceBackList.filter(b => b.supplier === supplier).forEach(b => {
        totalBack += Number(b.invoice_amount);
    });
    
    const balance = totalBack - totalIn;
    
    displayEl.textContent = `￥${balance.toFixed(2)}`;
    displayEl.style.color = balance < 0 ? '#ff4d4f' : '#333';
}

function refreshInvoiceBackList() {
    const filterSupplier = document.getElementById('invoiceBackSupplierFilter').value;
    let list = [...allInvoiceBackList];
    list.sort((a, b) => b.id - a.id);
    if (filterSupplier) list = list.filter(i => i.supplier === filterSupplier);

    const cfg = financePageConfig.invoiceBack;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('invoiceBackList');
    tbody.innerHTML = '';
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
    renderFinancePagination('invoiceBack');
}

function openInvoiceBackAddModal() {
    currentInvoiceBackEditId = null;
    document.getElementById('invoiceBackDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceBackAmount').value = '';
    document.getElementById('invoiceBackNo').value = '';
    document.getElementById('invoiceBackRemark').value = '';
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
    updateInvoiceBackBalance(row.supplier);
    const modal = document.getElementById('invoiceBackModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
}

function closeInvoiceBackModal() {
    document.getElementById('invoiceBackModal').style.display = 'none';
}
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
        
        await loadAllInvoiceBack();
        await recalculateInvoiceStatus(supplier);
        await loadAllStockIn();
        refreshInvoiceBackList();
        
        if (typeof window.loadStockIn === 'function') {
            await window.loadStockIn();
        } else if (typeof loadStockIn === 'function') {
            await loadStockIn();
        }
        
        showMsg(currentInvoiceBackEditId ? '发票记录更新成功，已重新计算核销状态' : '发票退回记录保存成功，已自动核销入库记录');
        closeInvoiceBackModal();
        currentInvoiceBackEditId = null;
    } catch (e) {
        console.error('保存失败:', e);
        showMsg('保存失败：' + e.message);
    }
}

// ===================== 发票核销引擎 =====================
async function autoWriteOffInvoice(supplier, invoiceAmount, invoiceNo) {
    if (!supplier || invoiceAmount <= 0) return;
    await recalculateInvoiceStatus(supplier);
}

async function recalculateInvoiceStatus(supplier) {
    if (!supplier) return;

    const supplierInvoices = allInvoiceBackList
        .filter(inv => inv.supplier === supplier)
        .sort((a, b) => new Date(a.return_date) - new Date(b.return_date));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const latestStockIn = await res.json();

    const inRecords = latestStockIn
        .filter(item => 
            item.supplier === supplier && 
            item.settleType === '线下'
        )
        .sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

    if (inRecords.length === 0) {
        return;
    }

    const headers = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };

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
        allStockInList = latestStockIn;
        return;
    }

    let remainingInRecords = [...inRecords];

    for (let invoice of supplierInvoices) {
        const invoiceAmount = Number(invoice.invoice_amount) || 0;
        if (invoiceAmount <= 0) continue;

        let remainingAmount = invoiceAmount;
        const updatedIds = [];

        for (let record of remainingInRecords) {
            if (remainingAmount <= 0) break;

            const recordTotal = Number(record.in_price) * Number(record.in_num);
            
            if (remainingAmount >= recordTotal) {
                remainingAmount -= recordTotal;
                updatedIds.push({ id: record.id, status: '已开票' });
            } else {
                updatedIds.push({ id: record.id, status: '未开票' });
                remainingAmount = 0;
            }
        }

        for (let item of updatedIds) {
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

    allStockInList = latestStockIn;
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
    refreshInvoiceBackList();
    
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
        supplierGroup[s] = { totalIn: 0, totalPay: 0, totalBack: 0 };
    });
    allStockInList.filter(i => i.settleType === '线下').forEach(item => {
        const total = Number(item.in_price) * Number(item.in_num);
        supplierGroup[item.supplier].totalIn += total;
    });
    allPayList.forEach(p => {
        supplierGroup[p.supplier].totalPay += Number(p.payment_amount);
    });
    allInvoiceBackList.forEach(b => {
        supplierGroup[b.supplier].totalBack += Number(b.invoice_amount);
    });
    let list = Object.entries(supplierGroup).map(([supplier, data]) => {
        const payable = data.totalIn - data.totalPay;
        const invBalance = data.totalBack - data.totalIn;
        return { supplier, payable, invBalance, totalIn: data.totalIn, totalPay: data.totalPay, totalBack: data.totalBack };
    });

    const cfg = financePageConfig.paymentBoard;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('paymentBoardList');
    tbody.innerHTML = '';
    pageData.forEach((row, idx) => {
        const color = row.invBalance < 0 ? 'color:red;' : '';
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${row.supplier}</td>
            <td>${row.totalIn.toFixed(2)}</td>
            <td>${row.totalPay.toFixed(2)}</td>
            <td>${row.totalBack.toFixed(2)}</td>
            <td>${row.payable.toFixed(2)}</td>
            <td style="${color}">${row.invBalance.toFixed(2)}</td>
        </tr>`;
    });
    renderFinancePagination('paymentBoard');
}

// ===================== ⑥发票月结余 =====================
function initMonthBalancePage() {
    financePageConfig.monthInvoiceBalance.current = 1;
    const sel = document.getElementById('monthBalanceSelect');
    sel.innerHTML = '<option value="">请选择月份</option>';
    monthDistinctList.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
    document.getElementById('monthBalanceSearch').value = '';
    const tbody = document.getElementById('monthBalanceList');
    tbody.innerHTML = '';
    renderFinancePagination('monthInvoiceBalance');
}
function searchMonthInvoiceBalance() {
    financePageConfig.monthInvoiceBalance.current = 1;
    const month = document.getElementById('monthBalanceSelect').value;
    const searchKey = document.getElementById('monthBalanceSearch').value.trim().toLowerCase();
    if (!month) return showMsg('请选择统计月份');
    const supplierMap = {};
    const monthStock = allStockInList.filter(i => {
        return i.settleType === '线下' && i.record_date && i.record_date.substring(0, 7) === month;
    });
    monthStock.forEach(item => {
        const total = Number(item.in_price) * Number(item.in_num);
        if (!supplierMap[item.supplier]) supplierMap[item.supplier] = { inTotal: 0, backTotal: 0 };
        supplierMap[item.supplier].inTotal += total;
    });
    const monthBack = allInvoiceBackList.filter(b => b.return_date && b.return_date.substring(0, 7) === month);
    monthBack.forEach(item => {
        if (!supplierMap[item.supplier]) supplierMap[item.supplier] = { inTotal: 0, backTotal: 0 };
        supplierMap[item.supplier].backTotal += Number(item.invoice_amount);
    });
    let list = [];
    for (const s in supplierMap) {
        const balance = supplierMap[s].backTotal - supplierMap[s].inTotal;
        list.push({ supplier: s, month, balance });
    }
    if (searchKey) list = list.filter(row => row.supplier.toLowerCase().includes(searchKey));

    const cfg = financePageConfig.monthInvoiceBalance;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('monthBalanceList');
    tbody.innerHTML = '';
    pageData.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.month}</td>
            <td>${item.balance.toFixed(2)}</td>
        </tr>`;
    });
    renderFinancePagination('monthInvoiceBalance');
}

// ===================== ⑦入库对账 =====================
function initStockInCheckPage() {
    financePageConfig.stockInCheck.current = 1;
    initCheckMonthSelect('checkInMonth');
    
    const suppliers = [...new Set(allStockInList.map(item => item.supplier).filter(Boolean))];
    window._checkInSupplierList = suppliers;
    
    const goodsNames = [...new Set(allStockInList.map(item => item.goodsName).filter(Boolean))];
    window._checkInGoodsList = goodsNames;
    
    const tbody = document.getElementById('stockInCheckList');
    if (tbody) tbody.innerHTML = '';
    
    renderFinancePagination('stockInCheck');
}

function initCheckMonthSelect(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">全部月份</option>';
    monthDistinctList.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
}
function searchStockInCheck() {
    financePageConfig.stockInCheck.current = 1;
    
    const settle = document.getElementById('checkInSettle').value;
    const invStatus = document.getElementById('checkInInvoice').value;
    const month = document.getElementById('checkInMonth').value;
    const supplier = document.getElementById('checkInSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('checkInGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('checkInTaxRateSearch').value;
    const groupSupplier = document.getElementById('checkInSupplierGroup').checked;
    const groupGoods = document.getElementById('checkInGoodsGroup').checked;

    let list = [...allStockInList];    
  
    if (settle) list = list.filter(i => i.settleType === settle);
    if (invStatus) list = list.filter(i => i.invoice_status === invStatus);
    if (month) list = list.filter(i => i.record_date && i.record_date.substring(0, 7) === month);
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
        const channel = row.settleType || (goods ? goods.channel : '');
        const inPrice = Number(row.in_price) || 0;
        const qty = Number(row.in_num) || 0;
        const totalAmount = inPrice * qty;
        
        let noTaxTotal = 0;
        let taxTotal = 0;
        let isPay = '';
        let remainAmount = '';
        let taxRateDisplay = '';
        let inPriceDisplay = '';
        const recordDate = row.record_date || '';
        
        if (channel === '线上') {
            taxRateDisplay = '';
            inPriceDisplay = formatMoney(inPrice);
            noTaxTotal = 0;
            taxTotal = 0;
            isPay = '';
            remainAmount = '';
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
            
            const supplierPay = allPayList
                .filter(p => p.supplier === row.supplier)
                .reduce((sum, p) => sum + Number(p.payment_amount), 0);
            isPay = supplierPay >= totalAmount ? '已付清' : '未付清';
            
            const backTotal = allInvoiceBackList
                .filter(b => b.supplier === row.supplier)
                .reduce((sum, b) => sum + Number(b.invoice_amount), 0);
            remainAmount = backTotal - totalAmount;
        }
        
        return {
            ...row,
            channel: channel,
            tax_rate_display: taxRateDisplay,
            in_price_display: inPriceDisplay,
            in_num: qty,
            totalAmount: totalAmount,
            noTaxTotal: noTaxTotal,
            taxTotal: taxTotal,
            isPay: isPay,
            remainAmount: remainAmount,
            record_date: recordDate
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
                    invoice_status: row.invoice_status || '',
                    in_price_display: '￥0.00',
                    in_num: 0,
                    totalAmount: 0,
                    noTaxTotal: 0,
                    taxTotal: 0,
                    isPay: row.isPay,
                    remainAmount: 0,
                    record_date: row.record_date || '',
                    count: 0
                };
            }
            const g = groupMap[key];
            g.in_num += Number(row.in_num);
            g.totalAmount += row.totalAmount;
            g.noTaxTotal += row.noTaxTotal;
            g.taxTotal += row.taxTotal;
            g.remainAmount += isNaN(row.remainAmount) ? 0 : row.remainAmount;
            g.count++;
            if (g.count === 1) {
                g.in_price_display = row.in_price_display;
                g.record_date = row.record_date;
            }
        });
        processedList = Object.values(groupMap);
    }
    
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
        const remainVal = typeof row.remainAmount === 'number' ? row.remainAmount : Number(row.remainAmount);
        if (!isNaN(remainVal)) {
            summary.remainAmount += remainVal;
        }
    });
    
    const totalTip = document.getElementById('stockInCheckTotalTip');
    if (totalTip) {
        totalTip.innerText = `共 ${allStockInList.length} 条入库记录，当前搜索结果 ${processedList.length} 条`;
    }
    
    const cfg = financePageConfig.stockInCheck;
    cfg.total = processedList.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = processedList.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('stockInCheckList');
    tbody.innerHTML = '';

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
        renderFinancePagination('stockInCheck');
        return;
    }

    pageData.forEach((row, index) => {
        let invoiceClass = '';
        if (row.invoice_status === '已开票') {
            invoiceClass = 'bg-green-invoice';
        } else if (row.invoice_status === '未开票') {
            invoiceClass = 'bg-yellow-invoice';
        }
        
        let payClass = '';
        if (row.isPay === '已付清') {
            payClass = 'bg-green-invoice';
        } else if (row.isPay === '未付清') {
            payClass = 'bg-yellow-invoice';
        }
        
        let remainColor = '';
        if (!isNaN(row.remainAmount) && row.remainAmount < 0) {
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
            <td class="${invoiceClass}">${row.invoice_status || ''}</td>
            <td>${row.in_price_display}</td>
            <td>${row.in_num}</td>
            <td class="${payClass}">${row.isPay}</td>
            <td>${formatMoney(row.totalAmount)}</td>
            <td>${formatMoney(row.noTaxTotal)}</td>
            <td>${formatMoney(row.taxTotal)}</td>
            <td ${remainColor}>${formatMoney(row.remainAmount)}</td>
            <td>${row.record_date}</td>
        </tr>`;
    });
    const remainColor = summary.remainAmount < 0 ? 'style="color:red;"' : '';
    tbody.innerHTML += `
    <tr style="background:#f0f4f8;font-weight:bold;">
        <td colspan="7" style="text-align:right;">汇总：</td>
        <td>${summary.in_num}</td>
        <td></td>
        <td>${formatMoney(summary.totalAmount)}</td>
        <td>${formatMoney(summary.noTaxTotal)}</td>
        <td>${formatMoney(summary.taxTotal)}</td>
        <td ${remainColor}>${formatMoney(summary.remainAmount)}</td>
        <td></td>
    </tr>`;
    
    renderFinancePagination('stockInCheck');
}

// ===================== resetStockInCheck 函数 =====================
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
    searchStockInCheck();
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
 * 导出入库对账表
 */
function exportStockInCheckExcel() {
    searchStockInCheck();
    
    const settle = document.getElementById('checkInSettle').value;
    const invStatus = document.getElementById('checkInInvoice').value;
    const month = document.getElementById('checkInMonth').value;
    const supplier = document.getElementById('checkInSupplierSearchInput').value.trim();
    const goodsName = document.getElementById('checkInGoodsSearchInput').value.trim();
    const taxRate = document.getElementById('checkInTaxRateSearch').value;
    const groupSupplier = document.getElementById('checkInSupplierGroup').checked;
    const groupGoods = document.getElementById('checkInGoodsGroup').checked;
    
    let list = [...allStockInList];
    
    if (settle) list = list.filter(i => i.settleType === settle);
    if (invStatus) list = list.filter(i => i.invoice_status === invStatus);
    if (month) list = list.filter(i => i.record_date && i.record_date.substring(0, 7) === month);
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
        const channel = row.settleType || (goods ? goods.channel : '');
        const inPrice = Number(row.in_price) || 0;
        const qty = Number(row.in_num) || 0;
        const totalAmount = inPrice * qty;
        
        let noTaxTotal = 0;
        let taxTotal = 0;
        let isPay = '';
        let remainAmount = '';
        let taxRateDisplay = '';
        let inPriceDisplay = '';
        const recordDate = row.record_date || '';
        
        if (channel === '线上') {
            taxRateDisplay = '';
            inPriceDisplay = formatMoney(inPrice);
            noTaxTotal = 0;
            taxTotal = 0;
            isPay = '';
            remainAmount = '';
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
            
            const supplierPay = allPayList
                .filter(p => p.supplier === row.supplier)
                .reduce((sum, p) => sum + Number(p.payment_amount), 0);
            isPay = supplierPay >= totalAmount ? '已付清' : '未付清';
            
            const backTotal = allInvoiceBackList
                .filter(b => b.supplier === row.supplier)
                .reduce((sum, b) => sum + Number(b.invoice_amount), 0);
            remainAmount = backTotal - totalAmount;
        }
        
        return {
            supplier: row.supplier,
            goodsName: row.goodsName,
            spec: row.spec || '',
            tax_rate_display: taxRateDisplay,
            invoice_status: row.invoice_status || '',
            in_price_display: inPriceDisplay,
            in_num: qty,
            isPay: isPay,
            totalAmount: totalAmount,
            noTaxTotal: noTaxTotal,
            taxTotal: taxTotal,
            remainAmount: remainAmount,
            record_date: recordDate
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
                    invoice_status: row.invoice_status || '',
                    in_price_display: '￥0.00',
                    in_num: 0,
                    isPay: row.isPay,
                    totalAmount: 0,
                    noTaxTotal: 0,
                    taxTotal: 0,
                    remainAmount: 0,
                    record_date: row.record_date || '',
                    count: 0
                };
            }
            const g = groupMap[key];
            g.in_num += Number(row.in_num);
            g.totalAmount += row.totalAmount;
            g.noTaxTotal += row.noTaxTotal;
            g.taxTotal += row.taxTotal;
            g.remainAmount += isNaN(row.remainAmount) ? 0 : row.remainAmount;
            g.count++;
            if (g.count === 1) {
                g.in_price_display = row.in_price_display;
                g.record_date = row.record_date;
            }
        });
        processedList = Object.values(groupMap);
    }
    
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
        summary.remainAmount += isNaN(row.remainAmount) ? 0 : row.remainAmount;
    });
    
    const header = ["序号", "供应商", "商品名称", "规格", "税率", "发票状态", "入库单价", "入库数量", "是否付清", "含税入库金额", "不含税金额", "税额", "发票结余", "录入日期"];
    const expData = processedList.map((row, idx) => [
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
        row.record_date
    ]);
    
    expData.push([
        "汇总", "", "", "", "", "",
        summary.in_num, "",
        formatMoney(summary.totalAmount),
        formatMoney(summary.noTaxTotal),
        formatMoney(summary.taxTotal),
        formatMoney(summary.remainAmount),
        ""
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库对账表");
    XLSX.writeFile(wb, `入库对账表_${new Date().toISOString().slice(0,10)}.xlsx`);
    // showMsg('导出成功');
}

// ===================== ⑧出库对账 =====================
function showCheckOutSupplierList() {
    const list = window._checkOutSupplierList || [];
    renderCheckOutSupplierList(list);
    document.getElementById('checkOutSupplierListBox').style.display = 'block';
}

function filterCheckOutSupplierList() {
    const kw = document.getElementById('checkOutSupplierSearchInput').value.toLowerCase();
    const list = (window._checkOutSupplierList || []).filter(s => s.toLowerCase().includes(kw));
    renderCheckOutSupplierList(list);
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
        };
        box.appendChild(div);
    });
}

function showCheckOutGoodsList() {
    const list = window._checkOutGoodsList || [];
    renderCheckOutGoodsList(list);
    document.getElementById('checkOutGoodsListBox').style.display = 'block';
}

function filterCheckOutGoodsList() {
    const kw = document.getElementById('checkOutGoodsSearchInput').value.toLowerCase();
    const list = (window._checkOutGoodsList || []).filter(s => s.toLowerCase().includes(kw));
    renderCheckOutGoodsList(list);
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
        };
        box.appendChild(div);
    });
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('#checkOutSupplierSearchInput') && !e.target.closest('#checkOutSupplierListBox')) {
        document.getElementById('checkOutSupplierListBox').style.display = 'none';
    }
    if (!e.target.closest('#checkOutGoodsSearchInput') && !e.target.closest('#checkOutGoodsListBox')) {
        document.getElementById('checkOutGoodsListBox').style.display = 'none';
    }
});

function initStockOutCheckPage() {
    financePageConfig.stockOutCheck.current = 1;
    initCheckOutMonthSelect('checkOutMonth');
    
    const outData = window.allStockOut || [];
    
    const suppliers = [...new Set(outData.map(item => item.supplier).filter(Boolean))];
    window._checkOutSupplierList = suppliers;
    
    const goodsNames = [...new Set(outData.map(item => item.goodsName).filter(Boolean))];
    window._checkOutGoodsList = goodsNames;
    
    const tbody = document.getElementById('stockOutCheckList');
    if (tbody) tbody.innerHTML = '';
    
    renderFinancePagination('stockOutCheck');
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

function searchStockOutCheck() {
    financePageConfig.stockOutCheck.current = 1;
    
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
    searchStockOutCheck();
}

function exportStockOutCheckExcel() {
    searchStockOutCheck();
    
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
function showBeginSupplierList() {
    const list = window._beginSupplierList || [];
    renderBeginSupplierList(list);
    document.getElementById('beginSupplierListBox').style.display = 'block';
}

function filterBeginSupplierList() {
    const kw = document.getElementById('beginSupplierSearchInput').value.toLowerCase();
    const list = (window._beginSupplierList || []).filter(s => s.toLowerCase().includes(kw));
    renderBeginSupplierList(list);
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
        };
        box.appendChild(div);
    });
}

function showBeginGoodsList() {
    const list = window._beginGoodsList || [];
    renderBeginGoodsList(list);
    document.getElementById('beginGoodsListBox').style.display = 'block';
}

function filterBeginGoodsList() {
    const kw = document.getElementById('beginGoodsSearchInput').value.toLowerCase();
    const list = (window._beginGoodsList || []).filter(s => s.toLowerCase().includes(kw));
    renderBeginGoodsList(list);
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
        };
        box.appendChild(div);
    });
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('#beginSupplierSearchInput') && !e.target.closest('#beginSupplierListBox')) {
        document.getElementById('beginSupplierListBox').style.display = 'none';
    }
    if (!e.target.closest('#beginGoodsSearchInput') && !e.target.closest('#beginGoodsListBox')) {
        document.getElementById('beginGoodsListBox').style.display = 'none';
    }
});

function calcMonthEndStock(supplier, goodsName, spec, inPrice, produceDate, expireDate, endDate) {
    const inRecords = allStockInList.filter(item => {
        const itemKey = `${item.supplier}|${item.goodsName}|${item.spec || ''}|${item.in_price || 0}|${item.produce_date || ''}|${item.expire_date || ''}`;
        const batchKey = `${supplier}|${goodsName}|${spec || ''}|${inPrice || 0}|${produceDate || ''}|${expireDate || ''}`;
        return itemKey === batchKey && item.record_date && item.record_date <= endDate;
    });
    
    if (inRecords.length === 0) return 0;
    
    let totalIn = 0;
    const inIds = [];
    inRecords.forEach(rec => {
        totalIn += Number(rec.in_num || 0);
        inIds.push(rec.id);
    });
    
    let totalOut = 0;
    const outData = window.allStockOut || [];
    outData.forEach(out => {
        if (out.recordDate && out.recordDate <= endDate && inIds.includes(out.inRecordId)) {
            totalOut += Number(out.outNum || 0);
        }
    });
    
    return Math.max(0, totalIn - totalOut);
}

function initMonthBeginPage() {
    financePageConfig.monthBeginStock.current = 1;
    
    initBeginMonthSelect('beginMonth');
    
    const inData = allStockInList || [];
    
    const suppliers = [...new Set(inData.map(item => item.supplier).filter(Boolean))];
    window._beginSupplierList = suppliers;
    
    const goodsNames = [...new Set(inData.map(item => item.goodsName).filter(Boolean))];
    window._beginGoodsList = goodsNames;
    
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

function searchMonthBeginStock() {
    financePageConfig.monthBeginStock.current = 1;
    
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
        if (supplier && item.supplier !== supplier) return;
        if (goodsName && item.goodsName !== goodsName) return;
        
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
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
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
    searchMonthBeginStock();
}

function exportMonthBeginStockExcel() {
    searchMonthBeginStock();
    
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
        if (supplier && item.supplier !== supplier) return;
        if (goodsName && item.goodsName !== goodsName) return;
        
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