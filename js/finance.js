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
    document.querySelectorAll('.finance-sub-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-${tabKey}`).style.display = 'block';
    // 清空所有按钮激活样式
    document.querySelectorAll('.finance-sub-btn').forEach(btn => btn.classList.remove('active'));
    // 优先使用点击事件的按钮，如果不存在则按当前tabKey匹配按钮（解决首次进入无event导致不高亮）
    if (event && event.target && event.target.classList.contains('finance-sub-btn')) {
        event.target.classList.add('active');
    } else {
        // 遍历所有按钮，找到当前激活的tab对应的按钮添加高亮
        const btnList = document.querySelectorAll('.finance-sub-btn');
        for (let btn of btnList) {
            if (btn.getAttribute('data-tab') === tabKey) {
                btn.classList.add('active');
                break;
            }
        }
    }
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

// 多条件筛选刷新表格（点击按钮才执行，空条件默认查全部）
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

    // 渲染表格
    const tbody = document.getElementById('taxRateList');
    tbody.innerHTML = '';
    list.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.name}</td>
            <td>${item.spec || ''}</td>
            <td>${item.channel}</td>
            <td>${item.tax_rate ? item.tax_rate + '%' : '未设置'}</td>
            <td><button class="btn btn-primary" onclick="openTaxEdit(${item.id})">编辑税率</button></td>
        </tr>`;
    });
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
function initStockInPrintPage() {
    const sel = document.getElementById('printSupplier');
    sel.innerHTML = '<option value="">全部线下供应商</option>';
    offlineSupplierList.forEach(s => sel.innerHTML += `<option value="${s}">${s}</option>`);
    document.getElementById('printStartDate').value = '';
    document.getElementById('printEndDate').value = '';
    document.getElementById('printGoodsName').value = '';
    document.getElementById('printSpec').value = '';
    document.getElementById('printStockInList').innerHTML = '';
}
function searchPrintStockIn() {
    const supplier = document.getElementById('printSupplier').value;
    const goodsName = document.getElementById('printGoodsName').value.trim().toLowerCase();
    const spec = document.getElementById('printSpec').value.trim().toLowerCase();
    const start = document.getElementById('printStartDate').value;
    const end = document.getElementById('printEndDate').value;
    let list = allStockInList.filter(item => item.settleType === '线下');
    if (supplier) list = list.filter(i => i.supplier === supplier);
    if (goodsName) list = list.filter(i => i.goodsName.toLowerCase().includes(goodsName));
    if (spec) list = list.filter(i => (i.spec || '').toLowerCase().includes(spec));
    if (start) list = list.filter(i => i.record_date >= start);
    if (end) list = list.filter(i => i.record_date <= end);
    printStockInData = list;
    const tbody = document.getElementById('printStockInList');
    tbody.innerHTML = '';
    list.forEach((item, idx) => {
        const total = (Number(item.in_price) * Number(item.in_num)).toFixed(2);
        tbody.innerHTML += `
        <tr>
            <td><input type="checkbox" class="print-checkbox" data-index="${idx}"></td>
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
}
function previewAndPrint() {
    const checkedBox = document.querySelectorAll('.print-checkbox:checked');
    if (checkedBox.length === 0) return showMsg('请选择需要打印的入库记录');
    let totalAmount = 0;
    let supplierName = '';
    let printDate = '';
    const tableBody = document.getElementById('printPreviewTable');
    tableBody.innerHTML = '';
    checkedBox.forEach(cb => {
        const idx = Number(cb.dataset.index);
        const row = printStockInData[idx];
        supplierName = row.supplier;
        printDate = row.record_date;
        const rowTotal = Number(row.in_price) * Number(row.in_num);
        totalAmount += rowTotal;
        tableBody.innerHTML += `
        <tr>
            <td>${row.goodsName}</td>
            <td>${row.spec || ''}</td>
            <td>${Number(row.in_price).toFixed(2)}</td>
            <td>${row.in_num}</td>
            <td>${rowTotal.toFixed(2)}</td>
        </tr>`;
    });
    document.getElementById('printPreviewSupplier').innerText = supplierName;
    document.getElementById('printPreviewDate').innerText = printDate;
    document.getElementById('printPreviewTotal').innerText = totalAmount.toFixed(2);
    const previewDom = document.getElementById('printPreviewWrap');
    previewDom.style.display = 'block';
    window.print();
    previewDom.style.display = 'none';
}

// ===================== ③财务付款记录模块 =====================
let currentPayEditId = null;
function initPayRecordPage() {
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
    const tbody = document.getElementById('payRecordList');
    tbody.innerHTML = '';
    list.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${idx + 1}</td>
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
    closePayModal();
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
    const tbody = document.getElementById('invoiceBackList');
    tbody.innerHTML = '';
    list.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${idx + 1}</td>
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
    closeInvoiceBackModal();
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
    const tbody = document.getElementById('paymentBoardList');
    tbody.innerHTML = '';
    let idx = 1;
    for (const supplier in supplierGroup) {
        const data = supplierGroup[supplier];
        const payable = data.totalIn - data.totalPay;
        const invBalance = data.totalBack - data.totalIn;
        const color = invBalance < 0 ? 'color:red;' : '';
        tbody.innerHTML += `
        <tr>
            <td>${idx++}</td>
            <td>${supplier}</td>
            <td>${data.totalIn.toFixed(2)}</td>
            <td>${data.totalPay.toFixed(2)}</td>
            <td>${data.totalBack.toFixed(2)}</td>
            <td>${payable.toFixed(2)}</td>
            <td style="${color}">${invBalance.toFixed(2)}</td>
        </tr>`;
    }
}

// ===================== ⑥发票月结余 =====================
function initMonthBalancePage() {
    const sel = document.getElementById('monthBalanceSelect');
    sel.innerHTML = '<option value="">请选择月份</option>';
    monthDistinctList.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
    document.getElementById('monthBalanceSearch').value = '';
}
function searchMonthInvoiceBalance() {
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
    const tbody = document.getElementById('monthBalanceList');
    tbody.innerHTML = '';
    list.forEach((item, idx) => {
        tbody.innerHTML += `
        <tr>
            <td>${idx + 1}</td>
            <td>${item.supplier}</td>
            <td>${item.month}</td>
            <td>${item.balance.toFixed(2)}</td>
        </tr>`;
    });
}

// ===================== ⑦入库对账 =====================
function initStockInCheckPage() {
    initCheckMonthSelect('checkInMonth');
}
function initCheckMonthSelect(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">全部月份</option>';
    monthDistinctList.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
}
function searchStockInCheck() {
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
    const tbody = document.getElementById('stockInCheckList');
    tbody.innerHTML = '';
    list.forEach(row => {
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
}

// ===================== ⑧出库对账 =====================
function initStockOutCheckPage() {
    initCheckMonthSelect('checkOutMonth');
}
function searchStockOutCheck() {
    showMsg('出库模块需对接stock_out表，当前仅框架已完成，待出库表数据接入后即可使用');
}

// ===================== ⑨月期初库存 =====================
function initMonthBeginPage() {
    initCheckMonthSelect('beginMonth');
}
function searchMonthBeginStock() {
    showMsg('库存期初表需要实时库存结余计算逻辑，当前框架已完成');
}