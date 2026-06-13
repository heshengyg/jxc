// 全局变量
let outCurrSupplierList = [];
let outCurrGoodsList = [];
let allStockOut = [];
let filteredStockOut = [];
let outCurrentPage = 1;
let outPageSize = 10;
let outTotalPages = 1;
let outSortField = '';
let outSortAsc = true;

// 刷新出库列表
function refreshStockOut(){
    loadStockOut();
}

// 供应商下拉
function showOutSupList(){
    outCurrSupplierList = [...new Set(allGoods.map(item=>item.supplier).filter(s=>s))];
    renderOutSupplierList(outCurrSupplierList);
    document.getElementById('outSupListBox').style.display = 'block';
}
function filterOutSupList(){
    let kw = document.getElementById('outSupSearchInput').value.toLowerCase();
    let res = outCurrSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderOutSupplierList(res);
    document.getElementById('outSupListBox').style.display = 'block';
}
function renderOutSupplierList(list){
    let box = document.getElementById('outSupListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(sup=>{
        let div = document.createElement('div');
        div.innerText = sup;
        div.onclick = function(){
            document.getElementById('outSupSearchInput').value = sup;
            document.getElementById('outSupListBox').style.display = 'none';
            loadOutGoodsBySupplier(sup);
        };
        box.appendChild(div);
    });
}

// 根据供应商加载商品
function loadOutGoodsBySupplier(supplier){
    outCurrGoodsList = allGoods.filter(g => g.supplier === supplier);
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('outNum').value = '';
    document.getElementById('outRecordDate').value = '';
    document.getElementById('totalStockNum').value = '';
}

// 商品下拉
function showOutGoodsList(){
    renderOutGoodsSelectList(outCurrGoodsList);
    document.getElementById('outGoodsListBox').style.display = 'block';
}
function filterOutGoodsList(){
    let kw = document.getElementById('outGoodsSearchInput').value.toLowerCase();
    let res = outCurrGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderOutGoodsSelectList(res);
    document.getElementById('outGoodsListBox').style.display = 'block';
}
function renderOutGoodsSelectList(list){
    let box = document.getElementById('outGoodsListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(goods=>{
        let div = document.createElement('div');
        div.innerText = goods.name;
        div.onclick = function(){
            selectOutGoods(goods);
            document.getElementById('outGoodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// 选择商品：自动带出信息 + 读取当前总库存
function selectOutGoods(goods){
    let sup = document.getElementById('outSupSearchInput').value;
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outCurGoodsId').value = goods.id;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.channel || '';
    document.getElementById('outSalePrice').value = formatMoney(goods.sale_price);

    // 读取当前商品总库存
    let total = getTotalStockNum(sup, goods.name);
    document.getElementById('totalStockNum').value = total;
}

// 出库数量输入校验库存
function checkStockNum(){
    let totalStock = Number(document.getElementById('totalStockNum').value) || 0;
    let outNum = Number(document.getElementById('outNum').value) || 0;
    if(outNum > totalStock && totalStock > 0){
        showMsg('出库数量不能大于当前库存');
    }
}

// 打开新增出库弹窗
function openStockOutForm(){
    document.getElementById('outSupSearchInput').value = '';
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('outNum').value = '';
    document.getElementById('totalStockNum').value = '';
    document.getElementById('outRecordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('stockOutModal').style.display = 'block';
}
function closeStockOutForm(){
    document.getElementById('stockOutModal').style.display = 'none';
}

// 获取优先出库批次（按生产日期先后）
function getFirstAvailableBatch(supplier, goodsName){
    let batches = allStockIn.filter(b => b.supplier === supplier && b.goodsName === goodsName);
    batches.sort((a,b)=>new Date(a.produce_date||'') - new Date(b.produce_date||''));
    for(let b of batches){
        let outSum = allStockOut.filter(o=>o.inRecordId === b.id).reduce((s,o)=>s+(Number(o.outNum)||0),0);
        if(Number(b.in_num) - outSum > 0){
            return b;
        }
    }
    return null;
}

// 提交出库（仅新增）
async function submitStockOut(){
    let supplier = document.getElementById('outSupSearchInput').value.trim();
    let goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    let goodsId = document.getElementById('outCurGoodsId').value;
    let spec = document.getElementById('outSpec').value;
    let settleType = document.getElementById('outSettleType').value;
    let salePriceText = document.getElementById('outSalePrice').value;
    let salePrice = parseFloat(salePriceText.replace('￥','')) || 0;
    let outNum = parseInt(document.getElementById('outNum').value);
    let recordDate = document.getElementById('outRecordDate').value;

    if(!supplier) return showMsg('请选择供应商');
    if(!goodsName || !goodsId) return showMsg('请选择商品');
    if(isNaN(outNum) || outNum < 1) return showMsg('出库数量必须大于0');
    if(!recordDate) return showMsg('请选择录入日期');

    let totalStock = Number(document.getElementById('totalStockNum').value) || 0;
    if(outNum > totalStock) return showMsg('库存不足，无法出库');

    let targetBatch = getFirstAvailableBatch(supplier, goodsName);
    if(!targetBatch) return showMsg('暂无可用库存批次');

    let outPrice = Number(targetBatch.in_price || 0);
    let outAmount = (outPrice * outNum).toFixed(2);
    let saleAmount = (salePrice * outNum).toFixed(2);

    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec || null,
        settleType: settleType,
        outPrice: outPrice,
        salePrice: salePrice,
        outNum: outNum,
        outAmount: outAmount,
        saleAmount: saleAmount,
        recordDate: recordDate,
        inRecordId: targetBatch.id,
        outDetail: []
    };

    try{
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
            method:'POST',
            headers:{
                apikey:SUPABASE_KEY,
                Authorization:`Bearer ${SUPABASE_KEY}`,
                'Content-Type':'application/json',
                'Prefer':'return=representation'
            },
            body:JSON.stringify(postData)
        });
        if(!res.ok) throw new Error('请求异常');

        showMsg('出库成功');
        closeStockOutForm();
        // 刷新出库 + 刷新入库（自动更新库存）
        await loadStockOut();
        loadStockIn();
    }catch(e){
        showMsg('出库提交失败');
    }
}

// 加载出库列表
async function loadStockOut() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        let list = await res.json();
        allStockOut = list.sort((a,b) => b.id - a.id);
        document.getElementById('outTotalCount').textContent = allStockOut.length;
        filterStockOut();
    } catch (e) {
        showMsg('加载出库记录失败');
    }
}

// 搜索筛选
function filterStockOut() {
    let field = document.getElementById('outSearchField').value;
    let kw = document.getElementById('outSearchKeyword').value.toLowerCase();
    filteredStockOut = allStockOut.filter(item => String(item[field]||'').toLowerCase().includes(kw));
    document.getElementById('outSearchCount').textContent = filteredStockOut.length;
    outCurrentPage = 1;
    renderOutPagination();
    renderStockOut();
}

// 出库列表排序
function outSortTable(field) {
    outSortField = field;
    outSortAsc = (outSortField === field) ? !outSortAsc : true;
    filteredStockOut.sort((a,b)=>{
        let va=a[field]||'', vb=b[field]||'';
        if(['outPrice','outNum','salePrice','outAmount','saleAmount'].includes(field)){
            va=Number(va)||0; vb=Number(vb)||0;
            return outSortAsc ? va - vb : vb - va;
        }
        return outSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateOutSortIcon();
    renderStockOut();
}
function updateOutSortIcon() {
    document.querySelectorAll('.outSortIcon').forEach(i=>i.innerText='');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th=>th.onclick?.toString().includes(outSortField));
    if(idx>-1) document.querySelectorAll('.outSortIcon')[idx].innerText = outSortAsc?'↑':'↓';
}

// 渲染出库表格
function renderStockOut() {
    let start = (outCurrentPage-1)*outPageSize;
    let pageData = filteredStockOut.slice(start, start+outPageSize);
    let tb = document.getElementById('stockOutList');
    if(!tb) return;
    tb.innerHTML = '';
    pageData.forEach((item, idx)=>{
        let html = `
        <tr>
            <td><input type="checkbox" class="out-item-checkbox" value="${item.id}"></td>
            <td>${start + idx + 1}</td>
            <td>${item.supplier||''}</td>
            <td>${item.goodsName||''}</td>
            <td>${item.spec||'-'}</td>
            <td>${item.settleType||''}</td>
            <td>${formatMoney(item.outPrice)}</td>
            <td>${formatMoney(item.salePrice)}</td>
            <td>${item.outNum}</td>
            <td>${formatMoney(item.outAmount)}</td>
            <td>${formatMoney(item.saleAmount)}</td>
            <td>${item.recordDate||''}</td>
            <td>
                <button class="btn btn-danger" onclick="deleteStockOut(${item.id})">删除</button>
            </td>
        </tr>
        `;
        tb.innerHTML += html;
    });
}

// 分页
function renderOutPagination() {
    outTotalPages = Math.ceil(filteredStockOut.length/outPageSize)||1;
    document.getElementById('outCurrentPage').textContent = outCurrentPage;
    document.getElementById('outTotalPages').textContent = outTotalPages;
    let pgBox = document.getElementById('outPageNumbers');
    pgBox.innerHTML='';
    let s = Math.max(1, outCurrentPage-2), e = Math.min(outTotalPages, s+4);
    for(let i=s;i<=e;i++){
        let btn = document.createElement('button');
        btn.className = 'page-btn '+(i===outCurrentPage?'active':'');
        btn.innerText=i;
        btn.onclick=()=>outGoToPage(i);
        pgBox.appendChild(btn);
    }
    let btns = document.querySelectorAll('#stockOut .page-controls .page-btn');
    btns[0].disabled = outCurrentPage===1;
    btns[1].disabled = outCurrentPage===1;
    btns[3].disabled = outCurrentPage===outTotalPages;
    btns[4].disabled = outCurrentPage===outTotalPages;
}
function outGoToPage(p){
    if(p<1||p>outTotalPages)return;
    outCurrentPage=p;
    renderOutPagination();
    renderStockOut();
}
function outPrevPage(){ outGoToPage(outCurrentPage-1); }
function outNextPage(){ outGoToPage(outCurrentPage+1); }
function changeOutPageSize(){
    outPageSize=+document.getElementById('outPageSize').value;
    outCurrentPage=1;
    renderOutPagination();
    renderStockOut();
}

// 全选
function outToggleSelectAll(){
    let all = document.getElementById('outSelectAll').checked;
    document.querySelectorAll('.out-item-checkbox').forEach(cb=>cb.checked=all);
}

// 单条删除
async function deleteStockOut(id){
    if(!confirm('确定删除该出库记录？')) return;
    try{
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        showMsg('删除成功');
        await loadStockOut();
        loadStockIn();
    }catch(e){
        showMsg('删除失败');
    }
}

// 批量删除
async function batchDeleteStockOut(){
    let ids = [];
    document.querySelectorAll('.out-item-checkbox:checked').forEach(cb=>ids.push(cb.value));
    if(ids.length === 0) return showMsg('请先选择数据');
    if(!confirm('确定批量删除？')) return;
    for(let id of ids){
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
    }
    showMsg('批量删除成功');
    await loadStockOut();
    loadStockIn();
}

// 导出出库Excel
function exportStockOutExcel(){
    if(filteredStockOut.length === 0){
        showMsg("暂无数据可导出");
        return;
    }
    let header = ["供应商","商品名称","规格","结算方式","出库单价","销售单价","出库数量","出库金额","销售金额","录入日期"];
    let expData = filteredStockOut.map(item=>[
        item.supplier||"",
        item.goodsName||"",
        item.spec||"",
        item.settleType||"",
        item.outPrice||0,
        item.salePrice||0,
        item.outNum||0,
        item.outAmount||0,
        item.saleAmount||0,
        item.recordDate||""
    ]);
    let ws = XLSX.utils.aoa_to_sheet([header,...expData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库记录");
    XLSX.writeFile(wb, "出库记录.xlsx");
}

// 下载出库导入模板
function downloadStockOutTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","出库单价","销售单价","出库数量","录入日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库导入模板");
    XLSX.writeFile(wb, "出库导入模板.xlsx");
}

// 重置搜索
function resetOutSearch() {
    document.getElementById('outSearchKeyword').value = '';
    document.getElementById('outSearchField').selectedIndex = 0;
    filterStockOut();
}

// 清除排序
function clearOutSort(){
    outSortField = '';
    outSortAsc = true;
    updateOutSortIcon();
    loadStockOut();
}

// 页面初始化
document.addEventListener('DOMContentLoaded',function(){
    loadStockOut();
});