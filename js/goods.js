let goodsUsedCache = new Map();
let isLoadingGoods = false;  // ✅ 添加这行
let isGoodsLoaded = false;   // ✅ 添加这行，标记是否已加载

// 刷新商品列表
function refreshGoods() {
    if(isLoadingGoods) return;
    loadGoods();
}
// ========== 校验商品是否存在入库记录 ==========
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
        console.error("校验状态失败", err);
        return true; // 出错时默认返回true，防止误删
    }
}
// ========== 结算类型相关全局变量 ==========
let settleData = [];          // 所有结算类型数据
let filteredSettle = [];      // 筛选后的结算类型
let settleCurrentPage = 1;
let settlePageSize = 10;
let settleTotalPages = 1;

// ========== 结算类型管理 ==========
// 加载结算类型列表（从独立的settle_types表）
async function loadSettleList() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/settle_types?order=id.desc`, {
            headers: { 
                apikey: SUPABASE_KEY, 
                Authorization: `Bearer ${SUPABASE_KEY}` 
            }
        });
        if (!res.ok) throw new Error('读取失败');
        let list = await res.json();
        
        // 先加载商品数据用于计算数量
        let goodsRes = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        let goodsList = goodsRes.ok ? await goodsRes.json() : [];
        
        // 计算每个供应商涉及的商品数
        for (let item of list) {
            let goodsCount = goodsList.filter(g => g.supplier === item.supplier).length;
            item.count = goodsCount;
        }
        
        settleData = list;
        
        // 更新供应商下拉列表
        updateSettleSupplierFilter();
        
        let totalCountEl = document.getElementById('settleTotalCount');
        if (totalCountEl) totalCountEl.textContent = settleData.length;
        
        filteredSettle = [...settleData];
        let searchCountEl = document.getElementById('settleSearchCount');
        if (searchCountEl) searchCountEl.textContent = filteredSettle.length;
        
        renderSettlePagination();
        renderSettleList();
    } catch (e) {
        showMsg('加载结算类型失败：' + e.message);
        console.error(e);
    }
}

// 更新结算类型供应商筛选下拉
function updateSettleSupplierFilter() {
    let select = document.getElementById('settleSupplierSearch');
    if (!select) return;
    let currentValue = select.value;
    select.innerHTML = '<option value="">全部供应商</option>';
    let suppliers = settleData.map(s => s.supplier).sort();
    suppliers.forEach(sup => {
        let opt = document.createElement('option');
        opt.value = sup;
        opt.textContent = sup;
        select.appendChild(opt);
    });
    select.value = currentValue;
}

// 筛选结算类型列表
function filterSettleList() {
    // ✅ 从隐藏域获取供应商值
    let supplier = document.getElementById('settleSupplierSearch').value;
    let channel = document.getElementById('settleChannelSearch').value;
    
    filteredSettle = settleData.filter(item => {
        let matchSupplier = !supplier || item.supplier === supplier;
        let matchChannel = !channel || item.channel === channel;
        return matchSupplier && matchChannel;
    });
    
    let searchCountEl = document.getElementById('settleSearchCount');
    if (searchCountEl) searchCountEl.textContent = filteredSettle.length;
    
    settleCurrentPage = 1;
    renderSettlePagination();
    renderSettleList();
}

// ========== 供应商管理搜索下拉 ==========
function showSettleSupplierList() {
    const box = document.getElementById('settleSupplierListBox');
    if (!box) return;
    const searchInput = document.getElementById('settleSupplierSearchInput');
    if (!searchInput) return;
    
    let suppliers = settleData.map(s => s.supplier).sort();
    box.innerHTML = '';
    if (suppliers.length === 0) {
        box.innerHTML = '<div style="padding:8px;color:#999;">暂无供应商</div>';
        box.style.display = 'block';
        return;
    }
    suppliers.forEach(sup => {
        let div = document.createElement('div');
        div.textContent = sup;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            searchInput.value = sup;
            document.getElementById('settleSupplierSearch').value = sup;
            box.style.display = 'none';
            filterSettleList();
        };
        box.appendChild(div);
    });
    box.style.display = 'block';
}

function filterSettleSupplierList() {
    const box = document.getElementById('settleSupplierListBox');
    if (!box) return;
    const searchInput = document.getElementById('settleSupplierSearchInput');
    if (!searchInput) return;
    
    let keyword = searchInput.value.toLowerCase();
    let suppliers = settleData.map(s => s.supplier).sort();
    box.innerHTML = '';
    let filtered = suppliers.filter(s => s.toLowerCase().includes(keyword));
    if (filtered.length === 0) {
        box.innerHTML = '<div style="padding:8px;color:#999;">无匹配供应商</div>';
        box.style.display = 'block';
        return;
    }
    filtered.forEach(sup => {
        let div = document.createElement('div');
        div.textContent = sup;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            searchInput.value = sup;
            document.getElementById('settleSupplierSearch').value = sup;
            box.style.display = 'none';
            filterSettleList();
        };
        box.appendChild(div);
    });
    box.style.display = 'block';
}

// 点击空白关闭下拉
document.addEventListener('click', function(e) {
    if (!e.target.closest('#settleSupplierSearchInput') && !e.target.closest('#settleSupplierListBox')) {
        const box = document.getElementById('settleSupplierListBox');
        if (box) box.style.display = 'none';
    }
});

// 重置结算类型搜索
function resetSettleSearch() {
    document.getElementById('settleSupplierSearchInput').value = '';
    document.getElementById('settleSupplierSearch').value = '';
    document.getElementById('settleChannelSearch').value = '';
    filterSettleList();
}

function refreshSettleList() {
    loadSettleList();
}

function renderSettleList() {
    let start = (settleCurrentPage - 1) * settlePageSize;
    let pageData = filteredSettle.slice(start, start + settlePageSize);
    let tb = document.getElementById('settleTypeList');
    if (!tb) return;
    tb.innerHTML = '';
    if (pageData.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">暂无数据</td></tr>';
        return;
    }
    pageData.forEach((item, idx) => {
        // ✅ 根据结算方式设置颜色
        let channelColor = '';
        let channelDisplay = item.channel || '';
        if (channelDisplay === '线上') {
            channelColor = 'style="color:#52c41a;font-weight:bold;"';  // 浅绿色
        } else if (channelDisplay === '线下') {
            channelColor = 'style="color:#ff6b6b;font-weight:bold;"';  // 浅红色
        }
        
        let html = `
            <tr>
                <td>${start + idx + 1}</td>
                <td>${item.supplier}</td>
                <td ${channelColor}>${channelDisplay}</td>
                <td>${item.count || 0}</td>
                <td>
                    <button class="btn btn-primary" onclick="openSettleEditForm(${item.id})">编辑</button>
                    <button class="btn btn-danger" onclick="deleteSettleType(${item.id})">删除</button>
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    });
}

function renderSettlePagination() {
    settleTotalPages = Math.ceil(filteredSettle.length / settlePageSize) || 1;
    let currentPageEl = document.getElementById('settleCurrentPage');
    let totalPagesEl = document.getElementById('settleTotalPages');
    if (currentPageEl) currentPageEl.textContent = settleCurrentPage;
    if (totalPagesEl) totalPagesEl.textContent = settleTotalPages;

    let pgBox = document.getElementById('settlePageNumbers');
    if (!pgBox) return;
    pgBox.innerHTML = '';
    let s = Math.max(1, settleCurrentPage - 2);
    let e = Math.min(settleTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === settleCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => settleGoToPage(i);
        pgBox.appendChild(btn);
    }

    let btns = document.querySelectorAll('#sub-settleType .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (settleCurrentPage === 1);
        btns[1].disabled = (settleCurrentPage === 1);
        btns[btns.length - 2].disabled = (settleCurrentPage === settleTotalPages);
        btns[btns.length - 1].disabled = (settleCurrentPage === settleTotalPages);
    }
}

function settleGoToPage(p) { 
    if (p < 1 || p > settleTotalPages) return; 
    settleCurrentPage = p; 
    renderSettlePagination(); 
    renderSettleList(); 
}

function settlePrevPage() { settleGoToPage(settleCurrentPage - 1); }
function settleNextPage() { settleGoToPage(settleCurrentPage + 1); }

function changeSettlePageSize() { 
    settlePageSize = +document.getElementById('settlePageSize').value; 
    settleCurrentPage = 1; 
    renderSettlePagination(); 
    renderSettleList(); 
}

// ========== 结算类型CRUD ==========
// 新增结算类型 - 弹窗形式
function openSettleForm() {
    document.getElementById('settleModalTitle').innerText = '新增结算类型';
    document.getElementById('settleEditId').value = '';
    document.getElementById('settleSupplierInput').value = '';
    document.getElementById('settleChannelSelect').value = '线上';
    document.getElementById('settleSupplierInput').disabled = false;
    document.getElementById('settleModal').style.display = 'flex';
}

// 编辑结算类型 - 弹窗形式
function openSettleEditForm(id) {
    let item = settleData.find(s => s.id === id);
    if (!item) return;
    
    document.getElementById('settleModalTitle').innerText = '编辑结算类型';
    document.getElementById('settleEditId').value = id;
    document.getElementById('settleSupplierInput').value = item.supplier;
    document.getElementById('settleSupplierInput').disabled = true;
    document.getElementById('settleChannelSelect').value = item.channel;
    document.getElementById('settleModal').style.display = 'flex';
}

// 关闭结算类型弹窗
function closeSettleModal() {
    document.getElementById('settleModal').style.display = 'none';
    document.getElementById('settleSupplierInput').disabled = false;
    document.getElementById('settleSupplierInput').value = '';
    document.getElementById('settleEditId').value = '';
}

// 提交结算类型表单
async function submitSettleForm() {
    let id = document.getElementById('settleEditId').value;
    let supplier = document.getElementById('settleSupplierInput').value.trim();
    let channel = document.getElementById('settleChannelSelect').value;
    
    if (!supplier) {
        showMsg('请输入供应商名称！');
        return;
    }
    
    // ✅ 检查供应商+结算方式是否重复
    let isDuplicate = settleData.some(item => {
        // 如果是编辑模式，排除自身
        if (id && item.id == id) return false;
        return item.supplier === supplier && item.channel === channel;
    });
    
    if (isDuplicate) {
        showMsg(`供应商"${supplier}"的结算方式"${channel}"已存在！`);
        return;
    }
    
    try {
        if (id) {
            // 编辑时也要检查：如果修改了结算方式，检查是否与其他记录重复
            let currentItem = settleData.find(s => s.id == id);
            if (currentItem && currentItem.channel !== channel) {
                // 检查新的结算方式是否与其他记录重复
                let conflict = settleData.some(item => {
                    return item.id != id && item.supplier === supplier && item.channel === channel;
                });
                if (conflict) {
                    showMsg(`供应商"${supplier}"的结算方式"${channel}"已存在！`);
                    return;
                }
            }
            
            await fetch(`${SUPABASE_URL}/rest/v1/settle_types?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ channel: channel })
            });
            showMsg('结算类型更新成功！');
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/settle_types`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ supplier, channel })
            });
            showMsg('新增结算类型成功！');
        }
        
        closeSettleModal();
        // 先重新加载商品数据，再加载结算类型
        loadGoods();
        loadSettleList();
        loadSupplierSelect();
    } catch (e) {
        showMsg('操作失败：' + e.message);
        console.error(e);
    }
}

// 删除结算类型
async function deleteSettleType(id) {
    let item = settleData.find(s => s.id === id);
    if (!item) return;
    
    let goodsList = allGoods ? allGoods.filter(g => g.supplier === item.supplier) : [];
    if (goodsList.length > 0) {
        showMsg(`供应商"${item.supplier}"下存在${goodsList.length}条商品记录，无法删除！`);
        return;
    }
    
    if (!confirm(`确定要删除供应商"${item.supplier}"吗？`)) return;
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/settle_types?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        showMsg(`已删除供应商"${item.supplier}"`);
        loadSettleList();
        loadSupplierSelect();
    } catch (e) {
        showMsg('删除失败：' + e.message);
    }
}

// ========== 结算类型导入导出 ==========
function downloadSettleTemplate() {
    let h = ["供应商", "结算方式"];
    let ws = XLSX.utils.aoa_to_sheet([h]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "结算类型导入模板.xlsx");
}

async function importSettleExcel() {
    let fileInput = document.getElementById('settleFileInput');
    let file = fileInput.files[0];
    if (!file) return showMsg('请选择文件');
    
    let reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, { type: 'array' });
            let sheet = workbook.Sheets[workbook.SheetNames[0]];
            let json = XLSX.utils.sheet_to_json(sheet);
            
            let successCount = 0;
            let failCount = 0;
            
            for (let row of json) {
                let supplier = row['供应商']?.trim();
                let channel = row['结算方式']?.trim();
                
                if (!supplier || !channel) {
                    failCount++;
                    continue;
                }
                
                if (!['线上', '线下'].includes(channel)) {
                    failCount++;
                    continue;
                }
                
                if (settleData.some(s => s.supplier === supplier)) {
                    failCount++;
                    continue;
                }
                
                try {
                    await fetch(`${SUPABASE_URL}/rest/v1/settle_types`, {
                        method: 'POST',
                        headers: {
                            apikey: SUPABASE_KEY,
                            Authorization: `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ supplier, channel })
                    });
                    successCount++;
                } catch (err) {
                    failCount++;
                }
            }
            
            showMsg(`导入完成：成功 ${successCount} 条，失败 ${failCount} 条`);
            fileInput.value = '';
            loadSettleList();
            loadSupplierSelect();
        } catch (err) {
            showMsg('导入失败：' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function exportSettleExcel() {
    if (filteredSettle.length === 0) {
        showMsg("暂无数据可导出");
        return;
    }
    
    let header = ["序号", "供应商", "结算方式", "涉及商品数"];
    let exportData = filteredSettle.map((item, idx) => [
        idx + 1,
        item.supplier || "",
        item.channel || "",
        item.count || 0
    ]);
    
    let ws = XLSX.utils.aoa_to_sheet([header, ...exportData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "结算类型列表");
    XLSX.writeFile(wb, "结算类型列表.xlsx");
}

// ========== 商品子Tab切换 ==========
function switchGoodsSubTab(tab) {
// ===== 新增：检查子版块权限 =====
    if (typeof currentUserId !== 'undefined' && currentUserId) {
        if (typeof getUserPermissions === 'function') {
            var perms = getUserPermissions(currentUserId);
            if (perms.view && perms.view.indexOf(tab) === -1) {
                showMsg('您没有查看该子版块的权限');
                return;
            }
        }
    }
    const buttons = document.querySelectorAll('#goods .finance-sub-btn');
    if (buttons.length === 0) {
        console.warn('没有找到子Tab按钮');
        return;
    }
    buttons.forEach(function(btn) {
        btn.classList.remove('active');
    });
    
    const targetBtn = document.querySelector('#goods .finance-sub-btn[data-tab="' + tab + '"]');
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    const contents = document.querySelectorAll('#goods .finance-sub-content');
    contents.forEach(function(div) {
        div.style.display = 'none';
    });
    
    const targetContent = document.getElementById('sub-' + tab);
    if (targetContent) {
        targetContent.style.display = 'block';
        console.log('显示子Tab:', tab);
    } else {
        console.warn('找不到子Tab内容: sub-' + tab);
        return;
    }
    
   if (tab === 'supplier') {  // 原来是 'settleType'
        loadSettleList();
    } else if (tab === 'goodsInfo') {
        currentPage = 1;
        const goodsTbody = document.getElementById('goodsList');
        if(goodsTbody) goodsTbody.innerHTML = '';
        loadGoods(true);
    } else if (tab === 'expireDate') {  // 原来是 'dateChange'
        loadDateChangeTab();
    }
}

// 渠道切换：控制线上成本价、税率、保质期时长、保质期单位输入框禁用/启用
function toggleOnlineCostInput() {
    let channel = document.getElementById('add_channel').value;
    let costInput = document.getElementById('add_online_cost');
    let taxSelect = document.getElementById('add_tax_rate');
    let shelfNumInput = document.getElementById('add_shelf_life_num');
    let shelfUnitSelect = document.getElementById('add_shelf_life_unit');

    if (channel === '线下') {
        costInput.disabled = true;
        costInput.value = '';
        taxSelect.disabled = false;
        shelfNumInput.disabled = false;
        shelfUnitSelect.disabled = false;
    } else {
        costInput.disabled = false;
        taxSelect.disabled = true;
        taxSelect.value = '';
        shelfNumInput.disabled = true;
        shelfNumInput.value = '';
        shelfUnitSelect.disabled = true;
        shelfUnitSelect.value = '';
    }
}

function clearSort() {
    sortField = '';
    sortAsc = true;
    updateSortIcon();
    loadGoods();
}

async function loadGoods(force) {
    // ✅ 如果强制刷新，跳过缓存检查
    if (force) {
        console.log('强制刷新商品数据...');
        isLoadingGoods = false;
        isGoodsLoaded = false;
        // 继续执行下面的加载逻辑
    } else {
        // ✅ 如果正在加载，跳过
        if (isLoadingGoods) {
            console.log('商品数据正在加载中，跳过重复请求');
            return;
        }
        
        // ========== 修改开始：当切换到商品列表时，强制刷新数据 ==========
        // ✅ 修改：不再使用缓存，每次都重新加载，确保数据最新
        // 删除或注释掉这段缓存逻辑
        // if (isGoodsLoaded && allGoods && allGoods.length > 0) {
        //     console.log('商品数据已加载，直接渲染');
        //     const goodsTbody = document.getElementById('goodsList');
        //     if(goodsTbody) goodsTbody.innerHTML = '';
        //     let searchField = document.getElementById('searchField');
        //     if (searchField) {
        //         filterGoods();
        //     } else {
        //         filteredGoods = [...allGoods];
        //         let searchCount = document.getElementById('searchCount');
        //         if (searchCount) searchCount.textContent = filteredGoods.length;
        //         currentPage = 1;
        //         renderPagination();
        //         renderGoods();
        //     }
        //     return;
        // }
        // ========== 修改结束 ==========
    }
    
    try {
        isLoadingGoods = true;
        let res = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        let list = await res.json();
        allGoods = list.sort((a, b) => b.id - a.id);
        window.allGoods = allGoods;
        isGoodsLoaded = true;
        
        let totalCountEl = document.getElementById('totalCount');
        if (totalCountEl) totalCountEl.textContent = allGoods.length;
        
        let searchField = document.getElementById('searchField');
        if (searchField) {
            filterGoods();
        } else {
            filteredGoods = [...allGoods];
            let searchCount = document.getElementById('searchCount');
            if (searchCount) searchCount.textContent = filteredGoods.length;
            currentPage = 1;
            renderPagination();
            renderGoods();
        }
        loadSettleListSilently();
    } catch (e) {
        showMsg('加载商品失败：' + e.message);
        console.error(e);
    } finally {
        isLoadingGoods = false;
    }
}

async function loadSettleListSilently() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/settle_types?order=id.asc`, {
            headers: { 
                apikey: SUPABASE_KEY, 
                Authorization: `Bearer ${SUPABASE_KEY}` 
            }
        });
        if (!res.ok) throw new Error('读取失败');
        let list = await res.json();
        settleData = list;
    } catch (e) {
        console.error('静默加载结算类型失败：', e.message);
    }
}

function loadSupplierSelect() {
    let select = document.getElementById('add_supplier');
    if (!select) return;
    
    select.innerHTML = '<option value="">请选择供应商</option>';
    let suppliers = settleData.map(s => s.supplier).sort();
    suppliers.forEach(sup => {
        let opt = document.createElement('option');
        opt.value = sup;
        opt.textContent = sup;
        select.appendChild(opt);
    });
}

// ========== 商品弹窗供应商搜索下拉 ==========
function showAddSupplierList() {
    const box = document.getElementById('addSupplierListBox');
    if (!box) return;
    const searchInput = document.getElementById('addSupplierSearch');
    if (!searchInput) return;
    
    // 从settleData获取供应商列表
    let suppliers = settleData.map(s => s.supplier).sort();
    box.innerHTML = '';
    suppliers.forEach(sup => {
        let div = document.createElement('div');
        div.textContent = sup;
        div.onclick = function() {
            searchInput.value = sup;
            document.getElementById('add_supplier').value = sup;
            box.style.display = 'none';
            onSupplierChange();
        };
        box.appendChild(div);
    });
    box.style.display = 'block';
}

function filterAddSupplierList() {
    const box = document.getElementById('addSupplierListBox');
    if (!box) return;
    const searchInput = document.getElementById('addSupplierSearch');
    if (!searchInput) return;
    
    let keyword = searchInput.value.toLowerCase();
    let suppliers = settleData.map(s => s.supplier).sort();
    box.innerHTML = '';
    suppliers.filter(s => s.toLowerCase().includes(keyword)).forEach(sup => {
        let div = document.createElement('div');
        div.textContent = sup;
        div.onclick = function() {
            searchInput.value = sup;
            document.getElementById('add_supplier').value = sup;
            box.style.display = 'none';
            onSupplierChange();
        };
        box.appendChild(div);
    });
    box.style.display = 'block';
}

// 点击空白关闭下拉
document.addEventListener('click', function(e) {
    if (!e.target.closest('#addSupplierSearch') && !e.target.closest('#addSupplierListBox')) {
        const box = document.getElementById('addSupplierListBox');
        if (box) box.style.display = 'none';
    }
});

function onSupplierChange() {
    let supplier = document.getElementById('add_supplier').value;
    let channelInput = document.getElementById('add_channel');
    if (!channelInput) return;
    
    if (supplier) {
        let found = settleData.find(s => s.supplier === supplier);
        channelInput.value = found ? found.channel : '';
        toggleOnlineCostInput();
    } else {
        channelInput.value = '';
    }
}

function openAddForm() {
    document.getElementById('formTitle').innerText = '新增商品';
    document.getElementById('editId').value = '';
    document.querySelectorAll('#formModal .form-group input,#formModal .form-group select').forEach(el => {
        if (el.id !== 'addSupplierSearch') el.value = '';
    });
    // 清空供应商搜索框和隐藏值
    document.getElementById('addSupplierSearch').value = '';
    document.getElementById('add_supplier').value = '';
    document.getElementById('add_channel').value = '';
    document.getElementById('add_supplier').disabled = false;
    document.getElementById('add_name').disabled = false;
    document.getElementById('add_spec').disabled = false;
    document.getElementById('add_channel').disabled = true;
    toggleOnlineCostInput();
    document.getElementById('formModal').style.display = 'block';
}

async function openEditForm(id) {
    let item = allGoods.find(x => x.id === id);
    if (!item) return;
    document.getElementById('formTitle').innerText = '编辑商品';
    document.getElementById('editId').value = id;
    
    // 设置供应商搜索框和隐藏值
    document.getElementById('addSupplierSearch').value = item.supplier || '';
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
    document.getElementById('add_channel').disabled = true;

    toggleOnlineCostInput();

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
    let searchField = document.getElementById('searchField');
    let searchKeyword = document.getElementById('searchKeyword');
    let searchCount = document.getElementById('searchCount');
    
    if (!searchField || !searchKeyword || !searchCount) {
        console.warn('搜索元素不存在');
        return;
    }
    
    let field = searchField.value;
    let kw = searchKeyword.value.toLowerCase();
    
    if (!allGoods || !Array.isArray(allGoods)) {
        filteredGoods = [];
    } else {
        // 保留筛选内局部去重，不修改全局allGoods，避免数据错乱卡死
        const uniqueMap = new Map();
        allGoods.forEach(item => {
            if (!uniqueMap.has(item.id)) {
                uniqueMap.set(item.id, item);
            }
        });
        const uniqueGoods = Array.from(uniqueMap.values());
        
        filteredGoods = uniqueGoods.filter(item => String(item[field] || '').toLowerCase().includes(kw));
    }
    
    searchCount.textContent = filteredGoods.length;
    currentPage = 1;
    renderPagination();

    // 批量预查当前页商品是否被使用
    (async () => {
        const start = (currentPage - 1) * pageSize;
        const pageData = filteredGoods.slice(start, start + pageSize);
        goodsUsedCache.clear();
        for(const item of pageData) {
            const used = await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec);
            goodsUsedCache.set(item.id, used);
        }
        renderGoods();
    })();
}

function updateSortIcon() {
    document.querySelectorAll('.sort-icon').forEach(i => i.innerText = '');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th => th.onclick?.toString().includes(sortField));
    if (idx > -1) document.querySelectorAll('.sort-icon')[idx].innerText = sortAsc ? '↑' : '↓';
}

function renderGoods() {
    const goodsTbody = document.getElementById('goodsList');
    if (goodsTbody) {
        goodsTbody.innerHTML = '';
    }

    let tb = document.getElementById('goodsList');
    if (!tb) {
        console.warn('goodsList元素不存在，等待重试...');
        setTimeout(() => renderGoods(), 100);
        return;
    }
    
    if (!filteredGoods || filteredGoods.length === 0) {
        tb.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:20px;">暂无数据</td></tr>';
        return;
    }
    
    let start = (currentPage - 1) * pageSize;
    let pageData = filteredGoods.slice(start, start + pageSize);
    tb.innerHTML = '';
    
    if (pageData.length === 0) {
        tb.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:20px;">暂无数据</td></tr>';
        return;
    }
    
    for (let idx = 0; idx < pageData.length; idx++) {
        const item = pageData[idx];
        const seqNum = start + idx + 1;

        let shelfText = (item.shelf_life_num && item.shelf_life_unit) ? `${item.shelf_life_num}${item.shelf_life_unit}` : '';
        let expire = calculateExpireDays ? calculateExpireDays(item.shelf_life_num, item.shelf_life_unit) : '';
        let onlineCost = formatMoney ? formatMoney(item.online_cost) : (item.online_cost || 0);
        // 从缓存读取，不再await
        let isUsed = goodsUsedCache.get(item.id) ?? false;
        
        let delBtn = isUsed 
            ? `<button class="btn btn-danger" disabled style="opacity:0.5">删除</button>`
            : `<button class="btn btn-danger" onclick="deleteGoods(${item.id})">删除</button>`;
        
        let html = `
            <tr>
                <td><input type="checkbox" class="item-checkbox" value="${item.id}" ${isUsed ? 'disabled' : ''}></td>
                <td>${seqNum}</td>
                <td>${item.supplier || ''}</td>
                <td>${item.name || ''}</td>
                <td>${item.spec || '-'}</td>
                <td>${item.channel || ''}</td>
                <td>${formatMoney ? formatMoney(item.sale_price) : (item.sale_price || 0)}</td>
                <td>${onlineCost}</td>
                <td>${item.tax_rate ? item.tax_rate + '%' : ''}</td>
                <td>${shelfText}</td>
                <td>${expire}</td>
                <td>${item.warn_num || 0}</td>
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
    // ✅ 确保 filteredGoods 是数组
    const totalItems = Array.isArray(filteredGoods) ? filteredGoods.length : 0;
    totalPages = Math.ceil(totalItems / pageSize) || 1;
    
    // ✅ 确保 currentPage 不超过总页数
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    let currentPageEl = document.getElementById('currentPage');
    let totalPagesEl = document.getElementById('totalPages');
    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;

    let pgBox = document.getElementById('pageNumbers');
    if (!pgBox) return;
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

    let btns = document.querySelectorAll('#sub-goodsInfo .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (currentPage === 1);
        btns[1].disabled = (currentPage === 1);
        btns[btns.length - 2].disabled = (currentPage === totalPages);
        btns[btns.length - 1].disabled = (currentPage === totalPages);
    }
}

function goToPage(p) {
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    renderPagination();
    renderGoods();
}

function prevPage() { goToPage(currentPage - 1); }
function nextPage() { goToPage(currentPage + 1); }

function changePageSize() {
    pageSize = +document.getElementById('pageSize').value;
    currentPage = 1;
    renderPagination();
    renderGoods();
}

function toggleSelectAll() {
    let all = document.getElementById('selectAll').checked;
    document.querySelectorAll('.item-checkbox').forEach(cb => {
        // 只勾选未被禁用的checkbox
        if (!cb.disabled) {
            cb.checked = all;
        }
    });
}

function closeForm() {
    document.getElementById('formModal').style.display = 'none';
}

function isDuplicate(supplier, name, spec, editId) {
    // ✅ 确保 allGoods 是最新的
    if (!allGoods || allGoods.length === 0) {
        return false;
    }
    return allGoods.some(item => {
        if (editId && +item.id === +editId) return false;
        return (item.supplier || '').trim() === supplier.trim()
            && (item.name || '').trim() === name.trim()
            && (item.spec || '').trim() === spec.trim();
    });
}

async function submitForm() {
    let editId = document.getElementById('editId').value;
    let supplier = document.getElementById('add_supplier').value;  // 从隐藏域获取
    let name = document.getElementById('add_name').value;
    let spec = document.getElementById('add_spec').value;
    let channel = document.getElementById('add_channel').value;
    let taxRate = document.getElementById('add_tax_rate').value;
    let salePrice = document.getElementById('add_sale_price').value;
    let onlineCost = document.getElementById('add_online_cost').value;
    let warnNum = document.getElementById('add_warn_num').value;
    let shelfNum = document.getElementById('add_shelf_life_num').value;
    let shelfUnit = document.getElementById('add_shelf_life_unit').value;
    
    if (!supplier || !name || !channel || !salePrice) return showMsg('必填项不能为空');
    if (+salePrice <= 0) return showMsg('销售单价必须大于0');
    if (isDuplicate(supplier, name, spec, editId)) return showMsg('该供应商下已存在同名同规格商品！');
    
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
    
    try {
        if (editId) {
            await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${editId}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            showMsg('编辑成功');
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(data)
            });
            showMsg('新增成功');
        }
        closeForm();
        // ✅ 强制重新加载商品数据，绕过缓存
        await loadGoods(true);
        if (typeof loadAllGoods === 'function') {
            await loadAllGoods();
        }
    } catch (e) {
        showMsg('操作失败');
    }
}

async function deleteGoods(id) {
    let item = allGoods.find(g => g.id === id);
    if (item && await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec)) {
        showMsg('该商品已存在入库记录，禁止删除！');
        return;
    }
    if (!confirm('确定删除？')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        showMsg('删除成功');
        // ✅ 强制重新加载商品数据，绕过缓存
        await loadGoods(true);
        if (typeof loadAllGoods === 'function') {
            await loadAllGoods();
        }
    } catch (e) {
        showMsg('删除失败');
    }
}

async function batchDelete() {
    let ids = [];
    let hasDisabled = false;
    
    document.querySelectorAll('.item-checkbox').forEach(cb => {
        if (cb.checked) {
            if (cb.disabled) {
                hasDisabled = true;
            } else {
                ids.push(cb.value);
            }
        }
    });
    
    if (ids.length === 0) {
        if (hasDisabled) {
            showMsg('选中的商品中存在已录入入库单据的数据，无法删除！');
        } else {
            showMsg('请选择数据');
        }
        return;
    }
    
    let hasUsed = false;
    for (let id of ids) {
        let item = allGoods.find(g => g.id == id);
        if (item && await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec)) {
            hasUsed = true;
            break;
        }
    }
    if (hasUsed) {
        showMsg('选中商品中存在已录入入库单据的数据，无法批量删除！');
        return;
    }
    
    if (!confirm(`确定删除${ids.length}条？`)) return;
    for (let id of ids) {
        await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
    }
    showMsg('批量删除成功');
    // ✅ 强制重新加载商品数据，绕过缓存
    await loadGoods(true);
    if (typeof loadAllGoods === 'function') {
        await loadAllGoods();
    }
}

function downloadTemplate() {
    let h = ["供应商", "商品名称", "规格", "销售渠道", "销售单价", "税率", "线上成本价", "库存预警阈值", "保质期时长", "保质期单位"];
    let ws = XLSX.utils.aoa_to_sheet([h]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "商品导入模板.xlsx");
}

function exportExcel() {
    if (filteredGoods.length === 0) {
        showMsg("暂无数据可导出");
        return;
    }
    // ✅ 增加"临期天数"和"操作"列，共11列
    let header = ["供应商", "商品名称", "规格", "销售渠道", "销售单价", "税率", "线上成本价", "库存预警阈值", "保质期", "临期天数"];
    let exportData = filteredGoods.map(item => {
        let shelf = item.shelf_life_num ? `${item.shelf_life_num}${item.shelf_life_unit || ''}` : "";
        let expire = calculateExpireDays ? calculateExpireDays(item.shelf_life_num, item.shelf_life_unit) : '';
        return [
            item.supplier || "",
            item.name || "",
            item.spec || "",
            item.channel || "",
            item.sale_price || 0,
            item.tax_rate ? item.tax_rate + '%' : "",
            item.online_cost || 0,
            item.warn_num || 0,
            shelf,
            expire  // ✅ 新增临期天数
        ];
    });
    let ws = XLSX.utils.aoa_to_sheet([header, ...exportData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "商品列表");
    XLSX.writeFile(wb, "商品列表.xlsx");
}

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    // 默认激活商品信息
    let goodsInfoBtn = document.querySelector('#goods .finance-sub-btn[data-tab="goodsInfo"]');
    if (goodsInfoBtn) {
        goodsInfoBtn.classList.add('active');
        document.querySelector('#goods .finance-sub-btn[data-tab="settleType"]')?.classList.remove('active');
        document.querySelector('#goods .finance-sub-btn[data-tab="dateChange"]')?.classList.remove('active');
    }
    
    let goodsInfoContent = document.getElementById('sub-goodsInfo');
    let settleTypeContent = document.getElementById('sub-settleType');
    let dateChangeContent = document.getElementById('sub-dateChange');
    
    if (goodsInfoContent) goodsInfoContent.style.display = 'block';
    if (settleTypeContent) settleTypeContent.style.display = 'none';
    if (dateChangeContent) dateChangeContent.style.display = 'none';
    
    // ✅ 加载商品数据
    refreshGoods();
    
    // ✅ 加载库存数据（供后台更换日期使用）
    if (typeof loadStockStock === 'function') {
        loadStockStock();
    }
});

// ============================================================
// ========== 后台更换日期模块 ==========
// ============================================================

// 日期更换相关变量
let dateChangeData = [];
let filteredDateChange = [];
let dateChangeCurrentPage = 1;
let dateChangePageSize = 10;
let dateChangeTotalPages = 1;

/**
 * 获取商品当前库存中的最早批次日期
 * @param {string} supplier - 供应商
 * @param {string} goodsName - 商品名
 * @param {string} spec - 规格
 * @returns {Object} { produce_date, expire_date, batchRemain, recordDate, bzStatusText, countDownText }
 */
function getEarliestBatchDate(supplier, goodsName, spec) {
    try {
        // 直接从 allStockBatchList 中查找
        if (!allStockBatchList || allStockBatchList.length === 0) {
            return null;
        }
        
        // ✅ 筛选出该商品的所有批次 - 修复 spec 匹配
        const batchList = allStockBatchList.filter(function(item) {
            // 供应商和商品名必须匹配
            if (item.supplier !== supplier || item.goodsName !== goodsName) {
                return false;
            }
            // 规格匹配：如果商品规格为null或'-'，匹配库存中规格为'-'或null的
            const itemSpec = item.spec || '-';
            const targetSpec = spec || '-';
            return itemSpec === targetSpec;
        });
        
        if (!batchList || batchList.length === 0) {
            return null;
        }
        
        // ✅ 按日期排序：有生产日期的按生产日期升序，有到期日期的按到期日期升序
        batchList.sort(function(a, b) {
            const getDate = function(item) {
                if (item.produce_date && item.produce_date !== '-') {
                    return { date: new Date(item.produce_date), type: 'produce' };
                } else if (item.expire_date && item.expire_date !== '-') {
                    return { date: new Date(item.expire_date), type: 'expire' };
                }
                return null;
            };
            
            const dateA = getDate(a);
            const dateB = getDate(b);
            
            // 都没有日期
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            
            // 按日期升序（最早的在前）
            return dateA.date - dateB.date;
        });
        
        // 取排序后的第一个批次（最早批次）
        const earliest = batchList[0];
        
        console.log('最早批次:', earliest.goodsName, '生产日期:', earliest.produce_date, '到期日期:', earliest.expire_date);
        
        // ✅ 获取该批次对应的入库记录，提取录入日期
        let recordDate = null;
        if (earliest && allStockIn) {
            const matchedIn = allStockIn.find(function(item) {
                const matchSupplier = item.supplier === supplier;
                const matchGoods = item.goodsName === goodsName;
                const matchSpec = item.spec === (spec || null) || (item.spec === null && spec === '-');
                
                let matchDate = false;
                if (earliest.produce_date && earliest.produce_date !== '-') {
                    matchDate = item.produce_date === earliest.produce_date;
                } else if (earliest.expire_date && earliest.expire_date !== '-') {
                    matchDate = item.expire_date === earliest.expire_date;
                }
                
                return matchSupplier && matchGoods && matchSpec && matchDate;
            });
            if (matchedIn) {
                recordDate = matchedIn.record_date;
            }
        }
        
        // 确定日期类型
        let produceDate = null;
        let expireDate = null;
        let dateType = '';
        let dateValue = null;
        
        if (earliest.produce_date && earliest.produce_date !== '-') {
            produceDate = earliest.produce_date;
            dateType = '生产日期';
            dateValue = earliest.produce_date;
        } else if (earliest.expire_date && earliest.expire_date !== '-') {
            expireDate = earliest.expire_date;
            dateType = '到期日期';
            dateValue = earliest.expire_date;
        }
        
        return {
            produce_date: produceDate,
            expire_date: expireDate,
            batchRemain: earliest.batchRemain || 0,
            recordDate: recordDate,
            bzStatusText: earliest.bzStatusText || '',
            countDownText: earliest.countDownText || '',
            dateType: dateType,
            dateValue: dateValue
        };
    } catch (e) {
        console.error('获取最早批次日期失败:', e);
        return null;
    }
}

/**
 * 格式化日期显示
 * @param {string} dateStr - 日期字符串
 * @param {string} dateType - '生产日期' 或 '到期日期'
 * @param {Object} goodsItem - 商品对象（用于获取保质期）
 * @returns {string} 格式化后的日期
 */
function formatDateTimeValue(dateStr, dateType, goodsItem) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 到期日期：永远显示 年月日
    if (dateType === '到期日期') {
        return `${year}年${month}月${day}日`;
    }
    
    // 生产日期：根据保质期判断
    let shelfDays = 0;
    if (goodsItem && goodsItem.shelf_life_num && goodsItem.shelf_life_unit) {
        switch (goodsItem.shelf_life_unit) {
            case '天': shelfDays = parseInt(goodsItem.shelf_life_num); break;
            case '个月': shelfDays = parseInt(goodsItem.shelf_life_num) * 30; break;
            case '年': shelfDays = parseInt(goodsItem.shelf_life_num) * 365; break;
        }
    }
    
    if (shelfDays > 60) {
        return `${year}年${month}月`;
    } else {
        return `${year}年${month}月${day}日`;
    }
}

/**
 * 判断商品是否需要更新日期
 * @param {Object} goodsItem - 商品对象
 * @returns {Object} { needUpdate: boolean, earliest: Object, dateType: string, dateValue: string }
 */
function checkNeedDateUpdate(goodsItem) {
    const earliest = getEarliestBatchDate(goodsItem.supplier, goodsItem.name, goodsItem.spec || '-');
    if (!earliest || earliest.batchRemain <= 0) {
        return { needUpdate: false, earliest: null };
    }
    
    const savedProduce = goodsItem.saved_produce_date;
    const savedExpire = goodsItem.saved_expire_date;
    
    console.log('检查商品:', goodsItem.name);
    console.log('  最早批次生产日期:', earliest.produce_date);
    console.log('  已保存生产日期:', savedProduce);
    
    let needUpdate = false;
    let dateType = '';
    let dateValue = null;
    
    // 检查生产日期
    if (earliest.produce_date) {
        const currentDate = new Date(earliest.produce_date);
        const currentDateStr = currentDate.toISOString().split('T')[0];
        
        let shelfDays = 0;
        if (goodsItem.shelf_life_num && goodsItem.shelf_life_unit) {
            switch (goodsItem.shelf_life_unit) {
                case '天': shelfDays = parseInt(goodsItem.shelf_life_num); break;
                case '个月': shelfDays = parseInt(goodsItem.shelf_life_num) * 30; break;
                case '年': shelfDays = parseInt(goodsItem.shelf_life_num) * 365; break;
            }
        }
        
        let savedDateStr = null;
        if (savedProduce) {
            const savedDate = new Date(savedProduce);
            if (shelfDays > 60) {
                savedDateStr = `${savedDate.getFullYear()}-${String(savedDate.getMonth() + 1).padStart(2, '0')}`;
            } else {
                savedDateStr = savedDate.toISOString().split('T')[0];
            }
        }
        
        let currentCompareStr = null;
        if (shelfDays > 60) {
            currentCompareStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        } else {
            currentCompareStr = currentDateStr;
        }
        
        console.log('  比对:', savedDateStr, 'vs', currentCompareStr);
        
        if (savedDateStr !== currentCompareStr) {
            needUpdate = true;
            dateType = '生产日期';
            dateValue = earliest.produce_date;
            console.log('  ✅ 需要更新');
        }
    }
    
    // 检查到期日期
    if (!needUpdate && earliest.expire_date) {
        const savedDate = savedExpire ? new Date(savedExpire).toISOString().split('T')[0] : null;
        const currentDate = new Date(earliest.expire_date).toISOString().split('T')[0];
        
        if (savedDate !== currentDate) {
            needUpdate = true;
            dateType = '到期日期';
            dateValue = earliest.expire_date;
            console.log('  ✅ 需要更新（到期日期）');
        }
    }
    
    return {
        needUpdate: needUpdate,
        earliest: earliest,
        dateType: dateType,
        dateValue: dateValue,
        displayValue: dateValue ? formatDateTimeValue(dateValue, dateType, goodsItem) : ''
    };
}

/**
 * 获取所有需要更新日期的商品列表
 */
function getNeedUpdateGoodsList() {
    const result = [];
    if (!allGoods || allGoods.length === 0) {
        console.log('allGoods 为空');
        return result;
    }
    
    console.log('开始遍历商品，总数:', allGoods.length);
    
    for (const item of allGoods) {
        const check = checkNeedDateUpdate(item);
        console.log('商品:', item.name, 'needUpdate:', check.needUpdate);
        
        if (check.needUpdate && check.earliest) {
            console.log('✅ 添加商品到列表:', item.name);
            
            // ✅ 手动构造数据，不使用扩展运算符
            result.push({
                id: item.id,
                supplier: item.supplier || '',
                name: item.name || '',
                spec: item.spec || '-',
                channel: item.channel || '',
                sale_price: item.sale_price || 0,
                online_cost: item.online_cost || 0,
                tax_rate: item.tax_rate || '',
                warn_num: item.warn_num || 0,
                shelf_life_num: item.shelf_life_num || '',
                shelf_life_unit: item.shelf_life_unit || '',
                saved_produce_date: item.saved_produce_date || null,
                saved_expire_date: item.saved_expire_date || null,
                saved_date_updated_at: item.saved_date_updated_at || null,
                earliestBatch: check.earliest,
                dateType: check.dateType,
                dateValue: check.dateValue,
                displayValue: check.displayValue || '',
                batchRemain: check.earliest.batchRemain || 0,
                recordDate: check.earliest.recordDate || null
            });
        }
    }
    
    console.log('需要更新的商品总数:', result.length);
    return result;
}
/**
 * 加载后台更换日期列表
 */
function loadDateChangeTab() {
    console.log('加载后台更换日期...');
    
    function checkAndLoad() {
        if (!allGoods || allGoods.length === 0) {
            console.log('商品数据未加载，先加载商品...');
            loadGoods();
            setTimeout(checkAndLoad, 300);
            return;
        }
        
        // ✅ 每次打开都重新加载库存数据，确保最新
        console.log('重新加载库存数据...');
        if (typeof loadStockStock === 'function') {
            allStockBatchList = [];
            loadStockStock();
        }
        
        setTimeout(function() {
            doLoadDateChange();
        }, 500);
    }
    
    function doLoadDateChange() {
        dateChangeData = getNeedUpdateGoodsList();
        filteredDateChange = [...dateChangeData];
        
        console.log('需要更新的商品数量:', dateChangeData.length);
        
        updateDateChangeButton();
        updateDateChangeStatus();
        dateChangeCurrentPage = 1;
        renderDateChangePagination();
        renderDateChangeList();
    }
    
    checkAndLoad();
}

/**
 * 更新状态文字
 */
function updateDateChangeStatus() {
    const statusEl = document.getElementById('dateChangeStatus');
    if (!statusEl) return;
    
    if (dateChangeData.length > 0) {
        statusEl.textContent = `需更新：${dateChangeData.length} 条`;
        statusEl.style.color = '#ff6b6b';
    } else {
        statusEl.textContent = '✅ 所有商品日期已是最新';
        statusEl.style.color = '#52c41a';
    }
}

/**
 * 更新"需更新"按钮状态
 */
function updateDateChangeButton() {
    const btn = document.getElementById('batchUpdateDateBtn');
    if (!btn) return;
    const count = dateChangeData.length;
    
    if (count > 0) {
        btn.style.background = '#ff4d4f';
        btn.style.color = '#ffffff';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.textContent = `需更新 (${count})`;
        btn.disabled = false;
    } else {
        btn.style.background = '#d9d9d9';
        btn.style.color = '#999999';
        btn.style.fontWeight = 'normal';
        btn.style.cursor = 'not-allowed';
        btn.textContent = '需更新 (0)';
        btn.disabled = true;
    }
}

/**
 * 渲染日期更换列表
 */
function renderDateChangeList() {
    const tb = document.getElementById('dateChangeList');
    if (!tb) {
        console.warn('dateChangeList元素不存在');
        return;
    }
    
    console.log('渲染日期更换列表，数据量:', filteredDateChange.length);
    
    tb.innerHTML = '';
    
    const start = (dateChangeCurrentPage - 1) * dateChangePageSize;
    const pageData = filteredDateChange.slice(start, start + dateChangePageSize);
    
    console.log('当前页数据量:', pageData.length);
    
    if (pageData.length === 0) {
        tb.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:30px;color:#999;">暂无需要更新的商品</td></tr>';
        return;
    }
    
    tb.innerHTML = '';
    pageData.forEach((item, idx) => {
        let statusText = '无';
        let statusColor = '#999';
        let countDownText = '';
        
        if (item.earliestBatch && item.earliestBatch.bzStatusText) {
            statusText = item.earliestBatch.bzStatusText;
            countDownText = item.earliestBatch.countDownText || '';
            
            switch(statusText) {
                case '过期': statusColor = '#ff4d4f'; break;
                case '临期': statusColor = '#faad14'; break;
                case '打折': statusColor = '#1890ff'; break;
                case '正常': statusColor = '#52c41a'; break;
                default: statusColor = '#999';
            }
        }
        
        // ✅ 确定日期类型显示文字和颜色
        let dateTypeDisplay = '';
        let dateTypeColor = '';
        if (item.dateType === '生产日期') {
            dateTypeDisplay = '生产';
            dateTypeColor = '#d4edda';  // 浅绿色
        } else if (item.dateType === '到期日期') {
            dateTypeDisplay = '到期';
            dateTypeColor = '#f8d7da';  // 浅红色
        } else {
            dateTypeDisplay = item.dateType || '';
            dateTypeColor = '#f5f5f5';
        }
        
        const rowNum = start + idx + 1;
        const dateStr = item.dateValue ? new Date(item.dateValue).toISOString().split('T')[0] : '-';
        const recordDateStr = item.earliestBatch && item.earliestBatch.recordDate 
            ? new Date(item.earliestBatch.recordDate).toISOString().split('T')[0] 
            : '-';
        
        // ========== 修改开始：生成复制按钮的文字内容 ==========
        // 根据日期类型和显示值生成复制内容
        let copyText = '';
        if (item.dateType === '生产日期' && item.displayValue) {
            copyText = `（${item.displayValue}生产）`;
        } else if (item.dateType === '到期日期' && item.displayValue) {
            copyText = `（${item.displayValue}到期）`;
        } else {
            copyText = '';
        }
        // ========== 修改结束 ==========
        
        const html = `
            <tr>
                <td>${rowNum}</td>
                <td>${recordDateStr}</td>
                <td>${item.supplier || ''}</td>
                <td>${item.name || ''}</td>
                <td>${item.spec || '-'}</td>
                <td>${item.batchRemain || 0}</td>
                <td style="color:${statusColor};">${statusText}</td>
                <td>${countDownText}</td>
                <td>${dateStr}</td>
                <td style="background-color:${dateTypeColor}; font-weight:bold; text-align:center;">${dateTypeDisplay}</td>
                <td>${item.displayValue || ''}</td>
                <td>
                    <!-- ========== 修改开始：添加复制按钮 ========== -->
                    <button class="btn btn-success" onclick="copyDateText('${copyText.replace(/'/g, "\\'")}', this)" style="padding:4px 8px; font-size:12px; margin-right:4px;">复制</button>
                    <!-- ========== 修改结束 ========== -->
                    <button class="btn btn-primary" onclick="updateSingleGoodsDate(${item.id})" style="padding:4px 12px; font-size:12px;">更新</button>
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    });
}

// ========== 新增：复制日期文本函数 ==========
function copyDateText(text, btnElement) {
    if (!text) {
        showMsg('没有可复制的内容');
        return;
    }
    
    // 使用 navigator.clipboard 复制
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            // 复制成功，显示反馈
            const originalText = btnElement.textContent;
            btnElement.textContent = '√已复制';
            btnElement.style.background = '#52c41a';
            btnElement.style.color = '#ffffff';
            
            // 2秒后恢复
            setTimeout(function() {
                btnElement.textContent = '复制';
                btnElement.style.background = '';
                btnElement.style.color = '';
            }, 2000);
        }).catch(function() {
            // 降级方案：使用 document.execCommand
            fallbackCopy(text, btnElement);
        });
    } else {
        // 降级方案
        fallbackCopy(text, btnElement);
    }
}

// 降级复制方案
function fallbackCopy(text, btnElement) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        // 复制成功
        const originalText = btnElement.textContent;
        btnElement.textContent = '√已复制';
        btnElement.style.background = '#52c41a';
        btnElement.style.color = '#ffffff';
        setTimeout(function() {
            btnElement.textContent = '复制';
            btnElement.style.background = '';
            btnElement.style.color = '';
        }, 2000);
    } catch (e) {
        showMsg('复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
}

/**
 * 单条更新商品日期
 */
async function updateSingleGoodsDate(id) {
    const item = allGoods.find(g => g.id === id);
    if (!item) {
        showMsg('找不到该商品');
        return;
    }
    
    const earliest = getEarliestBatchDate(item.supplier, item.name, item.spec);
    if (!earliest || earliest.batchRemain <= 0) {
        showMsg('该商品暂无库存批次');
        return;
    }
    
    let dateType = '';
    let dateValue = '';
    if (earliest.produce_date) {
        dateType = '生产日期';
        dateValue = earliest.produce_date;
    } else if (earliest.expire_date) {
        dateType = '到期日期';
        dateValue = earliest.expire_date;
    } else {
        showMsg('该批次没有有效日期');
        return;
    }
    
    const confirmMsg = `确认平台已更新"${item.name}"日期？\n一旦更新数据消失（不可逆）！\n\n${dateType}：${dateValue}`;
    if (!confirm(confirmMsg)) return;
    
    try {
        const updateData = {};
        if (earliest.produce_date) {
            updateData.saved_produce_date = earliest.produce_date;
        }
        if (earliest.expire_date) {
            updateData.saved_expire_date = earliest.expire_date;
        }
        updateData.saved_date_updated_at = new Date().toISOString();
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('更新失败:', errorText);
            showMsg('更新失败：' + errorText);
            return;
        }
        
        showMsg(`✅ 商品"${item.name}"日期更新成功！`);
        // ✅ 强制重新加载商品数据
        await loadGoods(true);
        // ✅ 强制刷新后台更换日期列表
        loadDateChangeTab();
    } catch (e) {
        showMsg('更新失败：' + e.message);
        console.error(e);
    }
}

/**
 * 批量更新所有商品日期（一键更新）
 */
async function batchUpdateGoodsDate() {
    const needUpdateList = getNeedUpdateGoodsList();
    if (needUpdateList.length === 0) {
        showMsg('没有需要更新的商品');
        return;
    }
    
    if (!confirm(`⚠ 确认一键更新 ${needUpdateList.length} 条商品？\n\n点击后所有数据将完全消失（不可逆）！\n请确认平台商品日期都已更改为最新日期！`)) {
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const item of needUpdateList) {
        try {
            const earliest = getEarliestBatchDate(item.supplier, item.name, item.spec);
            if (!earliest || earliest.batchRemain <= 0) continue;
            
            const updateData = {};
            if (earliest.produce_date) {
                updateData.saved_produce_date = earliest.produce_date;
            }
            if (earliest.expire_date) {
                updateData.saved_expire_date = earliest.expire_date;
            }
            updateData.saved_date_updated_at = new Date().toISOString();
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${item.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                successCount++;
            } else {
                failCount++;
                console.error('更新失败:', item.name, await response.text());
            }
        } catch (e) {
            failCount++;
            console.error('更新失败:', item.name, e);
        }
    }
    
    showMsg(`✅ 批量更新完成！成功 ${successCount} 条${failCount > 0 ? `，失败 ${failCount} 条` : ''}`);
    // ✅ 强制重新加载商品数据
    await loadGoods(true);
    // ✅ 强制刷新后台更换日期列表
    loadDateChangeTab();
}

// ========== 日期更换分页 ==========
function renderDateChangePagination() {
    dateChangeTotalPages = Math.ceil(filteredDateChange.length / dateChangePageSize) || 1;
    
    const currentPageEl = document.getElementById('dateChangeCurrentPage');
    const totalPagesEl = document.getElementById('dateChangeTotalPages');
    if (currentPageEl) currentPageEl.textContent = dateChangeCurrentPage;
    if (totalPagesEl) totalPagesEl.textContent = dateChangeTotalPages;
    
    const pgBox = document.getElementById('dateChangePageNumbers');
    if (!pgBox) return;
    pgBox.innerHTML = '';
    
    let s = Math.max(1, dateChangeCurrentPage - 2);
    let e = Math.min(dateChangeTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === dateChangeCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => dateChangeGoToPage(i);
        pgBox.appendChild(btn);
    }
    
    const btns = document.querySelectorAll('#sub-dateChange .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (dateChangeCurrentPage === 1);
        btns[1].disabled = (dateChangeCurrentPage === 1);
        btns[btns.length - 2].disabled = (dateChangeCurrentPage === dateChangeTotalPages);
        btns[btns.length - 1].disabled = (dateChangeCurrentPage === dateChangeTotalPages);
    }
}

function dateChangeGoToPage(p) {
    if (p < 1 || p > dateChangeTotalPages) return;
    dateChangeCurrentPage = p;
    renderDateChangePagination();
    renderDateChangeList();
}

function dateChangePrevPage() { dateChangeGoToPage(dateChangeCurrentPage - 1); }
function dateChangeNextPage() { dateChangeGoToPage(dateChangeCurrentPage + 1); }

function changeDateChangePageSize() {
    dateChangePageSize = +document.getElementById('dateChangePageSize').value;
    dateChangeCurrentPage = 1;
    renderDateChangePagination();
    renderDateChangeList();
}