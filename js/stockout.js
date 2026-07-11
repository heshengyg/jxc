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

    // 获取该商品所有业务批次（系统原生分组+按生产日期升序，0下标=最早批次）
    const allBatchList = getStockBatchList(sup, goods.name);
    if(allBatchList.length === 0){
        document.getElementById('outSalePrice').value = "¥0.00";
        document.getElementById('totalStockNum').value = 0;
        return;
    }
    // 最早生产日期业务批次
    const earliestBatch = allBatchList[0];
    const baseGoods = allGoods.find(g => g.id === goods.id);
    let showSalePrice = 0;

    // 兼容到期日期为空场景，无到期日直接判定为“正常”
    let statusKey = "正常";
    if(earliestBatch.produce_date && earliestBatch.expire_date){
        statusKey = calcBzStatus(
            earliestBatch.produce_date,
            earliestBatch.expire_date,
            baseGoods.shelf_life_num,
            baseGoods.shelf_life_unit
        );
    }
    // 严格对齐price_temp_state字段映射
    const statusToField = {
        "正常": "sale_price",
        "过期": "expire_price",
        "discount_1": "discount_1_price",
        "discount_2": "discount_2_price",
        "discount_3": "discount_3_price",
        "discount_4": "discount_4_price"
    };
    const targetField = statusToField[statusKey];
    try{
        // 读取该商品对应档位售价
        const priceRes = await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${baseGoods.id}`,{
            headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
        });
        const priceData = await priceRes.json();
        if(Array.isArray(priceData) && priceData.length > 0){
            const priceRow = priceData[0];
            const rawNum = Number(priceRow[targetField]);
            if(!isNaN(rawNum) && rawNum > 0){
                showSalePrice = rawNum;
            }
        }
    }catch(err){
        console.error("读取折扣售价失败", err);
    }
    // 回填格式化售价
    document.getElementById('outSalePrice').value = formatMoney(showSalePrice);
    // 总库存
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

    // FIFO拆分每条入库单扣减明细（common原生逻辑不动）
    const outDetail = calcFIFOOut(supplier, goodsName, outNum);
    if(outDetail.length === 0) return showMsg('无可用库存批次');

    // 1、获取全部业务批次，构建入库ID → 完整批次+入库单对象映射
    const allBatchList = getStockBatchList(supplier, goodsName);
    const inIdMap = new Map();
    allBatchList.forEach(batch => {
        batch.inRecords.forEach(inRec => {
            // 完整业务唯一键：6项判定条件全部参与拼接
            const fullBatchKey = `${batch.supplier}|${batch.goodsName}|${batch.spec}|${batch.in_price}|${batch.produce_date}|${batch.expire_date}`;
            inIdMap.set(inRec.id, {
                batchKey: fullBatchKey,
                batchInfo: batch,
                sourceInRecord: inRec // 单条入库完整信息，直接取in_price
            });
        });
    });

    // 2、按完整业务批次key分组，不同批次自动拆分独立出库单
    const batchGroupMap = {};
    for(const item of outDetail){
        const rid = item.inRecordId;
        const mapItem = inIdMap.get(rid);
        if(!mapItem) continue;
        const key = mapItem.batchKey;
        const inRec = mapItem.sourceInRecord;
        if(!batchGroupMap[key]){
            batchGroupMap[key] = {
                batchKey: key,
                sourceInRec: inRec,
                totalOutQty: 0,
                detailList: []
            };
        }
        batchGroupMap[key].totalOutQty += item.useNum;
        batchGroupMap[key].detailList.push(item);
    }
    const targetOutBatchList = Object.values(batchGroupMap);
    console.log("待生成出库单据数量（业务批次）：", targetOutBatchList.length);
    if(targetOutBatchList.length === 0) return showMsg('出库明细拆分失败');

    // 3、全局统一销售价（取全商品最早生产日期批次计算）
    const earliestWholeBatch = allBatchList[0];
    const goodsInfo = allGoods.find(g => g.supplier === supplier && g.name === goodsName);
    let globalSalePrice = 0;
    let saleStatus = "正常";
    if(earliestWholeBatch.produce_date && earliestWholeBatch.expire_date){
        saleStatus = calcBzStatus(
            earliestWholeBatch.produce_date,
            earliestWholeBatch.expire_date,
            goodsInfo.shelf_life_num,
            goodsInfo.shelf_life_unit
        );
    }
    const statusFieldMap = {
        "正常": "sale_price",
        "过期": "expire_price",
        "discount_1": "discount_1_price",
        "discount_2": "discount_2_price",
        "discount_3": "discount_3_price",
        "discount_4": "discount_4_price"
    };
    const targetSaleField = statusFieldMap[saleStatus];
    try{
        const priceRes = await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsInfo.id}`,{
            headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
        });
        const priceRows = await priceRes.json();
        if(priceRows.length > 0){
            const priceCfg = priceRows[0];
            const num = Number(priceCfg[targetSaleField]);
            if(!isNaN(num) && num > 0) globalSalePrice = num;
        }
    }catch(err){
        console.error("全局售价读取失败", err);
    }

    // 4、严格串行逐条提交，一条完成再下一条，杜绝并发丢失单据
    let allSubmitSuccess = true;
    for(let i = 0; i < targetOutBatchList.length; i++){
        const batchItem = targetOutBatchList[i];
        const inRec = batchItem.sourceInRec;
        // 出库单价：直接取当前入库单的入库单价 in_price，无多余兜底
        const outSinglePrice = Number(inRec.in_price);
        const outTotalAmount = Number((outSinglePrice * batchItem.totalOutQty).toFixed(2));
        const saleTotalAmount = Number((globalSalePrice * batchItem.totalOutQty).toFixed(2));

        const submitData = {
            supplier,
            goodsName,
            spec,
            settleType,
            outPrice: outSinglePrice,
            salePrice: globalSalePrice,
            outNum: batchItem.totalOutQty,
            outAmount: outTotalAmount,
            saleAmount: saleTotalAmount,
            recordDate,
            inRecordId: inRec.id,
            outDetail: JSON.stringify(batchItem.detailList)
        };
        try{
            console.log(`正在提交第${i+1}张出库单`, submitData);
            const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
                method: "POST",
                headers:{
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify(submitData)
            });
            if(!res.ok){
                const errInfo = await res.json();
                console.error(`第${i+1}张单据提交失败`, errInfo);
                allSubmitSuccess = false;
            }else{
                console.log(`第${i+1}张单据保存成功`);
            }
        }catch(e){
            console.error(`第${i+1}张单据请求异常`, e);
            allSubmitSuccess = false;
        }
    }

    if(allSubmitSuccess){
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