// ===================== 出库模块 - 纯业务函数 =====================
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
    // 先按 商品名称+规格 做唯一去重
    const uniqueMap = new Map();
    allStockIn
        .filter(item => item.supplier === supplier)
        .forEach(item => {
            // 组合唯一键：商品名 + 规格，避免同名不同规格误去重
            const key = `${item.goodsName}||${item.spec || ''}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, {
                    name: item.goodsName,
                    spec: item.spec,
                    settleType: item.settleType,
                    salePrice: item.sale_price
                });
            }
        });
    // 转回数组
    let goodsArr = Array.from(uniqueMap.values());

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

// 选择商品，自动带出字段 + 加载总库存
function selectOutGoods(goods){
    let sup = document.getElementById('outSupSearchInput').value;
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.settleType || '';

    // 直接从商品基础库读取最新销售单价
    let baseGoods = allGoods.find(g => g.supplier === sup && g.name === goods.name);
    let salePrice = baseGoods ? Number(baseGoods.sale_price) : 0;
    document.getElementById('outSalePrice').value = formatMoney(salePrice);

    // 自动带出总库存
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

// 打开新增出库弹窗 【核心修复：outEditId → outEdit 匹配HTML真实ID】
function openStockOutForm(){
    // HTML 隐藏域 id 是 outEdit，原代码写 outEditId 导致报错
    document.getElementById('outEdit').value = '';
    document.getElementById('stockOutFormTitle').innerText = '添加出库单据';

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

    document.getElementById('stockOutModal').style.display = 'block';
}
function closeStockOutForm(){
    document.getElementById('stockOutModal').style.display = 'none';
}

// 提交出库
async function submitStockOut(){
    let supplier = document.getElementById('outSupSearchInput').value.trim();
    let goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    let spec = document.getElementById('outSpec').value || '';
    let settleType = document.getElementById('outSettleType').value || '';
    let salePriceText = document.getElementById('outSalePrice').value;
    let salePrice = parseFloat(salePriceText.replace('￥','')) || 0;
    let outNum = Number(document.getElementById('outNum').value) || 0;
    let recordDate = document.getElementById('outRecordDate').value;

    // 基础校验
    if(!supplier) return showMsg('请选择供应商');
    if(!goodsName) return showMsg('请选择商品');
    if(outNum < 1) return showMsg('出库数量必须大于0');
    if(!recordDate) return showMsg('请选择录入日期');

    // 库存校验
    let totalStock = getTotalStockNum(supplier, goodsName);
    if(outNum > totalStock){
        return showMsg(`库存不足！当前可用库存：${totalStock}`);
    }

    // 先进先出计算扣减明细
    let outDetail = calcFIFOOut(supplier, goodsName, outNum);
    if(outDetail.length === 0) return showMsg('无可用库存批次');

    // 按入库记录ID分组
    let groupMap = {};
    for(let d of outDetail){
        let inRecordId = d.inRecordId;
        let useNum = d.useNum;
        let inItem = allStockIn.find(inRec => inRec.id === inRecordId);
        if(!inItem) continue;

        let outPrice = 0;
        let goodsItem = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
        if(settleType === '线上'){
            outPrice = goodsItem ? Number(goodsItem.online_cost) : 0;
        }else{
            outPrice = Number(inItem.in_price) || 0;
        }

        if(!groupMap[inRecordId]){
            groupMap[inRecordId] = {
                inRecordId: inRecordId,
                outPrice: outPrice,
                totalUseNum: 0,
                details: []
            };
        }
        groupMap[inRecordId].totalUseNum += useNum;
        groupMap[inRecordId].details.push(d);
    }

    let groupList = Object.values(groupMap);
    if(groupList.length === 0) return showMsg('拆分出库数据失败');

    let baseGoods = allGoods.find(g => g.supplier === supplier && g.name === goodsName);
    if(baseGoods){
        salePrice = Number(baseGoods.sale_price) || 0;
    }

    let submitSuccess = true;
    for(let group of groupList){
        let singleOutNum = group.totalUseNum;
        let singleOutPrice = group.outPrice;
        let linkInId = group.inRecordId;
        let detailStr = JSON.stringify(group.details);

        let outAmount = Number((singleOutPrice * singleOutNum).toFixed(2));
        let saleAmount = Number((salePrice * singleOutNum).toFixed(2));

        let postData = {
            supplier: supplier,
            goodsName: goodsName,
            spec: spec,
            settleType: settleType,
            outPrice: singleOutPrice,
            salePrice: salePrice,
            outNum: singleOutNum,
            outAmount: outAmount,
            saleAmount: saleAmount,
            recordDate: recordDate,
            inRecordId: linkInId,
            outDetail: detailStr
        };

        try {
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
            if(!res.ok){
                let err = await res.json();
                console.error('单条出库提交失败：', err);
                submitSuccess = false;
            }
        } catch (e) {
            console.error('单条出库请求异常：', e);
            submitSuccess = false;
        }
    }

    if(submitSuccess){
        showMsg('出库提交成功');
    }else{
        showMsg('部分出库记录提交异常，请检查数据');
    }
    closeStockOutForm();
    await loadStockOut();
    await loadStockIn();
}

// 导出出库模板
function downloadStockOutTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","出库单价","销售单价","出库数量","出库金额","销售金额","录入日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库导入模板");
    XLSX.writeFile(wb, "出库导入模板.xlsx");
}
// 导出出库Excel
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
    let ws = XLSX.utils.aoa_to_sheet([header]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库记录");
    XLSX.writeFile(wb, "出库记录.xlsx");
}

// 加载出库列表
async function loadStockOut() {
    try {
        const pageOffset = (outCurrentPage - 1) * outPageSize;
        const fetchPage = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?order=id.desc&limit=${outPageSize}&offset=${pageOffset}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const pageData = await fetchPage.json();
        const countRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?select=id`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Range-Unit': 'items',
                'Range': '0-0',
                'Prefer': 'count=exact'
            }
        });
        const totalRecord = Number(countRes.headers.get('content-range').split('/')[1]);
        allStockOut = pageData;
        document.getElementById('outTotalCount').textContent = totalRecord;
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
function changeOutPageSize(){ outPageSize=+document.getElementById('outPageSize').value; outCurrentPage=1; renderOutPagination(); }

// 全选
function outToggleSelectAll(){
    let all = document.getElementById('outSelectAll').checked;
    document.querySelectorAll('.out-item-checkbox').forEach(cb=>cb.checked=all);
}

// 单条删除
async function deleteStockOut(id){
    if(!confirm('确定删除？'))return;
    try{
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,
            'Range-Unit':'items',
            'Range':`${id}-${id}`
        }});
        showMsg('删除成功');
        await loadStockOut();
        await loadStockIn();
    }catch(e){ showMsg('删除失败'); }
}

// 批量删除
async function batchDeleteStockOut(){
    let ids = [];
    document.querySelectorAll('.out-item-checkbox').forEach(cb=>{
        if(cb.checked) ids.push(cb.value);
    });
    if(ids.length===0) return showMsg('请选择数据');
    if(!confirm(`确定删除${ids.length}条？`))return;
    for(let id of ids){
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,
            'Range-Unit':'items',
            'Range':`${id}-${id}`
        });
    }
    showMsg('批量删除成功');
    await loadStockOut();
    await loadStockIn();
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