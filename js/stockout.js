// ===================== 出库模块 - 纯业务函数 =====================
let outCurrSupplierList = [];
let outCurrGoodsList = [];
// ========== 出库筛选数据 ==========
let outFilterData = {
    supplier: [],
    goodsName: [],
    settleType: ['线上', '线下']  // 结算方式固定
};
// 刷新出库列表
function refreshStockOut(){
    loadStockOut();
}

// ========== 出库筛选下拉 ==========
function initOutFilterData() {
    if (!allStockOut || allStockOut.length === 0) return;
    outFilterData.supplier = [...new Set(allStockOut.map(item => item.supplier).filter(s => s))].sort();
    outFilterData.goodsName = [...new Set(allStockOut.map(item => item.goodsName).filter(n => n))].sort();
}

function showOutFilterList(type) {
    const listId = `outFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    const inputId = `outFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderOutFilterList(type, kw);
    box.style.display = 'block';
}

function filterOutFilterList(type) {
    const inputId = `outFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderOutFilterList(type, kw);
    const listId = `outFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (box) box.style.display = 'block';
}

function renderOutFilterList(type, keyword = '') {
    const listId = `outFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    let data = outFilterData[type] || [];
    if (keyword) {
        data = data.filter(item => item.toLowerCase().includes(keyword));
    }
    box.innerHTML = '';
    if (data.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配</div>';
        return;
    }
    data.forEach(opt => {
        const div = document.createElement('div');
        div.style.padding = '4px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.textContent = opt;
        div.onclick = function() {
            const inputId = `outFilter${capitalize(type)}Input`;
            document.getElementById(inputId).value = opt;
            box.style.display = 'none';
            filterStockOut();
        };
        box.appendChild(div);
    });
}

function resetOutSearch() {
    document.getElementById('outFilterSupplierInput').value = '';
    document.getElementById('outFilterGoodsNameInput').value = '';
    document.getElementById('outFilterSettleTypeInput').value = '';
    // 关闭所有下拉
    document.querySelectorAll('[id^="outFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterStockOut();
}

// ========== 出库实时搜索（输入即搜索） ==========
function onOutFilterInput() {
    filterStockOut();
    // 实时更新下拉列表
    const supplierInput = document.getElementById('outFilterSupplierInput');
    const goodsInput = document.getElementById('outFilterGoodsNameInput');
    const settleInput = document.getElementById('outFilterSettleTypeInput');
    
    if (document.activeElement === supplierInput) {
        renderOutFilterList('supplier', supplierInput.value.trim());
        const list = document.getElementById('outFilterSupplierList');
        if (list) list.style.display = 'block';
    } else if (document.activeElement === goodsInput) {
        renderOutFilterList('goodsName', goodsInput.value.trim());
        const list = document.getElementById('outFilterGoodsNameList');
        if (list) list.style.display = 'block';
    } else if (document.activeElement === settleInput) {
        renderOutFilterList('settleType', settleInput.value.trim());
        const list = document.getElementById('outFilterSettleTypeList');
        if (list) list.style.display = 'block';
    }
}

// 供应商下拉
// 修改为（增加异步判断）
async function showOutSupList(){
    if(!allStockIn || allStockIn.length === 0){
        await loadStockIn();
    }
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
// 根据供应商加载对应商品（已修复重复问题，其余逻辑完全不变）
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

// 选择商品，自动带出字段 + 加载总库存（仅修改这一处）
async function selectOutGoods(goods){
    const supInput = document.getElementById('outSupSearchInput');
    const sup = supInput.value.trim();
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.settleType || '';
    document.getElementById('outCurGoodsId').value = goods.id;

    const allStockBatch = allStockIn.filter(row => row.supplier === sup && row.goodsName === goods.name);
    allStockBatch.sort((a,b)=>Number(a.id)-Number(b.id));
    const earliestIn = allStockBatch[0];
    const baseGoods = allGoods.find(g => g.id === goods.id);
    // 强制兜底商品原价
    let showSalePrice = Number(baseGoods?.sale_price || 0);

    if(baseGoods && earliestIn){
        let bzStatus = "正常";
        // 到期日为空直接走正常价，不进入计算避免报错
        if(earliestIn.produce_date && earliestIn.expire_date){
            bzStatus = calcBzStatus(
                earliestIn.produce_date,
                earliestIn.expire_date,
                baseGoods.shelf_life_num,
                baseGoods.shelf_life_unit
            );
        }
        const fieldMap = {
            "正常":"sale_price",
            "过期":"expire_price",
            "discount_1":"discount_1_price",
            "discount_2":"discount_2_price",
            "discount_3":"discount_3_price",
            "discount_4":"discount_4_price"
        };
        const targetField = fieldMap[bzStatus] || "sale_price";
        try{
            const priceRes = await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${baseGoods.id}`,{
                headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
            });
            const priceList = await priceRes.json();
            if(priceList && priceList.length > 0){
                const priceRule = priceList[0];
                const tempP = Number(priceRule[targetField]);
                // 读取失败/空值 自动回退商品原价
                if(!isNaN(tempP) && tempP > 0){
                    showSalePrice = tempP;
                }
            }
        }catch(e){
            console.log('价格接口异常，使用原价',e);
        }
    }
    document.getElementById('outSalePrice').value = formatMoney(showSalePrice);
    const totalStock = getTotalStockNum(sup, goods.name);
    document.getElementById('totalStockNum').value = totalStock;
}
// 出库数量实时库存校验
function checkStockNum(){
    let totalStock = Number(document.getElementById('totalStockNum').value) || 0;
    let outNum = Number(document.getElementById('outNum').value) || 0;
    if(outNum > totalStock && totalStock > 0){
        showMsg(`库存不足！当前可用库存：${totalStock}`);
    }
}

// 打开新增出库弹窗（已移除编辑逻辑，仅保留新增）
function openStockOutForm(){
    document.getElementById('outEditId').value = '';
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

    // 关闭下拉列表
    const supBox = document.getElementById('outSupListBox');
    if (supBox) supBox.style.display = 'none';
    const goodsBox = document.getElementById('outGoodsListBox');
    if (goodsBox) goodsBox.style.display = 'none';
    
    // 清空商品列表缓存
    outCurrGoodsList = [];

    document.getElementById('stockOutModal').style.display = 'block';
}
function closeStockOutForm(){
    // 关闭时隐藏下拉
    const supBox = document.getElementById('outSupListBox');
    if (supBox) supBox.style.display = 'none';
    const goodsBox = document.getElementById('outGoodsListBox');
    if (goodsBox) goodsBox.style.display = 'none';
    document.getElementById('stockOutModal').style.display = 'none';
}
// 提交出库（改造：多单价自动拆分为多条出库记录，原有逻辑全部保留）
async function submitStockOut(){
    const supplier = document.getElementById('outSupSearchInput').value.trim();
    const goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    const spec = document.getElementById('outSpec').value || '';
    const settleType = document.getElementById('outSettleType').value || '';
    const outNum = Number(document.getElementById('outNum').value) || 0;
    const recordDate = document.getElementById('outRecordDate').value;

    // 基础校验
    if(!supplier) return showMsg('请选择供应商');
    if(!goodsName) return showMsg('请选择商品');
    if(outNum < 1) return showMsg('出库数量必须大于0');
    if(!recordDate) return showMsg('请选择录入日期');

    const totalStock = getTotalStockNum(supplier, goodsName);
    if(outNum > totalStock){
        return showMsg(`库存不足！当前可用库存：${totalStock}`);
    }

    // FIFO拆分
    const outDetail = calcFIFOOut(supplier, goodsName, outNum);
    console.log("【FIFO明细】", outDetail);
    if(outDetail.length === 0) return showMsg('无可用库存批次');

    // 提取所有入库id
    const allUsedInRecordIds = Array.from(new Set(outDetail.map(item => item.inRecordId)));
    allUsedInRecordIds.sort((a,b)=>Number(a)-Number(b));
    console.log("所有参与出库入库ID数组：", allUsedInRecordIds, "长度：", allUsedInRecordIds.length);
    const firstInId = allUsedInRecordIds[0];
    const firstInRecord = allStockIn.find(r => r.id === firstInId);
    const goodsInfo = allGoods.find(g => g.supplier === supplier && g.name === goodsName);
    let globalSalePrice = Number(goodsInfo?.sale_price || 0);

    // 价格计算兜底空日期
    if(goodsInfo && firstInRecord){
        let bzStatus = "正常";
        if(firstInRecord.produce_date && firstInRecord.expire_date){
            bzStatus = calcBzStatus(
                firstInRecord.produce_date,
                firstInRecord.expire_date,
                goodsInfo.shelf_life_num,
                goodsInfo.shelf_life_unit
            );
        }
        const fieldMap = {
            "正常":"sale_price",
            "过期":"expire_price",
            "discount_1":"discount_1_price",
            "discount_2":"discount_2_price",
            "discount_3":"discount_3_price",
            "discount_4":"discount_4_price"
        };
        const targetField = fieldMap[bzStatus] || "sale_price";
        try{
            const priceRes = await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsInfo.id}`,{
                headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
            });
            const priceList = await priceRes.json();
            if(priceList && priceList.length > 0){
                const priceRule = priceList[0];
                const tempP = Number(priceRule[targetField]);
                if(!isNaN(tempP) && tempP > 0){
                    globalSalePrice = tempP;
                }
            }
        }catch(err){
            console.warn('读取折扣价失败，使用商品原价',err);
        }
    }

    // 按入库ID分组
    const batchGroup = {};
    for(const item of outDetail){
        const rid = item.inRecordId;
        if(!batchGroup[rid]){
            const inRec = allStockIn.find(r => r.id === rid);
            batchGroup[rid] = { rid, totalUse:0, details:[], sourceIn:inRec };
        }
        batchGroup[rid].totalUse += item.useNum;
        batchGroup[rid].details.push(item);
    }
    const batchArr = Object.values(batchGroup);
    console.log("最终要生成出库条数：", batchArr.length, batchArr);
    if(batchArr.length === 0) return showMsg('出库明细拆分失败');

    // 关键：串行循环，等待一条插入完成再执行下一条，禁止并发
    let allSuccess = true;
    for(let i = 0; i < batchArr.length; i++){
        const batch = batchArr[i];
        const sourceIn = batch.sourceIn;
        // 每条独立出库单价
        let singleOutPrice = 0;
        if(settleType === '线上'){
            singleOutPrice = Number(goodsInfo?.online_cost || 0);
        }else{
            singleOutPrice = Number(sourceIn?.in_price || 0);
        }
        const outAmount = Number((singleOutPrice * batch.totalUse).toFixed(2));
        const saleAmount = Number((globalSalePrice * batch.totalUse).toFixed(2));
        const postData = {
            supplier,goodsName,spec,settleType,
            outPrice: singleOutPrice,
            salePrice: globalSalePrice,
            outNum: batch.totalUse,
            outAmount,
            saleAmount,
            recordDate,
            inRecordId: batch.rid,
            outDetail: JSON.stringify(batch.details)
        };
        try{
            console.log(`正在插入第${i+1}条出库单据`, postData);
            const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
                method:'POST',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body: JSON.stringify(postData)
            });
            if(!res.ok){
                const err = await res.json();
                console.error(`第${i+1}条插入失败`,err);
                allSuccess = false;
            }else{
                console.log(`第${i+1}条插入成功`);
            }
        }catch(e){
            console.error(`第${i+1}请求异常`,e);
            allSuccess = false;
        }
    }

    if(allSuccess){
        showMsg('出库提交成功');
    }else{
        showMsg('部分批次出库提交失败，请打开控制台查看日志');
    }
    closeStockOutForm();
    loadStockOut();
    loadStockIn();
}

// 导出/导入/模板、分页、排序、删除 等通用功能
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
        const fetchAll = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allData = await fetchAll.json();
        allStockOut = allData;
        initOutFilterData();
        window.allStockOut = allData;   // ✅ 新增：暴露到全局，供财务模块使用
        document.getElementById('outTotalCount').textContent = allData.length;
        outCurrentPage = 1;
        filterStockOut();
    } catch (e) {
        showMsg('加载出库记录失败：' + e.message);
    }
}
// 搜索筛选
function filterStockOut() {
    const supplier = document.getElementById('outFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('outFilterGoodsNameInput')?.value.trim() || '';
    const settleType = document.getElementById('outFilterSettleTypeInput')?.value.trim() || '';

    if (!allStockOut || !Array.isArray(allStockOut)) {
        filteredStockOut = [];
    } else {
        filteredStockOut = allStockOut.filter(item => {
            let match = true;
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (settleType && !(item.settleType || '').toLowerCase().includes(settleType.toLowerCase())) match = false;
            return match;
        });
    }

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

// 渲染表格（已删除编辑按钮，仅保留删除按钮）
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
    outTotalPages = Math.ceil(filteredStockOut.length / outPageSize) || 1;
    document.getElementById('outCurrentPage').textContent = outCurrentPage;
    document.getElementById('outTotalPages').textContent = outTotalPages;

    let pgBox = document.getElementById('outPageNumbers');
    pgBox.innerHTML = '';
    let s = Math.max(1, outCurrentPage - 2);
    let e = Math.min(outTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === outCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => outGoToPage(i);
        pgBox.appendChild(btn);
    }

    let btns = document.querySelectorAll('#stockOut .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (outCurrentPage === 1);
        btns[1].disabled = (outCurrentPage === 1);
        btns[btns.length - 2].disabled = (outCurrentPage === outTotalPages);
        btns[btns.length - 1].disabled = (outCurrentPage === outTotalPages);
    }
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

// 单条删除出库
async function deleteStockOut(id) {
    // ===== 检查是否管理员 =====
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除出库记录');
        return;
    }
    if (!confirm('确定删除？')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        showMsg('删除成功');
        loadStockOut();
        loadStockIn();
    } catch (e) {
        showMsg('删除失败');
    }
}
// 批量删除出库
async function batchDeleteStockOut() {
    // ===== 检查是否管理员 =====
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以批量删除出库记录');
        return;
    }
    let ids = [];
    document.querySelectorAll('.out-item-checkbox:checked').forEach(cb => ids.push(cb.value));
    if (ids.length === 0) return showMsg('请选择数据');
    if (!confirm(`确定删除${ids.length}条？`)) return;
    for (let id of ids) {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
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

// ===== 全局点击关闭下拉列表（出库模块） =====
(function() {
    if (window._stockOutClickOutsideBound) return;
    window._stockOutClickOutsideBound = true;
    document.addEventListener('click', function(e) {
        // 供应商下拉
        const supInput = document.getElementById('outSupSearchInput');
        const supList = document.getElementById('outSupListBox');
        if (supList && supList.style.display === 'block') {
            if (supInput && !supInput.contains(e.target) && !supList.contains(e.target)) {
                supList.style.display = 'none';
            }
        }
        // 商品下拉
        const goodsInput = document.getElementById('outGoodsSearchInput');
        const goodsList = document.getElementById('outGoodsListBox');
        if (goodsList && goodsList.style.display === 'block') {
            if (goodsInput && !goodsInput.contains(e.target) && !goodsList.contains(e.target)) {
                goodsList.style.display = 'none';
            }
        }
    });
})();

// ===== 全局点击关闭下拉列表（出库筛选） =====
document.addEventListener('click', function(e) {
    const listIds = [
        'outFilterSupplierList',
        'outFilterGoodsNameList',
        'outFilterSettleTypeList'
    ];
    listIds.forEach(id => {
        const box = document.getElementById(id);
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${id.replace('List', 'Input')}`)) {
            box.style.display = 'none';
        }
    });
});
window.resetOutSearch = resetOutSearch;