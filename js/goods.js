// 异步调用Supabase RPC：校验商品是否存在入库记录
async function checkGoodsUsedByStockIn(supplier, goodsName, spec) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_goods_stock_in`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                p_supplier: supplier,
                p_goods_name: goodsName,
                p_spec: spec
            })
        });
        return await res.json();
    } catch (err) {
        showMsg("校验状态失败");
        console.error(err);
        return true;
    }
}

// 刷新商品列表
function refreshGoods(){
    loadGoods();
}

// 渠道切换：控制线上成本价、税率、保质期时长、保质期单位输入框禁用/启用
function toggleOnlineCostInput(){
    let channel = document.getElementById('add_channel').value;
    let costInput = document.getElementById('add_online_cost');
    let taxSelect = document.getElementById('add_tax_rate');
    // 保质期两个控件
    let shelfNumInput = document.getElementById('add_shelf_life_num');
    let shelfUnitSelect = document.getElementById('add_shelf_life_unit');

    if(channel === '线下'){
        costInput.disabled = true;
        costInput.value = '';
        // 线下：税率可编辑
        taxSelect.disabled = false;
        // 线下：保质期启用可输入
        shelfNumInput.disabled = false;
        shelfUnitSelect.disabled = false;
    }else{
        costInput.disabled = false;
        // 线上：税率强制禁用，赋值为空字符串""
        taxSelect.disabled = true;
        taxSelect.value = '';
        // 线上：保质期直接禁用，清空内容
        shelfNumInput.disabled = true;
        shelfNumInput.value = '';
        shelfUnitSelect.disabled = true;
        shelfUnitSelect.value = '';
    }
}
function clearSort(){
    sortField = ''; sortAsc = true; updateSortIcon(); loadGoods();
}

async function loadGoods() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        let list = await res.json();
        allGoods = list.sort((a,b) => b.id - a.id);
        // 同步挂载到window，供财务共享数据源
        window.allGoods = allGoods;
        document.getElementById('totalCount').textContent = allGoods.length;
        filterGoods();
        // ✅ 新增：刷新结算类型列表
        if (typeof refreshSettleTypeList === 'function') {
            refreshSettleTypeList();
        }
    } catch (e) {
        showMsg('加载商品失败：' + e.message);
    }
}

function resetSearch() {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchField').selectedIndex = 0;
    filterGoods();
}

function filterGoods() {
    let field = document.getElementById('searchField').value;
    let kw = document.getElementById('searchKeyword').value.toLowerCase();
    filteredGoods = allGoods.filter(item => String(item[field]||'').toLowerCase().includes(kw));
    document.getElementById('searchCount').textContent = filteredGoods.length;
    currentPage = 1;
    renderPagination();
    renderGoods();
}

function sortTable(field) {
    sortField = (sortField === field) ? field : field;
    sortAsc = (sortField === field) ? !sortAsc : true;
    filteredGoods.sort((a,b)=>{
        let va=a[sortField]||'', vb=b[sortField]||'';
        if(['sale_price','online_cost','warn_num','shelf_life_num'].includes(sortField)){
            va=Number(va)||0; vb=Number(vb)||0;
            return sortAsc ? va-vb : vb-va;
        }
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateSortIcon(); renderGoods();
}

function updateSortIcon() {
    document.querySelectorAll('.sort-icon').forEach(i=>i.innerText='');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th=>th.onclick?.toString().includes(sortField));
    if(idx>-1) document.querySelectorAll('.sort-icon')[idx].innerText = sortAsc?'↑':'↓';
}

async function renderGoods() {
    let start = (currentPage-1)*pageSize;
    let pageData = filteredGoods.slice(start, start+pageSize);
    let tb = document.getElementById('goodsList'); tb.innerHTML = '';
    for(let idx = 0; idx < pageData.length; idx++){
        const item = pageData[idx];
        // 保质期：有数值才拼接，无则返回空字符串
        let shelfText = (item.shelf_life_num && item.shelf_life_unit) ? `${item.shelf_life_num}${item.shelf_life_unit}` : '';
        let expire = calculateExpireDays(item.shelf_life_num, item.shelf_life_unit);
        let onlineCost = formatMoney(item.online_cost);
        let isUsed = await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec);
        // 编辑按钮始终可用，删除按钮参照in.js样式置灰
        let delBtn = isUsed 
            ? `<button class="btn btn-danger" disabled style="opacity:0.5">删除</button>`
            : `<button class="btn btn-danger" onclick="deleteGoods(${item.id})">删除</button>`;
        let html = `
            <tr>
                <td><input type="checkbox" class="item-checkbox" value="${item.id}" ${isUsed ? 'disabled' : ''}></td>
                <td>${start+idx+1}</td>
                <td>${item.supplier||''}</td>
                <td>${item.name||''}</td>
                <td>${item.spec||'-'}</td>
                <td>${item.channel||''}</td>
                <td>${formatMoney(item.sale_price)}</td>
                <td>${onlineCost}</td>
                <!-- 修复：税率带%展示 -->
                <td>${item.tax_rate ? item.tax_rate + '%' : ''}</td>
                <!-- 保质期无值直接空白，不再显示“无” -->
                <td>${shelfText}</td>
                <td>${expire}</td>
                <td>${item.warn_num||0}</td>
                <td>
                    <button class="btn btn-primary" onclick="openEditForm(${item.id})">编辑</button>
                    ${delBtn}
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    }
}
function renderPagination() {
    totalPages = Math.ceil(filteredGoods.length / pageSize) || 1;
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;

    let pgBox = document.getElementById('pageNumbers');
    pgBox.innerHTML = '';
    let s = Math.max(1, currentPage - 2);
    let e = Math.min(totalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === currentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => goToPage(i);
        pgBox.appendChild(btn);
    }

    // ✅ 通过位置获取：第一个=首页，第二个=上一页，倒数第二个=下一页，倒数第一个=末页
    let btns = document.querySelectorAll('#goods .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (currentPage === 1);
        btns[1].disabled = (currentPage === 1);
        btns[btns.length - 2].disabled = (currentPage === totalPages);
        btns[btns.length - 1].disabled = (currentPage === totalPages);
    }
}

function goToPage(p){ if(p<1||p>totalPages)return; currentPage=p; renderPagination(); renderGoods(); }
function prevPage(){ goToPage(currentPage-1); }
function nextPage(){ goToPage(currentPage+1); }
function changePageSize(){ pageSize=+document.getElementById('pageSize').value; currentPage=1; renderPagination(); renderGoods(); }

function toggleSelectAll(){
    let all = document.getElementById('selectAll').checked;
    document.querySelectorAll('.item-checkbox').forEach(cb=>cb.checked=all);
}

function openAddForm(){
    document.getElementById('formTitle').innerText='新增商品';
    document.getElementById('editId').value='';
    // 1. 清空所有表单值
    document.querySelectorAll('#formModal .form-group input,#formModal .form-group select').forEach(el=>el.value='');
    // 【关键修复1】每次打开新增，强制把4个基础字段恢复可编辑，清除上次锁定状态
    document.getElementById('add_supplier').disabled = false;
    document.getElementById('add_name').disabled = false;
    document.getElementById('add_spec').disabled = false;
    document.getElementById('add_channel').disabled = false;
    // 2. 执行渠道规则，管控税率、保质期、线上成本价禁用状态
    toggleOnlineCostInput();
    document.getElementById('formModal').style.display='block';
}

async function openEditForm(id){
    let item = allGoods.find(x=>x.id===id); if(!item)return;
    document.getElementById('formTitle').innerText='编辑商品';
    document.getElementById('editId').value=id;
    // 回填表单数据
    document.getElementById('add_supplier').value=item.supplier||'';
    document.getElementById('add_name').value=item.name||'';
    document.getElementById('add_spec').value=item.spec||'';
    document.getElementById('add_channel').value=item.channel||'线上';
    document.getElementById('add_tax_rate').value=item.tax_rate||'';
    document.getElementById('add_sale_price').value=item.sale_price||'';
    document.getElementById('add_online_cost').value=item.online_cost||'';
    document.getElementById('add_warn_num').value=item.warn_num||'';
    document.getElementById('add_shelf_life_num').value=item.shelf_life_num||'';
    document.getElementById('add_shelf_life_unit').value=item.shelf_life_unit||'';

    // 【关键修复2】每次打开编辑，先强制解锁4个基础字段，清除上次遗留的禁用状态
    document.getElementById('add_supplier').disabled = false;
    document.getElementById('add_name').disabled = false;
    document.getElementById('add_spec').disabled = false;
    document.getElementById('add_channel').disabled = false;

    // 执行渠道逻辑：线上自动禁用税率、保质期，解决线上编辑初始没禁用的问题
    toggleOnlineCostInput();

    // ✅ 新增：自动带出结算方式（如果供应商在结算类型中有设置）
    autoFillChannel(item.supplier);

    // 仅当该商品有入库记录时，才重新锁定4个基础字段
    let isUsed = await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec);
    if(isUsed){
        document.getElementById('add_supplier').disabled = true;
        document.getElementById('add_name').disabled = true;
        document.getElementById('add_spec').disabled = true;
        document.getElementById('add_channel').disabled = true;
    }

    document.getElementById('formModal').style.display='block';
}

function closeForm(){ document.getElementById('formModal').style.display='none'; }

// 重复商品校验
function isDuplicate(supplier,name,spec,editId){
    return allGoods.some(item=>{
        if(editId && +item.id===+editId) return false;
        return (item.supplier||'').trim()===supplier.trim()
            && (item.name||'').trim()===name.trim()
            && (item.spec||'').trim()===spec.trim();
    });
}

async function submitForm(){
    let editId = document.getElementById('editId').value;
    let supplier = document.getElementById('add_supplier').value;
    let name = document.getElementById('add_name').value;
    let spec = document.getElementById('add_spec').value;
    let channel = document.getElementById('add_channel').value;
    let taxRate = document.getElementById('add_tax_rate').value;
    let salePrice = document.getElementById('add_sale_price').value;
    let onlineCost = document.getElementById('add_online_cost').value;
    let warnNum = document.getElementById('add_warn_num').value;
    let shelfNum = document.getElementById('add_shelf_life_num').value;
    let shelfUnit = document.getElementById('add_shelf_life_unit').value;
    if(!supplier||!name||!channel||!salePrice) return showMsg('必填项不能为空');
    if(+salePrice<=0) return showMsg('销售单价必须大于0');
    if(isDuplicate(supplier,name,spec,editId)) return showMsg('该供应商下已存在同名同规格商品！');
    let data = {
        supplier: supplier.trim(),
        name: name.trim(),
        spec: spec.trim() || null,
        channel: channel,
        tax_rate: taxRate,
        sale_price: +salePrice,
        online_cost: onlineCost ? +onlineCost : null,
        warn_num: warnNum ? +warnNum : null,
        shelf_life_num: shelfNum ? +shelfNum : null,
        shelf_life_unit: shelfUnit || null
    };
    try{
        if(editId){
            await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${editId}`,{
                method:'PATCH',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json'
                },
                body:JSON.stringify(data)
            });
            showMsg('编辑成功');
        }else{
            await fetch(`${SUPABASE_URL}/rest/v1/goods`,{
                method:'POST',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body:JSON.stringify(data)
            });
            showMsg('新增成功');
        }
        closeForm();
        loadGoods();
        // 同步刷新财务全局商品缓存
        if(typeof loadAllGoods === 'function'){
            await loadAllGoods();
        }
    }catch(e){
        showMsg('操作失败');
    }
}

async function deleteGoods(id){
    let item = allGoods.find(g => g.id === id);
    // 校验是否被入库引用
    if(item && await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec)){
        showMsg('该商品已存在入库记录，禁止删除！');
        return;
    }
    if(!confirm('确定删除？'))return;
    try{
        await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        showMsg('删除成功');
        loadGoods();
        // 同步刷新财务全局商品缓存
        if(typeof loadAllGoods === 'function'){
            await loadAllGoods();
        }
    }catch(e){ showMsg('删除失败'); }
}

async function batchDelete(){
    let ids = [];
    document.querySelectorAll('.item-checkbox').forEach(cb=>ids.push(cb.value));
    if(ids.length===0) return showMsg('请选择数据');
    // 批量校验是否存在已入库商品
    let hasUsed = false;
    for(let id of ids){
        let item = allGoods.find(g => g.id === id);
        if(item && await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec)){
            hasUsed = true;
            break;
        }
    }
    if(hasUsed){
        showMsg('选中商品中存在已录入入库单据的数据，无法批量删除！');
        return;
    }
    if(!confirm(`确定删除${ids.length}条？`))return;
    for(let id of ids){
        await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
    }
    showMsg('批量删除成功');
    loadGoods();
    // 同步刷新财务全局商品缓存
    if(typeof loadAllGoods === 'function'){
        await loadAllGoods();
    }
}

// 商品下载模板
function downloadTemplate(){
    let h = ["供应商","商品名称","规格","销售渠道","销售单价","税率","线上成本价","库存预警阈值","保质期时长","保质期单位"];
    let ws = XLSX.utils.aoa_to_sheet([h]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"模板");
    XLSX.writeFile(wb,"商品导入模板.xlsx");
}

// 商品导出Excel
function exportExcel(){
    if(filteredGoods.length === 0){
        showMsg("暂无数据可导出");
        return;
    }
    let header = ["供应商","商品名称","规格","销售渠道","销售单价","税率","线上成本价","库存预警阈值","保质期"];
    let exportData = filteredGoods.map(item=>{
        let shelf = item.shelf_life_num ? `${item.shelf_life_num}${item.shelf_life_unit||''}` : "";
        return [
            item.supplier||"",
            item.name||"",
            item.spec||"",
            item.channel||"",
            item.sale_price||0,
            item.tax_rate ? item.tax_rate + '%' : "",
            item.online_cost||0,
            item.warn_num||0,
            shelf
        ];
    });
    let ws = XLSX.utils.aoa_to_sheet([header,...exportData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"商品列表");
    XLSX.writeFile(wb,"商品列表.xlsx");
}

// ===================== 结算类型管理 =====================

// 供应商结算方式数据
let settleTypeList = [];
let currentSettleTypeSupplier = '';

/**
 * 刷新结算类型列表
 */
function refreshSettleTypeList() {
    // 按供应商分组，取每个供应商的第一个商品的 channel 作为结算方式
    const supplierMap = new Map();
    allGoods.forEach(item => {
        if (!supplierMap.has(item.supplier)) {
            supplierMap.set(item.supplier, {
                supplier: item.supplier,
                channel: item.channel || '线上',
                count: 0
            });
        }
        const data = supplierMap.get(item.supplier);
        data.count += 1;
        // 如果有多个商品，取最新的 channel（但正常情况下同一供应商结算方式应一致）
        if (item.channel) {
            data.channel = item.channel;
        }
    });
    
    settleTypeList = Array.from(supplierMap.values());
    
    // 渲染表格
    const tbody = document.getElementById('settleTypeList');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (settleTypeList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:10px;">暂无数据</td></tr>';
        return;
    }
    
    settleTypeList.forEach((item, idx) => {
        const channelDisplay = item.channel === '线上' 
            ? '<span style="color:#0066cc;">线上</span>' 
            : '<span style="color:#cc6600;">线下</span>';
        tbody.innerHTML += `
        <tr>
            <td style="padding:6px 10px;border:1px solid #dee2e6;">${idx + 1}</td>
            <td style="padding:6px 10px;border:1px solid #dee2e6;">${item.supplier}</td>
            <td style="padding:6px 10px;border:1px solid #dee2e6;">${channelDisplay}</td>
            <td style="padding:6px 10px;border:1px solid #dee2e6;">${item.count}</td>
            <td style="padding:6px 10px;border:1px solid #dee2e6;">
                <button class="btn btn-primary" onclick="openSettleTypeEdit('${item.supplier}')" style="padding:2px 10px;font-size:12px;">编辑</button>
            </td>
        </tr>`;
    });
}

/**
 * 打开结算方式编辑弹窗
 * @param {string} supplier 供应商名称（可选，不传则弹窗让用户选择）
 */
function openSettleTypeEdit(supplier) {
    if (supplier) {
        // 直接编辑指定供应商
        currentSettleTypeSupplier = supplier;
        const data = settleTypeList.find(item => item.supplier === supplier);
        if (data) {
            document.getElementById('settleTypeSupplier').value = supplier;
            document.getElementById('settleTypeChannel').value = data.channel || '线上';
        }
    } else {
        // 未指定供应商，需要用户选择
        // 构建供应商下拉选择
        const supplierList = settleTypeList.map(item => item.supplier);
        if (supplierList.length === 0) {
            showMsg('暂无供应商数据');
            return;
        }
        // 用 prompt 让用户选择（简单实现，也可以做成下拉弹窗）
        // 这里直接用弹窗方式
        showMsg('请点击表格中的"编辑"按钮选择具体供应商');
        return;
    }
    document.getElementById('settleTypeModal').style.display = 'block';
}

/**
 * 关闭结算方式编辑弹窗
 */
function closeSettleTypeModal() {
    document.getElementById('settleTypeModal').style.display = 'none';
}

/**
 * 保存结算方式
 */
async function saveSettleType() {
    const supplier = document.getElementById('settleTypeSupplier').value.trim();
    const channel = document.getElementById('settleTypeChannel').value;
    
    if (!supplier) {
        showMsg('请选择供应商');
        return;
    }
    
    // 确认修改
    if (!confirm(`确定将供应商 "${supplier}" 的结算方式修改为 "${channel}" 吗？\n该操作将同时更新该供应商下所有商品的结算方式。`)) {
        return;
    }
    
    try {
        // 批量更新该供应商下所有商品的 channel
        const goodsList = allGoods.filter(item => item.supplier === supplier);
        
        if (goodsList.length === 0) {
            showMsg('该供应商下没有商品');
            return;
        }
        
        let successCount = 0;
        for (let goods of goodsList) {
            const updateData = { channel: channel };
            // 如果改为线上，清空线上成本价的禁用状态不影响数据，但保留字段
            const res = await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${goods.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            if (res.ok) {
                successCount++;
            }
        }
        
        closeSettleTypeModal();
        showMsg(`结算方式更新成功！共更新 ${successCount} 个商品`);
        
        // 刷新商品列表和结算类型列表
        await loadGoods();
        refreshSettleTypeList();
        
        // 同步刷新财务模块的商品数据
        if (typeof loadAllGoods === 'function') {
            await loadAllGoods();
        }
        
    } catch (e) {
        showMsg('更新失败：' + e.message);
    }
}

/**
 * 初始化结算类型列表（在页面加载时调用）
 */
function initSettleTypeList() {
    refreshSettleTypeList();
}

// ===================== 供应商下拉选择（用于新增/编辑商品） =====================
let currSupplierList = [];

function showSupplierSelectList() {
    // 从所有商品中获取供应商列表
    currSupplierList = [...new Set(allGoods.map(item => item.supplier).filter(Boolean))];
    renderSupplierSelectList(currSupplierList);
    document.getElementById('supplierSelectListBox').style.display = 'block';
}

function filterSupplierSelectList() {
    const kw = document.getElementById('add_supplier').value.toLowerCase();
    const filterList = currSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderSupplierSelectList(filterList);
    document.getElementById('supplierSelectListBox').style.display = 'block';
}

function renderSupplierSelectList(list) {
    const box = document.getElementById('supplierSelectListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#666;">无匹配数据</div>';
        return;
    }
    list.forEach(s => {
        const div = document.createElement('div');
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.innerText = s;
        div.onclick = function() {
            document.getElementById('add_supplier').value = s;
            document.getElementById('supplierSelectListBox').style.display = 'none';
            // 自动带出结算方式
            autoFillChannel(s);
        };
        box.appendChild(div);
    });
}

function autoFillChannel(supplier) {
    // 从结算类型中查找该供应商的结算方式
    const settleData = settleTypeList.find(item => item.supplier === supplier);
    if (settleData) {
        document.getElementById('add_channel').value = settleData.channel || '线上';
        toggleOnlineCostInput();
    }
}

// 点击空白关闭下拉（注意：这里不要重复绑定，如果已存在可跳过）
// 但为了确保功能，添加到已有的 document.addEventListener 中或单独添加

// 如果 goods.js 中没有 document.addEventListener，添加这个
// 如果已有，将下面的逻辑合并到已有的监听中
document.addEventListener('click', function(e) {
    if (!e.target.closest('#add_supplier') && !e.target.closest('#supplierSelectListBox')) {
        document.getElementById('supplierSelectListBox').style.display = 'none';
    }
});