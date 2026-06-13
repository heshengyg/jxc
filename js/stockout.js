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
            // 选中供应商后 自动加载商品并刷新下拉
            loadOutGoodsBySupplier(sup);
        };
        box.appendChild(div);
    });
}

// 根据供应商加载对应商品 + 同步商品下拉数据源
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

    // 清空表单附属字段
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';

    // 关键：加载完商品 立即刷新下拉面板数据
    renderOutGoodsList(outCurrGoodsList);
}

// 商品下拉
function showOutGoodsList(){
    // 先渲染再展示
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

// 选择商品：自动带出字段 + 计算【总库存】展示
function selectOutGoods(goods){
    let sup = document.getElementById('outSupSearchInput').value;
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.settleType || '';
    document.getElementById('outSalePrice').value = formatMoney(goods.salePrice);

    // 仅计算商品总库存
    let total = getTotalStockNum(sup, goods.name);
    document.getElementById('totalStockNum').value = total;
}

// 出库数量实时校验：只校验总库存
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

    // 编辑模式：回填数据 + 重新计算最新总库存
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

// 核心提交函数（完整实现：编辑归还库存 + 总库存校验 + 优先最早批次扣减）
async function submitStockOut() {
    const outEditId = document.getElementById('outEditId').value;
    const supplier = document.getElementById('outSupSearchInput').value.trim();
    const goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    const outNum = Number(document.getElementById('outNum').value);
    const recordDate = document.getElementById('outRecordDate').value;

    // 基础非空校验
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

    // 1. 仅校验【商品总库存】
    let totalStock = getTotalStockNum(supplier, goodsName);
    if (totalStock < outNum) {
        showMsg(`库存不足！当前可用库存：${totalStock}`);
        return;
    }

    // 2. 编辑模式：先逻辑归还原出库数量（总库存/批次库存自动回加）
    if (outEditId) {
        let oldOutRecord = allStockOut.find(o => o.id === outEditId);
        if(oldOutRecord){
            // 无需操作数据库，删除/更新本条记录后，库存计算自动归还
        }
    }

    // 3. 筛选当前商品所有入库批次 → 按【生产日期升序（最早优先）】
    let batches = allStockIn
        .filter(inItem => inItem.supplier === supplier && inItem.goodsName === goodsName)
        .sort((a, b) => new Date(a.produce_date || 0) - new Date(b.produce_date || 0));

    if (batches.length === 0) {
        showMsg('该商品暂无入库记录，无法出库');
        return;
    }

    // 4. 找到第一个有剩余库存的批次
    let targetBatch = null;
    for (const batch of batches) {
        // 计算当前批次已出库总和
        let batchOutTotal = allStockOut
            .filter(o => o.inRecordId === batch.id)
            .reduce((sum, o) => sum + (Number(o.outNum) || 0), 0);
        let batchRemain = Number(batch.in_num) - batchOutTotal;

        if (batchRemain > 0) {
            targetBatch = batch;
            break;
        }
    }

    if (!targetBatch) {
        showMsg('该商品暂无可用批次库存，无法出库');
        return;
    }

    // 5. 组装数据 → 严格匹配你 stock_out 表原有驼峰字段
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

    // 6. 提交接口
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
            // 新增：新建出库记录
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
            const err = await res.json();
            console.error('接口报错：', err);
            throw new Error('数据提交异常');
        }

        showMsg(outEditId ? '编辑出库成功' : '新增出库成功');
        closeStockOutForm();
        refreshStockOut();
        loadStockIn(); // 刷新入库 → 批次库存、总库存实时更新
    } catch (e) {
        console.error('出库提交失败：', e);
        showMsg('出库提交失败，请检查网络或数据');
    }
}

// 导出、导入模板
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

// 表格排序
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
        const idx = Array.from(sortables).findIndex(th => th.onclick?.toString().includes(outSortField));
        if (idx > -1 && icons[idx]) {
            icons[idx].innerText = outSortAsc ? '↑' : '↓';
        }
    } catch (e) {}
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
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`);
    }
    showMsg('批量删除成功');
    loadStockOut();
    loadStockIn();
}

// 重置搜索、清空排序
function clearOutSort(){
    outSortField = ''; outSortAsc = true; updateOutSortIcon(); loadStockOut();
}
function resetOutSearch() {
    document.getElementById('outSearchKeyword').value = '';
    document.getElementById('outSearchField').selectedIndex = 0;
    filterStockOut();
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function(){
    loadStockOut();
});