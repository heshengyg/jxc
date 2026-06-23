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
switchTab = async function (tabName) {   // ← 加上 async
    originSwitchTab(tabName);
    if (tabName === 'finance') {
        const taxModal = document.getElementById('taxModal');
        if (taxModal) taxModal.style.display = 'none';
        await initFinanceBaseData();   // ← 加上 await
        await switchFinanceSubTab('taxRate');   // ← 加上 await
        document.querySelector('.finance-sub-btn').classList.add('active');
    }
}

// 财务子Tab切换
async function switchFinanceSubTab(tabKey) {   // ← 加上 async
    currFinanceSub = tabKey;

    // 【新增】切换子页面前，清空所有9个财务分页，杜绝分页叠加
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
        const pageDom = document.getElementById(id);
        if (pageDom) {
            pageDom.innerHTML = '';
        }
    });

    document.querySelectorAll('.finance-sub-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-${tabKey}`).style.display = 'block';

    document.querySelectorAll('.finance-sub-btn').forEach(btn => btn.classList.remove('active'));
    if (event?.target?.classList.contains('finance-sub-btn')) {
        event.target.classList.add('active');
    } else {
        document.querySelector(`.finance-sub-btn[data-tab="${tabKey}"]`).classList.add('active');
    }
    
    await initCurrentSubPage();   // ← 加上 await
}

// 财务分页公共渲染函数（统一分页底部UI：每页显示下拉、当前/总页数，复用项目现有pagination样式）
function renderFinancePagination(pageKey) {
    const cfg = financePageConfig[pageKey];
    const totalPages = Math.ceil(cfg.total / cfg.pageSize) || 1;
    // 复用你系统已有的分页样式结构
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
        searchPrintStockIn(true);   // 明确传 true 重置
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
        searchPrintStockIn(false);   // ← 新增参数 false
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

// 加载全部发票退回记录
async function loadAllInvoiceBack() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    allInvoiceBackList = await res.json();
}

// 当前子页面初始化分发
async function initCurrentSubPage() {
    switch (currFinanceSub) {
        case 'taxRate': initTaxRatePage(); break;
        case 'stockInPrint': initStockInPrintPage(); break;
        case 'payRecord': await initPayRecordPage(); break;
        case 'invoiceBack': await initInvoiceBackPage(); break;
        case 'paymentBoard': initPaymentBoardPage(); break;
        case 'monthInvoiceBalance': initMonthBalancePage(); break;
        case 'stockInCheck': initStockInCheckPage(); break;
        case 'stockOutCheck': initStockOutCheckPage(); break;
        case 'monthBeginStock': initMonthBeginPage(); break;
    }
}

// ===================== ①税率录入模块：仅线下商品、进入页面自动关闭弹窗、自动加载列表 =====================
function initTaxRatePage() {
    const taxModal = document.getElementById('taxModal');
    if(taxModal) taxModal.style.display = 'none';
    initTaxSupplierFilter();
    // 确保自动执行表格刷新
    refreshTaxList();
}
function initTaxSupplierFilter() {
    // 初始化供应商数据源：只线下商品供应商
    const supplierSet = new Set();
    allGoodsList.filter(g => g.channel === '线下').forEach(g => supplierSet.add(g.supplier));
    currTaxSupplierList = Array.from(supplierSet);

    // 初始化商品数据源：所有线下商品
    currTaxGoodsList = allGoodsList.filter(g => g.channel === '线下');

    // 清空所有搜索框
    document.getElementById('taxSupplierSearch').value = '';
    document.getElementById('taxGoodsSearch').value = '';
    document.getElementById('taxRateSearch').value = '';

    // 关闭所有下拉框
    document.getElementById('taxSupplierListBox').style.display = 'none';
    document.getElementById('taxGoodsListBox').style.display = 'none';
    document.getElementById('taxRateListBox').style.display = 'none';
}

// 供应商下拉相关函数（复刻入库搜索逻辑）
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

// 商品名称下拉相关函数（复刻入库搜索逻辑）
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

// 税率下拉相关函数（复刻入库搜索逻辑）
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

// 多条件筛选刷新表格（点击按钮才执行，空条件默认查全部 + 分页处理）
function refreshTaxList() {
    // 获取所有筛选条件
    const selectSupplier = document.getElementById('taxSupplierSearch').value.trim();
    const selectGoodsName = document.getElementById('taxGoodsSearch').value.trim();
    const selectTaxText = document.getElementById('taxRateSearch').value.trim();
    const filterChannel = document.getElementById('taxChannelFilter').value;

    // 初始数据源：默认全部线下商品
    let list = [...allGoodsList.filter(g => g.channel === '线下')];

    // 条件1：供应商筛选（选了才过滤，空则不过滤）
    if(selectSupplier){
        list = list.filter(g => g.supplier === selectSupplier);
    }

    // 条件2：商品名称筛选
    if(selectGoodsName){
        list = list.filter(g => g.name === selectGoodsName);
    }

    // 条件3：税率筛选
    if(selectTaxText){
        const targetTax = currTaxRateOptionList.find(item => item.text === selectTaxText);
        if(targetTax){
            if(targetTax.val === null){
                // 筛选未设置税率
                list = list.filter(g => g.tax_rate === null || g.tax_rate === undefined || g.tax_rate === '');
            }else if(targetTax.val !== ''){
                // 筛选指定税率
                list = list.filter(g => String(g.tax_rate) === targetTax.val);
            }
            // val为空：全部税率，不筛选
        }
    }

    // 条件4：结算方式筛选
    if(filterChannel){
        list = list.filter(g => g.channel === filterChannel);
    }

    // 分页处理
    const cfg = financePageConfig.taxRate;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    // 渲染表格
    const tbody = document.getElementById('taxRateList');
    tbody.innerHTML = '';
    pageData.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${start + idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.name}</td>
            <td>${item.spec || ''}</td>
            <td>${item.channel}</td>
            <td>${item.tax_rate ? item.tax_rate + '%' : '未设置'}</td>
            <td><button class="btn btn-primary" onclick="openTaxEdit(${item.id})">编辑税率</button></td>
        </tr>`;
    });
    // 渲染分页底部
    renderFinancePagination('taxRate');
}

function openTaxEdit(id) {
    document.getElementById('taxEditId').value = id;
    const row = allGoodsList.find(g => g.id === id);
    document.getElementById('taxRateSelect').value = row.tax_rate || '0';
    // 弹窗强制最高层级，避免被表头遮挡
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
    // 新增：主动刷新商品页面数据，实现财务改完商品页立刻更新
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
/* 仅打印容器可见，预览正常不遮挡 */
body{margin:0;padding:0;}
body *{visibility:hidden;}
#printPreviewWrap, #printPreviewWrap *{visibility:visible;}
#printPreviewWrap{width:100%;}

@page{
  size:A5 landscape;
  margin:1.5cm; /* 小幅缩小边距给横向更多空间 */
  marks:none;
  /* 强制禁止浏览器自动生成空白页 */
  break-before:avoid;
  break-after:avoid;
}
/* 单据强制顶部对齐，绝对不垂直居中 */
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
/* 表格横向最大利用宽度，上限140%，左右居中 */
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

    // 【修复】所有下拉数据源100%来自入库表的线下数据，和商品表完全解耦
    // 1. 线下供应商：从入库表去重获取
    printSupplierSearchList = [...new Set(allStockInList.filter(i=>i.settleType==='线下').map(i=>i.supplier))];
    // 2. 商品名称：从入库表对应供应商的线下数据去重获取
    printGoodsSearchList = [...new Set(allStockInList.filter(i=>i.settleType==='线下').map(i=>i.goodsName))];
    // 3. 规格：从入库表对应供应商的线下数据去重获取
    printSpecSearchList = [...new Set(allStockInList.filter(i=>i.settleType==='线下').map(i=>i.spec).filter(Boolean))];

    // 清空筛选条件
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

// ========== 需求①：下拉带搜索函数 ==========
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

// 全局点击空白关闭三个下拉框（修复下拉卡死、一直显示无匹配问题）
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

// ========== 需求③默认最新日期在前、④列排序、清除排序 ==========
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

// 筛选查询主函数
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

    // 供应商汇总行渲染
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

    // ===== 关键：在分页渲染完成后重新绑定所有事件 =====
    // 全选事件
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

    // 手动勾选事件
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

    // 同步全选按钮状态
    skipPrintAllChange = true;
    document.getElementById('printAllCheck').checked = (selectedPrintIds.size === printStockInData.length && printStockInData.length > 0);
    skipPrintAllChange = false;
}

function previewAndPrint() {
    if (selectedPrintIds.size === 0) {
        showMsg('请选择需要打印的入库记录');
        return;
    }

    // 从 printStockInData 中筛选出选中的记录
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
                        <span>库管员签字：___________</span>
                        <span>业务员签字：___________</span>
                        <span>财务审核签字：___________</span>
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
            position: relative;   /* 让页脚绝对定位 */
            padding-bottom: 2.2cm; /* 为页脚预留空间（约40px） */
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

        /* 表格：宽度100%，列宽固定，不拉伸行高 */
        .goods-table {
            width: 100% !important;
            border-collapse: collapse;
            font-size: 11pt;
            table-layout: fixed;
            margin-bottom: 0;  /* 让页脚独立 */
        }
        .goods-table th, .goods-table td {
            border: 1px solid #000;
            padding: 4px 3px;
            text-align: center;
            font-size: 11pt;
            word-break: break-word;
            height: auto;      /* 不固定高度，由内容撑开 */
        }
        .goods-table th {
            border: 2px solid #000;
            background: #f5f5f5;
            font-weight: bold;
            font-size: 12pt;
        }

        /* 列宽百分比（总和100%） */
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

        /* 页脚：绝对定位到底部（距底部0.6cm，在页边距内） */
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

        /* 屏幕预览辅助 */
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
            .bill-footer { 
                bottom: 0.6cm !important;
            }
            /* 防止表格被拉伸 */
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
    // ✅ 关键修复：先确保弹窗是关闭状态
    const payModal = document.getElementById('payModal');
    if (payModal) payModal.style.display = 'none';
    
    // 确保数据已加载
    if (offlineSupplierList.length === 0) {
        await loadOfflineSupplier();
    }
    financePageConfig.payRecord.current = 1;
    initPaySupplierSelect();
    refreshPayRecordList();
}

function initPaySupplierSelect() {
    const filterSel = document.getElementById('paySupplierFilter');
    filterSel.innerHTML = '<option value="">全部供应商</option>';
    const editSel = document.getElementById('paySupplier');
    editSel.innerHTML = '';
    offlineSupplierList.forEach(s => {
        filterSel.innerHTML += `<option value="${s}">${s}</option>`;
        editSel.innerHTML += `<option value="${s}">${s}</option>`;
    });
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
}
function refreshPayRecordList() {
    const filterSupplier = document.getElementById('paySupplierFilter').value;
    let list = [...allPayList];
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
    const modal = document.getElementById('payModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
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
    
    // ✅ 新增：关闭弹窗并重置编辑ID
    closePayModal();
    currentPayEditId = null;
}

async function deletePayRecord(id) {
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
    // ✅ 关键修复：先确保弹窗是关闭状态
    const invoiceBackModal = document.getElementById('invoiceBackModal');
    if (invoiceBackModal) invoiceBackModal.style.display = 'none';
    
    if (offlineSupplierList.length === 0) {
        await loadOfflineSupplier();
    }
    financePageConfig.invoiceBack.current = 1;
    initInvoiceBackSupplierSelect();
    refreshInvoiceBackList();
}

function initInvoiceBackSupplierSelect() {
    const filterSel = document.getElementById('invoiceBackSupplierFilter');
    filterSel.innerHTML = '<option value="">全部供应商</option>';
    const editSel = document.getElementById('invoiceBackSupplier');
    editSel.innerHTML = '';
    offlineSupplierList.forEach(s => {
        filterSel.innerHTML += `<option value="${s}">${s}</option>`;
        editSel.innerHTML += `<option value="${s}">${s}</option>`;
    });
    document.getElementById('invoiceBackDate').value = new Date().toISOString().split('T')[0];
}
function refreshInvoiceBackList() {
    const filterSupplier = document.getElementById('invoiceBackSupplierFilter').value;
    let list = [...allInvoiceBackList];
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
    if (!backDate || !supplier || isNaN(amount) || amount <= 0 || !invNo) return showMsg('请完善必填项，退回金额必须大于0');
    const body = { return_date: backDate, supplier, invoice_amount: amount, invoice_no: invNo, remark };
    if (currentInvoiceBackEditId) {
        await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice?id=eq.${currentInvoiceBackEditId}`, {
            method: 'PATCH',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } else {
        await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }
    await loadAllInvoiceBack();
    refreshInvoiceBackList();
    showMsg('发票退回记录保存成功');
    
    // ✅ 新增：关闭弹窗并重置编辑ID
    closeInvoiceBackModal();
    currentInvoiceBackEditId = null;
}

async function deleteInvoiceBackRecord(id) {
    if (!confirm('确定删除该发票退回记录？')) return;
    await fetch(`${SUPABASE_URL}/rest/v1/finance_invoice?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    await loadAllInvoiceBack();
    refreshInvoiceBackList();
    showMsg('删除成功');
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
    // 汇总线下入库总货款
    allStockInList.filter(i => i.settleType === '线下').forEach(item => {
        const total = Number(item.in_price) * Number(item.in_num);
        supplierGroup[item.supplier].totalIn += total;
    });
    // 汇总付款
    allPayList.forEach(p => {
        supplierGroup[p.supplier].totalPay += Number(p.payment_amount);
    });
    // 汇总发票退回
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
    // 筛选当月线下入库
    const monthStock = allStockInList.filter(i => {
        return i.settleType === '线下' && i.record_date && i.record_date.substring(0, 7) === month;
    });
    // 当月入库货款汇总
    monthStock.forEach(item => {
        const total = Number(item.in_price) * Number(item.in_num);
        if (!supplierMap[item.supplier]) supplierMap[item.supplier] = { inTotal: 0, backTotal: 0 };
        supplierMap[item.supplier].inTotal += total;
    });
    // 当月发票退回汇总
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
    const tbody = document.getElementById('stockInCheckList');
    tbody.innerHTML = '';
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
    const groupSupplier = document.getElementById('checkInSupplierGroup').checked;
    const groupGoods = document.getElementById('checkInGoodsGroup').checked;
    let list = [...allStockInList];
    if (settle) list = list.filter(i => i.settleType === settle);
    if (invStatus) list = list.filter(i => i.invoice_status === invStatus);
    if (month) list = list.filter(i => i.record_date && i.record_date.substring(0, 7) === month);
    // 绑定税率
    list = list.map(row => {
        const goods = allGoodsList.find(g => g.name === row.goodsName && g.supplier === row.supplier && g.spec === row.spec);
        const tax = goods ? Number(goods.tax_rate || 0) / 100 : 0;
        const taxRate = tax === 0 ? 0 : Number(row.in_price) / (1 + tax);
        const noTaxTotal = taxRate * row.in_num;
        const taxTotal = Number(row.in_price) * row.in_num - noTaxTotal;
        const supplierPay = allPayList.filter(p => p.supplier === row.supplier).reduce((sum, p) => sum + Number(p.payment_amount), 0);
        const stockTotal = Number(row.in_price) * row.in_num;
        const isPay = supplierPay >= stockTotal ? '已付清' : '未付清';
        const backTotal = allInvoiceBackList.filter(b => b.supplier === row.supplier).reduce((sum, b) => sum + Number(b.invoice_amount), 0);
        const remain = backTotal - stockTotal;
        return {
            ...row, tax_rate: tax * 100, noTaxPrice: taxRate.toFixed(2), noTaxTotal: noTaxTotal.toFixed(2),
            taxTotal: taxTotal.toFixed(2), isPay, remainAmount: remain.toFixed(2)
        };
    });
    // 汇总处理
    if (groupSupplier || groupGoods) {
        const groupMap = {};
        list.forEach(row => {
            const key = groupSupplier ? row.supplier : `${row.supplier}_${row.goodsName}_${row.spec}`;
            if (!groupMap[key]) {
                groupMap[key] = {
                    supplier: row.supplier, goodsName: row.goodsName, spec: row.spec, tax_rate: row.tax_rate,
                    invoice_status: row.invoice_status, noTaxPrice: Number(row.noTaxPrice),
                    in_num: 0, isPay: row.isPay, totalAmount: 0, noTaxTotal: 0, taxTotal: 0, remainAmount: 0
                };
            }
            groupMap[key].in_num += row.in_num;
            groupMap[key].totalAmount += Number(row.in_price) * row.in_num;
            groupMap[key].noTaxTotal += Number(row.noTaxTotal);
            groupMap[key].taxTotal += Number(row.taxTotal);
            groupMap[key].remainAmount += Number(row.remainAmount);
        });
        list = Object.values(groupMap);
    }

    const cfg = financePageConfig.stockInCheck;
    cfg.total = list.length;
    const start = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('stockInCheckList');
    tbody.innerHTML = '';
    pageData.forEach(row => {
        tbody.innerHTML += `
        <tr>
            <td>${row.supplier}</td>
            <td>${row.goodsName}</td>
            <td>${row.spec || ''}</td>
            <td>${row.tax_rate}%</td>
            <td>${row.invoice_status}</td>
            <td>${Number(row.noTaxPrice || row.in_price).toFixed(2)}</td>
            <td>${row.in_num}</td>
            <td>${row.isPay}</td>
            <td>${(Number(row.noTaxPrice || row.in_price) * row.in_num).toFixed(2)}</td>
            <td>${Number(row.noTaxTotal).toFixed(2)}</td>
            <td>${Number(row.taxTotal).toFixed(2)}</td>
            <td>${Number(row.remainAmount).toFixed(2)}</td>
        </tr>`;
    });
    renderFinancePagination('stockInCheck');
}

// ===================== ⑧出库对账 =====================
function initStockOutCheckPage() {
    financePageConfig.stockOutCheck.current = 1;
    initCheckMonthSelect('checkOutMonth');
    const tbody = document.getElementById('stockOutCheckList');
    tbody.innerHTML = '';
    renderFinancePagination('stockOutCheck');
}
function searchStockOutCheck() {
    showMsg('出库模块需对接stock_out表，当前仅框架已完成，待出库表数据接入后即可使用');
}

// ===================== ⑨月期初库存 =====================
function initMonthBeginPage() {
    financePageConfig.monthBeginStock.current = 1;
    initCheckMonthSelect('beginMonth');
    const tbody = document.getElementById('monthBeginStockList');
    tbody.innerHTML = '';
    renderFinancePagination('monthBeginStock');
}
function searchMonthBeginStock() {
    showMsg('库存期初表需要实时库存结余计算逻辑，当前框架已完成');
}