// ===================== 出库模块 - 最终完整版（编辑优先取最早批次） =====================
let outCurrSupplierList = [];
let outCurrGoodsList = [];

/**
 * 根据供应商+商品ID，查找【库存>0、生产日期最早】的入库批次
 * @param {string} supplier 供应商
 * @param {string} goodsId 商品ID
 * @returns {object|null} 批次对象 / 无库存返回null
 */
function getFirstAvailableBatch(supplier, goodsId) {
    // 筛选：同供应商、同商品、批次库存 > 0
    let batchList = allStockIn.filter(item => {
        return item.supplier === supplier 
            && item.goodsId === goodsId 
            && Number(item.batchStock) > 0;
    });
    if (batchList.length === 0) return null;

    // 按生产日期 升序（越早越靠前）
    batchList.sort((a, b) => {
        return new Date(a.produce_date) - new Date(b.produce_date);
    });

    return batchList[0];
}

// 刷新出库列表
function refreshStockOut(){
    loadStockOut();
}

// 供应商下拉
function showOutSupList(){
    outCurrSupplierList = [...new Set(allStockIn.map(item=>item.supplier).filter(s=>s))];
    renderOutSupList(outCurrSupplierList);
    document.getElementById('outSupListBox').style.display = 'block';
}
function filterOutSupList(){
    let kw = document.getElementById('outSupSearchInput').value.toLowerCase();
    let res = outCurrSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderOutSupList(res);
    document.getElementById('outSupListBox').style.display = 'block';
}
function renderOutSupList(list){
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

// 根据供应商加载对应商品
function loadOutGoodsBySupplier(supplier){
    let goodsArr = [...new Set(allStockIn
        .filter(item => item.supplier === supplier)
        .map(item => JSON.stringify({
            id: item.goodsId,
            name: item.goodsName,
            spec: item.spec,
            settleType: item.settleType,
            salePrice: item.sale_price
        }))
    )].map(str => JSON.parse(str));

    outCurrGoodsList = goodsArr;
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';
}

// 商品下拉
function showOutGoodsList(){
    renderOutGoodsList(outCurrGoodsList);
    document.getElementById('outGoodsListBox').style.display = 'block';
}
function filterOutGoodsList(){
    let kw = document.getElementById('outGoodsSearchInput').value.toLowerCase();
    let res = outCurrGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderOutGoodsList(res);
    document.getElementById('outGoodsListBox').style.display = 'block';
}
function renderOutGoodsList(list){
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

// 选择商品，自动带出字段 + 加载总库存（已追加最早批次库存逻辑）
function selectOutGoods(goods){
    let sup = document.getElementById('outSupSearchInput').value;
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outCurGoodsId').value = goods.id;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.settleType || '';
    document.getElementById('outSalePrice').value = formatMoney(goods.salePrice);

    let total = getTotalStockNum(sup, goods.name);
    document.getElementById('totalStockNum').value = total;

    // 选中商品后，读取【最早可用批次】库存
    let batch = getFirstAvailableBatch(sup, goods.id);
    if(batch){
        document.getElementById('totalStockNum').value = batch.batchStock;
    }
}

// 出库数量实时库存校验
function checkStockNum(){
    let totalStock = Number(document.getElementById('totalStockNum').value) || 0;
    let outNum = Number(document.getElementById('outNum').value) || 0;
    if(outNum > totalStock && totalStock > 0){
        showMsg(`库存不足！当前可用库存：${totalStock}`);
    }
}

// 打开添加/编辑出库弹窗
function openStockOutForm(id=null){
    document.getElementById('outEditId').value = id || '';
    document.getElementById('stockOutFormTitle').innerText = id ? '编辑出库单据' : '添加出库单据';

    // 重置表单
    document.getElementById('outSupSearchInput').value = '';
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';
    document.getElementById('outRecordDate').value = new Date().toISOString().split('T')[0];

    // 编辑模式回填数据
    if(id){
        let item = allStockOut.find(x => x.id === id);
        if(item){
            document.getElementById('outSupSearchInput').value = item.supplier;
            loadOutGoodsBySupplier(item.supplier);
            setTimeout(()=>{
                let targetGoods = outCurrGoodsList.find(g => g.name === item.goodsName);
                if(targetGoods){
                    selectOutGoods(targetGoods);
                    document.getElementById('outNum').value = item.outNum;
                    document.getElementById('outRecordDate').value = item.recordDate || '';
                }
            },100);
        }
    }

    document.getElementById('stockOutModal').style.display = 'block';
}
function closeStockOutForm(){
    document.getElementById('stockOutModal').style.display = 'none';
}

// 提交出库（核心改造：编辑时恢复旧库存、重新取最早批次）
async function submitStockOut() {
    const outEditId = document.getElementById('outEditId').value;
    const supplier = document.getElementById('outSupSearchInput').value.trim();
    const goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    const goodsId = document.getElementById('outCurGoodsId').value;
    const outNum = Number(document.getElementById('outNum').value);
    const recordDate = document.getElementById('outRecordDate').value;

    // 基础校验
    if (!supplier || !goodsName || !goodsId) {
        showMsg('请选择供应商和商品');
        return;
    }
    if (isNaN(outNum) || outNum < 1) {
        showMsg('出库数量必须大于0');
        return;
    }
    if (!recordDate) {
        showMsg('请选择录入日期');
        return;
    }

    // 1. 查找当前该商品最早可用批次
    let targetBatch = getFirstAvailableBatch(supplier, goodsId);

    // ========== 编辑模式：先撤销旧出库，恢复原批次库存 ==========
    if (outEditId) {
        // 找到当前正在编辑的出库记录
        let outItem = allStockOut.find(x => x.id === outEditId);
        if (!outItem) {
            showMsg('出库记录不存在');
            return;
        }
        let oldOutNum = Number(outItem.outNum);
        let oldBatchId = outItem.inRecordId; // 本条出库原来绑定的入库批次ID

        // 把旧数量 加回 原来的批次库存
        let oldBatch = allStockIn.find(x => x.id === oldBatchId);
        if (oldBatch) {
            oldBatch.batchStock = Number(oldBatch.batchStock) + oldOutNum;
        }

        // 恢复后，重新再查一次最新最早批次
        targetBatch = getFirstAvailableBatch(supplier, goodsId);
    }

    // 校验：是否还有可出库库存
    if (!targetBatch) {
        showMsg('该商品暂无可用库存，无法出库');
        return;
    }
    if (Number(targetBatch.batchStock) < outNum) {
        showMsg('当前最早批次库存不足，请减少出库数量');
        return;
    }

    // 2. 扣减 新查到的最早批次 库存
    targetBatch.batchStock = Number(targetBatch.batchStock) - outNum;

    let spec = document.getElementById('outSpec').value || '';
    let settleType = document.getElementById('outSettleType').value || '';
    let outPrice = Number(targetBatch.in_price) || 0;
    let salePriceText = document.getElementById('outSalePrice').value;
    let salePrice = parseFloat(salePriceText.replace('￥','')) || 0;
    let outAmount = Number((outPrice * outNum).toFixed(2));
    let saleAmount = Number((salePrice * outNum).toFixed(2));

    // 组装出库数据
    const postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec,
        settleType: settleType,
        outPrice: outPrice,
        salePrice: salePrice,
        outNum: outNum,
        outAmount: outAmount,
        saleAmount: saleAmount,
        recordDate: recordDate,
        inRecordId: targetBatch.id,
        outDetail: ""
    };

    // 3. 保存数据（新增 / 编辑）
    try {
        let res;
        if(outEditId){
            // 编辑
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${outEditId}`,{
                method:'PATCH',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body:JSON.stringify(postData)
            });
        }else{
            // 新增
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
                method:'POST',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body:JSON.stringify(postData)
            });
        }
        if(!res.ok) throw new Error('请求失败');

        showMsg(outEditId ? '编辑出库成功' : '出库提交成功');
        closeStockOutForm();
        refreshStockOut();
    } catch (e) {
        console.error(e);
        showMsg('操作失败：' + e.message);
    }
}

// 导出/导入/模板、分页、排序、删除
function downloadStockOutTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","出库单价","销售单价","出库数量","出库金额","销售金额","录入日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库导入模板");
    XLSX.writeFile(wb, "出库导入模板.xlsx");
}
function exportStockOutExcel(){
    if(filteredStockOut.length === 0){
        showMsg("暂无数据可导出");
        return;
    }
    let header = ["供应商","商品名称","规格","结算方式","出库单价","销售单价","出库数量","出库金额","销售金额","录入日期"];
    let expData = filteredStockOut.map(item=>[
        item.supplier||"",item.goodsName||"",item.spec||"",item.settleType||"",
        item.outPrice||0,item.salePrice||0,item.outNum||0,
        item.outAmount||0,item.saleAmount||0,item.recordDate||""
    ]);
    let ws = XLSX.utils.aoa_to_sheet([header,...expData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库记录");
    XLSX.writeFile(wb, "出库记录.xlsx");
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
        showMsg('加载出库记录失败：' + e.message);
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

// 排序
function outSortTable(field) {
    outSortField = field;
    outSortAsc = (outSortField === field) ? !outSortAsc : true;
    filteredStockOut.sort((a,b)=>{
        let va=a[outSortField]||'', vb=b[outSortField]||'';
        if(['outPrice','outNum','outAmount','saleAmount','salePrice'].includes(outSortField)){
            va=Number(va)||0; vb=Number(vb)||0;
            return outSortAsc ? va-vb : vb-va;
        }
        return outSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateOutSortIcon(); renderStockOut();
}
function updateOutSortIcon() {
    document.querySelectorAll('.outSortIcon').forEach(i=>i.innerText='');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th=>th.onclick?.toString().includes(outSortField));
    if(idx>-1) document.querySelectorAll('.outSortIcon')[idx].innerText = outSortAsc?'↑':'↓';
}

// 渲染表格
function renderStockOut() {
    let start = (outCurrentPage-1)*outPageSize;
    let pageData = filteredStockOut.slice(start, start+outPageSize);
    let tb = document.getElementById('stockOutList'); tb.innerHTML = '';
    pageData.forEach((item,idx)=>{
        let html = `
            <tr>
                <td><input type="checkbox" class="out-item-checkbox" value="${item.id}"></td>
                <td>${start+idx+1}</td>
                <td>${item.supplier||''}</td>
                <td>${item.goodsName||''}</td>
                <td>${item.spec||'-'}</td>
                <td>${item.settleType||''}</td>
                <td>${formatMoney(item.outPrice)}</td>
                <td>${formatMoney(item.salePrice)}</td>
                <td>${item.outNum||0}</td>
                <td>${formatMoney(item.outAmount)}</td>
                <td>${formatMoney(item.saleAmount)}</td>
                <td>${item.recordDate||''}</td>
                <td>
                    <button class="btn btn-primary" onclick="openStockOutForm(${item.id})">编辑</button>
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
    let pgBox = document.getElementById('outPageNumbers'); pgBox.innerHTML='';
    let s = Math.max(1, outCurrentPage-2), e = Math.min(outTotalPages, s+4);
    for(let i=s;i<=e;i++){
        let btn = document.createElement('button');
        btn.className = 'page-btn '+(i===outCurrentPage?'active':'');
        btn.innerText=i; btn.onclick=()=>outGoToPage(i); pgBox.appendChild(btn);
    }
    let btns = document.querySelectorAll('#stockOut .page-controls .page-btn');
    btns[0].disabled = outCurrentPage===1;
    btns[1].disabled = outCurrentPage===1;
    btns[3].disabled = outCurrentPage===outTotalPages;
    btns[4].disabled = outTotalPages;
}
function outGoToPage(p){ if(p<1||p>outTotalPages)return; outCurrentPage=p; renderOutPagination(); renderStockOut(); }
function outPrevPage(){ outGoToPage(outCurrentPage-1); }
function outNextPage(){ outGoToPage(outCurrentPage+1); }
function changeOutPageSize(){ outPageSize=+document.getElementById('outPageSize').value; outCurrentPage=1; renderOutPagination(); renderStockOut(); }

// 全选
function outToggleSelectAll(){
    let all = document.getElementById('outSelectAll').checked;
    document.querySelectorAll('.out-item-checkbox').forEach(cb=>cb.checked=all);
}

// 单条删除
async function deleteStockOut(id){
    if(!confirm('确定删除？'))return;
    try{
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        showMsg('删除成功');
        loadStockOut();
    }catch(e){ showMsg('删除失败'); }
}

// 批量删除
async function batchDeleteStockOut(){
    let ids = [];
    document.querySelectorAll('.out-item-checkbox:checked').forEach(cb=>ids.push(cb.value));
    if(ids.length===0) return showMsg('请选择数据');
    if(!confirm(`确定删除${ids.length}条？`))return;
    for(let id of ids){
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
    }
    showMsg('批量删除成功');
    loadStockOut();
}

// 清空排序、重置搜索
function clearOutSort(){
    outSortField = ''; outSortAsc = true; updateOutSortIcon(); loadStockOut();
}
function resetOutSearch() {
    document.getElementById('outSearchKeyword').value = '';
    document.getElementById('outSearchField').selectedIndex = 0;
    filterStockOut();
}

// 页面DOM加载完成，自动加载出库列表
document.addEventListener('DOMContentLoaded', function(){
    loadStockOut();
});