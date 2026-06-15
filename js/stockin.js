// ===================== 入库模块 - 纯业务函数 =====================

// ===================== 入库模块 - 纯业务函数 =====================

/**
 * 【前端校验】校验当前入库ID是否被出库引用（原有逻辑保留）
 * @param {number|string} inId 入库单ID
 * @returns {boolean} true=已被引用(禁止操作)  false=未引用(可操作)
 */
function checkInUsedByOut(inId) {
    if (!inId) return false;
    return allStockOut.some(outItem => Number(outItem.inRecordId) === Number(inId));
}

/**
 * 【新增】后端校验入库ID是否被出库引用
 * @param {number|string} inId 入库单ID
 * @returns {Promise<boolean>} true=已被引用 false=未引用
 */
async function checkInUsedByOutBackend(inId) {
    if (!inId) return false;
    try {
        // 调用后端接口校验（需替换为实际后端校验接口地址）
        const res = await fetch(`${SUPABASE_URL}/rest/v1/check_stock_in_used?inId=eq.${inId}`, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error('后端校验请求失败');
        const data = await res.json();
        // 假设后端返回 { isUsed: true/false } 格式，根据实际返回调整
        return data.isUsed || false;
    } catch (e) {
        console.error('后端校验入库单引用状态失败：', e);
        // 后端请求失败时，降级使用前端校验结果
        return checkInUsedByOut(inId);
    }
}

// 打开添加入库弹窗（新增后端校验）
async function openStockInForm(id=null) {
    // 原有前端校验（快速提示）
    if (id && checkInUsedByOut(id)) {
        showMsg('该入库记录已生成出库单据，禁止编辑！');
        return;
    }

    // 【新增】后端校验（兜底）
    if (id) {
        const isUsed = await checkInUsedByOutBackend(id);
        if (isUsed) {
            showMsg('该入库记录已生成出库单据，禁止编辑！');
            return;
        }
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

// 单条删除（新增后端校验）
async function deleteStockIn(id){
    // 原有前端校验（快速提示）
    if (checkInUsedByOut(id)) {
        showMsg('该入库记录已生成出库单据，禁止删除！');
        return;
    }

    // 【新增】后端校验（兜底）
    const isUsed = await checkInUsedByOutBackend(id);
    if (isUsed) {
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

// 批量删除（新增后端校验）
async function batchDeleteStockIn(){
    let ids = [];
    document.querySelectorAll('.in-item-checkbox').forEach(cb=>{
        if(cb.checked) ids.push(cb.value);
    });
    if(ids.length===0) return showMsg('请选择数据');

    // 原有前端校验（快速提示）
    let usedIds = ids.filter(id => checkInUsedByOut(id));
    if (usedIds.length > 0) {
        showMsg(`选中数据中有 ${usedIds.length} 条已关联出库单据，无法批量删除！`);
        return;
    }

    // 【新增】后端批量校验（兜底）
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/batch_check_stock_in_used`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error('后端批量校验失败');
        const data = await res.json();
        // 假设后端返回 { usedIds: [1,2,3] } 格式，根据实际返回调整
        const backendUsedIds = data.usedIds || [];
        if (backendUsedIds.length > 0) {
            showMsg(`选中数据中有 ${backendUsedIds.length} 条已关联出库单据，无法批量删除！`);
            return;
        }
    } catch (e) {
        console.error('后端批量校验入库单引用状态失败：', e);
        showMsg('批量删除前校验失败，请重试！');
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

// 其余原有代码（未改动）保持不变...
// 刷新入库列表
function refreshStockIn(){
    loadStockIn();
}

// 供应商下拉
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
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
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

// 商品下拉
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
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
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
    if(goods.channel === '线上'){
        priceInput.disabled = true;
        priceInput.value = '';
    }else{
        priceInput.disabled = false;
    }
}

// 日期互斥
function lockExpireDate(){
    let p = document.getElementById('inProduceDate').value;
    if(p) document.getElementById('inExpireDate').value = '';
}
function lockProduceDate(){
    let e = document.getElementById('inExpireDate').value;
    if(e) document.getElementById('inProduceDate').value = '';
}

// 打开添加入库弹窗
function openStockInForm(id=null){
    // 编辑前校验：已被出库引用则禁止编辑
    if (id && checkInUsedByOut(id)) {
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

function closeStockInForm(){
    document.getElementById('stockInModal').style.display = 'none';
}

// 提交入库
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

    // ========== 【唯一改动1】线上取商品档案的线上成本价，线下取手动输入单价 ==========
    let targetGoods = allGoods.find(g => g.id == goodsId);
    let finalInPrice = 0;
    if(settleType === '线上'){
        finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
    }else{
        finalInPrice = +inPrice;
    }

    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec || null,
        settleType: settleType,
        sale_price: salePrice,
        in_price: finalInPrice,  // 使用计算后的最终单价
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

// 下载导入模板
function downloadStockInTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库导入模板");
    XLSX.writeFile(wb, "入库导入模板.xlsx");
}

// 导出Excel
function exportStockInExcel(){
    if(filteredStockIn.length === 0){
        showMsg("暂无数据可导出");
        return;
    }
    let header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    let expData = filteredStockIn.map(item=>[
        item.supplier||"",
        item.goodsName||"",
        item.spec||"",
        item.settleType||"",
        item.sale_price||0,
        item.in_price||0,
        item.in_num||0,
        item.record_date||"",
        item.produce_date||"",
        item.expire_date||""
    ]);
    let ws = XLSX.utils.aoa_to_sheet([header,...expData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库记录");
    XLSX.writeFile(wb, "入库记录.xlsx");
}

// Excel导入
async function importStockInExcel() {
    let file = document.getElementById('fileInput').files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, { type: 'array' });
        let sheet = workbook.Sheets[workbook.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) {
            showMsg('模板无有效数据！');
            return;
        }
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

            // ========== 【唯一改动2】导入逻辑同步规则：线上取商品线上成本价 ==========
            let targetGoods = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
            let finalInPrice = 0;
            if(settleType === '线上'){
                finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
            }else{
                finalInPrice = inPrice;
            }

            let postData = {
                supplier, goodsName, spec, settleType,
                sale_price: salePrice,
                in_price: finalInPrice,
                in_num: inNum,
                record_date: recordDate,
                produce_date: produceDate,
                expire_date: expireDate
            };

            try {
                await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
                    method: 'POST',
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(postData)
                });
                successCount++;
            } catch (e) {
                failCount++;
            }
        }
        showMsg(`导入完成：成功${successCount}条，失败${failCount}条`);
        loadStockIn();
    };
    reader.readAsArrayBuffer(file);
}

// 加载入库列表
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

// 搜索筛选
function filterStockIn() {
    let field = document.getElementById('inSearchField').value;
    let kw = document.getElementById('inSearchKeyword').value.toLowerCase();
    filteredStockIn = allStockIn.filter(item => String(item[field]||'').toLowerCase().includes(kw));
    document.getElementById('inSearchCount').textContent = filteredStockIn.length;
    inCurrentPage = 1;
    renderInPagination();
    renderStockIn();
}

// 列表排序
function inSortTable(field) {
    inSortField = field;
    inSortAsc = (inSortField === field) ? !inSortAsc : true;
    filteredStockIn.sort((a,b)=>{
        let va=a[inSortField]||'', vb=b[inSortField]||'';
        if(['in_price','in_num','sale_price'].includes(inSortField)){
            va=Number(va)||0; vb=Number(vb)||0;
            return inSortAsc ? va-vb : vb-va;
        }
        return inSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateInSortIcon(); renderStockIn();
}

function updateInSortIcon() {
    document.querySelectorAll('.inSortIcon').forEach(i=>i.innerText='');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th=>th.onclick?.toString().includes(inSortField));
    if(idx>-1) document.querySelectorAll('.inSortIcon')[idx].innerText = inSortAsc?'↑':'↓';
}

// 渲染入库表格（修复DOM不存在报错 + 已引用出库则按钮置灰）
function renderStockIn() {
    let start = (inCurrentPage-1)*inPageSize;
    let pageData = filteredStockIn.slice(start, start+inPageSize);
    let tb = document.getElementById('stockInList'); 
    if (!tb) {
        console.error('找不到入库列表DOM元素 #stockInList');
        return; // 找不到元素直接返回，不执行渲染
    }
    tb.innerHTML = '';

    // 缓存批次列表，避免重复计算
    let goodsSet = new Set(pageData.map(item => `${item.supplier}_${item.goodsName}`));
    let batchCache = {};
    goodsSet.forEach(key => {
        let [supplier, goodsName] = key.split('_');
        batchCache[key] = getStockBatchList(supplier, goodsName);
    });

    pageData.forEach((item, idx) => {
        let batchList = batchCache[`${item.supplier}_${item.goodsName}`];
        let batch = batchList.find(b => 
            b.inRecords.some(inItem => inItem.id === item.id)
        );
        let batchRemain = batch ? batch.batchRemain : 0;
        let totalStock = getTotalStockNum(item.supplier, item.goodsName);
        let amount = formatMoney((item.in_price || 0) * item.in_num);

        // 判断是否被出库引用，控制按钮状态
        let isUsed = checkInUsedByOut(item.id);
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
    });
}
// 分页渲染
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
function changeInPageSize(){ inPageSize=+document.getElementById('inPageSize').value; inCurrentPage=1; renderInPagination(); renderStockIn(); }

// 全选
function inToggleSelectAll(){
    let all = document.getElementById('inSelectAll').checked;
    document.querySelectorAll('.in-item-checkbox').forEach(cb=>cb.checked=all);
}

// 单条删除
async function deleteStockIn(id){
    // 删除前校验：已被出库引用禁止删除
    if (checkInUsedByOut(id)) {
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

// 批量删除
async function batchDeleteStockIn(){
    let ids = [];
    document.querySelectorAll('.in-item-checkbox').forEach(cb=>{
        if(cb.checked) ids.push(cb.value);
    });
    if(ids.length===0) return showMsg('请选择数据');

    // 批量校验：存在已引用单据则整体拦截
    let usedIds = ids.filter(id => checkInUsedByOut(id));
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

// 清空排序、重置搜索
function clearInSort(){
    inSortField = ''; inSortAsc = true; updateInSortIcon(); loadStockIn();
}
function resetInSearch() {
    document.getElementById('inSearchKeyword').value = '';
    document.getElementById('inSearchField').selectedIndex = 0;
    filterStockIn();
}