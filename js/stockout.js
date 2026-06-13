let outCurrSupplierList = [];
let outCurrGoodsList = [];

// 新增：根据供应商+商品名，取生产日期最早、有库存的入库批次
function getFirstAvailableBatch(supplier, goodsName) {
    console.log("=== 开始查找批次 ===");
    console.log("参数：supplier=" + supplier + ", goodsName=" + goodsName);

    // 1. 兼容库存字段名（batchStock / stock / currentStock）
    function getStockValue(item) {
        const stockVal = Number(item.batchStock || item.stock || item.currentStock || 0);
        console.log("批次 " + item.id + " 库存值：" + stockVal);
        return stockVal;
    }

    // 2. 筛选：同供应商、同商品、库存>0
    let batchList = allStockIn.filter(item => {
        const matchSupplier = (item.supplier || "").trim() === (supplier || "").trim();
        const matchGoodsName = (item.goodsName || "").trim() === (goodsName || "").trim();
        const hasStock = getStockValue(item) > 0;

        console.log("批次 " + item.id + "：供应商匹配=" + matchSupplier + "，商品名匹配=" + matchGoodsName + "，库存>0=" + hasStock);
        return matchSupplier && matchGoodsName && hasStock;
    });

    console.log("筛选后批次列表：", batchList);

    if (batchList.length === 0) {
        console.log("❌ 未找到任何可用批次");
        return null;
    }

    // 3. 按生产日期排序
    batchList.sort((a, b) => {
        let dateA = new Date(a.produce_date || a.produceDate || a.produce_date_str || 0);
        let dateB = new Date(b.produce_date || b.produceDate || b.produce_date_str || 0);
        console.log("排序：批次" + a.id + "日期=" + dateA + " vs 批次" + b.id + "日期=" + dateB);
        return dateA - dateB;
    });

    console.log("✅ 最终选择批次：", batchList[0]);
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

// 【重点修复】根据供应商加载对应商品（去掉JSON.stringify去重，改用对象去重）
function loadOutGoodsBySupplier(supplier){
    // 1. 先取出该供应商所有入库记录
    let list = allStockIn.filter(item => item.supplier === supplier);

    // 2. 手动去重：按 goodsName 唯一
    let map = {};
    list.forEach(item => {
        if (!map[item.goodsName]) {
            map[item.goodsName] = {
                name: item.goodsName,
                spec: item.spec || '',
                settleType: item.settleType || '',
                salePrice: item.sale_price || 0
            };
        }
    });
    outCurrGoodsList = Object.values(map);

    // 清空表单
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

// 商品下拉 —— 显示总库存
function selectOutGoods(goods){
    let sup = document.getElementById('outSupSearchInput').value;
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.settleType || '';
    document.getElementById('outSalePrice').value = formatMoney(goods.salePrice);

    let total = getTotalStockNum(sup, goods.name);
    document.getElementById('totalStockNum').value = total;
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

    document.getElementById('outSupSearchInput').value = '';
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';
    document.getElementById('outRecordDate').value = new Date().toISOString().split('T')[0];

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

// 提交出库 —— 编辑归还旧库存 + 提交时取最早批次扣减
async function submitStockOut() {
    console.log("=== 提交出库开始 ===");
    const outEditId = document.getElementById('outEditId').value;
    const supplier = document.getElementById('outSupSearchInput').value.trim();
    const goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    const outNum = Number(document.getElementById('outNum').value);
    const recordDate = document.getElementById('outRecordDate').value;

    console.log("参数：supplier=" + supplier + ", goodsName=" + goodsName + ", outNum=" + outNum);

    // 基础校验
    if (!supplier || !goodsName) {
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

    // 编辑：先归还旧库存
    if (outEditId) {
        console.log("编辑模式，先归还旧库存");
        let outItem = allStockOut.find(x => x.id === outEditId);
        if (!outItem) {
            showMsg('出库记录不存在');
            return;
        }
        let oldOutNum = Number(outItem.outNum);
        let oldBatchId = outItem.stockInId;

        let oldBatch = allStockIn.find(x => x.id === oldBatchId);
        if (oldBatch) {
            const stockKey = "batchStock" in oldBatch ? "batchStock" : ("stock" in oldBatch ? "stock" : "currentStock");
            oldBatch[stockKey] = Number(oldBatch[stockKey]) + oldOutNum;
            console.log("已归还库存到批次 " + oldBatchId + "，当前库存：" + oldBatch[stockKey]);
        }
    }

    // 找最早批次
    let targetBatch = getFirstAvailableBatch(supplier, goodsName);

    if (!targetBatch) {
        console.log("❌ 未找到可用批次，提交失败");
        showMsg('该商品暂无可用库存，无法出库');
        return;
    }

    // 库存校验
    const stockKey = "batchStock" in targetBatch ? "batchStock" : ("stock" in targetBatch ? "stock" : "currentStock");
    if (Number(targetBatch[stockKey]) < outNum) {
        showMsg('当前最早批次库存不足，请减少出库数量');
        return;
    }

    // 扣减库存
    targetBatch[stockKey] = Number(targetBatch[stockKey]) - outNum;
    console.log("✅ 扣减库存成功，批次 " + targetBatch.id + " 剩余库存：" + targetBatch[stockKey]);

    // 组装出库数据
    const outData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: document.getElementById('outSpec').value,
        settleType: document.getElementById('outSettleType').value,
        outPrice: Number(targetBatch.inPrice || targetBatch.in_price || 0),
        salePrice: Number(document.getElementById('outSalePrice').value),
        outNum: outNum,
        outAmount: (Number(targetBatch.inPrice || targetBatch.in_price || 0) * outNum).toFixed(2),
        saleAmount: (Number(document.getElementById('outSalePrice').value) * outNum).toFixed(2),
        recordDate: recordDate,
        stockInId: targetBatch.id
    };

    if (outEditId) {
        let idx = allStockOut.findIndex(x => x.id === outEditId);
        if (idx > -1) {
            allStockOut[idx] = { ...allStockOut[idx], ...outData };
        }
        showMsg('编辑出库成功');
    } else {
        outData.id = createId();
        allStockOut.push(outData);
        showMsg('新增出库成功');
    }

    saveStockOutData();
    saveStockInData();
    refreshStockOut();
    closeStockOutForm();
    console.log("=== 提交出库结束 ===");
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
    updateOutSortIcon();
    renderStockOut();
}

// 修复：安全更新排序图标
function updateOutSortIcon() {
    try {
        // 1. 清空所有排序图标
        const icons = document.querySelectorAll('.outSortIcon');
        if (icons && icons.length > 0) {
            icons.forEach(i => {
                if (i && i.innerText !== undefined) {
                    i.innerText = '';
                }
            });
        }

        // 2. 找到当前排序字段对应的按钮
        const sortables = document.querySelectorAll('.sortable');
        if (!sortables || sortables.length === 0) return;

        const idx = Array.from(sortables).findIndex(th => {
            return th && th.onclick?.toString().includes(outSortField);
        });

        // 3. 安全设置图标
        if (idx > -1 && icons && icons[idx]) {
            icons[idx].innerText = outSortAsc ? '↑' : '↓';
        }
    } catch (e) {
        console.warn("updateOutSortIcon 执行异常：", e);
    }
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
    btns[4].disabled = outCurrentPage===outTotalPages;
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
        loadStockIn();
        filterStockIn();
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
    loadStockIn();
    filterStockIn();
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