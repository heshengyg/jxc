let goodsUsedCache = new Map();
// ========== HTML 转义函数 ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;
// ========== 商品筛选数据 ==========
let goodsFilterData = {
    supplier: [],
    goodsName: [],
    channel: ['线上', '线下']  // 结算方式固定
};
let isLoadingGoods = false;  // ✅ 添加这行
let isGoodsLoaded = false;   // ✅ 添加这行，标记是否已加载

// ========== 权限辅助函数 ==========
function isFinanceOrAdmin() {
// 改日改-更新按钮权限：管理员、APP部
function canOperateDateUpdate() {
    if (typeof currentUserId === 'undefined' || !currentUserId) return false;
    if (typeof permissionData === 'undefined') return false;
    const user = permissionData.users.find(u => u.id === currentUserId);
    if (!user) return false;
    const role = permissionData.roles.find(r => r.id === user.roleId);
    if (!role) return false;
    return role.name === '管理员' || role.name === 'APP部';
}
// 改价按钮权限：管理员、商品部
function canOperatePriceEdit() {
    if (typeof currentUserId === 'undefined' || !currentUserId) return false;
    if (typeof permissionData === 'undefined') return false;
    const user = permissionData.users.find(u => u.id === currentUserId);
    if (!user) return false;
    const role = permissionData.roles.find(r => r.id === user.roleId);
    if (!role) return false;
    return role.name === '管理员' || role.name === '商品部';
}
// 挂载全局
window.canOperateDateUpdate = canOperateDateUpdate;
window.canOperatePriceEdit = canOperateDateUpdate;
window.isFinanceOrAdmin = isFinanceOrAdmin;

    if (typeof currentUserId === 'undefined' || !currentUserId) return false;
    if (typeof permissionData === 'undefined') return false;
    var user = permissionData.users.find(u => u.id === currentUserId);
    if (!user) return false;
    var role = permissionData.roles.find(r => r.id === user.roleId);
    if (!role) return false;
    return role.name === '管理员' || role.name === '财务部';
}

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
// 供应商管理下拉缓存变量
let settleSupplierList = [];
let settleSearchTimer = null;

allGoods = [];
filteredGoods = [];
currentPage = 1;
pageSize = 10;
totalPages = 1;
sortField = '';
sortAsc = true;

function capitalize(str = '') {
    if(!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

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
        
        // 初始化供应商下拉数据
        const suppliers = settleData.map(s => s.supplier).sort();
        settleSupplierList = suppliers;
        
        // 重置搜索框
        const searchInput = document.getElementById('settleSupplierSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        const listBox = document.getElementById('settleSupplierListBox');
        if (listBox) {
            listBox.style.display = 'none';
        }
        
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

// ========== 供应商管理 - 供应商搜索下拉 ==========
function showSettleSupplierList() {
    renderSettleSupplierList(settleSupplierList);
    document.getElementById('settleSupplierListBox').style.display = 'block';
}

function filterSettleSupplierList() {
    const kw = document.getElementById('settleSupplierSearchInput').value.toLowerCase();
    const filtered = settleSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderSettleSupplierList(filtered);
    document.getElementById('settleSupplierListBox').style.display = 'block';
}

function renderSettleSupplierList(list) {
    const box = document.getElementById('settleSupplierListBox');
    if (!box) return;
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
            document.getElementById('settleSupplierSearchInput').value = s;
            document.getElementById('settleSupplierListBox').style.display = 'none';
            // 输入即搜索
            filterSettleList();
        };
        box.appendChild(div);
    });
}

// ========== 供应商管理实时搜索（输入即搜索） ==========
function onSettleFilterInput() {
    // 清除之前的定时器
    if (settleSearchTimer) {
        clearTimeout(settleSearchTimer);
    }
    // 防抖处理，300ms后执行搜索
    settleSearchTimer = setTimeout(() => {
        filterSettleList();
        // 显示下拉列表
        const input = document.getElementById('settleSupplierSearchInput');
        if (document.activeElement === input) {
            const kw = input.value.toLowerCase().trim();
            const filtered = settleSupplierList.filter(s => s.toLowerCase().includes(kw));
            renderSettleSupplierList(filtered);
            document.getElementById('settleSupplierListBox').style.display = 'block';
        }
    }, 300);
}

// ========== 供应商管理重置搜索 ==========
function resetSettleSearch() {
    document.getElementById('settleSupplierSearchInput').value = '';
    document.getElementById('settleChannelSearch').value = '';
    document.getElementById('settleSupplierListBox').style.display = 'none';
    filterSettleList();
}

// 筛选结算类型列表
function filterSettleList() {
    let supplier = document.getElementById('settleSupplierSearchInput').value.trim();
    let channel = document.getElementById('settleChannelSearch').value;
    
    filteredSettle = settleData.filter(item => {
        let matchSupplier = true;
        let matchChannel = !channel || item.channel === channel;
        
        // 模糊匹配供应商
        if (supplier) {
            matchSupplier = (item.supplier || '').toLowerCase().includes(supplier.toLowerCase());
        }
        
        return matchSupplier && matchChannel;
    });
    
    let searchCountEl = document.getElementById('settleSearchCount');
    if (searchCountEl) searchCountEl.textContent = filteredSettle.length;
    
    settleCurrentPage = 1;
    renderSettlePagination();
    renderSettleList();
}

// 重置结算类型搜索（旧版本，保留兼容）
function resetSettleSearchOld() {
    resetSettleSearch();
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
        alert('请输入供应商名称！');
        return;
    }
    
    // ✅ 检查供应商+结算方式是否重复
    let isDuplicate = settleData.some(item => {
        // 如果是编辑模式，排除自身
        if (id && item.id == id) return false;
        return item.supplier === supplier && item.channel === channel;
    });
    
    if (isDuplicate) {
        alert(`供应商"${supplier}"的结算方式"${channel}"已存在！`);
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
                    alert(`供应商"${supplier}"的结算方式"${channel}"已存在！`);
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
    // 1. 优先隐藏所有内容，不依赖按钮
    const contents = document.querySelectorAll('#goods .finance-sub-content');
    contents.forEach(div => div.style.display = 'none');
    const targetContent = document.getElementById('sub-' + tab);
    if (targetContent) targetContent.style.display = 'block';

    // 2. 容错处理按钮，找不到不阻断流程
    const buttons = document.querySelectorAll('#goods .finance-sub-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.querySelector(`#goods .finance-sub-btn[data-tab="${tab}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    // 3. 各Tab加载逻辑
    if (tab === 'settleType') {
        loadSettleList();
    } else if (tab === 'goodsInfo') {
        currentPage = 1;
        const goodsTbody = document.getElementById('goodsList');
        if(goodsTbody) goodsTbody.innerHTML = '';
        loadGoods(true);
    } else if (tab === 'dateChange') {
        loadDateChangeTab();
    } else if (tab === 'unitPreset') {
    loadUnitList();
}
}
// 渠道切换：控制线上成本价、税率、保质期时长、保质期单位输入框禁用/启用
function toggleOnlineCostInput() {
    let channel = document.getElementById('add_channel').value;
    let costInput = document.getElementById('add_online_cost');
    let shelfNumInput = document.getElementById('add_shelf_life_num');
    let shelfUnitSelect = document.getElementById('add_shelf_life_unit');

    // 线上成本价：线上可填，线下禁用
    if (channel === '线下') {
        costInput.disabled = true;
        costInput.value = '';
    } else {
        costInput.disabled = false;
    }

    // 保质期和单位始终可用（不再根据渠道禁用）
    if (shelfNumInput) shelfNumInput.disabled = false;
    if (shelfUnitSelect) shelfUnitSelect.disabled = false;
}

function clearSort() {
    sortField = '';
    sortAsc = true;
    updateSortIcon();
    loadGoods();
}

async function loadGoods(force) {
    if (force) {
        isLoadingGoods = false;
        isGoodsLoaded = false;
        allGoods = [];
    } else {
        if (isLoadingGoods) return;
    }
    try {
        isLoadingGoods = true;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        const list = await res.json();
        allGoods = list.sort((a, b) => b.id - a.id);
        window.allGoods = allGoods;
        initGoodsFilterData();
        isGoodsLoaded = true;
        await filterGoodsWaitCache();
        const totalCountEl = document.getElementById('totalCount');
        if (totalCountEl) totalCountEl.textContent = allGoods.length;
        renderPagination();
        renderGoods();
        loadSettleListSilently();
    } catch (e) {
        showMsg('加载商品失败：' + e.message);
        console.error(e);
    } finally {
        isLoadingGoods = false;
    }
}

// 等待缓存异步完成的筛选函数
async function filterGoodsWaitCache() {
    const supplier = document.getElementById('goodsFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('goodsFilterGoodsNameInput')?.value.trim() || '';
    const channel = document.getElementById('goodsFilterChannelInput')?.value.trim() || '';
    filteredGoods = Array.isArray(allGoods) ? allGoods.filter(item => {
        let match = true;
        if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
        if (goodsName && !(item.name || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
        if (channel && !(item.channel || '').toLowerCase().includes(channel.toLowerCase())) match = false;
        return match;
    }) : [];
    const searchCount = document.getElementById('searchCount');
    if (searchCount) searchCount.textContent = filteredGoods.length;
    currentPage = 1;
    goodsUsedCache.clear();
    const start = (currentPage - 1) * pageSize;
    const pageData = filteredGoods.slice(start, start + pageSize);
    for (const item of pageData) {
        const used = await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec);
        goodsUsedCache.set(item.id, used);
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
    
    // ✅ 确保 settleData 已加载
    if (!settleData || settleData.length === 0) {
        loadSettleListSilently();
        box.innerHTML = '<div style="padding:6px 10px;color:#999;">加载中...</div>';
        box.style.display = 'block';
        setTimeout(() => showAddSupplierList(), 500);
        return;
    }
    
    let suppliers = settleData.map(s => s.supplier).sort();
    const keyword = searchInput.value.toLowerCase().trim();
    if (keyword) {
        suppliers = suppliers.filter(s => s.toLowerCase().includes(keyword));
    }
    
    box.innerHTML = '';
    if (suppliers.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配供应商</div>';
        box.style.display = 'block';
        return;
    }
    suppliers.forEach(sup => {
        let div = document.createElement('div');
        div.textContent = sup;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            searchInput.value = sup;
            document.getElementById('add_supplier').value = sup;
            box.style.display = 'none';
            onSupplierChange();
            var evt = new Event('change', { bubbles: true });
            searchInput.dispatchEvent(evt);
        };
        box.appendChild(div);
    });
    box.style.display = 'block';
}

function filterAddSupplierList() {
    showAddSupplierList();
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
    try {
// ✅ 加载单位下拉数据
        loadComboPackListData();
        document.getElementById('formTitle').innerText = '新增商品';
        document.getElementById('editId').value = '';

        document.getElementById('addSupplierSearch').value = '';
        document.getElementById('add_supplier').value = '';
        document.getElementById('add_name').value = '';
        document.getElementById('add_spec').value = '';
        document.getElementById('add_channel').value = '';
        document.getElementById('add_tax_rate').value = '';
        document.getElementById('add_sale_price').value = '';
        document.getElementById('add_online_cost').value = '';
        document.getElementById('add_warn_num').value = '';
        document.getElementById('add_shelf_life_num').value = '';
        document.getElementById('add_shelf_life_unit').value = '';

        document.getElementById('add_supplier').disabled = false;
        document.getElementById('addSupplierSearch').disabled = false;
        document.getElementById('add_name').disabled = false;
        document.getElementById('add_spec').disabled = false;
        document.getElementById('add_channel').disabled = true;

        var taxSelect = document.getElementById('add_tax_rate');
        if (taxSelect) {
            try {
                taxSelect.disabled = !isFinanceOrAdmin();
            } catch (e) {
                taxSelect.disabled = true;
                console.warn('权限检测失败，税率默认禁用', e);
            }
        }

        toggleOnlineCostInput();

        document.getElementById('formModal').style.display = 'block';
    } catch (e) {
        console.error('openAddForm 执行错误:', e);
        showMsg('打开新增表单失败，请刷新页面重试');
    }
}

async function openEditForm(id) {
    console.log('📝 打开编辑表单，ID:', id);
    let item = allGoods.find(x => x.id === id);
    if (!item) {
        showMsg('商品不存在');
        return;
    }

    document.getElementById('formTitle').innerText = '编辑商品';
    document.getElementById('editId').value = id;

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
    document.getElementById('addSupplierSearch').disabled = false;
    document.getElementById('add_name').disabled = false;
    document.getElementById('add_spec').disabled = false;
    document.getElementById('add_channel').disabled = true;

    toggleOnlineCostInput();

    let isUsed = await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec);

    ['addSupplierSearch', 'add_name', 'add_spec'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.oninput = null;
            el.onchange = null;
        }
    });

    var savedUser = sessionStorage.getItem('supabase_user') || sessionStorage.getItem('user');
    var userRole = '';
    if (savedUser) {
        try {
            var userObj = JSON.parse(savedUser);
            userRole = userObj.role || '';
        } catch(e) {}
    }
    var isFinanceOrAdminRole = (userRole === '管理员' || userRole === '财务部');

    if (isUsed) {
        document.getElementById('add_supplier').disabled = true;
        document.getElementById('addSupplierSearch').disabled = true;
        document.getElementById('add_name').disabled = true;
        document.getElementById('add_spec').disabled = true;
        document.getElementById('add_tax_rate').disabled = true;
    } else {
        var taxSelect = document.getElementById('add_tax_rate');
        if (taxSelect) {
            taxSelect.disabled = !isFinanceOrAdminRole;
        }

        function handleFieldChange() {
            if (isUsed) return;
            var taxSelect = document.getElementById('add_tax_rate');
            if (taxSelect) {
                taxSelect.value = '';
                taxSelect.disabled = !isFinanceOrAdminRole;
            }
        }
        ['addSupplierSearch', 'add_name', 'add_spec'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                el.oninput = handleFieldChange;
                el.onchange = handleFieldChange;
            }
        });
    }

    document.getElementById('formModal').style.display = 'block';
}

function resetSearch() {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchField').selectedIndex = 0;
    filterGoods();
}

function filterGoods() {
    const supplier = document.getElementById('goodsFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('goodsFilterGoodsNameInput')?.value.trim() || '';
    const channel = document.getElementById('goodsFilterChannelInput')?.value.trim() || '';
    filteredGoods = Array.isArray(allGoods) ? allGoods.filter(item => {
        let match = true;
        if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
        if (goodsName && !(item.name || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
        if (channel && !(item.channel || '').toLowerCase().includes(channel.toLowerCase())) match = false;
        return match;
    }) : [];
    const searchCount = document.getElementById('searchCount');
    if (searchCount) searchCount.textContent = filteredGoods.length;
    currentPage = 1;
    renderPagination();
    goodsUsedCache.clear();
    
    (async () => {
        const start = (currentPage - 1) * pageSize;
        const pageData = filteredGoods.slice(start, start + pageSize);
        for (const item of pageData) {
            const used = await checkGoodsUsedByStockIn(item.supplier, item.name, item.spec);
            goodsUsedCache.set(item.id, used);
        }
        renderGoods();
    })();
    renderGoods();
}

// ========== 商品筛选下拉 ==========
function initGoodsFilterData() {
    if (!allGoods || allGoods.length === 0) return;
    goodsFilterData.supplier = [...new Set(allGoods.map(item => item.supplier).filter(s => s))].sort();
    goodsFilterData.goodsName = [...new Set(allGoods.map(item => item.name).filter(n => n))].sort();
}

function showGoodsFilterList(type) {
    const listId = `goodsFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    const inputId = `goodsFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderGoodsFilterList(type, kw);
    box.style.display = 'block';
}
function filterGoodsFilterList(type) {
    const inputId = `goodsFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderGoodsFilterList(type, kw);
    const listId = `goodsFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (box) box.style.display = 'block';
}

function renderGoodsFilterList(type, keyword = '') {
    const listId = `goodsFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    let data = goodsFilterData[type] || [];
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
            const inputId = `goodsFilter${capitalize(type)}Input`;
            document.getElementById(inputId).value = opt;
            box.style.display = 'none';
            filterGoods();
        };
        box.appendChild(div);
    });
}

function resetGoodsSearch() {
    document.getElementById('goodsFilterSupplierInput').value = '';
    document.getElementById('goodsFilterGoodsNameInput').value = '';
    document.getElementById('goodsFilterChannelInput').value = '';
    document.querySelectorAll('[id^="goodsFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterGoods();
}
// ========== 商品实时搜索（输入即搜索） ==========
function onGoodsFilterInput() {
    filterGoods();
    
    const supplierInput = document.getElementById('goodsFilterSupplierInput');
    const goodsInput = document.getElementById('goodsFilterGoodsNameInput');
    const channelInput = document.getElementById('goodsFilterChannelInput');
    
    if (document.activeElement === supplierInput) {
        renderGoodsFilterList('supplier', supplierInput.value.trim());
        document.getElementById('goodsFilterSupplierList').style.display = 'block';
    } else if (document.activeElement === goodsInput) {
        renderGoodsFilterList('goodsName', goodsInput.value.trim());
        document.getElementById('goodsFilterGoodsNameList').style.display = 'block';
    } else if (document.activeElement === channelInput) {
        renderGoodsFilterList('channel', channelInput.value.trim());
        document.getElementById('goodsFilterChannelList').style.display = 'block';
    }
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
        let isUsed = goodsUsedCache.get(item.id) ?? false;
        
        let delBtn = '';
        if (isUsed) {
            delBtn = `<button class="btn btn-danger" disabled style="opacity:0.5">删除</button>`;
        } else {
            delBtn = `<button class="btn btn-danger" onclick="deleteGoods(${item.id})">删除</button>`;
        }
        
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
    const totalItems = Array.isArray(filteredGoods) ? filteredGoods.length : 0;
    totalPages = Math.ceil(totalItems / pageSize) || 1;
    
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
        if (!cb.disabled) {
            cb.checked = all;
        }
    });
}

function closeForm() {
    document.getElementById('formModal').style.display = 'none';
}

function isDuplicate(supplier, name, spec, editId) {
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
    
    if (!supplier || !name || !channel || !salePrice) return alert('必填项不能为空');
    if (+salePrice <= 0) return alert('销售单价必须大于0');
    if (isDuplicate(supplier, name, spec, editId)) return alert('该供应商下已存在同名同规格商品！');
    
    let oldSalePrice = null;
    let priceChanged = false;
    let newPrice = +salePrice;
    
    if (editId) {
        const oldItem = allGoods.find(g => g.id == editId);
        if (oldItem) {
            oldSalePrice = Number(oldItem.sale_price);
            // 用户输入的新价格 != 数据库中的旧价格 → 价格变动
            if (newPrice !== oldSalePrice) {
                priceChanged = true;
                console.log('⚠️ 销售价变动:', oldSalePrice, '→', newPrice);
            }
        }
    }
    
    let data = {
        supplier: supplier.trim(),
        name: name.trim(),
        spec: spec.trim() || null,
        channel: channel,
        tax_rate: taxRate,
        sale_price: newPrice,
        online_cost: onlineCost ? +onlineCost : null,
        warn_num: warnNum ? +warnNum : null,
        shelf_life_num: shelfNum ? +shelfNum : null,
        shelf_life_unit: shelfUnit || null,
        // ✅ last_sale_price 记录上一次的价格（即修改前的 sale_price）
        last_sale_price: editId ? oldSalePrice : null
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
            
            if (priceChanged) {
                await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${editId}`, {
                    method: 'DELETE',
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`
                    }
                });
                console.log('✅ 已清空商品', editId, '的所有临时价格（销售价变动）');
                showMsg('⚠️ 销售价已变动，所有状态价格已清空，请重新设置');
            }
        } else {
            // 新增商品：last_sale_price 为 null
            data.last_sale_price = null;
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
        await loadGoods(true);
        if (typeof loadAllGoods === 'function') {
            await loadAllGoods();
        }
    } catch (e) {
        showMsg('操作失败');
    }
}

async function deleteGoods(id) {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除商品');
        return;
    }
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
        await loadGoods(true);
        if (typeof loadAllGoods === 'function') {
            await loadAllGoods();
        }
    } catch (e) {
        showMsg('删除失败');
    }
}
async function batchDelete() {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以批量删除商品');
        return;
    }

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
            expire
        ];
    });
    let ws = XLSX.utils.aoa_to_sheet([header, ...exportData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "商品列表");
    XLSX.writeFile(wb, "商品列表.xlsx");
}

// ========== 商品批量导入 ==========
function importGoodsExcel() {
    let fileInput = document.getElementById('goodsFileInput');
    let file = fileInput.files[0];
    if (!file) {
        showMsg('请选择文件');
        return;
    }

    let reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, { type: 'array' });
            let sheet = workbook.Sheets[workbook.SheetNames[0]];
            let json = XLSX.utils.sheet_to_json(sheet);

            if (json.length === 0) {
                showMsg('Excel 文件为空或格式不正确');
                fileInput.value = '';
                return;
            }

            let successCount = 0;
            let failCount = 0;
            let failDetails = [];

            for (let row of json) {
                let supplier = row['供应商'] || row['supplier'] || '';
                let name = row['商品名称'] || row['goodsName'] || row['name'] || '';
                let spec = row['规格'] || row['spec'] || '';
                let channel = row['销售渠道'] || row['channel'] || row['结算方式'] || '';
                let salePrice = parseFloat(row['销售单价'] || row['sale_price'] || 0);
                let taxRate = row['税率'] || row['tax_rate'] || '';
                let onlineCost = parseFloat(row['线上成本价'] || row['online_cost'] || 0);
                let warnNum = parseInt(row['库存预警阈值'] || row['warn_num'] || 0);
                let shelfLifeNum = row['保质期时长'] || row['shelf_life_num'] || '';
                let shelfLifeUnit = row['保质期单位'] || row['shelf_life_unit'] || '';

                if (!supplier || !name) {
                    failCount++;
                    failDetails.push(`缺少供应商或商品名: 供应商="${supplier}", 商品名="${name}"`);
                    continue;
                }

                if (!channel) {
                    let found = settleData.find(s => s.supplier === supplier);
                    if (found) {
                        channel = found.channel;
                    } else {
                        channel = '线下';
                    }
                }

                let postData = {
                    supplier: supplier.trim(),
                    name: name.trim(),
                    spec: spec.trim() || null,
                    channel: channel.trim(),
                    tax_rate: taxRate || null,
                    sale_price: salePrice || 0,
                    online_cost: onlineCost || null,
                    warn_num: warnNum || null,
                    shelf_life_num: shelfLifeNum || null,
                    shelf_life_unit: shelfLifeUnit || null
                };

                try {
                    let res = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
                        method: 'POST',
                        headers: {
                            apikey: SUPABASE_KEY,
                            Authorization: `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(postData)
                    });

                    if (res.ok) {
                        successCount++;
                    } else {
                        let errorText = await res.text();
                        failCount++;
                        failDetails.push(`${name} 导入失败: ${errorText}`);
                        console.error('导入失败:', errorText);
                    }
                } catch (err) {
                    failCount++;
                    failDetails.push(`${name} 导入异常: ${err.message}`);
                    console.error('导入异常:', err);
                }
            }

            let msg = `导入完成：成功 ${successCount} 条`;
            if (failCount > 0) {
                msg += `，失败 ${failCount} 条`;
                if (failDetails.length > 0) {
                    msg += '\n' + failDetails.slice(0, 5).join('\n');
                    if (failDetails.length > 5) {
                        msg += `\n... 还有 ${failDetails.length - 5} 条错误`;
                    }
                }
            }
            showMsg(msg);

            fileInput.value = '';
            await loadGoods(true);
            if (typeof loadAllGoods === 'function') {
                await loadAllGoods();
            }

        } catch (err) {
            showMsg('导入失败：' + err.message);
            console.error(err);
            fileInput.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}
// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    switchGoodsSubTab('goodsInfo');
    if (typeof loadStockStock === 'function') {
        loadStockStock();
    }
});
// ============================================================
// ========== 后台更换日期模块 ==========
// ============================================================

let dateChangeData = [];
let dateChangeFilteredList = [];
let dateChangeCurrentPage = 1;
let dateChangePageSize = 10;
let dateChangeTotalPages = 1;

let dateChangeFilterData = {
    supplier: [],
    goodsName: [],
    spec: [],
    settleType: [],
    bzStatus: []
};

function getEarliestBatchDate(supplier, goodsName, spec) {
    try {
        if (!allStockBatchList || allStockBatchList.length === 0) {
            return null;
        }
        
        const batchList = allStockBatchList.filter(function(item) {
            if (item.supplier !== supplier || item.goodsName !== goodsName) {
                return false;
            }
            const itemSpec = item.spec || '-';
            const targetSpec = spec || '-';
            return itemSpec === targetSpec;
        });
        
        if (!batchList || batchList.length === 0) {
            return null;
        }
        
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
            
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            
            return dateA.date - dateB.date;
        });
        
        const earliest = batchList[0];
        
        console.log('最早批次:', earliest.goodsName, '生产日期:', earliest.produce_date, '到期日期:', earliest.expire_date);
        
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

function formatDateTimeValue(dateStr, dateType, goodsItem) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    if (dateType === '到期日期') {
        return `${year}年${month}月${day}日`;
    }
    
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

async function getNeedUpdateGoodsList() {
    const result = [];
    if (!allGoods || allGoods.length === 0) {
        console.log('allGoods 为空');
        return result;
    }
    
    // 批量加载所有 price_temp_state 数据
    let priceMap = {};
    try {
        const priceRes = await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?select=*`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        const priceData = await priceRes.json();
        priceData.forEach(item => {
            priceMap[item.goods_id] = {
                expirePrice: item.expire_price,
                discount1Price: item.discount_1_price,
                discount2Price: item.discount_2_price,
                discount3Price: item.discount_3_price,
                discount4Price: item.discount_4_price
            };
        });
        console.log('✅ 加载 price_temp_state 数据:', priceData.length, '条');
    } catch(e) {
        console.warn('加载 price_temp_state 失败:', e);
    }
    
    for (const item of allGoods) {
        // ========== 检查是否有库存批次 ==========
        const earliest = getEarliestBatchDate(item.supplier, item.name, item.spec || '-');
        if (!earliest || earliest.batchRemain <= 0) {
            continue; // 没有库存，跳过
        }
        
        // ========== 检查日期是否需要更新 ==========
const dateCheck = checkNeedDateUpdate(item);
const dateChanged = dateCheck.needUpdate;

// ========== 检查价格是否需要更新 ==========
const normalPrice = item.sale_price || 0;
const lastPrice = item.last_sale_price !== null && item.last_sale_price !== undefined 
    ? Number(item.last_sale_price) 
    : normalPrice;
const priceChanged = (normalPrice !== lastPrice);

// ========== 如果日期和价格都没有变化，跳过 ==========
if (!dateChanged && !priceChanged) {
    continue;
}

// ========== 获取保质期状态 ==========
const bzStatus = earliest.bzStatusText || '';

// ========== ✅ 新增：计算"需更新日期" ==========
let needUpdateDate = '';
let needUpdateDateColor = '';
let showCopyDateBtn = false;

if (dateChanged) {
    needUpdateDate = dateCheck.displayValue || dateCheck.dateValue || '日期已变';
    needUpdateDateColor = '#ff6b6b';
    showCopyDateBtn = true;
} else {
    needUpdateDate = '无需改日';
    needUpdateDateColor = '#52c41a';
}

// ========== 根据状态获取当前销售价 ==========
let currentSalePrice = normalPrice;
let newSalePrice = null;
let priceStatus = 'pending';
let statusPrice = null;

const priceData = priceMap[item.id];
const isNormalOrExpire = (bzStatus === '正常' || bzStatus === '过期');

if (isNormalOrExpire) {
    // 正常/过期状态：使用 normalPrice
    currentSalePrice = normalPrice;
    newSalePrice = null;
    priceStatus = 'pending';
} else {
    // 折扣/临期状态：从 price_temp_state 获取
    if (priceData) {
        if (bzStatus === '临期') {
            statusPrice = priceData.expirePrice;
        } else if (bzStatus === 'discount_1' || bzStatus === '打6.5折') {
            statusPrice = priceData.discount1Price;
        } else if (bzStatus === 'discount_2' || bzStatus === '打7折') {
            statusPrice = priceData.discount2Price;
        } else if (bzStatus === 'discount_3' || bzStatus === '打8折') {
            statusPrice = priceData.discount3Price;
        } else if (bzStatus === 'discount_4' || bzStatus === '打9.5折') {
            statusPrice = priceData.discount4Price;
        }
        
        if (statusPrice !== null && statusPrice !== undefined) {
            currentSalePrice = statusPrice;
            newSalePrice = statusPrice;
            priceStatus = 'updated';
        } else {
            // ✅ 折扣/临期状态但价格为空，设为 null
            currentSalePrice = null;
            newSalePrice = null;
            priceStatus = 'pending';
        }
    } else {
        // 没有 price_temp_state 数据
        currentSalePrice = null;
        newSalePrice = null;
        priceStatus = 'pending';
    }
}
// ========== 判断是否为折扣/临期状态 ==========
const isDiscountOrExpire = (bzStatus !== '正常' && bzStatus !== '过期');

// ========== 计算"需更新销售价" ==========
let needUpdatePrice = '';
let needUpdatePriceColor = '';
let showPriceBtn = false;
let showCopyPriceBtn = false;

if (!isDiscountOrExpire) {
    // 正常/过期状态：价格变化时更新 goods.sale_price
    if (priceChanged) {
        needUpdatePrice = formatMoney(normalPrice);
        needUpdatePriceColor = '#ff6b6b';
        // ✅ 正常状态：newSalePrice = normalPrice，用于更新 goods.sale_price
        newSalePrice = normalPrice;
        showCopyPriceBtn = true;
    } else {
        needUpdatePrice = '无需改价';
        needUpdatePriceColor = '#52c41a';
        // ✅ 正常状态没有价格变化时，newSalePrice 为 null
        newSalePrice = null;
    }
    showPriceBtn = false;
} else {
    // 折扣/临期状态：价格存储在 price_temp_state，不修改 goods.sale_price
    showPriceBtn = true;
    if (statusPrice !== null && statusPrice !== undefined) {
        needUpdatePrice = formatMoney(statusPrice);
        needUpdatePriceColor = '#ff6b6b';
        // ✅ 折扣/临期状态：newSalePrice 只用于显示"复制新价"，不更新 goods.sale_price
        // 注意：这里 newSalePrice 保持 statusPrice 用于复制，但更新时不会写入 sale_price
        showCopyPriceBtn = true;
    } else {
        needUpdatePrice = '待改价';
        needUpdatePriceColor = '#ff9800';
        showCopyPriceBtn = false;
    }
}

// ========== 判断更新按钮是否可用 ==========
// 折扣/临期状态 + 没有状态价格 = 不可用
const isUpdateDisabled = isDiscountOrExpire && (statusPrice === null || statusPrice === undefined);

result.push({
    id: item.id,
    supplier: item.supplier || '',
    name: item.name || '',
    spec: item.spec || '-',
    channel: item.channel || '',
    settleType: item.channel || '',
    sale_price: item.sale_price || 0,
    currentSalePrice: currentSalePrice,
    normalPrice: normalPrice,
    lastSalePrice: lastPrice,
    online_cost: item.online_cost || 0,
    tax_rate: item.tax_rate || '',
    warn_num: item.warn_num || 0,
    shelf_life_num: item.shelf_life_num || '',
    shelf_life_unit: item.shelf_life_unit || '',
    saved_produce_date: item.saved_produce_date || null,
    saved_expire_date: item.saved_expire_date || null,
    saved_date_updated_at: item.saved_date_updated_at || null,
    earliestBatch: earliest,
    dateType: dateCheck.dateType || '',
    dateValue: dateCheck.dateValue || null,
    displayValue: dateCheck.displayValue || '',
    batchRemain: earliest.batchRemain || 0,
    recordDate: earliest.recordDate || null,
    newSalePrice: newSalePrice,
    priceStatus: priceStatus,
    bzStatus: bzStatus,
    dateChanged: dateChanged,
    priceChanged: priceChanged,
    needUpdateDate: needUpdateDate,          // ✅ 现在已定义
    needUpdateDateColor: needUpdateDateColor, // ✅ 现在已定义
    needUpdatePrice: needUpdatePrice,
    needUpdatePriceColor: needUpdatePriceColor,
    showPriceBtn: showPriceBtn,
    showCopyPriceBtn: showCopyPriceBtn,
    showCopyDateBtn: showCopyDateBtn,        // ✅ 现在已定义
    statusPrice: statusPrice,
    isDiscountOrExpire: isDiscountOrExpire,
    isUpdateDisabled: isUpdateDisabled
});

    }
    
    console.log('需要更新的商品总数:', result.length);
    return result;
}

async function loadDateChangeTab() {
    console.log('加载后台更换日期...');
    
    async function checkAndLoad() {
        if (!allGoods || allGoods.length === 0) {
            console.log('商品数据未加载，先加载商品...');
            await loadGoods();
            setTimeout(checkAndLoad, 300);
            return;
        }
        
        console.log('重新加载库存数据...');
        if (typeof loadStockStock === 'function') {
            allStockBatchList = [];
            await loadStockStock();
        }
// ========== 新增：如果 allStockBatchList 为空，手动构建 ==========
        if ((!allStockBatchList || allStockBatchList.length === 0) && allStockIn && allStockIn.length > 0) {
            console.log('🔄 allStockBatchList 为空，手动构建...');
            const groupMap = {};
            allStockIn.forEach(record => {
                const key = record.supplier + '|' + record.goodsName + '|' + (record.spec || '') + '|' + (record.produce_date || '') + '|' + (record.expire_date || '');
                if (!groupMap[key]) {
                    groupMap[key] = {
                        supplier: record.supplier,
                        goodsName: record.goodsName,
                        spec: record.spec || '',
                        settleType: record.settleType || '',
                        inRecords: [],
                        batchRemain: 0,
                        produce_date: record.produce_date || '-',
                        expire_date: record.expire_date || '-',
                        bzStatusText: '正常',
                        countDownText: '',
                        recordDate: record.record_date || null
                    };
                }
                groupMap[key].batchRemain += (record.remain_num || 0);
                groupMap[key].inRecords.push(record);
            });
            allStockBatchList = Object.values(groupMap);
            window.allStockBatchList = allStockBatchList;
            console.log('✅ 手动构建完成，allStockBatchList 长度:', allStockBatchList.length);
        }
        
        setTimeout(async function() {
            await doLoadDateChange();
        }, 500);
    }
    
    async function doLoadDateChange() {
    try {
        dateChangeData = await getNeedUpdateGoodsList();
        dateChangeFilteredList = Array.isArray(dateChangeData) ? [...dateChangeData] : [];
// ========== 新增：如果 getNeedUpdateGoodsList 返回空，手动构建 ==========
        if (dateChangeFilteredList.length === 0 && allStockBatchList && allStockBatchList.length > 0) {
            console.log('🔄 getNeedUpdateGoodsList 返回空，手动构建改日改价数据...');
            dateChangeData = [];
            for (const item of allGoods || []) {
                const batches = (allStockBatchList || []).filter(b => 
                    b.supplier === item.supplier && 
                    b.goodsName === item.name &&
                    (b.spec || '-') === (item.spec || '-')
                );
                if (batches.length > 0) {
                    const earliest = batches[0];
                    const dateType = (earliest.produce_date && earliest.produce_date !== '-') ? '生产日期' : 
                                     (earliest.expire_date && earliest.expire_date !== '-') ? '到期日期' : '';
                    const dateValue = (earliest.produce_date && earliest.produce_date !== '-') ? earliest.produce_date : 
                                      (earliest.expire_date || null);
                    dateChangeData.push({
                        id: item.id,
                        supplier: item.supplier || '',
                        name: item.name || '',
                        spec: item.spec || '-',
                        settleType: item.channel || '',
                        currentSalePrice: item.sale_price || 0,
                        batchRemain: earliest.batchRemain || 0,
                        earliestBatch: earliest,
                        dateType: dateType,
                        dateValue: dateValue,
                        displayValue: dateValue || '',
                        recordDate: earliest.recordDate || null,
                        newSalePrice: null,
                        priceStatus: 'pending'
                    });
                }
            }
            dateChangeFilteredList = [...dateChangeData];
            console.log('✅ 手动构建改日改价数据:', dateChangeFilteredList.length, '条');
        }
        initDateChangeFilterData();
        console.log('需要更新的商品数量:', dateChangeFilteredList.length);
        updateDateChangeButton();
        updateDateChangeStatus();
        dateChangeCurrentPage = 1;
        renderDateChangePagination();
        renderDateChangeList();
    } catch (e) {
        console.error('加载后台更换日期失败:', e);
        dateChangeFilteredList = [];
        dateChangeData = [];
        initDateChangeFilterData();
        renderDateChangeList();
        showMsg('加载数据失败，请刷新重试');
    }
}
    
    checkAndLoad();
}

function initDateChangeFilterData() {
    dateChangeFilterData = { 
        supplier: [], 
        goodsName: [], 
        spec: [], 
        settleType: ['线上', '线下'],
        bzStatus: [] 
    };
    
    if (!dateChangeData || dateChangeData.length === 0) {
        return;
    }
    
    dateChangeFilterData.supplier = [...new Set(dateChangeData.map(item => item.supplier || '').filter(s => s))].sort();
    dateChangeFilterData.goodsName = [...new Set(dateChangeData.map(item => item.name || '').filter(s => s))].sort();
    dateChangeFilterData.spec = [...new Set(dateChangeData.map(item => item.spec || '').filter(s => s))].sort();
    const bzSet = new Set();
    dateChangeData.forEach(item => {
        if (item.earliestBatch && item.earliestBatch.bzStatusText) {
            bzSet.add(item.earliestBatch.bzStatusText);
        }
    });
    dateChangeFilterData.bzStatus = [...bzSet].sort();
}

function showDateChangeFilterList(type) {
    let listId = `dateChangeFilter${capitalize(type)}List`;
    let inputId = `dateChangeFilter${capitalize(type)}`;
    if (type === 'settleType') {
        listId = 'dateChangeFilterSettleList';
        inputId = 'dateChangeFilterSettle';
    } else if (type === 'goodsName') {
        listId = 'dateChangeFilterGoodsList';
        inputId = 'dateChangeFilterGoods';
    }
    const box = document.getElementById(listId);
    if (!box) return;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderDateChangeFilterList(type, kw);
    box.style.display = 'block';
}

function filterDateChangeFilterList(type) {
    let inputId = `dateChangeFilter${capitalize(type)}`;
    let listId = `dateChangeFilter${capitalize(type)}List`;
    if (type === 'settleType') {
        inputId = 'dateChangeFilterSettle';
        listId = 'dateChangeFilterSettleList';
    } else if (type === 'goodsName') {
        inputId = 'dateChangeFilterGoods';
        listId = 'dateChangeFilterGoodsList';
    }
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderDateChangeFilterList(type, kw);
    document.getElementById(listId).style.display = 'block';
}

function renderDateChangeFilterList(type, keyword = '') {
    let listId = `dateChangeFilter${capitalize(type)}List`;
    let inputId = `dateChangeFilter${capitalize(type)}`;
    if (type === 'settleType') {
        listId = 'dateChangeFilterSettleList';
        inputId = 'dateChangeFilterSettle';
    } else if (type === 'goodsName') {
        listId = 'dateChangeFilterGoodsList';
        inputId = 'dateChangeFilterGoods';
    }
    const box = document.getElementById(listId);
    if (!box) {
        console.warn('找不到下拉列表元素:', listId);
        return;
    }    
    let data = [];
    
    if (type === 'settleType') {
        data = ['线上', '线下'];
    } else if (type === 'supplier') {
        data = [...new Set(dateChangeData.map(item => item.supplier || '').filter(s => s))].sort();
    } else if (type === 'goodsName') {
        data = [...new Set(dateChangeData.map(item => item.name || '').filter(s => s))].sort();
    } else if (type === 'spec') {
        data = [...new Set(dateChangeData.map(item => item.spec || '').filter(s => s && s !== '-'))].sort();
    } else if (type === 'bzStatus') {
        const bzSet = new Set();
        dateChangeData.forEach(item => {
            if (item.earliestBatch && item.earliestBatch.bzStatusText) {
                bzSet.add(item.earliestBatch.bzStatusText);
            }
        });
        data = [...bzSet].sort();
    }
    
    if (keyword) {
        const kwLow = keyword.toLowerCase();
        data = data.filter(item => item.toLowerCase().includes(kwLow));
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
            let inputId = `dateChangeFilter${capitalize(type)}`;
            if (type === 'settleType') {
                inputId = 'dateChangeFilterSettle';
            }
            const input = document.getElementById(inputId);
            if (input) {
                input.value = opt;
                const evt = new Event('input', { bubbles: true });
                input.dispatchEvent(evt);
            }
            box.style.display = 'none';
            filterDateChangeList();
        };
        div.onmouseover = function() { this.style.background = '#f0f0f0'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        box.appendChild(div);
    });
}

let dateFilterTimer = null;

function onDateChangeFilterInput() {
    if(dateFilterTimer) clearTimeout(dateFilterTimer);
    dateFilterTimer = setTimeout(() => {
        filterDateChangeList();
        const types = ['supplier', 'goodsName', 'spec', 'settleType', 'bzStatus'];
        const idMap = {
            supplier: { input: 'dateChangeFilterSupplier', list: 'dateChangeFilterSupplierList' },
            goodsName: { input: 'dateChangeFilterGoods', list: 'dateChangeFilterGoodsList' },
            spec: { input: 'dateChangeFilterSpec', list: 'dateChangeFilterSpecList' },
            settleType: { input: 'dateChangeFilterSettle', list: 'dateChangeFilterSettleList' },
            bzStatus: { input: 'dateChangeFilterBzStatus', list: 'dateChangeFilterBzStatusList' }
        };
        for (const type of types) {
            const ids = idMap[type];
            const input = document.getElementById(ids.input);
            const list = document.getElementById(ids.list);
            if (document.activeElement === input && list) {
                renderDateChangeFilterList(type, input.value.trim());
                list.style.display = 'block';
                break;
            }
        }
    }, 250);
}

function filterDateChangeList() {
    const supplier = document.getElementById('dateChangeFilterSupplier')?.value.trim() || '';
    const goodsName = document.getElementById('dateChangeFilterGoods')?.value.trim() || '';
    const spec = document.getElementById('dateChangeFilterSpec')?.value.trim() || '';
    const settleType = document.getElementById('dateChangeFilterSettle')?.value.trim() || '';
    const bzStatus = document.getElementById('dateChangeFilterBzStatus')?.value.trim() || '';

    if (!dateChangeData || !Array.isArray(dateChangeData)) {
        dateChangeFilteredList = [];
    } else {
        dateChangeFilteredList = dateChangeData.filter(item => {
            let match = true;
            const itemBzStatus = item.earliestBatch?.bzStatusText || '';
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.name || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (spec && !(item.spec || '').toLowerCase().includes(spec.toLowerCase())) match = false;
            if (settleType && !(item.settleType || '').toLowerCase().includes(settleType.toLowerCase())) match = false;
            if (bzStatus && !itemBzStatus.toLowerCase().includes(bzStatus.toLowerCase())) match = false;
            return match;
        });
    }
    dateChangeCurrentPage = 1;
    renderDateChangePagination();
    renderDateChangeList();
}

function resetDateChangeFilter() {
    const inputIds = [
        'dateChangeFilterSupplier',
        'dateChangeFilterGoods',
        'dateChangeFilterSpec',
        'dateChangeFilterSettle',
        'dateChangeFilterBzStatus'
    ];
    inputIds.forEach(id => {
        const inp = document.getElementById(id);
        if (inp) inp.value = '';
    });
    document.querySelectorAll('[id^="dateChangeFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterDateChangeList();
}

function updateDateChangeStatus() {
    const statusEl = document.getElementById('dateChangeStatus');
    if (!statusEl) return;
    
    const count = Array.isArray(dateChangeData) ? dateChangeData.length : 0;
    
    if (count > 0) {
        statusEl.textContent = `需更新：${count} 条`;
        statusEl.style.color = '#ff6b6b';
    } else {
        statusEl.textContent = '✅ 所有商品日期已是最新';
        statusEl.style.color = '#52c41a';
    }
}

function updateDateChangeButton() {
    const btn = document.getElementById('batchUpdateDateBtn');
    if (!btn) return;
    const count = Array.isArray(dateChangeData) ? dateChangeData.length : 0;
    const hasPerm = canOperateDateUpdate();
    const canClick = count > 0 && hasPerm;
    
    if (canClick) {
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
        btn.textContent = `需更新 (${count})${!hasPerm ? '（无权限）' : ''}`;
        btn.disabled = true;
    }
}
function copyDateText(text, btnElement) {
    if (!text) {
        showMsg('没有可复制的内容');
        return;
    }
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            const originalText = btnElement.textContent;
            btnElement.textContent = '√已复制';
            btnElement.style.background = '#52c41a';
            btnElement.style.color = '#ffffff';
            
            setTimeout(function() {
                btnElement.textContent = '复制日期';  // 恢复为"复制日期"
                btnElement.style.background = '';
                btnElement.style.color = '';
            }, 2000);
        }).catch(function() {
            fallbackCopyDate(text, btnElement);
        });
    } else {
        fallbackCopyDate(text, btnElement);
    }
}

function fallbackCopyDate(text, btnElement) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        btnElement.textContent = '√已复制';
        btnElement.style.background = '#52c41a';
        btnElement.style.color = '#ffffff';
        setTimeout(function() {
            btnElement.textContent = '复制日期';
            btnElement.style.background = '';
            btnElement.style.color = '';
        }, 2000);
    } catch (e) {
        showMsg('复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
}
async function updateSingleGoodsDateWithPrice(id) {
// 权限拦截
    if (!canOperateDateUpdate()) {
        showMsg('当前角色无更新商品日期权限（仅管理员、APP部可操作）');
        return;
    }
    const item = dateChangeFilteredList.find(d => d.id === id);
    if (!item) return;
    
    const statusText = item.earliestBatch?.bzStatusText || '';
    const isDiscountOrExpire = (statusText !== '正常' && statusText !== '过期');
    
    // 折扣/临期状态，如果没有状态价格且不是跳过状态，阻止更新
    if (isDiscountOrExpire && item.newSalePrice === null && item.priceStatus !== 'skipped') {
        showMsg('请先设置新销售价或点击"无需修改"');
        return;
    }
    
    const earliest = getEarliestBatchDate(item.supplier, item.name, item.spec);
    if (!earliest || earliest.batchRemain <= 0) {
        showMsg('该商品暂无库存批次');
        return;
    }
    
    const updateData = {
        saved_produce_date: earliest.produce_date || null,
        saved_expire_date: earliest.expire_date || null,
        saved_date_updated_at: new Date().toISOString(),
        last_sale_price: null
    };
    
    if (!confirm(`确认更新"${item.name}"？\n\n${updateData.saved_produce_date ? '生产日期：' + updateData.saved_produce_date : ''}${updateData.saved_expire_date ? '\n到期日期：' + updateData.saved_expire_date : ''}\n销售价保持不变（sale_price 不会被修改）`)) return;
    
    await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${item.id}`, {
        method: 'PATCH',
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    });
    
    // ✅ 关键修改：只有价格发生变化的商品，才清空 price_temp_state
    // 如果只是更新日期（priceChanged = false），保留状态价格
    if (item.priceChanged) {
        clearPriceTempState(item.id);
        console.log('✅ 价格已变动，清空状态价格');
    } else {
        console.log('✅ 仅更新日期，保留状态价格');
    }
    
    showMsg(`✅ 更新成功！日期已更新，last_sale_price 已清空`);
    await loadGoods(true);
    loadDateChangeTab();
}

async function batchUpdateGoodsDate() {
// 权限拦截
    if (!canOperateDateUpdate()) {
        showMsg('当前角色无批量更新权限（仅管理员、APP部可操作）');
        return;
    }
    // ✅ 修改：统计更新按钮未置灰的行（即 isUpdateDisabled === false）
    const canUpdateList = dateChangeFilteredList.filter(item => {
        return item.isUpdateDisabled === false;
    });
    
    if (canUpdateList.length === 0) {
        showMsg('没有可更新的商品');
        return;
    }
    
    if (!confirm(`⚠ 确认批量更新 ${canUpdateList.length} 条商品？\n点击后数据将完全消失（不可逆）！`)) return;
    
    let successCount = 0;
    const successIds = [];
    const priceChangedIds = [];
    
    for (const item of canUpdateList) {
        try {
            const earliest = getEarliestBatchDate(item.supplier, item.name, item.spec);
            if (!earliest || earliest.batchRemain <= 0) continue;
            
            const updateData = {
                saved_produce_date: earliest.produce_date || null,
                saved_expire_date: earliest.expire_date || null,
                saved_date_updated_at: new Date().toISOString(),
                last_sale_price: null
            };
            
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
                successIds.push(item.id);
                if (item.priceChanged) {
                    priceChangedIds.push(item.id);
                }
            }
        } catch (e) {
            console.error('更新失败:', item.name, e);
        }
    }
    
    for (const id of priceChangedIds) {
        await clearPriceTempState(id);
        console.log('✅ 价格已变动，清空状态价格:', id);
    }
    
    showMsg(`✅ 批量更新完成！成功 ${successCount} 条${priceChangedIds.length > 0 ? '，其中 ' + priceChangedIds.length + ' 条价格已变动并清空状态价格' : ''}`);
    await loadGoods(true);
    loadDateChangeTab();
}

function renderDateChangePagination() {
    dateChangeTotalPages = Math.ceil(dateChangeFilteredList.length / dateChangePageSize) || 1;
    
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

let dateChangeSortField = '';
let dateChangeSortAsc = true;

function refreshDateChangeList() {
    loadDateChangeTab();
}

function clearDateChangeSort() {
    dateChangeSortField = '';
    dateChangeSortAsc = true;
    updateDateChangeSortIcon();
    loadDateChangeTab();
}

function dateChangeSortTable(field) {
    if (dateChangeSortField === field) {
        dateChangeSortAsc = !dateChangeSortAsc;
    } else {
        dateChangeSortField = field;
        dateChangeSortAsc = true;
    }
    updateDateChangeSortIcon();
    dateChangeFilteredList.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];
        if (['recordDate','dateValue'].includes(field)) {
            valA = new Date(valA || 0);
            valB = new Date(valB || 0);
        }
        if (field === 'batchRemain') {
            valA = Number(valA || 0);
            valB = Number(valB || 0);
        }
        if (typeof valA === 'string') valA = valA.trim();
        if (typeof valB === 'string') valB = valB.trim();

        if (valA > valB) return dateChangeSortAsc ? 1 : -1;
        if (valA < valB) return dateChangeSortAsc ? -1 : 1;
        return 0;
    });
    dateChangeCurrentPage = 1;
    renderDateChangePagination();
    renderDateChangeList();
}

function updateDateChangeSortIcon() {
    document.querySelectorAll('.dateChangeSortIcon').forEach(icon => icon.textContent = '');
    const thList = document.querySelectorAll('#sub-dateChange .sortable');
    for(let th of thList) {
        if(th.onclick?.toString().includes(`'${dateChangeSortField}'`)) {
            th.querySelector('.dateChangeSortIcon').textContent = dateChangeSortAsc ? ' ↑' : ' ↓';
            break;
        }
    }
}

function renderDateChangeList() {
    // 排序规则：如果用户点击了表头排序，则优先使用表头排序；无表头排序时默认「待改价」置顶
    dateChangeFilteredList.sort((a, b) => {
        // 1. 优先判断是否有手动点击的排序列
        if(dateChangeSortField) {
            let valA = a[dateChangeSortField];
            let valB = b[dateChangeSortField];
            if (['recordDate','dateValue'].includes(dateChangeSortField)) {
                valA = new Date(valA || 0);
                valB = new Date(valB || 0);
            }
            if (dateChangeSortField === 'batchRemain') {
                valA = Number(valA || 0);
                valB = Number(valB || 0);
            }
            if (typeof valA === 'string') valA = valA.trim();
            if (typeof valB === 'string') valB = valB.trim();
            if (valA > valB) return dateChangeSortAsc ? 1 : -1;
            if (valA < valB) return dateChangeSortAsc ? -1 : 1;
            return 0;
        }
        // 2. 无表头排序时，默认规则：待改价 置顶
        const aIsNeedPrice = a.needUpdatePrice === '待改价';
        const bIsNeedPrice = b.needUpdatePrice === '待改价';
        if(aIsNeedPrice && !bIsNeedPrice) return -1;
        if(!aIsNeedPrice && bIsNeedPrice) return 1;
        // 同为待改价 / 同为无需改价，保持原有加载顺序不变
        return 0;
    });
    const tb = document.getElementById('dateChangeList');
    if (!tb) {
        console.warn('dateChangeList元素不存在');
        return;
    }
    
    console.log('渲染日期更换列表，数据量:', dateChangeFilteredList.length);
    
    tb.innerHTML = '';
    
    const start = (dateChangeCurrentPage - 1) * dateChangePageSize;
    const pageData = dateChangeFilteredList.slice(start, start + dateChangePageSize);
    
    console.log('当前页数据量:', pageData.length);
    
    if (pageData.length === 0) {
        tb.innerHTML = '<tr><td colspan="16" style="text-align:center;padding:30px;color:#999;">暂无需要更新的商品</td></tr>';
        return;
    }
    
    tb.innerHTML = '';
    pageData.forEach((item, idx) => {
        let statusText = '无';
        let statusBgColor = '';
        let statusColor = '#333';
        let countDownText = '';
        
        if (item.earliestBatch && item.earliestBatch.bzStatusText) {
            statusText = item.earliestBatch.bzStatusText;
            countDownText = item.earliestBatch.countDownText || '';
            
            if (statusText === '过期') {
                statusBgColor = '#ff4444';
                statusColor = '#fff';
            } else if (statusText === '临期') {
                statusBgColor = '#ffdddd';
                statusColor = '#333';
            } else if (statusText === '正常') {
                statusBgColor = '#d4edda';
                statusColor = '#333';
            } else {
                const config = window.settingsData?.discountConfig?.items || [];
                const index = config.findIndex(c => c.label === statusText);
                const colors = ['#ffcdd2', '#bbdefb', '#fff9c4', '#ffe0b2'];
                const colorIndex = (index >= 0 && index < colors.length) ? index : 0;
                statusBgColor = colors[colorIndex];
                statusColor = '#333';
            }
        } else {
            statusBgColor = '#f5f5f5';
            statusColor = '#999';
        }
        
        // 日期显示：始终显示批次日期
let dateStr = '-';
if (item.dateValue) {
    dateStr = new Date(item.dateValue).toISOString().split('T')[0];
} else if (item.earliestBatch && item.earliestBatch.dateValue) {
    dateStr = new Date(item.earliestBatch.dateValue).toISOString().split('T')[0];
} else if (item.earliestBatch && item.earliestBatch.produce_date && item.earliestBatch.produce_date !== '-') {
    dateStr = new Date(item.earliestBatch.produce_date).toISOString().split('T')[0];
} else if (item.earliestBatch && item.earliestBatch.expire_date && item.earliestBatch.expire_date !== '-') {
    dateStr = new Date(item.earliestBatch.expire_date).toISOString().split('T')[0];
}
        // 生产/到期列显示
let dateTypeDisplay = '';
let dateTypeColor = '';
// 优先从 item.dateType 获取
if (item.dateType === '生产日期') {
    dateTypeDisplay = '生产';
    dateTypeColor = '#d4edda';
} else if (item.dateType === '到期日期') {
    dateTypeDisplay = '到期';
    dateTypeColor = '#f8d7da';
} else if (item.earliestBatch && item.earliestBatch.dateType) {
    // 如果 item.dateType 为空，从 earliestBatch 获取
    if (item.earliestBatch.dateType === '生产日期') {
        dateTypeDisplay = '生产';
        dateTypeColor = '#d4edda';
    } else if (item.earliestBatch.dateType === '到期日期') {
        dateTypeDisplay = '到期';
        dateTypeColor = '#f8d7da';
    }
} else {
    // 从 earliestBatch 的日期字段判断
    if (item.earliestBatch && item.earliestBatch.produce_date && item.earliestBatch.produce_date !== '-') {
        dateTypeDisplay = '生产';
        dateTypeColor = '#d4edda';
    } else if (item.earliestBatch && item.earliestBatch.expire_date && item.earliestBatch.expire_date !== '-') {
        dateTypeDisplay = '到期';
        dateTypeColor = '#f8d7da';
    }
}
        
        let settleColor = '';
        if (item.settleType === '线上') {
            settleColor = 'style="color:#52c41a;font-weight:bold;"';
        } else if (item.settleType === '线下') {
            settleColor = 'style="color:#ff6b6b;font-weight:bold;"';
        }
        
        const currentPriceDisplay = formatMoney(item.currentSalePrice || 0);
        const rowNum = start + idx + 1;
        const recordDateStr = item.earliestBatch && item.earliestBatch.recordDate 
            ? new Date(item.earliestBatch.recordDate).toISOString().split('T')[0] 
            : '-';
        
        // ========== 原销售价（灰色显示 lastSalePrice） ==========
        const lastPriceDisplay = formatMoney(item.lastSalePrice || 0);
        const lastPriceStyle = 'style="color:#999;font-size:13px;"';
        
        // ========== 需更新日期（带颜色） ==========
        const needUpdateDateDisplay = item.needUpdateDate || '';
        const needUpdateDateColor = item.needUpdateDateColor || '#333';
        const needUpdateDateStyle = 'style="color:' + needUpdateDateColor + ';"';
        
        // ========== 需更新销售价（带颜色） ==========
        const needUpdatePriceDisplay = item.needUpdatePrice || '';
        const needUpdatePriceColor = item.needUpdatePriceColor || '#333';
        const needUpdatePriceStyle = 'style="color:' + needUpdatePriceColor + ';"';
        
       // ========== 构建操作按钮 ==========
let actionButtons = '';
actionButtons += '<div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; justify-content:center;">';

// 改价按钮：仅折扣/临期状态显示 + 角色权限校验
if (item.showPriceBtn) {
    const priceBtnDisabled = !canOperatePriceEdit();
    if (priceBtnDisabled) {
        actionButtons += `
            <button class="btn btn-warning" disabled style="opacity:0.5;cursor:not-allowed;background:#d9d9d9;color:#999;padding:4px 10px;font-size:12px;border:none;border-radius:3px;white-space:nowrap;height:28px;line-height:20px;">改价</button>
        `;
    } else {
        actionButtons += `
            <button class="btn btn-warning" onclick="openPriceModal(${item.id})" style="padding:4px 10px;font-size:12px;background:#ff9800;color:#fff;border:none;border-radius:3px;cursor:pointer;white-space:nowrap;height:28px;line-height:20px;">改价</button>
        `;
    }
}

// 复制新价按钮：有 newSalePrice 且 priceChanged 为 true 时才显示（无权限限制）
if (item.showCopyPriceBtn) {
    actionButtons += `
        <button class="btn btn-success" onclick="copyNewPrice(${item.id})" style="padding:4px 10px;font-size:12px;background:#7030A0;color:#fff;border:none;border-radius:3px;cursor:pointer;white-space:nowrap;height:28px;line-height:20px;">复制新价</button>
    `;
}

// 复制日期按钮：仅日期变动时显示（无权限限制）
if (item.showCopyDateBtn) {
    const copyDateTextVal = (item.dateType === '生产日期' && item.displayValue) 
        ? `${item.displayValue}生产` 
        : (item.dateType === '到期日期' && item.displayValue) 
            ? `${item.displayValue}到期` 
            : '';
    actionButtons += `
        <button class="btn btn-success" onclick="copyDateText('${copyDateTextVal.replace(/'/g, "\\'")}', this)" style="padding:4px 10px;font-size:12px;background:#28a745;color:#fff;border:none;border-radius:3px;cursor:pointer;white-space:nowrap;height:28px;line-height:20px;">复制日期</button>
    `;
}

// 更新按钮：原有业务禁用 + 角色权限双重判断
const dateUpdatePerm = canOperateDateUpdate();
const updateBtnRealDisabled = item.isUpdateDisabled || !dateUpdatePerm;
if (updateBtnRealDisabled) {
    actionButtons += `
        <button class="btn btn-primary" disabled style="opacity:0.5;cursor:not-allowed;background:#d9d9d9;color:#999;padding:4px 10px;font-size:12px;border:none;border-radius:3px;white-space:nowrap;height:28px;line-height:20px;">更新</button>
    `;
} else {
    actionButtons += `
        <button class="btn btn-primary" onclick="updateSingleGoodsDateWithPrice(${item.id})" style="padding:4px 10px;font-size:12px;background:#007bff;color:#fff;border:none;border-radius:3px;cursor:pointer;white-space:nowrap;height:28px;line-height:20px;">更新</button>
    `;
}

actionButtons += '</div>';        
        const html = `
            <tr>
                <td>${rowNum}</td>
                <td>${recordDateStr}</td>
                <td>${item.supplier || ''}</td>
                <td>${item.name || ''}</td>
                <td>${item.spec || '-'}</td>
                <td ${settleColor}>${item.settleType || '-'}</td>
                <td>${item.batchRemain || 0}</td>
                <td style="background-color:${statusBgColor}; color:${statusColor}; text-align:center;">${statusText}</td>
                <td>${countDownText}</td>
                <td>${dateStr}</td>
                <td style="background-color:${dateTypeColor}; text-align:center;">${dateTypeDisplay}</td>
                <td ${needUpdateDateStyle}>${needUpdateDateDisplay}</td>
                <td ${lastPriceStyle}>${lastPriceDisplay}</td>
                <td ${needUpdatePriceStyle}>${needUpdatePriceDisplay}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
        tb.innerHTML += html;
    });
}
function exportDateChangeExcel() {
    if (dateChangeFilteredList.length === 0) {
        showMsg('暂无数据可导出');
        return;
    }
    
    const header = [
        '序列', '录入日期', '供应商', '商品名', '规格', '结算方式', '批次库存',
        '保质期状态', '状态倒计时', '日期', '生产/到期', '需更新日期', '原销售价', '需更新销售价'
    ];
    
    const expData = dateChangeFilteredList.map((item, idx) => {
        const statusText = item.earliestBatch?.bzStatusText || '';
        const countDownText = item.earliestBatch?.countDownText || '';
        const recordDateStr = item.earliestBatch?.recordDate 
            ? new Date(item.earliestBatch.recordDate).toISOString().split('T')[0] 
            : '-';
        const dateStr = item.dateValue ? new Date(item.dateValue).toISOString().split('T')[0] : '-';
        let newPriceDisplay = '';
        if (item.newSalePrice !== null && item.newSalePrice !== undefined) {
            newPriceDisplay = formatMoney(item.newSalePrice);
        } else if (item.priceStatus === 'skipped') {
            newPriceDisplay = '无需修改';
        } else {
            const needPriceChange = (item.settleType === '线下' && statusText !== '正常' && statusText !== '过期');
            newPriceDisplay = needPriceChange ? '待改价' : '';
        }
        
        return [
            idx + 1,
            recordDateStr,
            item.supplier || '',
            item.name || '',
            item.spec || '-',
            item.settleType || '-',
            item.batchRemain || 0,
            statusText,
            countDownText,
            dateStr,
            item.dateType || '',
            item.displayValue || '',
            formatMoney(item.currentSalePrice || 0),
            newPriceDisplay
        ];
    });
    
    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '改日改价明细');
    XLSX.writeFile(wb, `改日改价明细_${new Date().toISOString().slice(0,10)}.xlsx`);
}

document.addEventListener('click', function(e) {
    const listIds = [
        'goodsFilterSupplierList',
        'goodsFilterGoodsNameList',
        'goodsFilterChannelList'
    ];
    listIds.forEach(id => {
        const box = document.getElementById(id);
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${id.replace('List', 'Input')}`)) {
            box.style.display = 'none';
        }
    });

    const dateChangeListIds = [
        'dateChangeFilterSupplierList',
        'dateChangeFilterGoodsList',
        'dateChangeFilterSpecList',
        'dateChangeFilterSettleList',
        'dateChangeFilterBzStatusList'
    ];
    dateChangeListIds.forEach(id => {
        const box = document.getElementById(id);
        const inputId = id.replace('List', '');
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${inputId}`)) {
            box.style.display = 'none';
        }
    });
});

// ============================================================
// ========== 改价弹窗相关函数（新改价逻辑） ==========
// ============================================================

function openPriceModal(id) {
// 权限拦截
    if (!canOperatePriceEdit()) {
        showMsg('当前角色无改价权限（仅管理员、商品部可操作）');
        return;
    }
    const item = dateChangeFilteredList.find(d => d.id === id);
    if (!item) {
        showMsg('找不到该商品');
        return;
    }
    
    const statusText = item.earliestBatch?.bzStatusText || '未知';
    const normalPrice = item.normalPrice || item.sale_price || 0;
    const lastPrice = item.lastSalePrice || normalPrice;
    
    // ✅ 修复：获取当前状态销售价
    let currentPrice = null;
    // 直接使用 item.currentSalePrice，即使是 null 也保留
    if (item.currentSalePrice !== undefined) {
        currentPrice = item.currentSalePrice;
    } else {
        currentPrice = normalPrice;
    }
    
    // ✅ 判断是否为折扣/临期状态（非正常/过期状态）
    const isSpecialStatus = (statusText !== '正常' && statusText !== '过期');
    // 如果是特殊状态且价格为 null，显示"未录入"
    let displayPrice;
    if (isSpecialStatus && (currentPrice === null || currentPrice === undefined)) {
        displayPrice = '未录入';
    } else {
        displayPrice = formatMoney(currentPrice || 0);
    }
    
    const modal = document.createElement('div');
    modal.id = 'priceModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
        z-index: 99999;
    `;
    
    modal.innerHTML = `
        <div style="background:#fff; border-radius:8px; padding:30px; width:440px; max-width:90%; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
            <h3 style="margin-top:0; margin-bottom:20px; color:#333;">修改销售价</h3>
            
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold; display:block; margin-bottom:4px; font-size:14px;">商品</label>
                <span style="font-size:15px;">${item.name} (${item.spec || '-'})</span>
            </div>
            
            <div style="display:flex; gap:40px; margin-bottom:16px; flex-wrap:wrap;">
                <div>
                    <label style="font-weight:bold; display:block; margin-bottom:4px; font-size:13px;">保质期状态</label>
                    <span style="font-size:15px; padding:4px 16px; border-radius:4px; display:inline-block; ${statusText === '过期' ? 'background:#ff4444;color:#fff;' : statusText === '临期' ? 'background:#ffdddd;' : statusText === '正常' ? 'background:#d4edda;' : 'background:#bbdefb;'}">${statusText}</span>
                </div>
                <div>
                    <label style="font-weight:bold; display:block; margin-bottom:4px; font-size:13px; color:#999;">原正常销售价</label>
                    <span style="font-size:16px; color:#999; font-weight:bold;">${formatMoney(lastPrice)}</span>
                </div>
                <div>
                    <label style="font-weight:bold; display:block; margin-bottom:4px; font-size:13px;">当前正常销售价</label>
                    <span style="font-size:16px; color:#333; font-weight:bold;">${formatMoney(normalPrice)}</span>
                </div>
            </div>
            
            <div style="margin-bottom:20px; padding:14px 16px; background:#f8f9fa; border-radius:6px; border-left:4px solid #ff6b6b;">
                <label style="font-weight:bold; display:block; margin-bottom:2px; font-size:13px;">当前销售价（${statusText}状态）</label>
                <span style="font-size:24px; color:#ff6b6b; font-weight:bold;">${displayPrice}</span>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold; display:block; margin-bottom:4px; font-size:14px;">新销售价</label>
                <input type="number" id="priceModalInput" step="0.01" min="0" 
                    style="width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:4px; font-size:18px; box-sizing:border-box;"
                    placeholder="请输入新销售价">
            </div>
            
            <div style="display:flex; gap:10px; justify-content:flex-end; padding-top:10px; border-top:1px solid #eee;">
                <button onclick="closePriceModal()" style="padding:8px 24px; border:1px solid #ddd; border-radius:4px; background:#f5f5f5; cursor:pointer; font-size:14px;">取消</button>
                <button onclick="confirmPriceChange(${id})" style="padding:8px 24px; border:none; border-radius:4px; background:#007bff; color:#fff; cursor:pointer; font-size:14px;">确认改价</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => {
        const input = document.getElementById('priceModalInput');
        if (input) input.focus();
    }, 100);
    
    document.getElementById('priceModalInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            confirmPriceChange(id);
        }
    });
}

function closePriceModal() {
    const modal = document.getElementById('priceModal');
    if (modal) modal.remove();
}

async function confirmPriceChange(id) {
    const input = document.getElementById('priceModalInput');
    if (!input) return;
    
    const newPrice = parseFloat(input.value);
    if (isNaN(newPrice) || newPrice < 0) {
        showMsg('请输入有效的销售价（大于等于0）');
        return;
    }
    
    const item = dateChangeFilteredList.find(d => d.id === id);
    if (!item) {
        showMsg('找不到该商品');
        return;
    }
    
    const bzStatus = item.earliestBatch?.bzStatusText || '正常';
    console.log('确认改价:', item.name, '状态:', bzStatus, '新价格:', newPrice);
    
    if (bzStatus === '正常') {
        // 正常状态 → 更新 goods 表
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${item.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sale_price: newPrice })
            });
            showMsg('✅ 正常状态销售价已更新到商品信息表');
        } catch (e) {
            showMsg('更新失败：' + e.message);
            return;
        }
    } else {
        // 其他状态 → 存入 price_temp_state 表
        await savePriceTempStateByStatus(item.id, bzStatus, newPrice);
        showMsg('✅ 已保存 ' + bzStatus + ' 状态销售价：' + formatMoney(newPrice));
    }
    
    closePriceModal();
    // ========== 重新加载改日改价 ==========
    await loadDateChangeTab();
}

async function savePriceTempStateByStatus(goodsId, bzStatus, newSalePrice) {
    try {
        // 先检查是否存在
        const checkRes = await fetch(
            `${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&select=id`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const existData = await checkRes.json();
        
        // 根据状态决定更新哪个字段
        let updateField = {};
        if (bzStatus === '临期') {
            updateField = { expire_price: newSalePrice };
        } else if (bzStatus === 'discount_1' || bzStatus === '打6.5折') {
            updateField = { discount_1_price: newSalePrice };
        } else if (bzStatus === 'discount_2' || bzStatus === '打7折') {
            updateField = { discount_2_price: newSalePrice };
        } else if (bzStatus === 'discount_3' || bzStatus === '打8折') {
            updateField = { discount_3_price: newSalePrice };
        } else if (bzStatus === 'discount_4' || bzStatus === '打9.5折') {
            updateField = { discount_4_price: newSalePrice };
        } else {
            // 其他状态（如正常）不存储
            return;
        }
        
        const body = {
            goods_id: Number(goodsId),
            updated_at: new Date().toISOString(),
            ...updateField
        };
        
        if (existData && existData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?id=eq.${existData[0].id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        }
        console.log('✅ 保存 ' + bzStatus + ' 状态价格成功:', goodsId, newSalePrice);
    } catch(e) {
        console.warn('保存临时价格失败:', e);
        savePriceTempStateLocal(goodsId, newSalePrice, 'updated');
    }
}

async function skipPriceChange(id) {
    const item = dateChangeFilteredList.find(d => d.id === id);
    if (item) {
        item.newSalePrice = null;
        item.priceStatus = 'skipped';
        await savePriceTempState(id, null, 'skipped');
    }
    closePriceModal();
    await loadDateChangeTab();
    showMsg('✅ 已标记为"无需修改"');
}

function copyNewPrice(id) {
    const item = dateChangeFilteredList.find(d => d.id === id);
    if (!item || item.newSalePrice === null || item.newSalePrice === undefined) {
        showMsg('没有可复制的新价格');
        return;
    }
    
    const text = String(item.newSalePrice);
    
    // 获取所有匹配的按钮
    const buttons = document.querySelectorAll('button[onclick*="copyNewPrice(' + id + ')"]');
    
    const doCopy = function() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                showCopyNewPriceFeedback(buttons);
            }).catch(function() {
                fallbackCopyNewPrice(text, buttons);
            });
        } else {
            fallbackCopyNewPrice(text, buttons);
        }
    };
    
    doCopy();
}

function showCopyNewPriceFeedback(buttons) {
    buttons.forEach(function(btn) {
        btn.textContent = '√已复制';
        btn.style.background = '#28a745';
        btn.style.color = '#ffffff';
        setTimeout(function() {
            btn.textContent = '复制新价';
            btn.style.background = '#7030A0';
            btn.style.color = '#ffffff';
        }, 2000);
    });
}

function fallbackCopyNewPrice(text, buttons) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showCopyNewPriceFeedback(buttons);
    } catch (e) {
        showMsg('复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
}

async function savePriceTempState(goodsId, newSalePrice, priceStatus) {
    try {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&select=id`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        const existData = await checkRes.json();
        
        let body = {
            goods_id: goodsId,
            new_sale_price: newSalePrice,
            price_status: priceStatus || 'updated',
            updated_at: new Date().toISOString()
        };
        
        if (existData && existData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?id=eq.${existData[0].id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        }
        console.log('✅ 改价状态已保存到 Supabase:', goodsId, newSalePrice, priceStatus);
    } catch(e) {
        console.warn('保存临时状态到Supabase失败:', e);
        savePriceTempStateLocal(goodsId, newSalePrice, priceStatus);
    }
}

async function loadPriceTempState(goodsId) {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&select=*`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const data = await res.json();
        if (data && data.length > 0) {
            return {
                expirePrice: data[0].expire_price,
                discount1Price: data[0].discount_1_price,
                discount2Price: data[0].discount_2_price,
                discount3Price: data[0].discount_3_price,
                discount4Price: data[0].discount_4_price
            };
        }
        return null;
    } catch(e) {
        console.warn('从Supabase加载临时状态失败:', e);
        return null;
    }
}

async function clearPriceTempState(goodsId) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&select=id`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await res.json();
        if (data && data.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?id=eq.${data[0].id}`, {
                method: 'DELETE',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            });
        }
        clearPriceTempStateLocal(goodsId);
        console.log('✅ 改价状态已从Supabase清除:', goodsId);
    } catch(e) {
        console.warn('从Supabase清除临时状态失败:', e);
        clearPriceTempStateLocal(goodsId);
    }
}

async function clearAllPriceTempState() {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state`, {
            method: 'DELETE',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        localStorage.removeItem('priceTempState');
        console.log('✅ 所有改价状态已清除');
    } catch(e) {
        console.warn('清除所有临时状态失败:', e);
    }
}

function savePriceTempStateLocal(id, newSalePrice, priceStatus) {
    try {
        let tempData = JSON.parse(localStorage.getItem('priceTempState') || '{}');
        if (newSalePrice !== null && newSalePrice !== undefined) {
            tempData[id] = { newSalePrice: newSalePrice, priceStatus: priceStatus || 'updated' };
        } else if (priceStatus === 'skipped') {
            tempData[id] = { newSalePrice: null, priceStatus: 'skipped' };
        } else {
            delete tempData[id];
        }
        localStorage.setItem('priceTempState', JSON.stringify(tempData));
    } catch(e) {
        console.warn('保存临时状态到localStorage失败', e);
    }
}

function loadPriceTempStateLocal(id) {
    try {
        let tempData = JSON.parse(localStorage.getItem('priceTempState') || '{}');
        return tempData[id] || null;
    } catch(e) {
        return null;
    }
}

function clearPriceTempStateLocal(id) {
    try {
        let tempData = JSON.parse(localStorage.getItem('priceTempState') || '{}');
        delete tempData[id];
        localStorage.setItem('priceTempState', JSON.stringify(tempData));
    } catch(e) {
        console.warn('清除localStorage临时状态失败', e);
    }
}

// ============================================================
// 暴露所有核心函数到全局（确保 HTML onclick 能调用）
// ============================================================

// 商品信息相关
window.switchGoodsSubTab = switchGoodsSubTab;
window.loadGoods = loadGoods;
window.filterGoods = filterGoods;
window.renderGoods = renderGoods;
window.renderPagination = renderPagination;
window.goToPage = goToPage;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.changePageSize = changePageSize;
window.deleteGoods = deleteGoods;
window.batchDelete = batchDelete;
window.openEditForm = openEditForm;
window.openAddForm = openAddForm;
window.closeForm = closeForm;
window.toggleSelectAll = toggleSelectAll;
window.resetGoodsSearch = resetGoodsSearch;
window.onGoodsFilterInput = onGoodsFilterInput;
window.exportExcel = exportExcel;
window.downloadTemplate = downloadTemplate;
window.importGoodsExcel = importGoodsExcel;
window.refreshGoods = refreshGoods;
window.clearSort = clearSort;

// 供应商管理相关
window.loadSettleList = loadSettleList;
window.renderSettleList = renderSettleList;
window.renderSettlePagination = renderSettlePagination;
window.settleGoToPage = settleGoToPage;
window.settlePrevPage = settlePrevPage;
window.settleNextPage = settleNextPage;
window.changeSettlePageSize = changeSettlePageSize;
window.filterSettleList = filterSettleList;
window.resetSettleSearch = resetSettleSearch;
window.showSettleSupplierList = showSettleSupplierList;
window.filterSettleSupplierList = filterSettleSupplierList;
window.onSettleFilterInput = onSettleFilterInput;
window.openSettleForm = openSettleForm;
window.openSettleEditForm = openSettleEditForm;
window.closeSettleModal = closeSettleModal;
window.submitSettleForm = submitSettleForm;
window.deleteSettleType = deleteSettleType;
window.downloadSettleTemplate = downloadSettleTemplate;
window.importSettleExcel = importSettleExcel;
window.exportSettleExcel = exportSettleExcel;
window.refreshSettleList = refreshSettleList;
window.resetSettleSearchOld = resetSettleSearchOld;

// 改日改价相关
window.loadDateChangeTab = loadDateChangeTab;
window.renderDateChangeList = renderDateChangeList;
window.renderDateChangePagination = renderDateChangePagination;
window.dateChangeGoToPage = dateChangeGoToPage;
window.dateChangePrevPage = dateChangePrevPage;
window.dateChangeNextPage = dateChangeNextPage;
window.changeDateChangePageSize = changeDateChangePageSize;
window.refreshDateChangeList = refreshDateChangeList;
window.clearDateChangeSort = clearDateChangeSort;
window.dateChangeSortTable = dateChangeSortTable;
window.exportDateChangeExcel = exportDateChangeExcel;
window.filterDateChangeList = filterDateChangeList;
window.resetDateChangeFilter = resetDateChangeFilter;
window.showDateChangeFilterList = showDateChangeFilterList;
window.onDateChangeFilterInput = onDateChangeFilterInput;
window.batchUpdateGoodsDate = batchUpdateGoodsDate;
window.copyDateText = copyDateText;

// 改价弹窗相关（已有，但确保完整）
window.openPriceModal = openPriceModal;
window.closePriceModal = closePriceModal;
window.confirmPriceChange = confirmPriceChange;
window.skipPriceChange = skipPriceChange;
window.copyNewPrice = copyNewPrice;
window.updateSingleGoodsDateWithPrice = updateSingleGoodsDateWithPrice;
window.savePriceTempState = savePriceTempState;
window.loadPriceTempState = loadPriceTempState;
window.clearPriceTempState = clearPriceTempState;
window.clearAllPriceTempState = clearAllPriceTempState;
window.savePriceTempStateByStatus = savePriceTempStateByStatus;
window.switchGodsSubTab = window.switchGoodsSubTab;


console.log('✅ 所有 goods.js 函数已暴露到 window');
console.log('goods.js 加载完成');
// ==================== 单位预设管理 ====================

// ==================== 单位预设管理（组合包） ====================

let unitList = [];
let unitFilteredList = [];
let unitCurrentPage = 1;
let unitPageSize = 10;

// 加载单位列表（组合包）
async function loadUnitList() {
    try {
        // 加载组合包数据，关联分类和基准单位
        const { data, error } = await supabase
            .from('combo_packs')
            .select(`
                *,
                categories(name),
                unit_presets(unit_name)
            `)
            .order('name');
        if (error) throw error;
        unitList = data || [];
        applyUnitFilter();
        renderUnitTable();
    } catch (e) {
        console.error('加载单位列表失败:', e);
        showMsg('加载数据失败: ' + e.message);
    }
}

// 渲染单位表格
function renderUnitTable() {
    const tbody = document.getElementById('unitPresetList');
    if (!tbody) return;
    
    const start = (unitCurrentPage - 1) * unitPageSize;
    const end = Math.min(start + unitPageSize, unitFilteredList.length);
    const pageData = unitFilteredList.slice(start, end);
    
    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#999;">暂无数据</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map((item, index) => `
            <tr>
                <td>${start + index + 1}</td>
                <td>${escapeHtml(item.name || '')}</td>
                <td>${escapeHtml(item.categories?.name || '-')}</td>
                <td>${escapeHtml(item.description || '-')}</td>
                <td>${escapeHtml(item.unit_presets?.unit_name || '-')}</td>
                <td>${item.is_locked ? '🔒 已锁定' : '✅ 可用'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editUnitPreset('${item.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUnitPreset('${item.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    }
    
    document.getElementById('comboTotalCount').textContent = unitList.length;
    document.getElementById('unitCurrentPage').textContent = unitCurrentPage;
    document.getElementById('unitTotalPages').textContent = Math.ceil(unitFilteredList.length / unitPageSize) || 1;
    
    renderUnitPagination();
}

// 渲染分页
function renderUnitPagination() {
    const container = document.getElementById('unitPageNumbers');
    if (!container) return;
    const total = Math.ceil(unitFilteredList.length / unitPageSize) || 1;
    let html = '';
    const startPage = Math.max(1, unitCurrentPage - 2);
    const endPage = Math.min(total, unitCurrentPage + 2);
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === unitCurrentPage ? 'active' : ''}" onclick="unitGoToPage(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

// 应用筛选
function applyUnitFilter() {
    const category = document.getElementById('unitFilterCategory')?.value?.trim() || '';
    const name = document.getElementById('unitFilterName')?.value?.trim() || '';
    
    unitFilteredList = unitList.filter(item => {
        let match = true;
        if (category) {
            const catName = item.categories?.name || '';
            if (!catName.toLowerCase().includes(category.toLowerCase())) match = false;
        }
        if (name) {
            if (!(item.name || '').toLowerCase().includes(name.toLowerCase())) match = false;
        }
        return match;
    });
    if (unitFilteredList.length === 0) unitCurrentPage = 1;
    if (unitCurrentPage > Math.ceil(unitFilteredList.length / unitPageSize)) {
        unitCurrentPage = Math.max(1, Math.ceil(unitFilteredList.length / unitPageSize));
    }
}

function filterUnitList() {
    applyUnitFilter();
    renderUnitTable();
}

// 分页操作
function unitGoToPage(page) {
    const total = Math.ceil(unitFilteredList.length / unitPageSize) || 1;
    if (page < 1 || page > total) return;
    unitCurrentPage = page;
    renderUnitTable();
}

function unitPrevPage() { unitGoToPage(unitCurrentPage - 1); }
function unitNextPage() { unitGoToPage(unitCurrentPage + 1); }

function changeUnitPageSize() {
    const el = document.getElementById('unitPageSize');
    if (el) unitPageSize = parseInt(el.value) || 10;
    unitCurrentPage = 1;
    renderUnitTable();
}

function resetUnitSearch() {
    document.getElementById('unitFilterCategory').value = '';
    document.getElementById('unitFilterName').value = '';
    applyUnitFilter();
    renderUnitTable();
}

// ==================== 单位弹窗（分类/基准单位 关键词+下拉） ====================

let unitCategoryList = [];
let unitBaseUnitList = [];

// 加载分类和基准单位数据
async function loadUnitSelectData() {
    try {
        // 加载分类
        const { data: catData, error: catError } = await supabase
            .from('categories')
            .select('name')
            .order('name');
        if (!catError) {
            unitCategoryList = catData.map(c => c.name);
        }
        
        // 加载基准单位
        const { data: unitData, error: unitError } = await supabase
            .from('unit_presets')
            .select('unit_name')
            .order('unit_name');
        if (!unitError) {
            unitBaseUnitList = unitData.map(u => u.unit_name);
        }
    } catch (e) {
        console.error('加载下拉数据失败:', e);
    }
}

// 分类下拉
function showUnitCategoryList() {
    renderUnitCategoryList(unitCategoryList);
    document.getElementById('unitCategoryListBox').style.display = 'block';
}

function filterUnitCategoryList() {
    const input = document.getElementById('unitCategoryInput');
    const kw = input.value.toLowerCase().trim();
    const filtered = unitCategoryList.filter(s => s.toLowerCase().includes(kw));
    renderUnitCategoryList(filtered);
    document.getElementById('unitCategoryListBox').style.display = 'block';
}

function renderUnitCategoryList(list) {
    const box = document.getElementById('unitCategoryListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        const input = document.getElementById('unitCategoryInput').value.trim();
        if (input) {
            box.innerHTML = `<div style="padding:6px 10px;color:#666;cursor:pointer;" onclick="selectUnitCategory('${input.replace(/'/g, "\\'")}')">➕ 创建 "${input}"</div>`;
        } else {
            box.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配分类</div>';
        }
        return;
    }
    list.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = item;
        div.onclick = function() { selectUnitCategory(item); };
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        box.appendChild(div);
    });
}

function selectUnitCategory(value) {
    document.getElementById('unitCategoryInput').value = value;
    document.getElementById('unitCategoryValue').value = value;
    document.getElementById('unitCategoryListBox').style.display = 'none';
    checkUnitCategoryDuplicate(value);
}

function checkUnitCategoryDuplicate(value) {
    if (!value) return;
    if (unitCategoryList.includes(value)) {
        document.getElementById('unitCategoryInput').style.borderColor = '';
    } else {
        document.getElementById('unitCategoryInput').style.borderColor = '#52c41a';
    }
}

// 基准单位下拉
function showUnitBaseUnitList() {
    renderUnitBaseUnitList(unitBaseUnitList);
    document.getElementById('unitBaseUnitListBox').style.display = 'block';
}

function filterUnitBaseUnitList() {
    const input = document.getElementById('unitBaseUnitInput');
    const kw = input.value.toLowerCase().trim();
    const filtered = unitBaseUnitList.filter(s => s.toLowerCase().includes(kw));
    renderUnitBaseUnitList(filtered);
    document.getElementById('unitBaseUnitListBox').style.display = 'block';
}

function renderUnitBaseUnitList(list) {
    const box = document.getElementById('unitBaseUnitListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        const input = document.getElementById('unitBaseUnitInput').value.trim();
        if (input) {
            box.innerHTML = `<div style="padding:6px 10px;color:#666;cursor:pointer;" onclick="selectUnitBaseUnit('${input.replace(/'/g, "\\'")}')">➕ 创建 "${input}"</div>`;
        } else {
            box.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配单位</div>';
        }
        return;
    }
    list.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = item;
        div.onclick = function() { selectUnitBaseUnit(item); };
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        box.appendChild(div);
    });
}

function selectUnitBaseUnit(value) {
    document.getElementById('unitBaseUnitInput').value = value;
    document.getElementById('unitBaseUnitValue').value = value;
    document.getElementById('unitBaseUnitListBox').style.display = 'none';
    checkUnitBaseUnitDuplicate(value);
}

function checkUnitBaseUnitDuplicate(value) {
    if (!value) return;
    if (unitBaseUnitList.includes(value)) {
        document.getElementById('unitBaseUnitInput').style.borderColor = '';
    } else {
        document.getElementById('unitBaseUnitInput').style.borderColor = '#52c41a';
    }
}

// 点击外部关闭下拉
document.addEventListener('click', function(e) {
    if (!e.target.closest('#unitCategoryInput') && !e.target.closest('#unitCategoryListBox')) {
        document.getElementById('unitCategoryListBox').style.display = 'none';
    }
    if (!e.target.closest('#unitBaseUnitInput') && !e.target.closest('#unitBaseUnitListBox')) {
        document.getElementById('unitBaseUnitListBox').style.display = 'none';
    }
});



// ==================== 拆分单位数据 ====================
let unitSplitUnitList = [];  // 所有可用的拆分单位（从 unit_presets 加载）

// 加载拆分单位下拉数据
async function loadSplitUnitData() {
    try {
        const { data, error } = await supabase
            .from('unit_presets')
            .select('unit_name')
            .order('unit_name');
        if (!error) {
            unitSplitUnitList = data.map(u => u.unit_name);
        }
    } catch (e) {
        console.error('加载拆分单位数据失败:', e);
    }
}

// 添加拆分单位行
function addUnitSplitRow(data) {
    const container = document.getElementById('unitSplitUnitsContainer');
    const rowIndex = container.querySelectorAll('.split-unit-row').length;
    
    const row = document.createElement('div');
    row.className = 'split-unit-row';
    row.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:center;';
    row.dataset.index = rowIndex;
    row.innerHTML = `
        <div style="position:relative;flex:2;">
            <input type="text" placeholder="拆分单位（如：提）" 
                   class="split-unit-name-input" 
                   value="${data ? escapeHtml(data.unit_name || '') : ''}"
                   onfocus="showSplitUnitList(this)" 
                   oninput="filterSplitUnitList(this)"
                   style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;">
            <div class="split-unit-list-box" style="position:absolute;top:100%;left:0;width:100%;max-height:150px;overflow-y:auto;background:#fff;border:1px solid #ddd;z-index:9999;display:none;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);"></div>
        </div>
        <div style="flex:1;">
            <input type="number" class="split-unit-quantity" placeholder="数量" 
                   value="${data ? data.quantity || '' : ''}"
                   min="1" oninput="updateUnitDescription()"
                   style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="flex:1;font-size:13px;color:#999;text-align:center;">
    <span class="split-unit-preview">层级${rowIndex + 1}</span>
    <span class="split-unit-relation" style="display:block;font-size:12px;color:#ff6b6b;font-weight:bold;"></span>
</div>
        <button class="btn btn-danger btn-sm" onclick="removeSplitUnitRow(this)" style="padding:2px 10px;">×</button>
    `;
    container.appendChild(row);
    
    // 如果传入了数据，设置隐藏值
    if (data && data.unit_name) {
        const input = row.querySelector('.split-unit-name-input');
        input.value = data.unit_name;
    }
    updateUnitDescription();
    // ✅ 新增：更新每行换算关系
    updateSplitUnitRelations();
}

// 移除拆分单位行
function removeSplitUnitRow(btn) {
    const container = document.getElementById('unitSplitUnitsContainer');
    if (container.children.length <= 1) {
        showMsg('至少保留一个拆分单位');
        return;
    }
    btn.closest('.split-unit-row').remove();
    updateUnitDescription();
    updateSplitUnitRelations();  // ✅ 添加这行
    // 更新层级显示
    document.querySelectorAll('.split-unit-row').forEach((row, idx) => {
        row.dataset.index = idx;
        const preview = row.querySelector('.split-unit-preview');
        if (preview) preview.textContent = '层级' + (idx + 1);
    });
}

// 拆分单位下拉
function showSplitUnitList(input) {
    const parent = input.closest('.split-unit-row');
    const box = parent.querySelector('.split-unit-list-box');
    const kw = input.value.toLowerCase().trim();
    const filtered = unitSplitUnitList.filter(s => s.toLowerCase().includes(kw));
    renderSplitUnitList(box, filtered, input);
    box.style.display = 'block';
}

function filterSplitUnitList(input) {
    const parent = input.closest('.split-unit-row');
    const box = parent.querySelector('.split-unit-list-box');
    const kw = input.value.toLowerCase().trim();
    const filtered = unitSplitUnitList.filter(s => s.toLowerCase().includes(kw));
    renderSplitUnitList(box, filtered, input);
    box.style.display = 'block';
}

function renderSplitUnitList(box, list, input) {
    box.innerHTML = '';
    if (list.length === 0) {
        const val = input.value.trim();
        if (val) {
            box.innerHTML = `<div style="padding:6px 10px;color:#666;cursor:pointer;" onclick="selectSplitUnit(this, '${val.replace(/'/g, "\\'")}')">➕ 创建 "${val}"</div>`;
        } else {
            box.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配单位</div>';
        }
        return;
    }
    list.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = item;
        div.onclick = function() { selectSplitUnit(this, item); };
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        box.appendChild(div);
    });
}

function selectSplitUnit(el, value) {
    const parent = el.closest('.split-unit-row');
    const input = parent.querySelector('.split-unit-name-input');
    input.value = value;
    const box = parent.querySelector('.split-unit-list-box');
    box.style.display = 'none';
    // 检查是否与基准单位重复
    const baseUnit = document.getElementById('unitBaseUnitValue').value.trim() || document.getElementById('unitBaseUnitInput').value.trim();
    if (value === baseUnit) {
        input.style.borderColor = '#ff6b6b';
        showMsg('拆分单位不能与基准单位相同');
    } else {
        input.style.borderColor = '';
    }
    updateUnitDescription();
}

// 更新换算关系描述（自动生成）
function updateUnitDescription() {
    const baseUnit = document.getElementById('unitBaseUnitInput').value.trim() || document.getElementById('unitBaseUnitValue').value.trim();
    if (!baseUnit) {
        document.getElementById('unitDescription').value = '';
        updateSplitUnitRelations(); // 清空行关系
        return;
    }
    
    const rows = document.querySelectorAll('.split-unit-row');
    let parts = ['1' + baseUnit];
    let hasValid = false;
    let allUnits = [];  // 收集所有层级
    
    rows.forEach((row, idx) => {
        const nameInput = row.querySelector('.split-unit-name-input');
        const qtyInput = row.querySelector('.split-unit-quantity');
        const name = nameInput ? nameInput.value.trim() : '';
        const qty = qtyInput ? parseInt(qtyInput.value) : 0;
        if (name && qty > 0 && name !== baseUnit) {
            // 检查是否与之前的拆分单位重复
            let isDuplicate = false;
            for (let i = 0; i < idx; i++) {
                const prevRow = rows[i];
                const prevName = prevRow.querySelector('.split-unit-name-input');
                if (prevName && prevName.value.trim() === name) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                parts.push(qty + name);
                allUnits.push({ name: name, qty: qty, row: row });
                hasValid = true;
            }
        }
    });
    
    // 生成主换算关系
    let mainDesc = parts.join('=');
    
    if (hasValid) {
        document.getElementById('unitDescription').value = mainDesc;
    } else {
        document.getElementById('unitDescription').value = '1' + baseUnit + '=...（请添加拆分单位并填写数量）';
    }
    
    // ✅ 更新每行的换算关系
    updateSplitUnitRelations();
}

// ==================== 更新每行拆分单位的换算关系 ====================
function updateSplitUnitRelations() {
    const rows = document.querySelectorAll('.split-unit-row');
    const allUnits = [];
    
    // 收集所有有效行
    rows.forEach((row) => {
        const nameInput = row.querySelector('.split-unit-name-input');
        const qtyInput = row.querySelector('.split-unit-quantity');
        const name = nameInput ? nameInput.value.trim() : '';
        const qty = qtyInput ? parseInt(qtyInput.value) : 0;
        if (name && qty > 0) {
            allUnits.push({ name: name, qty: qty, row: row });
        }
    });
    
    // 如果没有数据或只有一行，清空所有关系显示
    if (allUnits.length <= 1) {
        rows.forEach(row => {
            const relationEl = row.querySelector('.split-unit-relation');
            if (relationEl) relationEl.textContent = '';
        });
        return;
    }
    
    // 从后往前计算：最后一行不显示换算关系
    for (let i = 0; i < allUnits.length; i++) {
        const relationEl = allUnits[i].row.querySelector('.split-unit-relation');
        if (!relationEl) continue;
        
        // 最后一行不显示
        if (i === allUnits.length - 1) {
            relationEl.textContent = '';
            continue;
        }
        
        // 计算从当前行到最小单位的换算比例
// 当前行数量为 allUnits[i].qty，下一行到最小单位的累积比例为 ratio
let ratio = 1;
for (let j = i + 1; j < allUnits.length; j++) {
    ratio = ratio * allUnits[j].qty;
}
// 1 当前单位 = (ratio / allUnits[i].qty) 最小单位
const resultRatio = ratio / allUnits[i].qty;
        const currentUnit = allUnits[i].name;
        const smallestUnit = allUnits[allUnits.length - 1].name;
        relationEl.textContent = '1' + currentUnit + '=' + resultRatio + smallestUnit;
        relationEl.style.color = '#ff6b6b';
        relationEl.style.fontWeight = 'bold';
        relationEl.style.fontSize = '12px';
    }
}
// 点击外部关闭拆分单位下拉
document.addEventListener('click', function(e) {
    document.querySelectorAll('.split-unit-list-box').forEach(box => {
        const parent = box.closest('.split-unit-row');
        if (parent && !e.target.closest(parent)) {
            box.style.display = 'none';
        }
    });
});

// ==================== 单位CRUD ====================

// ✅ 编辑单位预设（供HTML按钮调用）
function editUnitPreset(id) {
    if (!id) {
        showMsg('无效的单位ID');
        return;
    }
    const item = unitList.find(u => u.id === id);
    if (!item) {
        showMsg('找不到该单位数据');
        return;
    }
    openUnitForm(item);
}

// ✅ 删除单位预设（供HTML按钮调用）
async function deleteUnitPreset(id) {
    if (!id) {
        showMsg('无效的单位ID');
        return;
    }
    
    const item = unitList.find(u => u.id === id);
    if (!item) {
        showMsg('找不到该单位数据');
        return;
    }
    
    if (item.is_locked) {
        showMsg('🔒 该单位已被锁定，无法删除');
        return;
    }
    
    // 检查是否被商品引用
    try {
        const { data: refData, error: refError } = await supabase
            .from('goods_combo_pack')
            .select('goods_id')
            .eq('combo_pack_id', id)
            .limit(1);
        if (!refError && refData && refData.length > 0) {
            showMsg('该单位已被商品引用，无法删除');
            return;
        }
    } catch (e) {
        console.warn('检查引用失败:', e);
    }
    
    if (!confirm(`确定要删除单位"${item.name}"吗？`)) return;
    
    try {
        // 删除拆分单位明细
        await supabase
            .from('combo_pack_details')
            .delete()
            .eq('combo_pack_id', id);
        
        // 删除组合包
        const { error } = await supabase
            .from('combo_packs')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showMsg('✅ 单位已删除');
        await loadUnitList();
        loadComboPackSelect();
    } catch (e) {
        console.error('删除单位失败:', e);
        showMsg('删除失败: ' + e.message);
    }
}

function openUnitForm(data) {
    const modal = document.getElementById('unitModal');
    const title = document.getElementById('unitModalTitle');
    const idField = document.getElementById('unitEditId');
    const nameField = document.getElementById('unitName');
    const categoryInput = document.getElementById('unitCategoryInput');
    const categoryValue = document.getElementById('unitCategoryValue');
    const baseUnitInput = document.getElementById('unitBaseUnitInput');
    const baseUnitValue = document.getElementById('unitBaseUnitValue');
    const descField = document.getElementById('unitDescription');
    const container = document.getElementById('unitSplitUnitsContainer');
    
    // 加载下拉数据
    loadUnitSelectData();
    loadSplitUnitData();
    
    if (data) {
        title.textContent = data.is_locked ? '🔒 编辑单位（已锁定）' : '编辑单位';
        idField.value = data.id;
        nameField.value = data.name || '';
        categoryInput.value = data.categories?.name || '';
        categoryValue.value = data.categories?.name || '';
        baseUnitInput.value = data.unit_presets?.unit_name || '';
        baseUnitValue.value = data.unit_presets?.unit_name || '';
        // 加载拆分单位明细
        loadSplitUnits(data.id);
    } else {
        title.textContent = '新增单位';
        idField.value = '';
        nameField.value = '';
        categoryInput.value = '';
        categoryValue.value = '';
        baseUnitInput.value = '';
        baseUnitValue.value = '';
        descField.value = '';
        container.innerHTML = '';
        // 默认添加两行拆分单位
        addSplitUnitRowWithDefault();
    }
    modal.style.display = 'flex';
}

function addSplitUnitRowWithDefault() {
    const container = document.getElementById('unitSplitUnitsContainer');
    // 只清空行，保留按钮
    const rows = container.querySelectorAll('.split-unit-row');
    rows.forEach(row => row.remove());
    addUnitSplitRow();
    addUnitSplitRow();
    // ✅ 添加更新
    setTimeout(function() {
        updateSplitUnitRelations();
    }, 50);
}
function closeUnitForm() {
    document.getElementById('unitModal').style.display = 'none';
    document.getElementById('unitCategoryListBox').style.display = 'none';
    document.getElementById('unitBaseUnitListBox').style.display = 'none';
    document.querySelectorAll('.split-unit-list-box').forEach(box => box.style.display = 'none');
}

// 加载拆分单位
async function loadSplitUnits(comboId) {
    try {
        const { data, error } = await supabase
            .from('combo_pack_details')
            .select('*')
            .eq('combo_pack_id', comboId)
            .order('display_order');
        if (error) throw error;
        const container = document.getElementById('unitSplitUnitsContainer');
        // 只清空行，保留按钮
        const rows = container.querySelectorAll('.split-unit-row');
        rows.forEach(row => row.remove());
        if (data && data.length > 0) {
            data.forEach(item => {
                addUnitSplitRow({
                    unit_name: item.unit_name,
                    quantity: item.conversion_ratio ? parseInt(item.conversion_ratio) : null
                });
            });
        } else {
            addUnitSplitRow();
            addUnitSplitRow();
        }
        setTimeout(function() {
            updateUnitDescription();
            updateSplitUnitRelations();  // ✅ 添加这行
        }, 100);
    } catch (e) {
        console.error('加载拆分单位失败:', e);
    }
}

// 保存单位
async function saveUnitPreset() {
    const id = document.getElementById('unitEditId').value;
    const name = document.getElementById('unitName').value.trim();
    const category = document.getElementById('unitCategoryValue').value.trim() || document.getElementById('unitCategoryInput').value.trim();
    const baseUnit = document.getElementById('unitBaseUnitValue').value.trim() || document.getElementById('unitBaseUnitInput').value.trim();
    const description = document.getElementById('unitDescription').value.trim();
    
    if (!name) { showMsg('请输入单位名称'); return; }
    if (!category) { showMsg('请输入或选择分类'); return; }
    if (!baseUnit) { showMsg('请输入或选择基准单位'); return; }
    
    // 收集拆分单位
    const rows = document.querySelectorAll('.split-unit-row');
    const splitUnits = [];
    let hasError = false;
    const unitNames = new Set();
    
    let prevQty = 0;
rows.forEach((row, idx) => {
    const nameInput = row.querySelector('.split-unit-name-input');
    const qtyInput = row.querySelector('.split-unit-quantity');
    const name = nameInput ? nameInput.value.trim() : '';
    const qty = qtyInput ? parseInt(qtyInput.value) : 0;
    if (name && qty > 0) {
        if (name === baseUnit) {
            showMsg('拆分单位"' + name + '"不能与基准单位相同');
            hasError = true;
            return;
        }
        if (unitNames.has(name)) {
            showMsg('拆分单位"' + name + '"重复，请勿重复添加');
            hasError = true;
            return;
        }
        // ✅ 新增：层级必须递增（后一行数量必须大于前一行）
        if (idx > 0 && qty <= prevQty) {
            showMsg('第' + (idx + 1) + '行的数量(' + qty + ')必须大于上一行(' + prevQty + ')，请调整层级顺序');
            hasError = true;
            return;
        }
        prevQty = qty;
        unitNames.add(name);
        splitUnits.push({ unit_name: name, quantity: qty });
    }
});
    
    if (hasError) return;
    if (splitUnits.length === 0) {
        showMsg('请至少添加一个有效的拆分单位');
        return;
    }
    
    try {
        // 1. 处理分类
        let categoryId = null;
        const { data: catData, error: catError } = await supabase
            .from('categories')
            .select('id')
            .eq('name', category)
            .maybeSingle();
        if (catError) throw catError;
        if (catData) {
            categoryId = catData.id;
        } else {
            const { data: newCat, error: newCatError } = await supabase
                .from('categories')
                .insert([{ name: category }])
                .select('id')
                .single();
            if (newCatError) throw newCatError;
            categoryId = newCat.id;
            unitCategoryList.push(category);
        }
        
        // 2. 处理基准单位
        let baseUnitId = null;
        const { data: unitData, error: unitError } = await supabase
            .from('unit_presets')
            .select('id')
            .eq('unit_name', baseUnit)
            .maybeSingle();
        if (unitError) throw unitError;
        if (unitData) {
            baseUnitId = unitData.id;
        } else {
            const { data: newUnit, error: newUnitError } = await supabase
                .from('unit_presets')
                .insert([{ unit_name: baseUnit, unit_code: baseUnit.toUpperCase(), is_default: false }])
                .select('id')
                .single();
            if (newUnitError) throw newUnitError;
            baseUnitId = newUnit.id;
            unitBaseUnitList.push(baseUnit);
        }
        
        // 3. 处理拆分单位（保存到 unit_presets 如果不存在）
        for (const su of splitUnits) {
            const { data: existUnit, error: existError } = await supabase
                .from('unit_presets')
                .select('id')
                .eq('unit_name', su.unit_name)
                .maybeSingle();
            if (existError) throw existError;
            if (!existUnit) {
                await supabase
                    .from('unit_presets')
                    .insert([{ unit_name: su.unit_name, unit_code: su.unit_name.toUpperCase(), is_default: false }]);
            }
        }
        
        // 4. 保存组合包
        const comboData = {
            name: name,
            category_id: categoryId,
            base_unit_id: baseUnitId,
            description: description,
            is_locked: false
        };
        
        let comboId = id;
        if (id) {
            const existing = unitList.find(c => c.id === id);
            if (existing?.is_locked) {
                const { error } = await supabase
                    .from('combo_packs')
                    .update({ name })
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('combo_packs')
                    .update(comboData)
                    .eq('id', id);
                if (error) throw error;
            }
        } else {
            const { data, error } = await supabase
                .from('combo_packs')
                .insert([comboData])
                .select('id')
                .single();
            if (error) throw error;
            comboId = data.id;
        }
        
        // 5. 保存拆分单位明细
        if (comboId) {
            await supabase.from('combo_pack_details').delete().eq('combo_pack_id', comboId);
            
            const details = splitUnits.map((su, index) => ({
                combo_pack_id: comboId,
                unit_name: su.unit_name,
                conversion_ratio: String(su.quantity),
                display_order: index + 1,
                is_base: index === 0
            }));
            
            const { error } = await supabase
                .from('combo_pack_details')
                .insert(details);
            if (error) throw error;
        }
        
        closeUnitForm();
        showMsg(id ? '单位更新成功' : '单位添加成功');
        await loadUnitList();
        // 刷新商品弹窗中的组合包下拉
        loadComboPackSelect();
    } catch (e) {
        console.error('保存单位失败:', e);
        showMsg('保存失败: ' + e.message);
    }
}

// 加载组合包下拉（商品弹窗使用）
async function loadComboPackSelect(goodsId) {
    const sel = document.getElementById('add_combo_pack');
    if (!sel) return;
    try {
        const { data, error } = await supabase
            .from('combo_packs')
            .select('*, categories(name), unit_presets(unit_name)')
            .order('name');
        if (error) throw error;
        
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">请选择组合包</option>';
        (data || []).forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            const catName = item.categories?.name || '未分类';
            const baseUnit = item.unit_presets?.unit_name || '';
            opt.textContent = `${item.name} (${catName} | 基准: ${baseUnit})`;
            sel.appendChild(opt);
        });
        
        if (goodsId) {
            const { data: relData, error: relError } = await supabase
                .from('goods_combo_pack')
                .select('combo_pack_id')
                .eq('goods_id', goodsId)
                .maybeSingle();
            if (!relError && relData) {
                sel.value = relData.combo_pack_id;
            }
        }
        if (currentVal) sel.value = currentVal;
    } catch (e) {
        console.error('加载组合包下拉失败:', e);
    }
}

// ========== 单位下拉（搜索+下拉，显示基准单位红色+换算关系） ==========

let comboPackListData = [];

// 加载单位下拉数据
async function loadComboPackListData() {
    try {
        const { data, error } = await supabase
            .from('combo_packs')
            .select(`
                id,
                name,
                categories(name),
                unit_presets(unit_name),
                description
            `)
            .order('name');
        if (error) throw error;
        comboPackListData = data || [];
    } catch (e) {
        console.error('加载单位下拉数据失败:', e);
    }
}

// 显示单位下拉列表
function showComboPackList() {
    const box = document.getElementById('addComboPackListBox');
    if (!box) return;
    const input = document.getElementById('addComboPackSearch');
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderComboPackList(kw);
    box.style.display = 'block';
}

// 过滤单位下拉列表
function filterComboPackList() {
    const input = document.getElementById('addComboPackSearch');
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderComboPackList(kw);
    const box = document.getElementById('addComboPackListBox');
    if (box) box.style.display = 'block';
}

// 渲染单位下拉列表
function renderComboPackList(keyword) {
    const box = document.getElementById('addComboPackListBox');
    if (!box) return;
    
    let list = comboPackListData;
    if (keyword) {
        list = list.filter(item => 
            (item.name || '').toLowerCase().includes(keyword) ||
            (item.categories?.name || '').toLowerCase().includes(keyword) ||
            (item.unit_presets?.unit_name || '').toLowerCase().includes(keyword)
        );
    }
    
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:8px 12px;color:#999;text-align:center;">暂无匹配单位</div>';
        return;
    }
    
    list.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee;display:flex;align-items:center;gap:8px;';
        
        // 名称和分类
        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'flex:0 0 auto;';
        nameSpan.textContent = item.name || '';
        
        // 基准单位（红色显示，放中间）
        const baseUnit = item.unit_presets?.unit_name || '';
        const baseSpan = document.createElement('span');
        baseSpan.style.cssText = 'color:#ff4d4f;font-weight:bold;font-size:15px;margin:0 6px;';
        baseSpan.textContent = '【' + baseUnit + '】';
        
        // 换算关系（紧跟其后，字体大一点，黑色）
        const descSpan = document.createElement('span');
        descSpan.style.cssText = 'color:#333;font-size:14px;';
        descSpan.textContent = item.description || '';
        
        // 组装：名称 + 基准单位(红色) + 换算关系
        div.appendChild(nameSpan);
        div.appendChild(baseSpan);
        if (item.description) {
            div.appendChild(descSpan);
        }
        
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            document.getElementById('addComboPackSearch').value = item.name;
            document.getElementById('add_combo_pack').value = item.id;
            box.style.display = 'none';
        };
        box.appendChild(div);
    });
}
// 点击外部关闭下拉
document.addEventListener('click', function(e) {
    if (!e.target.closest('#addComboPackSearch') && !e.target.closest('#addComboPackListBox')) {
        const box = document.getElementById('addComboPackListBox');
        if (box) box.style.display = 'none';
    }
});

// 暴露函数
window.loadUnitList = loadUnitList;
window.renderUnitTable = renderUnitTable;
window.applyUnitFilter = applyUnitFilter;
window.filterUnitList = filterUnitList;
window.unitGoToPage = unitGoToPage;
window.unitPrevPage = unitPrevPage;
window.unitNextPage = unitNextPage;
window.changeUnitPageSize = changeUnitPageSize;
window.resetUnitSearch = resetUnitSearch;
window.openUnitForm = openUnitForm;
window.closeUnitForm = closeUnitForm;
window.saveUnitPreset = saveUnitPreset;
window.editUnitPreset = editUnitPreset;
window.deleteUnitPreset = deleteUnitPreset;
window.showUnitCategoryList = showUnitCategoryList;
window.filterUnitCategoryList = filterUnitCategoryList;
window.selectUnitCategory = selectUnitCategory;
window.showUnitBaseUnitList = showUnitBaseUnitList;
window.filterUnitBaseUnitList = filterUnitBaseUnitList;
window.selectUnitBaseUnit = selectUnitBaseUnit;
window.openComboForm = openUnitForm;
// 拆分单位相关
window.addSplitUnitRow = addUnitSplitRow;  // 函数名是 addUnitSplitRow
window.removeSplitUnitRow = removeSplitUnitRow;
window.showSplitUnitList = showSplitUnitList;
window.filterSplitUnitList = filterSplitUnitList;
window.selectSplitUnit = selectSplitUnit;
window.updateUnitDescription = updateUnitDescription;
window.loadComboPackSelect = loadComboPackSelect;
window.updateSplitUnitRelations = updateSplitUnitRelations;