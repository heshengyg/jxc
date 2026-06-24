// ========== 结算类型相关全局变量 ==========
let settleData = [];          // 所有结算类型数据
let filteredSettle = [];      // 筛选后的结算类型
let settleCurrentPage = 1;
let settlePageSize = 10;
let settleTotalPages = 1;

// ========== 商品子Tab切换 ==========
function switchGoodsSubTab(tab) {
    // 切换按钮样式
    document.querySelectorAll('#goods .finance-sub-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`#goods .finance-sub-btn[data-tab="${tab}"]`).classList.add('active');
    // 切换内容
    document.querySelectorAll('#goods .finance-sub-content').forEach(div => div.style.display = 'none');
    document.getElementById(`sub-${tab}`).style.display = 'block';
    
    // 加载对应数据
    if (tab === 'settleType') {
        loadSettleList();
    } else if (tab === 'goodsInfo') {
        loadGoods();
    }
}
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
        window.allGoods = allGoods;
        document.getElementById('totalCount').textContent = allGoods.length;
        filterGoods();
        // 同时加载结算类型
        loadSettleList();
    } catch (e) {
        showMsg('加载商品失败：' + e.message);
    }
}

// 加载供应商下拉列表（从结算类型中获取）
function loadSupplierSelect() {
    let select = document.getElementById('add_supplier');
    select.innerHTML = '<option value="">请选择供应商</option>';
    // 从settleData中获取供应商列表
    let suppliers = settleData.map(s => s.supplier);
    suppliers.forEach(sup => {
        let opt = document.createElement('option');
        opt.value = sup;
        opt.textContent = sup;
        select.appendChild(opt);
    });
}

// 供应商变更时自动带出结算方式
function onSupplierChange() {
    let supplier = document.getElementById('add_supplier').value;
    let channelInput = document.getElementById('add_channel');
    if (supplier) {
        let found = settleData.find(s => s.supplier === supplier);
        channelInput.value = found ? found.channel : '';
        // 根据渠道禁用/启用线上成本价
        toggleOnlineCostInput();
    } else {
        channelInput.value = '';
    }
}

// 重写 openAddForm
function openAddForm() {
    document.getElementById('formTitle').innerText = '新增商品';
    document.getElementById('editId').value = '';
    // 清空所有表单值
    document.querySelectorAll('#formModal .form-group input,#formModal .form-group select').forEach(el => {
        if (el.id !== 'add_supplier') el.value = '';
    });
    // 加载供应商下拉
    loadSupplierSelect();
    // 清空渠道
    document.getElementById('add_channel').value = '';
    // 启用所有可编辑字段
    document.getElementById('add_supplier').disabled = false;
    document.getElementById('add_name').disabled = false;
    document.getElementById('add_spec').disabled = false;
    document.getElementById('add_channel').disabled = true;  // 只读
    toggleOnlineCostInput();
    document.getElementById('formModal').style.display = 'block';
}

// 重写 openEditForm
async function openEditForm(id) {
    let item = allGoods.find(x => x.id === id);
    if (!item) return;
    document.getElementById('formTitle').innerText = '编辑商品';
    document.getElementById('editId').value = id;
    
    // 加载供应商下拉
    loadSupplierSelect();
    document.getElementById('add_supplier').value = item.supplier || '';
    document.getElementById('add_name').value = item.name || '';
    document.getElementById('add_spec').value = item.spec || '';
    document.getElementById('add_channel').value = item.channel || '';
    document.getElementById('add_tax_rate').value = item.tax_rate || '';
    document.getElementById('add_sale_price').value = item.sale_price || '';
    document.getElementById('add_online_cost').value = item.online_cost || '';
    document.getElementById('add_warn_num').value = item.warn_num || '';
    document.getElementById('add_shelf_life_num').value = item.shelf_life_num || '';
    document.getElementById('add_shelf_life_unit').value = item.shelf_life_unit || '';

    document.getElementById('add_supplier').disabled = false;
    document.getElementById('add_name').disabled = false;
    document.getElementById('add_spec').disabled = false;
    document.getElementById('add_channel').disabled = true;  // 只读

    toggleOnlineCostInput();

    // 如果该商品有入库记录，锁定基础字段
    let isUsed = await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec);
    if (isUsed) {
        document.getElementById('add_supplier').disabled = true;
        document.getElementById('add_name').disabled = true;
        document.getElementById('add_spec').disabled = true;
    }

    document.getElementById('formModal').style.display = 'block';
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

async function submitForm() {
    let editId = document.getElementById('editId').value;
    let supplier = document.getElementById('add_supplier').value;
    let name = document.getElementById('add_name').value;
    let spec = document.getElementById('add_spec').value;
    let channel = document.getElementById('add_channel').value;  // 从只读框读取
    let taxRate = document.getElementById('add_tax_rate').value;
    let salePrice = document.getElementById('add_sale_price').value;
    let onlineCost = document.getElementById('add_online_cost').value;
    let warnNum = document.getElementById('add_warn_num').value;
    let shelfNum = document.getElementById('add_shelf_life_num').value;
    let shelfUnit = document.getElementById('add_shelf_life_unit').value;
    
    if (!supplier || !name || !channel || !salePrice) return showMsg('必填项不能为空');    if(+salePrice<=0) return showMsg('销售单价必须大于0');
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