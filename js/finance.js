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

// 重写Tab切换，进入财务页先强制关闭税率弹窗，避免自动弹出
const originSwitchTab = switchTab;
switchTab = function (tabName) {
    originSwitchTab(tabName);
    if (tabName === 'finance') {
        const taxModal = document.getElementById('taxModal');
        if (taxModal) taxModal.style.display = 'none';
        initFinanceBaseData();
        switchFinanceSubTab('taxRate');
        // 页面初始化手动给第一个子按钮添加active高亮
        document.querySelector('.finance-sub-btn').classList.add('active');
    }
}

// 财务子Tab切换
function switchFinanceSubTab(tabKey) {
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
            pageDom.innerHTML = ''; // 清空分页内容
        }
    });

    // 下面是你原来的切换代码，完全保留不要修改
    document.querySelectorAll('.finance-sub-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-${tabKey}`).style.display = 'block';

    document.querySelectorAll('.finance-sub-btn').forEach(btn => btn.classList.remove('active'));
    if (event?.target?.classList.contains('finance-sub-btn')) {
        event.target.classList.add('active');
    } else {
        document.querySelector(`.finance-sub-btn[data-tab="${tabKey}"]`).classList.add('active');
    }
    initCurrentSubPage();
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
    initCurrentSubPage();
}

// 跳转指定页
function financeGoToPage(pageKey, targetPage) {
    const cfg = financePageConfig[pageKey];
    const totalPages = Math.ceil(cfg.total / cfg.pageSize) || 1;
    if(targetPage < 1 || targetPage > totalPages) return;
    cfg.current = targetPage;
    initCurrentSubPage();
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
function initCurrentSubPage() {
    switch (currFinanceSub) {
        case 'taxRate': initTaxRatePage(); break;
        case 'stockInPrint': initStockInPrintPage(); break;
        case 'payRecord': initPayRecordPage(); break;
        case 'invoiceBack': initInvoiceBackPage(); break;
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
    cfg.current = 1;
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
function searchPrintStockIn() {
    financePageConfig.stockInPrint.current = 1;
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

    // 排序处理
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

    const startIdx = (cfg.current - 1) * cfg.pageSize;
    const pageData = list.slice(startIdx, startIdx + cfg.pageSize);

    // 表格渲染（需求②：新增序列列）
    const tbody = document.getElementById('printStockInList');
    tbody.innerHTML = '';
    pageData.forEach((item, idx) => {
        const total = (Number(item.in_price) * Number(item.in_num)).toFixed(2);
        tbody.innerHTML += `
        <tr>
            <td><input type="checkbox" class="print-checkbox" data-index="${startIdx+idx}"></td>
            <td>${startIdx + idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.goodsName}</td>
            <td>${item.spec || ''}</td>
            <td>${Number(item.in_price).toFixed(2)}</td>
            <td>${item.in_num}</td>
            <td>${total}</td>
            <td>${item.record_date}</td>
        </tr>`;
    });
    // 全选事件
    document.getElementById('printAllCheck').onchange = function () {
        document.querySelectorAll('.print-checkbox').forEach(cb => cb.checked = this.checked);
    }

    // 需求⑤：供应商汇总行渲染
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
}

// ===================== ②入库单打印模块 - 重写打印预览（横向拉满 + 汇总对齐 + ￥符号） =====================
function previewAndPrint() {
    // 1. 获取选中的记录
    const checkedBox = document.querySelectorAll('.print-checkbox:checked');
    if (checkedBox.length === 0) {
        showMsg('请选择需要打印的入库记录');
        return;
    }

    // 2. 按供应商分组
    const groupMap = {};
    checkedBox.forEach(cb => {
        const idx = parseInt(cb.dataset.index);
        const row = printStockInData[idx];
        if (!row) return;
        if (!groupMap[row.supplier]) {
            groupMap[row.supplier] = [];
        }
        groupMap[row.supplier].push(row);
    });

    // 3. 构建每个供应商的 HTML 片段
    let billHTML = '';
    const supplierList = Object.keys(groupMap);

    supplierList.forEach((supplier, index) => {
        const rows = groupMap[supplier];
        // 按入库日期升序排列
        rows.sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''));

        let totalQty = 0;
        let totalAmount = 0;
        let tableRows = '';

        rows.forEach(row => {
            const price = Number(row.in_price) || 0;
            const qty = Number(row.in_num) || 0;
            const amount = price * qty;
            totalQty += qty;
            totalAmount += amount;
            const date = row.record_date ? row.record_date.replace(/-/g, '/') : '';

            // 金额加￥符号，保留两位小数
            const priceStr = `￥${price.toFixed(2)}`;
            const amountStr = `￥${amount.toFixed(2)}`;

            tableRows += `
                <tr>
                    <td class="col-date">${date}</td>
                    <td class="col-supplier">${supplier}</td>
                    <td class="col-goods">${row.goodsName || ''}</td>
                    <td class="col-spec">${row.spec || ''}</td>
                    <td class="col-price">${priceStr}</td>
                    <td class="col-qty">${qty}</td>
                    <td class="col-amount">${amountStr}</td>
                </tr>
            `;
        });

        // 汇总行：前四列合并写“合计”，第五列留空，第六列显示总数量（不带文字），第七列显示总金额（带￥）
        const totalAmountStr = `￥${totalAmount.toFixed(2)}`;
        tableRows += `
            <tr class="total-row">
                <td colspan="4" class="total-label">合计</td>
                <td class="total-price"></td>
                <td class="total-qty">${totalQty}</td>
                <td class="total-amount">${totalAmountStr}</td>
            </tr>
        `;

        // 每个供应商的单据容器（最后一个不加分页，避免多余空白页）
        const pageBreak = index === supplierList.length - 1 ? 'page-break-after: avoid;' : 'page-break-after: always;';

        billHTML += `
            <div class="supplier-bill" style="${pageBreak}">
                <div class="bill-title">商品入库单</div>
                <div class="bill-header">
                    <span><span class="label">供应商：</span>${supplier}</span>
                    <span><span class="label">打印日期：</span>${new Date().toLocaleDateString('zh-CN')}</span>
                </div>
                <table class="goods-table">
                    <thead>
                        <tr>
                            <th class="col-date">入库日期</th>
                            <th class="col-supplier">供应商</th>
                            <th class="col-goods">商品名称</th>
                            <th class="col-spec">规格</th>
                            <th class="col-price">入库价</th>
                            <th class="col-qty">数量</th>
                            <th class="col-amount">金额（含税）</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <div class="bill-footer">
                    <span>库管员签字：___________</span>
                    <span>业务员签字：___________</span>
                    <span>财务审核签字：___________</span>
                </div>
            </div>
        `;
    });

    // 4. 组装完整 HTML（包含打印样式 + 自动打印脚本）
    const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>入库单打印预览</title>
    <style>
        /* ---------- 全局重置：消除默认边距 ---------- */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "SimSun", "宋体", serif;
            background: #fff;
            margin: 0;
            padding: 0;
            width: 100%;
        }

        /* ---------- 页面设置（A5横向 + 指定边距） ---------- */
        @page {
            size: A5 landscape;
            margin-top: 1.6cm;
            margin-bottom: 1.2cm;
            margin-left: 1.0cm;
            margin-right: 1.1cm;
            marks: none;
        }

        /* ---------- 打印容器 ---------- */
        .print-container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
        }

        /* ---------- 每个供应商单据 ---------- */
        .supplier-bill {
            width: 100%;
            padding: 0;
            margin: 0;
            page-break-inside: avoid;
        }
        .supplier-bill:last-child {
            page-break-after: avoid;
        }

        /* ---------- 标题：紧贴顶部，无多余空隙 ---------- */
        .bill-title {
            text-align: center;
            font-size: 22pt;
            font-weight: bold;
            margin: 0 0 4px 0;      /* 下边距极小，上边距为0 */
            letter-spacing: 8px;
            padding-top: 0;
        }

        /* ---------- 表头（供应商 + 日期） ---------- */
        .bill-header {
            display: flex;
            justify-content: space-between;
            font-size: 12pt;
            margin-bottom: 4px;      /* 减小下边距 */
            padding: 0 2px;
        }
        .bill-header .label {
            font-weight: bold;
        }

        /* ---------- 表格：占满整页宽度，水平居中 ---------- */
        .goods-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5pt;
            table-layout: fixed;     /* 固定列宽，防止内容撑开 */
            margin: 0 auto;
        }
        .goods-table th {
            border: 2px solid #000;
            padding: 5px 3px;
            background: #f5f5f5;
            font-weight: bold;
            text-align: center;
            font-size: 11pt;
        }
        .goods-table td {
            border: 1px solid #000;
            padding: 4px 3px;
            text-align: center;
            font-size: 10.5pt;
            word-break: break-word;
            white-space: normal;
        }

        /* ---------- 列宽精确分配（总和100%） ---------- */
        .goods-table .col-date     { width: 13%; }
        .goods-table .col-supplier { width: 14%; }
        .goods-table .col-goods    { width: 22%; }
        .goods-table .col-spec     { width: 14%; }
        .goods-table .col-price    { width: 11%; }
        .goods-table .col-qty      { width: 10%; }
        .goods-table .col-amount   { width: 16%; }

        /* ---------- 汇总行 ---------- */
        .goods-table .total-row td {
            border-top: 2px solid #000;
            font-weight: bold;
            font-size: 11pt;
            background: #fafafa;
        }
        .goods-table .total-label {
            text-align: right;
            padding-right: 10px;
        }
        .goods-table .total-price {
            /* 留空 */
        }
        .goods-table .total-qty,
        .goods-table .total-amount {
            text-align: center;
        }

        /* ---------- 页脚签字 ---------- */
        .bill-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            font-size: 12pt;
            padding: 0 4px;
        }
        .bill-footer span {
            display: inline-block;
            min-width: 100px;
        }

        /* ---------- 屏幕预览辅助（非打印时显示边框，便于查看） ---------- */
        @media screen {
            .supplier-bill {
                border: 1px dashed #ccc;
                padding: 10px 18px;
                margin: 20px auto;
                border-radius: 6px;
                max-width: 1100px;
                background: #fefefe;
            }
            .supplier-bill:last-child {
                margin-bottom: 20px;
            }
            body {
                padding: 20px;
                background: #f0f2f5;
            }
            .print-container {
                max-width: 1100px;
                margin: 0 auto;
            }
        }

        /* ---------- 打印时强制重置所有外边距内边距 ---------- */
        @media print {
            body {
                padding: 0 !important;
                background: #fff !important;
                margin: 0 !important;
            }
            .print-container {
                padding: 0 !important;
                margin: 0 !important;
            }
            .supplier-bill {
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                border-radius: 0 !important;
                background: #fff !important;
            }
            .bill-title {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
        }
    </style>
    </head>
    <body>
        <div class="print-container">
            ${billHTML}
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 400);
            };
            window.onafterprint = function() {
                window.close();
            };
        <\/script>
    </body>
    </html>
    `;

    // 5. 打开新窗口展示打印预览
    const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes,resizable=yes');
    if (!win) {
        showMsg('请允许弹出窗口，以便打印预览');
        return;
    }
    win.document.write(fullHTML);
    win.document.close();
    win.focus();
}

// ===================== ③财务付款记录模块 =====================
let currentPayEditId = null;
function initPayRecordPage() {
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
    document.getElementById('payModal').style.display = 'flex';
}
function openPayEdit(id) {
    currentPayEditId = id;
    const row = allPayList.find(p => p.id === id);
    document.getElementById('payDate').value = row.payment_date;
    document.getElementById('paySupplier').value = row.supplier;
    document.getElementById('payAmount').value = row.payment_amount;
    document.getElementById('payRemark').value = row.remark || '';
    document.getElementById('payModal').style.display = 'flex';
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
function initInvoiceBackPage() {
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
    document.getElementById('invoiceBackModal').style.display = 'flex';
}
function openInvoiceBackEdit(id) {
    currentInvoiceBackEditId = id;
    const row = allInvoiceBackList.find(i => i.id === id);
    document.getElementById('invoiceBackDate').value = row.return_date;
    document.getElementById('invoiceBackSupplier').value = row.supplier;
    document.getElementById('invoiceBackAmount').value = row.invoice_amount;
    document.getElementById('invoiceBackNo').value = row.invoice_no || '';
    document.getElementById('invoiceBackRemark').value = row.remark || '';
    document.getElementById('invoiceBackModal').style.display = 'flex';
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