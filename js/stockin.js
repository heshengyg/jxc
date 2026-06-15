// ===================== 入库模块 - 纯业务函数 /**
 * 校验入库单是否被出库引用（后端RPC实时校验，对齐goods.js写法）
 * @param {number|string} inId 入库表真实ID
 * @returns {boolean} true=已引用(禁用操作)  false=未引用(允许操作)
 */
async function checkInUsedByOut(inId) {
    if (!inId) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_in_used_by_out`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            body: JSON.stringify({
                p_in_id: inId
            })
        });
        // 解析Supabase RPC数组格式结果，取出真实布尔值
        const resultArr = await res.json();
        // 兼容数组/纯布尔两种返回格式
        const realResult = Array.isArray(resultArr) ? resultArr[0] : resultArr;
        // 强制转为标准布尔值
        return !!realResult;
    } catch (err) {
        console.error("入库引用校验失败：", err);
        // 异常兜底：禁止操作，保护数据安全（和goods逻辑对齐）
        return true;
    }
}

// 刷新入库列表
function refreshStockIn(){
    loadStockIn();
}

// 加载入库列表（你原来的函数，100%原样）
async function loadStockIn() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        let list = await res.json();
        allStockIn = list.sort((a,b) => b.id - a.id);
        document.getElementById('inTotalCount').textContent = allStockIn.length;
        filterStockIn();
    } catch (e) {
        showMsg('加载入库记录失败：' + e.message);
    }
}

// 渲染入库表格（仅优化了校验调用方式，其余完全原样）
async function renderStockIn() {
    let start = (inCurrentPage-1)*inPageSize;
    let pageData = filteredStockIn.slice(start, start+inPageSize);
    let tb = document.getElementById('stockInList'); 
    if (!tb) {
        console.error('找不到入库列表DOM元素');
        return;
    }
    tb.innerHTML = '';

    // 缓存批次列表（原有逻辑完全保留）
    let goodsSet = new Set(pageData.map(item => `${item.supplier}_${item.goodsName}`));
    let batchCache = {};
    goodsSet.forEach(key => {
        let [supplier, goodsName] = key.split('_');
        batchCache[key] = getStockBatchList(supplier, goodsName);
    });

    // 【核心修复】并行批量校验，避免循环串行阻塞
    const checkMap = new Map();
    const taskList = pageData.map(item => 
        checkInUsedByOut(item.id).then(flag => checkMap.set(item.id, flag))
    );
    await Promise.all(taskList);

    // 纯DOM渲染（无网络请求，极速执行）
    for(let idx = 0; idx < pageData.length; idx++){
        const item = pageData[idx];
        let batchList = batchCache[`${item.supplier}_${item.goodsName}`];
        let batch = batchList.find(b => 
            b.inRecords.some(inItem => inItem.id === item.id)
        );
        let batchRemain = batch ? batch.batchRemain : 0;
        let totalStock = getTotalStockNum(item.supplier, item.goodsName);
        let amount = formatMoney((item.in_price || 0) * item.in_num);
        let isUsed = checkMap.get(item.id) || false;
        let btnHtml = '';
        if(isUsed){
            btnHtml = `
                <button class="btn btn-primary" disabled style="opacity:0.5">编辑</button>
                <button class="btn btn-danger" disabled style="opacity:0.5">删除</button>
            `;
        }else{
            btnHtml = `
                <button class="btn btn-primary" onclick="openStockInForm(${item.id})">编辑</button>
                <button class="btn btn-danger" onclick="deleteStockIn(${item.id})">删除</button>
            `;
        }
        let html = `
            <tr>
                <td><input type="checkbox" class="in-item-checkbox" value="${item.id}"></td>
                <td>${start + idx + 1}</td>
                <td>${item.supplier || ''}</td>
                <td>${item.goodsName || ''}</td>
                <td>${item.spec || '-'}</td>
                <td>${item.settleType || ''}</td>
                <td>${formatMoney(item.in_price)}</td>
                <td>${item.in_num}</td>
                <td>${amount}</td>
                <td>${batchRemain}</td>
                <td>${totalStock}</td>
                <td>${item.produce_date || ''}</td>
                <td>${item.expire_date || ''}</td>
                <td>
                    ${btnHtml}
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    }
}

// 打开添加入库弹窗（仅加了await校验，其余完全原样）
async function openStockInForm(id=null){
    if (id && await checkInUsedByOut(id)) {
        showMsg('该入库记录已生成出库单据，禁止编辑！');
        return;
    }
    document.getElementById('inEditId').value = id || '';
    document.getElementById('stockInFormTitle').innerText = id ? '编辑入库单据' : '添加入库单据';
    document.getElementById('supSearchInput').value = '';
    document.getElementById('goodsSearchInput').value = '';
    document.getElementById('curSelectGoodsId').value = '';
    document.getElementById('inSpec').value = '';
    document.getElementById('inSettleType').value = '';
    document.getElementById('inSalePrice').value = '';
    document.getElementById('inNum').value = '';
    document.getElementById('inPrice').value = '';
    document.getElementById('inPrice').disabled = false;
    document.getElementById('inRecordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inProduceDate').value = '';
    document.getElementById('inExpireDate').value = '';
    if(id){
        let item = allStockIn.find(x=>x.id === id);
        if(!item) return;
        document.getElementById('supSearchInput').value = item.supplier;
        loadGoodsBySupplier(item.supplier);
        setTimeout(()=>{
            let targetGoods = currGoodsList.find(g => g.name === item.goodsName);
            if(targetGoods){
                selectInGoods(targetGoods);
                document.getElementById('inNum').value = item.in_num;
                document.getElementById('inPrice').value = item.in_price;
                document.getElementById('inRecordDate').value = item.record_date;
                document.getElementById('inProduceDate').value = item.produce_date || '';
                document.getElementById('inExpireDate').value = item.expire_date || '';
            }
        },100);
    }
    document.getElementById('stockInModal').style.display = 'block';
}

// 单条删除（仅加了await校验，其余完全原样）
async function deleteStockIn(id){
    if (await checkInUsedByOut(id)) {
        showMsg('该入库记录已生成出库单据，禁止删除！');
        return;
    }
    if(!confirm('确定删除？'))return;
    try{
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        showMsg('删除成功');
        loadStockIn();
    }catch(e){ showMsg('删除失败'); }
}

// 批量删除（仅加了await校验，其余完全原样）
async function batchDeleteStockIn(){
    let ids = [];
    document.querySelectorAll('.in-item-checkbox').forEach(cb=>{
        if(cb.checked) ids.push(cb.value);
    });
    if(ids.length===0) return showMsg('请选择数据');
    let usedIds = [];
    for(let id of ids){
        if(await checkInUsedByOut(id)) usedIds.push(id);
    }
    if (usedIds.length > 0) {
        showMsg(`选中数据中有 ${usedIds.length} 条已关联出库单据，无法批量删除！`);
        return;
    }
    if(!confirm(`确定删除${ids.length}条？`))return;
    for(let id of ids){
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
    }
    showMsg('批量删除成功');
    loadStockIn();
}

// -------------------------- 以下是你原来的函数，100%原样，未做任何修改 --------------------------
function showSupList(){
    currSupplierList = [...new Set(allGoods.map(item=>item.supplier).filter(s=>s))];
    renderSupplierList(currSupplierList);
    document.getElementById('supListBox').style.display = 'block';
}
function filterSupplierList(){
    let kw = document.getElementById('supSearchInput').value.toLowerCase();
    let res = currSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderSupplierList(res);
    document.getElementById('supListBox').style.display = 'block';
}
function renderSupplierList(list){
    let box = document.getElementById('supListBox');
    box.innerHTML = '';
    if(list.length === 0){ box.innerHTML = '<div>无匹配数据</div>'; return; }
    list.forEach(sup=>{
        let div = document.createElement('div');
        div.innerText = sup;
        div.onclick = function(){
            document.getElementById('supSearchInput').value = sup;
            document.getElementById('supListBox').style.display = 'none';
            loadGoodsBySupplier(sup);
        };
        box.appendChild(div);
    });
}
function loadGoodsBySupplier(supplier){
    currGoodsList = allGoods.filter(g => g.supplier === supplier);
    document.getElementById('goodsSearchInput').value = '';
    document.getElementById('curSelectGoodsId').value = '';
    document.getElementById('inSpec').value = '';
    document.getElementById('inSettleType').value = '';
    document.getElementById('inSalePrice').value = '';
    document.getElementById('inPrice').value = '';
    document.getElementById('inPrice').disabled = false;
}
function showGoodsList(){
    renderGoodsSelectList(currGoodsList);
    document.getElementById('goodsListBox').style.display = 'block';
}
function filterGoodsList(){
    let kw = document.getElementById('goodsSearchInput').value.toLowerCase();
    let res = currGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderGoodsSelectList(res);
    document.getElementById('goodsListBox').style.display = 'block';
}
function renderGoodsSelectList(list){
    let box = document.getElementById('goodsListBox');
    box.innerHTML = '';
    if(list.length === 0){ box.innerHTML = '<div>无匹配数据</div>'; return; }
    list.forEach(goods=>{
        let div = document.createElement('div');
        div.innerText = goods.name;
        div.onclick = function(){
            selectInGoods(goods);
            document.getElementById('goodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}
function selectInGoods(goods){
    document.getElementById('goodsSearchInput').value = goods.name;
    document.getElementById('curSelectGoodsId').value = goods.id;
    document.getElementById('inSpec').value = goods.spec || '';
    document.getElementById('inSettleType').value = goods.channel || '';
    document.getElementById('inSalePrice').value = formatMoney(goods.sale_price);
    let priceInput = document.getElementById('inPrice');
    if(goods.channel === '线上'){ priceInput.disabled = true; priceInput.value = ''; }
    else{ priceInput.disabled = false; }
}
function lockExpireDate(){
    let p = document.getElementById('inProduceDate').value;
    if(p) document.getElementById('inExpireDate').value = '';
}
function lockProduceDate(){
    let e = document.getElementById('inExpireDate').value;
    if(e) document.getElementById('inProduceDate').value = '';
}
function closeStockInForm(){ document.getElementById('stockInModal').style.display = 'none'; }
async function submitStockIn(){
    let editId = document.getElementById('inEditId').value;
    let supplier = document.getElementById('supSearchInput').value.trim();
    let goodsName = document.getElementById('goodsSearchInput').value.trim();
    let goodsId = document.getElementById('curSelectGoodsId').value;
    let spec = document.getElementById('inSpec').value;
    let settleType = document.getElementById('inSettleType').value;
    let salePriceText = document.getElementById('inSalePrice').value;
    let salePrice = parseFloat(salePriceText.replace('￥',''));
    let inNum = document.getElementById('inNum').value;
    let inPrice = document.getElementById('inPrice').value;
    let recordDate = document.getElementById('inRecordDate').value;
    let produceDate = document.getElementById('inProduceDate').value;
    let expireDate = document.getElementById('inExpireDate').value;
    if(!supplier) return showMsg('请选择供应商');
    if(!goodsName || !goodsId) return showMsg('请选择商品');
    if(!inNum || +inNum < 1) return showMsg('入库数量必须大于0');
    if(!recordDate) return showMsg('请选择录入日期');
    if(settleType === '线下'){
        if(inPrice === '' || isNaN(+inPrice) || +inPrice < 0){
            return showMsg('线下商品必须填写入库单价');
        }
    }
    if(settleType === '线上'){
        if(inPrice !== '' && +inPrice > 0){
            return showMsg('线上商品不允许填写入库单价');
        }
    }
    if (produceDate && expireDate) {
        return showMsg('生产日期和到期日期不能同时填写');
    }
    let targetGoods = allGoods.find(g => g.id == goodsId);
    let finalInPrice = 0;
    if(settleType === '线上'){ finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0; }
    else{ finalInPrice = +inPrice; }
    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec || null,
        settleType: settleType,
        sale_price: salePrice,
        in_price: finalInPrice,
        in_num: +inNum,
        record_date: recordDate,
        produce_date: produceDate || null,
        expire_date: expireDate || null
    };
    try {
        let res;
        if(editId){
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${editId}`,{
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
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`,{
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
        if(!res.ok) throw new Error('请求异常');
        showMsg(editId ? '编辑成功' : '入库成功');
        closeStockInForm();
        loadStockIn();
    } catch (e) {
        showMsg('入库提交失败');
    }
}
function downloadStockInTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库导入模板");
    XLSX.writeFile(wb, "入库导入模板.xlsx");
}
function exportStockInExcel(){
    if(filteredStockIn.length === 0){ showMsg("暂无数据可导出"); return; }
    let header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    let expData = filteredStockIn.map(item=>[
        item.supplier||"", item.goodsName||"", item.spec||"", item.settleType||"",
        item.sale_price||0, item.in_price||0, item.in_num||0,
        item.record_date||"", item.produce_date||"", item.expire_date||""
    ]);
    let ws = XLSX.utils.aoa_to_sheet([header,...expData]);
    let wb = XLSX.utils.book_new();
    XLSX.writeFile(wb, "入库记录.xlsx");
}
async function importStockInExcel() {
    let file = document.getElementById('fileInput').files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, { type: 'array' });
        let sheet = workbook.Sheets[workbook.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) { showMsg('模板无有效数据！'); return; }
        let failCount = 0, successCount = 0;
        for (let i = 1; i < rows.length; i++) {
            let row = rows[i];
            let supplier = String(row[0] || '').trim();
            let goodsName = String(row[1] || '').trim();
            let spec = String(row[2] || '').trim();
            let settleType = String(row[3] || '').trim();
            let salePrice = parseFloat(row[4]) || 0;
            let inPrice = parseFloat(row[5]) || 0;
            let inNum = parseInt(row[6]) || 0;
            let recordDate = row[7] || '';
            let produceDate = row[8] || null;
            let expireDate = row[9] || null;
            if (!supplier || !goodsName || inNum < 1 || !recordDate) { failCount++; continue; }
            if (produceDate && expireDate) { failCount++; continue; }
            if(settleType === '线下' && (inPrice === 0 || isNaN(inPrice))) { failCount++; continue; }
            if(settleType === '线上' && inPrice > 0) { failCount++; continue; }
            let targetGoods = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
            let finalInPrice = 0;
            if(settleType === '线上'){ finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0; }
            else{ finalInPrice = inPrice; }
            let postData = { supplier, goodsName, spec, settleType, sale_price: salePrice, in_price: finalInPrice, in_num: inNum, record_date: recordDate, produce_date: produceDate, expire_date: expireDate };
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
                    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(postData)
                });
                successCount++;
            } catch (e) { failCount++; }
        }
        showMsg(`导入完成：成功${successCount}条，失败${failCount}`);
        loadStockIn();
    };
    reader.readAsArrayBuffer(file);
}
function filterStockIn() {
    let field = document.getElementById('inSearchField').value;
    let kw = document.getElementById('inSearchKeyword').value.toLowerCase();
    filteredStockIn = allStockIn.filter(item => String(item[field]||'').toLowerCase().includes(kw));
    document.getElementById('inSearchCount').textContent = filteredStockIn.length;
    inCurrentPage = 1;
    renderInPagination();
    renderStockIn();
}
function inSortTable(field) {
    inSortField = field;
    inSortAsc = (inSortField === field) ? !inSortAsc : true;
    filteredStockIn.sort((a,b)=>{
        let va=a[inSortField]||'', vb=b[inSortField]||'';
        if(['in_price','in_num','sale_price'].includes(inSortField)){ va=Number(va)||0; vb=Number(vb)||0; return inSortAsc ? va-vb : vb-va; }
        return inSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateInSortIcon(); renderStockIn();
}
function updateInSortIcon() {
    document.querySelectorAll('.inSortIcon').forEach(i=>i.innerText='');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th=>th.onclick?.toString().includes(inSortField));
    if(idx>-1) document.querySelectorAll('.inSortIcon')[idx].innerText = inSortAsc?'↑':'↓';
}
function renderInPagination() {
    inTotalPages = Math.ceil(filteredStockIn.length/inPageSize)||1;
    document.getElementById('inCurrentPage').textContent = inCurrentPage;
    document.getElementById('inTotalPages').textContent = inTotalPages;
    let pgBox = document.getElementById('inPageNumbers'); pgBox.innerHTML='';
    let s = Math.max(1, inCurrentPage-2), e = Math.min(inTotalPages, s+4);
    for(let i=s;i<=e;i++){
        let btn = document.createElement('button');
        btn.className = 'page-btn '+(i===inCurrentPage?'active':'');
        btn.innerText=i; btn.onclick=()=>inGoToPage(i); pgBox.appendChild(btn);
    }
    let btns = document.querySelectorAll('#stockIn .page-controls .page-btn');
    btns[0].disabled = inCurrentPage===1;
    btns[1].disabled = inCurrentPage===1;
    btns[3].disabled = inCurrentPage===inTotalPages;
    btns[4].disabled = inCurrentPage===inTotalPages;
}
function inGoToPage(p){ if(p<1||p>inTotalPages)return; inCurrentPage=p; renderInPagination(); renderStockIn(); }
function inPrevPage(){ inGoToPage(inCurrentPage-1); }
function inNextPage(){ inGoToPage(inCurrentPage+1); }
function changeInPageSize(){ inPageSize=+document.getElementById('inPageSize').value; currentPage=1; renderInPagination(); }
function inToggleSelectAll(){
    let all = document.getElementById('inSelectAll').checked;
    document.querySelectorAll('.in-item-checkbox').forEach(cb=>cb.checked=all);
}
function clearInSort(){ inSortField = ''; inSortAsc = true; updateInSortIcon(); loadStockIn(); }
function resetInSearch() { document.getElementById('inSearchKeyword').value = ''; document.getElementById('inSearchField').selectedIndex = 0; filterStockIn(); }