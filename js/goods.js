// 补全刷新函数
function refreshGoods(){
    loadGoods();
}

// 补全重复商品判断
function isDuplicate(supplier,name,spec,editId){
    return allGoods.some(item=>{
        if(editId && +item.id===+editId) return false;
        return (item.supplier||'').trim()===supplier.trim()
            && (item.name||'').trim()===name.trim()
            && (item.spec||'').trim()===spec.trim();
    });
}
// 渠道切换：控制线上成本价输入框禁用/启用
function toggleOnlineCostInput(){
    let channel = document.getElementById('add_channel').value;
    let costInput = document.getElementById('add_online_cost');
    if(channel === '线下'){
        costInput.disabled = true;
        costInput.value = '';
    }else{
        costInput.disabled = false;
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
        document.getElementById('totalCount').textContent = allGoods.length;
        filterGoods();
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

function renderGoods() {
    let start = (currentPage-1)*pageSize;
    let pageData = filteredGoods.slice(start, start+pageSize);
    let tb = document.getElementById('goodsList'); tb.innerHTML = '';
    pageData.forEach((item,idx)=>{
        let shelfText = item.shelf_life_num ? `${item.shelf_life_num}${item.shelf_life_unit}` : '无';
        let expire = calculateExpireDays(item.shelf_life_num, item.shelf_life_unit);
        let onlineCost = formatMoney(item.online_cost);
        let html = `
            <tr>
                <td><input type="checkbox" class="item-checkbox" value="${item.id}"></td>
                <td>${start+idx+1}</td>
                <td>${item.supplier||''}</td>
                <td>${item.name||''}</td>
                <td>${item.spec||'-'}</td>
                <td>${item.channel||''}</td>
                <td>${formatMoney(item.sale_price)}</td>
                <td>${onlineCost}</td>
                <td>${shelfText}</td>
                <td>${expire}</td>
                <td>${item.warn_num||0}</td>
                <td>
                    <button class="btn btn-primary" onclick="openEditForm(${item.id})">编辑</button>
                    <button class="btn btn-danger" onclick="deleteGoods(${item.id})">删除</button>
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    });
}

function renderPagination() {
    totalPages = Math.ceil(filteredGoods.length/pageSize)||1;
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    let pgBox = document.getElementById('pageNumbers'); pgBox.innerHTML='';
    let s = Math.max(1, currentPage-2), e = Math.min(totalPages, s+4);
    for(let i=s;i<=e;i++){
        let btn = document.createElement('button');
        btn.className = 'page-btn '+(i===currentPage?'active':'');
        btn.innerText=i; btn.onclick=()=>goToPage(i); pgBox.appendChild(btn);
    }
    let btns = document.querySelectorAll('#goods .page-controls .page-btn');
    btns[0].disabled = currentPage===1;
    btns[1].disabled = currentPage===1;
    btns[3].disabled = currentPage===totalPages;
    btns[4].disabled = currentPage===totalPages;
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
    document.querySelectorAll('#formModal .form-group input,#formModal .form-group select').forEach(el=>el.value='');
    toggleOnlineCostInput();
    document.getElementById('formModal').style.display='block';
}

function openEditForm(id){
    let item = allGoods.find(x=>x.id===id); if(!item)return;
    document.getElementById('formTitle').innerText='编辑商品';
    document.getElementById('editId').value=id;
    document.getElementById('add_supplier').value=item.supplier||'';
    document.getElementById('add_name').value=item.name||'';
    document.getElementById('add_spec').value=item.spec||'';
    document.getElementById('add_channel').value=item.channel||'线上';
    document.getElementById('add_sale_price').value=item.sale_price||'';
    document.getElementById('add_online_cost').value=item.online_cost||'';
    document.getElementById('add_warn_num').value=item.warn_num||'';
    document.getElementById('add_shelf_life_num').value=item.shelf_life_num||'';
    document.getElementById('add_shelf_life_unit').value=item.shelf_life_unit||'';
    toggleOnlineCostInput();
    document.getElementById('formModal').style.display='block';
}

function closeForm(){ document.getElementById('formModal').style.display='none'; }

function isDuplicate(supplier,name,spec,editId){
    return allGoods.some(item=>{
        if(editId && +item.id===+editId) return false;
        return (item.supplier||'').trim()===supplier.trim()
            && (item.name||'').trim()===name.trim()
            && (item.spec||'').trim()===spec.trim();
    });
}

// 修改 submitForm()
async function submitForm(){
    let editId = document.getElementById('editId').value;
    let supplier = document.getElementById('add_supplier').value;
    let name = document.getElementById('add_name').value;
    let spec = document.getElementById('add_spec').value;
    let channel = document.getElementById('add_channel').value;
    let salePrice = document.getElementById('add_sale_price').value;
    let onlineCost = document.getElementById('add_sale_price').value;
    let warnNum = document.getElementById('add_warn_num').value;
    let shelfNum = document.getElementById('add_shelf_life_num').value;
    let shelfUnit = document.getElementById('add_shelf_life_unit').value;

    if(!supplier||!name||!channel||!salePrice) return showMsg('必填项不能为空');
    if(+salePrice<=0) return showMsg('销售单价必须大于0');
    // 新增重复商品判断
    if(isDuplicate(supplier,name,spec,editId)) return showMsg('该供应商下已存在同名同规格商品！');

    let data = {
        supplier: supplier.trim(),
        name: name.trim(),
        spec: spec.trim() || null,
        channel: channel,
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
        loadGoods(); // 新增后直接重新拉取列表，解决不刷新问题
    }catch(e){
        showMsg('操作失败：' + e.message);
    }
}

// 补全 exportExcel() 函数
function exportExcel(){
    if(filteredGoods.length === 0) return showMsg('没有数据可导出');
    let data = filteredGoods.map(item=>[
        item.supplier,
        item.name,
        item.spec,
        item.channel,
        item.sale_price,
        item.online_cost,
        item.warn_num,
        item.shelf_life_num ? `${item.shelf_life_num}${item.shelf_life_unit}` : ''
    ]);
    let header = ["供应商","商品名称","规格","销售渠道","销售单价","线上成本价","库存预警阈值","保质期"];
    let ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "商品列表");
    XLSX.writeFile(wb, "商品列表.xlsx");
}
async function deleteGoods(id){
    if(!confirm('确定删除？'))return;
    try{
        await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        showMsg('删除成功');
        loadGoods();
    }catch(e){ showMsg('删除失败'); }
}

async function batchDelete(){
    let ids = [];
    document.querySelectorAll('.item-checkbox:checked').forEach(cb=>ids.push(cb.value));
    if(ids.length===0) return showMsg('请选择数据');
    if(!confirm(`确定删除${ids.length}条？`))return;
    for(let id of ids){
        await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
    }
    showMsg('批量删除成功');
    loadGoods();
}

function downloadTemplate(){
    let h = ["供应商","商品名称","规格","销售渠道","销售单价","线上成本价","库存预警阈值","保质期时长","保质期单位"];
    let ws = XLSX.utils.aoa_to_sheet([h]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"模板");
    XLSX.writeFile(wb,"商品导入模板.xlsx");
}

function exportExcel(){}
function importExcel(){}