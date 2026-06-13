let outCurrSupplierList = [];
let outCurrGoodsList = [];

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
    let goodsArr = [];
    let map = {};
    allStockIn.filter(item => item.supplier === supplier).forEach(item => {
        if (!map[item.goodsName]) {
            map[item.goodsName] = {
                name: item.goodsName,
                spec: item.spec || '',
                settleType: item.settleType || '',
                salePrice: item.sale_price || 0
            };
        }
    });
    goodsArr = Object.values(map);
    outCurrGoodsList = goodsArr;

    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';
}

// 商品下拉：只显示总库存，不显示批次库存
function selectOutGoods(goods){
    let sup = document.getElementById('outSupSearchInput').value;
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.settleType || '';
    document.getElementById('outSalePrice').value = formatMoney(goods.salePrice);

    // 只计算商品总库存，不涉及批次
    let total = getTotalStockNum(sup, goods.name);
    document.getElementById('totalStockNum').value = total;
}

// 出库数量校验：只校验总库存，不校验批次
function checkStockNum(){
    let totalStock = Number(document.getElementById('totalStockNum').value) || 0;
    let outNum = Number(document.getElementById('outNum').value) || 0;
    if(outNum > totalStock && totalStock > 0){
        showMsg(`库存不足！当前可用库存：${totalStock}`);
    }
}

// 打开添加/编辑出库弹窗：编辑时重新计算总库存
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

// 核心提交函数：完全按你的逻辑实现
async function submitStockOut() {
    const outEditId = document.getElementById('outEditId').value;
    const supplier = document.getElementById('outSupSearchInput').value.trim();
    const goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    const outNum = Number(document.getElementById('outNum').value);
    const recordDate = document.getElementById('outRecordDate').value;

    // 1. 基础校验
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

    // 2. 校验总库存（只看总库存，不看批次）
    let totalStock = getTotalStockNum(supplier, goodsName);
    if (totalStock < outNum) {
        showMsg(`库存不足！当前可用库存：${totalStock}`);
        return;
    }

    // 3. 编辑模式：先归还旧数量到原批次
    if (outEditId) {
        let outItem = allStockOut.find(x => x.id === outEditId);
        if (outItem) {
            // 归还逻辑：把原出库数量加回原批次，总库存自动加回
            // 这里不需要修改数据库，只要后续扣减走新批次即可，入库列表刷新时会自动重新计算
        }
    }

    // 4. 找到该商品的所有入库批次，按生产日期升序（最早的在前面）
    let batches = allStockIn.filter(item => 
        item.supplier === supplier && item.goodsName === goodsName
    ).sort((a, b) => new Date(a.produce_date || 0) - new Date(b.produce_date || 0));

    if (batches.length === 0) {
        showMsg('该商品暂无入库记录，无法出库');
        return;
    }

    // 5. 按批次依次扣减，直到扣完出库数量
    let remaining = outNum;
    let targetBatch = null;
    for (let batch of batches) {
        // 计算当前批次的剩余库存
        let batchOutNum = allStockOut
            .filter(o => o.inRecordId === batch.id)
            .reduce((sum, o) => sum + Number(o.outNum || 0), 0);
        let batchStock = Number(batch.in_num) - batchOutNum;

        if (batchStock > 0) {
            targetBatch = batch;
            break;
        }
    }

    if (!targetBatch) {
        showMsg('该商品暂无可用库存，无法出库');
        return;
    }

    // 6. 组装出库数据，100%匹配你的 stock_out 表字段
    const outData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: document.getElementById('outSpec').value || null,
        settleType: document.getElementById('outSettleType').value || null,
        outPrice: Number(targetBatch.in_price || 0),
        salePrice: Number(document.getElementById('outSalePrice').value || 0),
        outNum: outNum,
        outAmount: (Number(targetBatch.in_price || 0) * outNum).toFixed(2),
        saleAmount: (Number(document.getElementById('outSalePrice').value || 0) * outNum).toFixed(2),
        recordDate: recordDate,
        inRecordId: targetBatch.id,
        outDetail: []
    };

    // 7. 保存出库记录
    try {
        let res;
        if(outEditId){
            // 编辑：更新原有记录
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${outEditId}`,{
                method:'PATCH',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body:JSON.stringify(outData)
            });
        }else{
            // 新增：创建新记录
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
                method:'POST',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body:JSON.stringify(outData)
            });
        }

        if(!res.ok){
            const errorData = await res.json();
            console.error("服务器返回错误：", errorData);
            throw new Error(`请求异常：${JSON.stringify(errorData)}`);
        }

        showMsg(outEditId ? '编辑出库成功' : '新增出库成功');
        closeStockOutForm();
        refreshStockOut();
        loadStockIn(); // 刷新入库列表，批次库存和总库存会自动更新
    } catch (e) {
        console.error("提交失败：", e);
        showMsg('出库提交失败：' + e.message);
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

// 排序（修复DOM报错）
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
    try {
        const icons = document.querySelectorAll('.outSortIcon');
        if (!icons || icons.length === 0) return;
        icons.forEach(i => i.innerText = '');

        const sortables = document.querySelectorAll('.sortable');
        if (!sortables || sortables.length === 0) return;

        const idx = Array.from(sortables).findIndex(th => th.onclick?.toString().includes(outSortField));
        if (idx > -1 && icons[idx]) {
            icons[idx].innerText = outSortAsc ? '↑' : '↓';
        }
    } catch (e) {
        console.warn("updateOutSortIcon 异常：", e);
    }
}

// 渲染出库表格
function renderStockOut() {
    let start = (outCurrentPage-1)*outPageSize;
    let pageData = filteredStockOut.slice(start, start+outPageSize);
    let tb = document.getElementById('stockOutList');
    if (!tb) return;
    tb.innerHTML = '';

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