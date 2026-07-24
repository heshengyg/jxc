// 防抖工具
function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    }
}

let goodsUsedCache = new Map();
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
    
    // 处理 tab 名称映射
    let targetTab = tab;
    if (tab === 'sub-unitSet' || tab === 'unitSet') {
        targetTab = 'unitSet';
    }
    const targetContent = document.getElementById('sub-' + targetTab);
    if (targetContent) targetContent.style.display = 'block';

    // 2. 按钮激活状态
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
    } else if (tab === 'sub-unitSet' || tab === 'unitSet') {
    // ✅ 先显示内容，再加载数据
    const unitSetContent = document.getElementById('sub-unitSet');
    if (unitSetContent) {
        unitSetContent.style.display = 'block';
    }
    // 加载数据并渲染表格
    loadAllBaseUnit();
    loadAllUnitSpec();
    // 延迟渲染表格（等待数据加载完成）
    setTimeout(function() {
        renderAllUnitTable();
    }, 500);
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
        tb.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:20px;">暂无数据</td></tr>';
        return;
    }
    
    let start = (currentPage - 1) * pageSize;
    let pageData = filteredGoods.slice(start, start + pageSize);
    tb.innerHTML = '';
    
    if (pageData.length === 0) {
        tb.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:20px;">暂无数据</td></tr>';
        return;
    }

    for (let idx = 0; idx < pageData.length; idx++) {
        const item = pageData[idx];
        const seqNum = start + idx + 1;

        let shelfText = (item.shelf_life_num && item.shelf_life_unit) ? `${item.shelf_life_num}${item.shelf_life_unit}` : '';
        let expire = calculateExpireDays ? calculateExpireDays(item.shelf_life_num, item.shelf_life_unit) : '';
        let onlineCost = formatMoney ? formatMoney(item.online_cost) : (item.online_cost || 0);
        let isUsed = goodsUsedCache.get(item.id) ?? false;
        
        // 🔥 获取最小计量单位名称
        let baseUnitName = item.base_unit_name || '-';
        
        // 🔥 获取价格基准规格名称
        let priceSpecName = '-';
        if (item.price_spec_id) {
            const spec = unitSpecList.find(s => s.id == item.price_spec_id);
            if (spec) {
                const baseItem = baseUnitList.find(b => b.id == spec.base_unit_id);
                priceSpecName = spec.show_name + '（' + spec.convert_rate + (baseItem ? baseItem.unit_name : '') + '）';
            }
        }
        
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
                <td>${baseUnitName}</td>           <!-- 🔥 新增：最小计量单位 -->
                <td>${priceSpecName}</td>           <!-- 🔥 新增：价格基准规格 -->
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
    let h = ["供应商", "商品名称", "规格", "销售渠道", "最小计量单位", "价格基准规格", "销售单价", "税率", "线上成本价", "库存预警阈值", "保质期时长", "保质期单位"];
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
    let header = ["供应商", "商品名称", "规格", "销售渠道", "最小计量单位", "价格基准规格", "销售单价", "税率", "线上成本价", "库存预警阈值", "保质期", "临期天数"];
    let exportData = filteredGoods.map(item => {
        let shelf = item.shelf_life_num ? `${item.shelf_life_num}${item.shelf_life_unit || ''}` : "";
        let expire = calculateExpireDays ? calculateExpireDays(item.shelf_life_num, item.shelf_life_unit) : '';
        let baseUnitName = item.base_unit_name || '';
        // 获取价格基准规格名称
        let priceSpecName = '';
        if (item.price_spec_id) {
            const spec = unitSpecList.find(s => s.id == item.price_spec_id);
            if (spec) {
                const baseItem = baseUnitList.find(b => b.id == spec.base_unit_id);
                priceSpecName = spec.show_name + '（' + spec.convert_rate + (baseItem ? baseItem.unit_name : '') + '）';
            }
        }
        return [
            item.supplier || "",
            item.name || "",
            item.spec || "",
            item.channel || "",
            baseUnitName,
            priceSpecName,
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
                let baseUnitName = row['最小计量单位'] || row['base_unit_name'] || '';
                let priceSpecName = row['价格基准规格'] || row['price_spec_name'] || '';
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
                    shelf_life_unit: shelfLifeUnit || null,
                    // 导入时 base_unit_name 作为参考，但实际绑定需要用户后续在编辑中设置
                    base_unit_name: baseUnitName || null
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

// ===================== 【文件最末尾唯一单位代码，前置原生函数已加载，无语法报错】 =====================
// 全局缓存（仅此处声明，无重复）
let baseUnitList = [];
let unitSpecList = [];
let baseUnitPage = 1;
let baseUnitPageSize = 10;
let specPage = 1;
let specPageSize = 10;
let currentSelectBaseId = null;
let baseUnitSearchTimer = null;
let tempSpecList = [];
let currentModalBaseId = null;

// 安全获取元素
function $(id) { return document.getElementById(id); }

// ===================== 加载数据函数 =====================
async function loadAllBaseUnit() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/base_unit?order=id.asc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        baseUnitList = await res.json() || [];
        renderBaseUnitSelectOpt();
    } catch (e) {
        showMsg('加载单位失败：' + e.message);
    }
}

async function loadAllUnitSpec() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/unit_spec?order=base_unit_id,id.asc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        unitSpecList = await res.json() || [];
    } catch (e) {
        showMsg('加载规格失败：' + e.message);
    }
}

// ===================== 渲染表格函数 =====================
function renderAllUnitTable() {
    // 构建扁平数据
    unitAllData = buildUnitFlatData();
    unitFilteredData = [...unitAllData];
    filterUnitData();
}
// ===================== 单位预设分页和搜索相关 =====================
let unitCurrentPage = 1;
let unitPageSize = 10;
let unitTotalPages = 1;
let unitFilteredData = [];
let unitAllData = [];
let unitFilterTimer = null;

// 构建扁平数据（用于搜索和分页）
function buildUnitFlatData() {
    const result = [];
    let seq = 0;
    baseUnitList.forEach(baseItem => {
        // 一级单位行
        seq++;
        result.push({
            seq: seq,
            type: 'base',
            id: baseItem.id,
            baseName: baseItem.unit_name,
            specName: '-',
            rate: '-',
            status: baseItem.is_locked ? '锁定' : '可编辑',
            baseItem: baseItem,
            isLocked: baseItem.is_locked,
            isBase: true
        });
        // 二级规格行
        const childSpecs = unitSpecList.filter(s => s.base_unit_id == baseItem.id);
        if (childSpecs.length === 0) {
            result.push({
                seq: seq,
                type: 'empty',
                id: null,
                baseName: baseItem.unit_name,
                specName: '（暂无换算规格）',
                rate: '',
                status: '',
                baseItem: baseItem,
                isLocked: false,
                isBase: false,
                isEmpty: true
            });
        } else {
            childSpecs.forEach(spec => {
                seq++;
                result.push({
                    seq: seq,
                    type: 'spec',
                    id: spec.id,
                    baseName: baseItem.unit_name,
                    specName: spec.show_name,
                    rate: `${spec.convert_rate}${baseItem.unit_name}`,
                    status: spec.is_locked ? '锁定' : '正常',
                    baseItem: baseItem,
                    spec: spec,
                    isLocked: spec.is_locked,
                    isBase: false,
                    isEmpty: false
                });
            });
        }
    });
    return result;
}

// 过滤单位数据
function filterUnitData() {
    const baseKeyword = document.getElementById('unitFilterBaseName')?.value.trim().toLowerCase() || '';
    const specKeyword = document.getElementById('unitFilterSpecName')?.value.trim().toLowerCase() || '';
    const rateKeyword = document.getElementById('unitFilterRate')?.value.trim().toLowerCase() || '';
    
    let filtered = unitAllData.filter(item => {
        let match = true;
        if (baseKeyword) {
            const baseName = (item.baseName || '').toLowerCase();
            match = match && baseName.includes(baseKeyword);
        }
        if (specKeyword) {
            const specName = (item.specName || '').toLowerCase();
            match = match && specName.includes(specKeyword);
        }
        if (rateKeyword) {
            const rate = (item.rate || '').toLowerCase();
            match = match && rate.includes(rateKeyword);
        }
        return match;
    });
    
    unitFilteredData = filtered;
    
    // 更新统计
    const totalBaseCount = baseUnitList.length;
    const totalSpecCount = unitSpecList.length;
    const searchBaseCount = new Set(filtered.filter(item => item.isBase).map(item => item.id)).size;
    const searchSpecCount = filtered.filter(item => item.type === 'spec').length;
    
    const totalBaseEl = document.getElementById('unitTotalBaseCount');
    const totalSpecEl = document.getElementById('unitTotalSpecCount');
    const searchBaseEl = document.getElementById('unitSearchBaseCount');
    const searchSpecEl = document.getElementById('unitSearchSpecCount');
    if (totalBaseEl) totalBaseEl.textContent = totalBaseCount;
    if (totalSpecEl) totalSpecEl.textContent = totalSpecCount;
    if (searchBaseEl) searchBaseEl.textContent = searchBaseCount;
    if (searchSpecEl) searchSpecEl.textContent = searchSpecCount;
    
    unitCurrentPage = 1;
    renderUnitPagination();
    renderUnitTable();
}

// 渲染单位表格（支持分页）
function renderUnitTable() {
    const tb = document.getElementById('allUnitTable');
    if (!tb) return;
    
    const start = (unitCurrentPage - 1) * unitPageSize;
    const pageData = unitFilteredData.slice(start, start + unitPageSize);
    
    tb.innerHTML = '';
    
    if (unitFilteredData.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">暂无匹配数据</td></tr>';
        return;
    }
    
    let rowNum = start;
    pageData.forEach(item => {
        rowNum++;
        const tr = document.createElement('tr');
        let html = '';
        
        if (item.isBase) {
            // 一级单位行
            html = `
                <td>${rowNum}</td>
                <td style="font-weight:bold;">${item.baseName}</td>
                <td>-</td>
                <td>-</td>
                <td>${item.isLocked ? '锁定' : '可编辑'}</td>
                <td>
                    ${item.isLocked ? '<button disabled class="btn btn-sm btn-danger">删除</button>' : `<button onclick="deleteBaseUnit(${item.id})" class="btn btn-sm btn-danger">删除</button>`}
                    <button onclick="openUnitEdit(${item.id},2,'','base')" class="btn btn-sm btn-success">新增规格</button>
                </td>
            `;
        } else if (item.isEmpty) {
            // 空规格提示行
            html = `
                <td>${rowNum}</td>
                <td>&nbsp;&nbsp;&nbsp;<span style="color:#999;">${item.baseName}</span></td>
                <td colspan="4" style="color:#999;text-align:center;">└ （暂无换算规格）</td>
            `;
        } else {
            // 二级规格行
            html = `
                <td>${rowNum}</td>
                <td>&nbsp;&nbsp;&nbsp;${item.baseName}</td>
                <td>${item.specName}</td>
                <td>${item.rate}</td>
                <td>${item.isLocked ? '锁定' : '正常'}</td>
                <td>
                    <button onclick="openUnitEdit(${item.id},2)" class="btn btn-sm btn-primary">编辑</button>
                    ${item.isLocked ? '<button disabled class="btn btn-sm btn-danger">删除</button>' : `<button onclick="deleteUnitSpec(${item.id})" class="btn btn-sm btn-danger">删除</button>`}
                </td>
            `;
        }
        tr.innerHTML = html;
        tb.appendChild(tr);
    });
}

// 分页相关函数
function renderUnitPagination() {
    unitTotalPages = Math.ceil(unitFilteredData.length / unitPageSize) || 1;
    if (unitCurrentPage > unitTotalPages) unitCurrentPage = unitTotalPages;
    
    const currentPageEl = document.getElementById('unitCurrentPage');
    const totalPagesEl = document.getElementById('unitTotalPages');
    if (currentPageEl) currentPageEl.textContent = unitCurrentPage;
    if (totalPagesEl) totalPagesEl.textContent = unitTotalPages;
    
    const pgBox = document.getElementById('unitPageNumbers');
    if (!pgBox) return;
    pgBox.innerHTML = '';
    
    let s = Math.max(1, unitCurrentPage - 2);
    let e = Math.min(unitTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === unitCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => unitGoToPage(i);
        pgBox.appendChild(btn);
    }
    
    // 更新按钮状态
    const btns = document.querySelectorAll('#sub-unitSet .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (unitCurrentPage === 1);
        btns[1].disabled = (unitCurrentPage === 1);
        btns[btns.length - 2].disabled = (unitCurrentPage === unitTotalPages);
        btns[btns.length - 1].disabled = (unitCurrentPage === unitTotalPages);
    }
}

function unitGoToPage(p) {
    if (p < 1 || p > unitTotalPages) return;
    unitCurrentPage = p;
    renderUnitPagination();
    renderUnitTable();
}

function unitPrevPage() { unitGoToPage(unitCurrentPage - 1); }
function unitNextPage() { unitGoToPage(unitCurrentPage + 1); }

function changeUnitPageSize() {
    unitPageSize = +document.getElementById('unitPageSize').value;
    unitCurrentPage = 1;
    renderUnitPagination();
    renderUnitTable();
}

// 搜索输入防抖
function onUnitFilterInput() {
    if (unitFilterTimer) clearTimeout(unitFilterTimer);
    unitFilterTimer = setTimeout(() => {
        // 先过滤表格数据
        filterUnitData();
        
        // 然后根据当前输入框更新对应的下拉列表
        const activeElement = document.activeElement;
        if (activeElement) {
            const id = activeElement.id;
            if (id === 'unitFilterBaseName') {
                const kw = activeElement.value.trim().toLowerCase();
                renderUnitBaseList(kw);
                const list = document.getElementById('unitFilterBaseNameList');
                if (list) list.style.display = 'block';
            } else if (id === 'unitFilterSpecName') {
                const kw = activeElement.value.trim().toLowerCase();
                renderUnitSpecList(kw);
                const list = document.getElementById('unitFilterSpecNameList');
                if (list) list.style.display = 'block';
            } else if (id === 'unitFilterRate') {
                const kw = activeElement.value.trim().toLowerCase();
                renderUnitRateList(kw);
                const list = document.getElementById('unitFilterRateList');
                if (list) list.style.display = 'block';
            }
        }
    }, 300);
}
// 重置搜索
function resetUnitSearch() {
    document.getElementById('unitFilterBaseName').value = '';
    document.getElementById('unitFilterSpecName').value = '';
    document.getElementById('unitFilterRate').value = '';
    filterUnitData();
}

// ===================== 单位预设搜索下拉过滤 =====================

// 显示基础单位下拉列表
function showUnitBaseList() {
    const input = document.getElementById('unitFilterBaseName');
    const list = document.getElementById('unitFilterBaseNameList');
    if (!input || !list) return;
    const kw = input.value.trim().toLowerCase();
    renderUnitBaseList(kw);
    list.style.display = 'block';
}

// 渲染基础单位下拉列表
function renderUnitBaseList(keyword) {
    const list = document.getElementById('unitFilterBaseNameList');
    if (!list) return;
    list.innerHTML = '';
    
    // 获取所有唯一的基础单位名称
    let data = [...new Set(unitAllData.filter(item => item.isBase).map(item => item.baseName))].sort();
    if (keyword) {
        data = data.filter(item => item.toLowerCase().includes(keyword));
    }
    
    if (data.length === 0) {
        list.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配</div>';
        list.style.display = 'block';
        return;
    }
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = item;
        div.onmouseover = function() { this.style.background = '#f0f0f0'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onmousedown = function(e) {
            e.preventDefault();  // 防止点击时输入框失去焦点
        };
        div.onclick = function() {
            document.getElementById('unitFilterBaseName').value = item;
            list.style.display = 'none';
            filterUnitData();
        };
        list.appendChild(div);
    });
    list.style.display = 'block';
}

// 显示包装单位下拉列表
function showUnitSpecList() {
    const input = document.getElementById('unitFilterSpecName');
    const list = document.getElementById('unitFilterSpecNameList');
    if (!input || !list) return;
    const kw = input.value.trim().toLowerCase();
    renderUnitSpecList(kw);
    list.style.display = 'block';
}

// 渲染包装单位下拉列表
function renderUnitSpecList(keyword) {
    const list = document.getElementById('unitFilterSpecNameList');
    if (!list) return;
    list.innerHTML = '';
    
    // 获取所有唯一的包装单位名称（排除空规格行）
    let data = [...new Set(unitAllData.filter(item => item.type === 'spec').map(item => item.specName))].sort();
    if (keyword) {
        data = data.filter(item => item.toLowerCase().includes(keyword));
    }
    
    if (data.length === 0) {
        list.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配</div>';
        list.style.display = 'block';
        return;
    }
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = item;
        div.onmouseover = function() { this.style.background = '#f0f0f0'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onmousedown = function(e) {
            e.preventDefault();  // 防止点击时输入框失去焦点
        };
        div.onclick = function() {
            document.getElementById('unitFilterSpecName').value = item;
            list.style.display = 'none';
            filterUnitData();
        };
        list.appendChild(div);
    });
    list.style.display = 'block';
}

// 显示换算比例下拉列表
function showUnitRateList() {
    const input = document.getElementById('unitFilterRate');
    const list = document.getElementById('unitFilterRateList');
    if (!input || !list) return;
    const kw = input.value.trim().toLowerCase();
    renderUnitRateList(kw);
    list.style.display = 'block';
}

// 渲染换算比例下拉列表
function renderUnitRateList(keyword) {
    const list = document.getElementById('unitFilterRateList');
    if (!list) return;
    list.innerHTML = '';
    
    // 获取所有唯一的换算比例（排除空规格行）
    let data = [...new Set(unitAllData.filter(item => item.type === 'spec').map(item => item.rate))].sort();
    if (keyword) {
        data = data.filter(item => item.toLowerCase().includes(keyword));
    }
    
    if (data.length === 0) {
        list.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配</div>';
        list.style.display = 'block';
        return;
    }
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = item;
        div.onmouseover = function() { this.style.background = '#f0f0f0'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onmousedown = function(e) {
            e.preventDefault();  // 防止点击时输入框失去焦点
        };
        div.onclick = function() {
            document.getElementById('unitFilterRate').value = item;
            list.style.display = 'none';
            filterUnitData();
        };
        list.appendChild(div);
    });
    list.style.display = 'block';
}
// 点击空白关闭下拉
document.addEventListener('click', function(e) {
    // 基础单位下拉
    const baseInput = document.getElementById('unitFilterBaseName');
    const baseList = document.getElementById('unitFilterBaseNameList');
    if (baseInput && baseList && !e.target.closest('#unitFilterBaseName') && !e.target.closest('#unitFilterBaseNameList')) {
        baseList.style.display = 'none';
    }
    // 包装单位下拉
    const specInput = document.getElementById('unitFilterSpecName');
    const specList = document.getElementById('unitFilterSpecNameList');
    if (specInput && specList && !e.target.closest('#unitFilterSpecName') && !e.target.closest('#unitFilterSpecNameList')) {
        specList.style.display = 'none';
    }
    // 换算比例下拉
    const rateInput = document.getElementById('unitFilterRate');
    const rateList = document.getElementById('unitFilterRateList');
    if (rateInput && rateList && !e.target.closest('#unitFilterRate') && !e.target.closest('#unitFilterRateList')) {
        rateList.style.display = 'none';
    }
});
function renderBaseUnitSelectOpt() {
    const specSel = $('specBaseUnitId');
    const filterSel = $('filterBaseUnit');
    if (specSel) {
        specSel.innerHTML = '';
        baseUnitList.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.unit_name;
            specSel.appendChild(opt);
        })
    }
    if (filterSel) {
        filterSel.innerHTML = '<option value="">全部单位</option>';
        baseUnitList.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.unit_name;
            filterSel.appendChild(opt);
        })
    }
}

// ===================== 规格列表管理 =====================
function renderSpecList() {
    const container = $('specListItems');
    const empty = $('specListEmpty');
    if (!container) return;
    container.innerHTML = '';
    
    if (tempSpecList.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    
    const rateUnitSpan = $('specRateUnit');
    const baseName = rateUnitSpan ? rateUnitSpan.textContent.trim() || '单位' : '单位';
    
    tempSpecList.forEach((spec, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:4px;background:#fff;border:1px solid #e0e0e0;border-radius:4px;padding:4px 8px;font-size:13px;margin-bottom:4px;';
        div.innerHTML = `
            <span><strong>${spec.show_name}</strong> → ${spec.convert_rate}${baseName}</span>
            <button onclick="removeSpecFromList(${index})" style="border:none;background:transparent;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;" title="删除">×</button>
        `;
        container.appendChild(div);
    });
}

function addSpecToList() {
    const showNameInput = $('specShowName');
    const rateInput = $('specRate');
    const rateUnitSpan = $('specRateUnit');
    const baseIdInput = $('specBaseUnitId');
    const baseNameInput = $('baseUnitName');
    
    if (!showNameInput || !rateInput) {
        showMsg('页面元素不完整，请刷新重试');
        return;
    }
    
    const showName = showNameInput.value.trim();
    const rate = parseFloat(rateInput.value);
    const baseName = rateUnitSpan ? rateUnitSpan.textContent.trim() : '单位';
    let baseId = baseIdInput ? baseIdInput.value : '';
    const unitName = baseNameInput ? baseNameInput.value.trim() : '';
    
    if (!showName) { showMsg('请输入换算单位名称'); return; }
    if (isNaN(rate) || rate <= 0) { showMsg('请输入有效的换算系数'); return; }
    if (!baseName || baseName === '单位') { showMsg('请先选择或输入最小计量单位'); return; }
    
    if (!baseId || baseId === '' || baseId === 'null') {
        if (unitName) {
            const existBase = baseUnitList.find(u => u.unit_name === unitName);
            if (existBase) {
                baseId = existBase.id;
                if (baseIdInput) baseIdInput.value = baseId;
            } else {
                showMsg('请先保存最小计量单位，再添加换算规格');
                return;
            }
        } else {
            showMsg('请先选择或输入最小计量单位');
            return;
        }
    }
    
    const existingSpec = unitSpecList.find(s => 
        s.base_unit_id == baseId && 
        s.show_name === showName && 
        s.convert_rate === rate
    );
    if (existingSpec) {
        showMsg(`该单位下已存在换算规格"${showName}（${rate}${baseName}）"`);
        return;
    }
    if (tempSpecList.some(s => s.show_name === showName && s.convert_rate === rate)) {
        showMsg(`该换算规格"${showName}（${rate}${baseName}）"已添加，请勿重复添加`);
        return;
    }
    
    tempSpecList.push({ show_name: showName, convert_rate: rate });
    showNameInput.value = '';
    rateInput.value = '';
    const modalList = $('specModalList');
    if (modalList) modalList.style.display = 'none';
    renderSpecList();
}

function removeSpecFromList(index) {
    tempSpecList.splice(index, 1);
    renderSpecList();
}

function loadSpecsToTempList(specs) {
    tempSpecList = specs.map(s => ({ show_name: s.show_name, convert_rate: s.convert_rate }));
    renderSpecList();
}

function clearTempSpecList() {
    tempSpecList = [];
    renderSpecList();
}

function renderExistingSpecs(baseId) {
    const container = $('existingSpecList');
    if (!container) return;
    container.innerHTML = '';
    if (!baseId) { 
        container.innerHTML = '<div style="color:#999;font-size:13px;padding:4px 0;">请先选择一级单位</div>'; 
        return; 
    }
    
    const baseItem = baseUnitList.find(u => u.id == baseId);
    const baseName = baseItem ? baseItem.unit_name : '';
    
    let specs = unitSpecList.filter(s => s.base_unit_id == baseId);
    
    if (specs.length === 0) { 
        container.innerHTML = `<div style="color:#999;font-size:13px;padding:4px 0;">该单位下暂无换算规格</div>`; 
        return; 
    }
    
    const grouped = {};
    specs.forEach(spec => {
        if (!grouped[spec.show_name]) {
            grouped[spec.show_name] = [];
        }
        grouped[spec.show_name].push(spec.convert_rate);
    });
    
    Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => a - b);
    });
    
    const sortedNames = Object.keys(grouped).sort();
    
    let html = `<div style="font-size:13px;color:#333;font-weight:bold;margin-bottom:6px;">📋 已有换算规格（共 ${specs.length} 个）：</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
    
    sortedNames.forEach(name => {
        const rates = grouped[name];
        const rateStr = rates.map(r => `${r}${baseName}`).join('、');
        html += `<div style="padding:4px 10px;background:#e8f5e9;border-radius:4px;font-size:13px;border:1px solid #c8e6c9;">
            <strong>${name}</strong> → ${rateStr}
        </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

// ===================== 🔥 openUnitEdit（核心修复：用表名区分ID） =====================
// ===================== 🔥 openUnitEdit（核心修复：用source区分ID来源） =====================
function openUnitEdit(editId = null, editType = 1, fillName = '', source = '') {
    const modal = $('unitAllModal');
    const title = $('unitModalTitle');
    const editTypeInput = $('unitEditType');
    const hidId = $('unitEditId');
    const baseNameInput = $('baseUnitName');
    const specWrap = $('specInputWrap');
    const specShow = $('specShowName');
    const specRate = $('specRate');
    const addSpecBtn = document.querySelector('#specInputWrap .btn-success');
    const rateUnitSpan = $('specRateUnit');
    const baseSelect = $('specBaseUnitId');
    const saveBtn = document.querySelector('#unitAllModal .btn-primary');
    const existingContainer = $('existingSpecList');

    if (!modal) { showMsg('弹窗元素不存在'); return; }
    modal.style.display = 'flex';

    // 重置所有字段
    if (hidId) hidId.value = '';
    if (editTypeInput) editTypeInput.value = editType;
    if (baseNameInput) baseNameInput.value = '';
    if (specShow) specShow.value = '';
    if (specRate) specRate.value = '';
    if (rateUnitSpan) rateUnitSpan.textContent = '单位';
    if (baseSelect) baseSelect.value = '';
    
    clearTempSpecList();
    currentModalBaseId = null;
    if (existingContainer) existingContainer.innerHTML = '';

    if (specWrap) { specWrap.style.display = 'block'; specWrap.style.visibility = 'visible'; }

    renderBaseUnitSelectOpt();

    // 重置"保存"按钮
    if (saveBtn) {
        saveBtn.textContent = '保存';
        saveBtn.onclick = submitAllUnit;
    }

    // 设置"+添加"按钮
    if (addSpecBtn) {
        addSpecBtn.textContent = '+ 添加';
        addSpecBtn.style.display = '';
        addSpecBtn.onclick = addSpecToList;
    }

    if (editType === 1) {
        // ===== 一级单位操作 =====
        if (baseNameInput) { baseNameInput.disabled = false; baseNameInput.style.background = '#fff'; }
        if (editId) {
            if (title) title.textContent = '编辑最小计量单位';
            const item = baseUnitList.find(u => u.id == editId);
            if (item && baseNameInput) {
                baseNameInput.value = item.unit_name;
                if (rateUnitSpan) rateUnitSpan.textContent = item.unit_name;
                if (baseSelect) baseSelect.value = item.id;
                currentModalBaseId = item.id;
                renderExistingSpecs(item.id);
                const specs = unitSpecList.filter(s => s.base_unit_id == editId);
                loadSpecsToTempList(specs);
            }
        } else {
            if (title) title.textContent = '新增最小计量单位';
            if (baseNameInput) baseNameInput.value = fillName || '';
            if (fillName) {
                const existItem = baseUnitList.find(u => u.unit_name === fillName);
                if (existItem) {
                    if (rateUnitSpan) rateUnitSpan.textContent = existItem.unit_name;
                    if (baseSelect) baseSelect.value = existItem.id;
                    currentModalBaseId = existItem.id;
                    renderExistingSpecs(existItem.id);
                } else {
                    if (rateUnitSpan) rateUnitSpan.textContent = fillName;
                    if (existingContainer) existingContainer.innerHTML = '';
                }
            }
        }
    } else {
        // ===== 二级规格操作 =====
        // 🔥 核心修复：通过 source 参数明确区分ID来源
        // source='base' 表示从一级行点击"新增规格"，editId 是一级单位ID
        // source='spec' 或空 表示编辑规格，editId 是二级规格ID
        
        if (source === 'base') {
            // ===== 新增规格（从一级行点击"新增规格"） =====
            if (title) title.textContent = '新增换算规格';
            // 直接查找 baseUnitList
            const baseItem = baseUnitList.find(u => u.id == editId);
            if (baseItem && baseNameInput) {
                baseNameInput.value = baseItem.unit_name;
                baseNameInput.disabled = true;
                baseNameInput.style.background = '#f5f5f5';
                if (rateUnitSpan) rateUnitSpan.textContent = baseItem.unit_name;
                if (baseSelect) baseSelect.value = baseItem.id;
                currentModalBaseId = baseItem.id;
                renderExistingSpecs(baseItem.id);
            }
            if (hidId) hidId.value = '';
            if (addSpecBtn) { 
                addSpecBtn.textContent = '+ 添加'; 
                addSpecBtn.style.display = '';
                addSpecBtn.onclick = addSpecToList; 
            }
            if (saveBtn) { 
                saveBtn.textContent = '保存'; 
                saveBtn.onclick = submitAllUnit; 
            }
        } else {
            // ===== 编辑规格（从二级行点击"编辑"） =====
            // 或者 source 为空，默认按编辑处理
            // 查找 unitSpecList
            const spec = unitSpecList.find(s => s.id == editId);
            if (spec) {
                if (title) title.textContent = '编辑换算规格';
                const baseItem = baseUnitList.find(u => u.id == spec.base_unit_id);
                if (baseItem && baseNameInput) {
                    baseNameInput.value = baseItem.unit_name;
                    baseNameInput.disabled = true;
                    baseNameInput.style.background = '#f5f5f5';
                    if (rateUnitSpan) rateUnitSpan.textContent = baseItem.unit_name;
                    if (baseSelect) baseSelect.value = baseItem.id;
                    currentModalBaseId = baseItem.id;
                    renderExistingSpecs(baseItem.id);
                }
                if (specShow) specShow.value = spec.show_name;
                if (specRate) specRate.value = spec.convert_rate;
                tempSpecList = [{ show_name: spec.show_name, convert_rate: spec.convert_rate }];
                renderSpecList();
                
                if (addSpecBtn) { addSpecBtn.style.display = 'none'; }
                if (saveBtn) {
                    saveBtn.textContent = '更新';
                    saveBtn.onclick = function() { doUpdateSpec(editId); };
                }
                if (hidId) hidId.value = editId;
            } else {
                // ===== 纯新增规格（无editId或找不到） =====
                if (title) title.textContent = '新增换算规格';
                if (baseNameInput) { baseNameInput.disabled = false; baseNameInput.style.background = '#fff'; }
                if (rateUnitSpan) rateUnitSpan.textContent = '单位';
                if (existingContainer) existingContainer.innerHTML = '';
                if (hidId) hidId.value = '';
                if (addSpecBtn) { 
                    addSpecBtn.textContent = '+ 添加'; 
                    addSpecBtn.style.display = '';
                    addSpecBtn.onclick = addSpecToList; 
                }
                if (saveBtn) { 
                    saveBtn.textContent = '保存'; 
                    saveBtn.onclick = submitAllUnit; 
                }
            }
        }
    }
}
async function doUpdateSpec(editId) {
    const showNameInput = $('specShowName');
    const rateInput = $('specRate');
    const baseSelect = $('specBaseUnitId');
    
    if (!showNameInput || !rateInput) { showMsg('页面元素不完整'); return; }
    
    const showName = showNameInput.value.trim();
    const rate = parseFloat(rateInput.value);
    const baseId = baseSelect ? baseSelect.value : '';
    const unitName = $('baseUnitName') ? $('baseUnitName').value.trim() : '';
    
    if (!showName) { showMsg('请输入换算单位名称'); return; }
    if (isNaN(rate) || rate <= 0) { showMsg('请输入有效的换算系数'); return; }
    if (!baseId || baseId === '' || baseId === 'null') { showMsg('请先选择一级单位'); return; }
    
    const duplicate = unitSpecList.some(s => 
        s.base_unit_id == baseId && 
        s.show_name === showName && 
        s.convert_rate === rate &&
        s.id != editId
    );
    if (duplicate) { 
        showMsg(`该单位下已存在换算规格"${showName}（${rate}${unitName}）"`); 
        return; 
    }
    
    try {
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/unit_spec?id=eq.${editId}`, {
            method: 'PATCH',
            headers: { 
                apikey: SUPABASE_KEY, 
                Authorization: `Bearer ${SUPABASE_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ show_name: showName, convert_rate: rate })
        });
        if (!updateRes.ok) { showMsg('更新失败'); return; }
        
        showMsg('规格更新成功！');
        closeUnitAllModal();
        clearTempSpecList();
        await loadAllBaseUnit(); 
        await loadAllUnitSpec(); 
        renderAllUnitTable(); 
        renderBaseUnitSelectOpt();
    } catch (e) {
        showMsg('操作失败：' + e.message);
        console.error(e);
    }
}

function closeUnitAllModal() {
    const modal = $('unitAllModal');
    if (modal) modal.style.display = 'none';
    const addSpecBtn = document.querySelector('#specInputWrap .btn-success');
    if (addSpecBtn) { 
        addSpecBtn.onclick = addSpecToList; 
        addSpecBtn.textContent = '+ 添加';
        addSpecBtn.style.display = '';
    }
    const saveBtn = document.querySelector('#unitAllModal .btn-primary');
    if (saveBtn) {
        saveBtn.textContent = '保存';
        saveBtn.onclick = submitAllUnit;
    }
}

// ===================== 删除函数 =====================
async function deleteBaseUnit(id) {
    if (!confirm('确认删除该最小计量单位及旗下所有换算规格？')) return;
    try {
        const specsToDelete = unitSpecList.filter(s => s.base_unit_id == id);
        for (const spec of specsToDelete) {
            await fetch(`${SUPABASE_URL}/rest/v1/unit_spec?id=eq.${spec.id}`, { 
                method: 'DELETE', 
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } 
            });
        }
        await fetch(`${SUPABASE_URL}/rest/v1/base_unit?id=eq.${id}`, { 
            method: 'DELETE', 
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } 
        });
        showMsg(`删除成功！已删除 ${specsToDelete.length} 个换算规格`);
        await loadAllBaseUnit(); 
        await loadAllUnitSpec(); 
        renderAllUnitTable(); 
        renderBaseUnitSelectOpt();
    } catch (e) { 
        showMsg('删除失败：' + e.message); 
        console.error(e);
    }
}

async function deleteUnitSpec(id) {
    if (!confirm('确认删除该换算规格？')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/unit_spec?id=eq.${id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
        showMsg('删除成功');
        await loadAllBaseUnit(); await loadAllUnitSpec(); renderAllUnitTable(); renderBaseUnitSelectOpt();
    } catch (e) { showMsg('删除失败：' + e.message); }
}

// ===================== 🔥 submitAllUnit（必须定义在 openUnitEdit 之前或之后，但要在调用前定义） =====================
async function submitAllUnit() {
    const editTypeInput = $('unitEditType');
    const editIdInput = $('unitEditId');
    const baseNameInput = $('baseUnitName');
    const baseSelect = $('specBaseUnitId');
    
    if (!editTypeInput || !baseNameInput) { showMsg('页面元素不完整'); return; }
    
    const editType = editTypeInput.value;
    const editId = editIdInput ? editIdInput.value : '';
    const unitName = baseNameInput.value.trim();
    const selectedBaseId = baseSelect ? baseSelect.value : '';
    
    if (!unitName) { showMsg('请填写最小计量单位'); return; }

    try {
        let savedBaseId = null;
        
        if (editType == 2 && editId) {
            await doUpdateSpec(editId);
            return;
        }
        
        if (editType == 2 && !editId) {
            let baseId = null;
            if (selectedBaseId && selectedBaseId !== '' && selectedBaseId !== 'null') {
                baseId = parseInt(selectedBaseId);
            }
            if (!baseId) {
                const existBase = baseUnitList.find(u => u.unit_name === unitName);
                if (existBase) { 
                    baseId = existBase.id; 
                } else {
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/base_unit`, {
                        method: 'POST',
                        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                        body: JSON.stringify({ unit_name: unitName, is_locked: false })
                    });
                    const newData = await res.json();
                    baseId = newData[0]?.id;
                    if (!baseId) { showMsg('创建一级单位失败'); return; }
                    await loadAllBaseUnit();
                }
            }
            savedBaseId = baseId;
            if (tempSpecList.length === 0) { showMsg('请添加换算规格'); return; }
            for (const spec of tempSpecList) {
                const exists = unitSpecList.some(s => 
                    s.base_unit_id == savedBaseId && 
                    s.show_name == spec.show_name && 
                    s.convert_rate == spec.convert_rate
                );
                if (exists) { 
                    showMsg(`换算规格"${spec.show_name}（${spec.convert_rate}${unitName}）"已存在`); 
                    return; 
                }
                const postRes = await fetch(`${SUPABASE_URL}/rest/v1/unit_spec`, {
                    method: 'POST',
                    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base_unit_id: savedBaseId, show_name: spec.show_name, convert_rate: spec.convert_rate, is_locked: false })
                });
                if (!postRes.ok) { showMsg('保存规格失败'); return; }
            }
            showMsg('规格添加成功！');
            closeUnitAllModal();
            clearTempSpecList();
            await loadAllBaseUnit(); await loadAllUnitSpec(); renderAllUnitTable(); renderBaseUnitSelectOpt();
            return;
        }
        
        if (editType == 1) {
            let baseId = null;
            if (editId) {
                const repeatBase = baseUnitList.some(item => item.unit_name === unitName && item.id != editId);
                if (repeatBase) { showMsg('该最小计量单位已存在'); return; }
                const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/base_unit?id=eq.${editId}`, {
                    method: 'PATCH',
                    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ unit_name: unitName, is_locked: false })
                });
                if (!updateRes.ok) { showMsg('更新一级单位失败'); return; }
                baseId = editId;
            } else {
                const existBase = baseUnitList.find(item => item.unit_name === unitName);
                if (existBase) { 
                    baseId = existBase.id; 
                } else {
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/base_unit`, {
                        method: 'POST',
                        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                        body: JSON.stringify({ unit_name: unitName, is_locked: false })
                    });
                    const newData = await res.json();
                    baseId = newData[0]?.id;
                    if (!baseId) { showMsg('创建一级单位失败'); return; }
                    await loadAllBaseUnit();
                }
            }
            if (!baseId) { showMsg('获取一级单位ID失败'); return; }
            if (tempSpecList.length === 0) { showMsg('请添加换算规格'); return; }
            for (const spec of tempSpecList) {
                const exists = unitSpecList.some(s => 
                    s.base_unit_id == baseId && 
                    s.show_name == spec.show_name && 
                    s.convert_rate == spec.convert_rate
                );
                if (exists) { 
                    showMsg(`换算规格"${spec.show_name}（${spec.convert_rate}${unitName}）"已存在`); 
                    return; 
                }
                const postRes = await fetch(`${SUPABASE_URL}/rest/v1/unit_spec`, {
                    method: 'POST',
                    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base_unit_id: baseId, show_name: spec.show_name, convert_rate: spec.convert_rate, is_locked: false })
                });
                if (!postRes.ok) { showMsg('保存规格失败'); return; }
            }
            showMsg(editId ? '保存成功！' : '新增成功！');
            closeUnitAllModal();
            clearTempSpecList();
            await loadAllBaseUnit(); await loadAllUnitSpec(); renderAllUnitTable(); renderBaseUnitSelectOpt();
            return;
        }
    } catch (e) {
        showMsg('操作失败：' + e.message);
        console.error(e);
    }
}

// ===================== 下拉搜索函数 =====================
function showBaseUnitInModal() {
    const input = $('baseUnitName');
    const list = $('baseUnitModalList');
    if (!input || !list) return;
    const kw = input.value.trim().toLowerCase();
    renderBaseUnitModalList(kw);
    list.style.display = 'block';
}

function filterBaseUnitInModal() {
    const input = $('baseUnitName');
    const list = $('baseUnitModalList');
    if (!input || !list) return;
    const kw = input.value.trim().toLowerCase();
    renderBaseUnitModalList(kw);
    list.style.display = 'block';
}

function renderBaseUnitModalList(keyword) {
    const list = $('baseUnitModalList');
    if (!list) return;
    list.innerHTML = '';
    let data = [...baseUnitList];
    if (keyword) data = data.filter(item => item.unit_name.toLowerCase().includes(keyword));
    const exactMatch = baseUnitList.some(item => item.unit_name.toLowerCase() === keyword);
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = item.unit_name;
        div.onmouseover = function() { this.style.background = '#f0f0f0'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            const nameInput = $('baseUnitName');
            const baseSelect = $('specBaseUnitId');
            const rateSpan = $('specRateUnit');
            if (nameInput) nameInput.value = item.unit_name;
            if (baseSelect) baseSelect.value = item.id;
            if (rateSpan) rateSpan.textContent = item.unit_name;
            currentModalBaseId = item.id;
            renderExistingSpecs(item.id);
            list.style.display = 'none';
        };
        list.appendChild(div);
    });
    
    if (!exactMatch && keyword) {
    const addDiv = document.createElement('div');
    addDiv.style.cssText = 'padding:6px 10px;cursor:pointer;background:#e6f7ff;color:#1890ff;';
    addDiv.textContent = `➕ 新增 "${keyword}"`;
    addDiv.onclick = async function() {
        // 🔥 弹窗确认
        if (!confirm(`是否新增最小计量单位"${keyword}"？`)) {
            return;
        }
        const nameInput = $('baseUnitName');
        const rateSpan = $('specRateUnit');
        const baseSelect = $('specBaseUnitId');
        const existingContainer = $('existingSpecList');
        
        if (nameInput) nameInput.value = keyword;
        if (rateSpan) rateSpan.textContent = keyword;
        if (existingContainer) existingContainer.innerHTML = '';
        
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/base_unit`, {
                method: 'POST',
                headers: { 
                    apikey: SUPABASE_KEY, 
                    Authorization: `Bearer ${SUPABASE_KEY}`, 
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ unit_name: keyword, is_locked: false })
            });
            const newData = await res.json();
            const newId = newData[0]?.id;
            if (newId) {
                if (baseSelect) baseSelect.value = newId;
                currentModalBaseId = newId;
                await loadAllBaseUnit();
                renderBaseUnitModalList(keyword);
                // 不弹窗，静默创建
            }
        } catch (e) {
            showMsg('创建一级单位失败：' + e.message);
        }
        list.style.display = 'none';
    };
    list.appendChild(addDiv);
}
}

function showSpecInModal() {
    const input = $('specShowName');
    const list = $('specModalList');
    if (!input || !list) return;
    const kw = input.value.trim().toLowerCase();
    renderSpecModalList(kw);
    list.style.display = 'block';
}

function filterSpecInModal() {
    const input = $('specShowName');
    const list = $('specModalList');
    if (!input || !list) return;
    const kw = input.value.trim().toLowerCase();
    renderSpecModalList(kw);
    list.style.display = 'block';
}

function renderSpecModalList(keyword) {
    const list = $('specModalList');
    if (!list) return;
    list.innerHTML = '';
    const baseSelect = $('specBaseUnitId');
    const baseId = baseSelect ? baseSelect.value : '';
    if (!baseId || baseId === '' || baseId === 'null') { 
        list.innerHTML = '<div style="padding:6px 10px;color:#999;">请先选择归属最小单位</div>'; 
        list.style.display = 'block';
        return; 
    }
    
    let data = unitSpecList.filter(s => s.base_unit_id == baseId);
    if (keyword) {
        data = data.filter(item => item.show_name.toLowerCase().includes(keyword));
    }
    const exactMatch = data.some(item => item.show_name.toLowerCase() === keyword);
    
    data.sort((a, b) => a.show_name.localeCompare(b.show_name));
    
    data.forEach(item => {
        const base = baseUnitList.find(u => u.id == item.base_unit_id);
        const div = document.createElement('div');
        div.style.cssText = 'padding:6px 10px;cursor:pointer;border-bottom:1px solid #eee;';
        div.textContent = `${item.show_name} → ${item.convert_rate}${base ? base.unit_name : ''}`;
        div.onmouseover = function() { this.style.background = '#f0f0f0'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            const nameInput = $('specShowName');
            const rateInput = $('specRate');
            if (nameInput) nameInput.value = item.show_name;
            if (rateInput) rateInput.value = item.convert_rate;
            list.style.display = 'none';
        };
        list.appendChild(div);
    });
    
    if (!exactMatch && keyword) {
        const addDiv = document.createElement('div');
        addDiv.style.cssText = 'padding:6px 10px;cursor:pointer;background:#e6f7ff;color:#1890ff;';
        const base = baseUnitList.find(u => u.id == baseId);
        addDiv.textContent = `➕ 新增 "${keyword}" (归属: ${base ? base.unit_name : ''})`;
        addDiv.onclick = function() {
            const nameInput = $('specShowName');
            const rateInput = $('specRate');
            if (nameInput) nameInput.value = keyword;
            if (rateInput) rateInput.focus();
            list.style.display = 'none';
        };
        list.appendChild(addDiv);
    }
    
    list.style.display = 'block';
}

function onModalBaseUnitChange() {
    const baseSelect = $('specBaseUnitId');
    const baseId = baseSelect ? baseSelect.value : '';
    const base = baseUnitList.find(u => u.id == baseId);
    if (base) {
        const rateSpan = $('specRateUnit');
        const nameInput = $('baseUnitName');
        if (rateSpan) rateSpan.textContent = base.unit_name;
        if (nameInput && !nameInput.value) nameInput.value = base.unit_name;
        currentModalBaseId = base.id;
        renderExistingSpecs(base.id);
    }
    const specName = $('specShowName');
    const specRate = $('specRate');
    const specList = $('specModalList');
    if (specName) specName.value = '';
    if (specRate) specRate.value = '';
    if (specList) specList.style.display = 'none';
}

async function createBaseUnitAndSelect(unitName) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/base_unit`, {
            method: 'POST',
            headers: { 
                apikey: SUPABASE_KEY, 
                Authorization: `Bearer ${SUPABASE_KEY}`, 
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ unit_name: unitName, is_locked: false })
        });
        const newData = await res.json();
        const newId = newData[0]?.id;
        if (newId) {
            await loadAllBaseUnit();
            const baseSelect = $('specBaseUnitId');
            const nameInput = $('baseUnitName');
            const rateSpan = $('specRateUnit');
            if (baseSelect) baseSelect.value = newId;
            if (nameInput) nameInput.value = unitName;
            if (rateSpan) rateSpan.textContent = unitName;
            currentModalBaseId = newId;
            renderExistingSpecs(newId);
            // 🔥 添加确认弹窗
            if (confirm(`✅ 最小计量单位 "${unitName}" 已成功创建！\n是否继续添加换算规格？`)) {
                // 继续停留在当前弹窗
                const modal = $('unitAllModal');
                if (modal) modal.style.display = 'flex';
                // 聚焦到换算规格输入框
                const specNameInput = $('specShowName');
                if (specNameInput) specNameInput.focus();
            } else {
                closeUnitAllModal();
            }
        }
    } catch (e) { showMsg('创建一级单位失败：' + e.message); }
}
// ===================== 商品弹窗单位下拉相关 =====================
const filterBaseFunc = function () {
    const input = $('addBaseUnitSearch');
    const box = $('addBaseUnitListBox');
    if (!input || !box) return;
    const kw = input.value.trim().toLowerCase();
    box.innerHTML = '';
    if (!kw) { box.style.display = 'none'; return; }
    const filterArr = baseUnitList.filter(u => u.unit_name.toLowerCase().includes(kw));
    filterArr.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:8px;cursor:pointer;';
        div.innerText = item.unit_name;
        div.onclick = () => selectGoodsBaseUnit(item);
        box.appendChild(div);
    });
    const hasExist = baseUnitList.some(u => u.unit_name.toLowerCase() === kw);
    if (!hasExist) {
        const addDiv = document.createElement('div');
        addDiv.style.cssText = 'padding:8px;background:#e6f7ff;';
        addDiv.innerText = `新增：${input.value}`;
        addDiv.onclick = () => { openUnitEdit(null, 1, input.value); box.style.display = 'none'; };
        box.appendChild(addDiv);
    }
    box.style.display = 'block';
};


function debounceFilterBase() {
    clearTimeout(baseUnitSearchTimer);
    baseUnitSearchTimer = setTimeout(filterBaseFunc, 300);
}

function showAddBaseUnitList() {
    if (!baseUnitList || baseUnitList.length === 0) {
        loadAllBaseUnit().then(() => filterBaseFunc());
    } else { filterBaseFunc(); }
}

function filterAddBaseUnitList() { debounceFilterBase(); }

// ===================== 商品新增弹窗单位下拉（树形结构） =====================
function selectGoodsBaseUnit(item) {
    currentSelectBaseId = item.id;
    const searchInput = $('addBaseUnitSearch');
    const hiddenInput = $('add_base_unit_id');
    const box = $('addBaseUnitListBox');
    if (searchInput) searchInput.value = item.unit_name;
    if (hiddenInput) hiddenInput.value = item.id;
    if (box) box.style.display = 'none';
    renderGoodsUnitTree(item.id);
}

// 渲染已选规格展示（按二级单位分组，每个二级占一行）
function renderGoodsUnitTree(selectedBaseId) {
    const wrap = $('specMultiWrap');
    const checkBox = $('specCheckWrap');
    if (!wrap || !checkBox) return;
    
    const bindInput = $('bindSpecIds');
    let boundSpecIds = [];
    if (bindInput && bindInput.value) {
        boundSpecIds = bindInput.value.split(',').filter(id => id).map(Number);
    }
    
    if (!selectedBaseId || boundSpecIds.length === 0) {
        wrap.style.display = 'none';
        checkBox.innerHTML = '';
        return;
    }
    
    wrap.style.display = 'block';
    checkBox.innerHTML = '';
    
    const baseItem = baseUnitList.find(u => u.id == parseInt(selectedBaseId));
    if (!baseItem) {
        wrap.style.display = 'none';
        return;
    }
    
    const selectedSpecs = unitSpecList.filter(s => boundSpecIds.includes(s.id));
    if (selectedSpecs.length === 0) {
        wrap.style.display = 'none';
        return;
    }
    
    // 按二级单位分组
    const grouped = {};
    selectedSpecs.forEach(spec => {
        if (!grouped[spec.show_name]) {
            grouped[spec.show_name] = [];
        }
        grouped[spec.show_name].push(spec);
    });
    
    const sortedNames = Object.keys(grouped).sort();
    
    // 🔥 标题单独占一行（块级元素自动换行）
    let html = `<div style="font-size:14px;color:#333;font-weight:bold;margin-bottom:8px;">✅ 已选换算规格（共 ${selectedSpecs.length} 个）</div>`;
    
    // 🔥 数据从下一行开始（没有任何内联元素阻止换行）
    sortedNames.forEach(name => {
        const specs = grouped[name];
        specs.sort((a, b) => a.convert_rate - b.convert_rate);
        
        html += `<div style="padding:6px 10px;margin-bottom:6px;background:#fafafa;border-radius:4px;border:1px solid #f0f0f0;">`;
        html += `<span style="font-weight:bold;color:#ff4d4f;font-size:14px;">📦 ${name} <span style="color:#999;font-size:12px;font-weight:normal;">（${specs.length}个规格）</span></span>`;
        html += `<span style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
        specs.forEach(spec => {
            html += `<span style="padding:2px 10px;background:#e6f7ff;border:1px solid #91d5ff;border-radius:12px;font-size:12px;color:#1890ff;">
                ${spec.convert_rate}${baseItem.unit_name}
            </span>`;
        });
        html += `</span>`;
        html += `</div>`;
    });
    
    checkBox.innerHTML = html;
// 🔥 更新价格基准规格下拉框
updatePriceSpecSelect();
    
}

// ===================== 商品弹窗单位树形下拉（完整树形结构） =====================

// 全局临时存储选中的单位数据（仅在单位下拉弹窗内使用）
let tempSelectedBaseId = null;      // 临时选中的一级单位ID
let tempSelectedSpecIds = new Set(); // 临时选中的规格ID集合

// 显示商品单位树形下拉
function showGoodsUnitTreeDropdown() {
    const dropdown = document.getElementById('goodsUnitDropdown');
    const searchInput = document.getElementById('addBaseUnitSearch');
    if (!dropdown || !searchInput) return;
    
    // 如果已显示则关闭
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        return;
    }
    
    // 清空弹窗内的搜索框
    const filterInput = document.getElementById('goodsUnitSearchInput');
    if (filterInput) {
        filterInput.value = '';
    }
    
    // 从已保存的数据加载临时状态
    const baseIdInput = document.getElementById('add_base_unit_id');
    const bindSpecInput = document.getElementById('bindSpecIds');
    
    if (baseIdInput && baseIdInput.value) {
        tempSelectedBaseId = baseIdInput.value;
    } else {
        tempSelectedBaseId = null;
    }
    
    if (bindSpecInput && bindSpecInput.value) {
        const savedIds = bindSpecInput.value.split(',').filter(id => id);
        tempSelectedSpecIds = new Set(savedIds);
    } else {
        tempSelectedSpecIds = new Set();
    }
    
    // 🔥 使用 getBoundingClientRect 精确定位
    const rect = searchInput.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = Math.max(rect.width, 380) + 'px';
    dropdown.style.maxHeight = '400px';
    
    // 检查下方空间是否足够
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    if (spaceBelow < 350) {
        // 下方空间不足，显示在上方
        dropdown.style.top = (rect.top - 400) + 'px';
        dropdown.style.bottom = 'auto';
    }
    
    // 设置置顶标志
    window._cachedSortedBaseList = [];
    window._shouldPinSelected = true;
    
    renderGoodsUnitTreeDropdownContent();
    dropdown.style.display = 'block';
    
    // 聚焦搜索框
    setTimeout(() => {
        if (filterInput) filterInput.focus();
    }, 100);
}

// 关闭单位下拉（不保存）
function closeGoodsUnitDropdown() {
    const dropdown = document.getElementById('goodsUnitDropdown');
    if (dropdown) dropdown.style.display = 'none';
    // 恢复显示已保存的值
    restoreGoodsUnitDisplay();
}

// 恢复已保存的单位显示
function restoreGoodsUnitDisplay() {
    const baseIdInput = document.getElementById('add_base_unit_id');
    const searchInput = document.getElementById('addBaseUnitSearch');
    const bindSpecInput = document.getElementById('bindSpecIds');
    
    if (baseIdInput && baseIdInput.value) {
        const baseItem = baseUnitList.find(u => u.id == parseInt(baseIdInput.value));
        if (baseItem && searchInput) {
            searchInput.value = baseItem.unit_name;
        }
    } else {
        if (searchInput) searchInput.value = '';
    }
    
    // 刷新已选规格展示
    if (baseIdInput && baseIdInput.value) {
        renderGoodsUnitTree(parseInt(baseIdInput.value));
    } else {
        const wrap = document.getElementById('specMultiWrap');
        if (wrap) wrap.style.display = 'none';
    }
}

// 确认选择（保存临时选择到正式字段）
function confirmGoodsUnitSelection() {
    const baseIdInput = document.getElementById('add_base_unit_id');
    const bindSpecInput = document.getElementById('bindSpecIds');
    const searchInput = document.getElementById('addBaseUnitSearch');
    
    if (!tempSelectedBaseId && tempSelectedSpecIds.size > 0) {
        const firstSpecId = Array.from(tempSelectedSpecIds)[0];
        const spec = unitSpecList.find(s => s.id == parseInt(firstSpecId));
        if (spec) {
            tempSelectedBaseId = String(spec.base_unit_id);
        }
    }
    
    if (baseIdInput) baseIdInput.value = tempSelectedBaseId || '';
    if (bindSpecInput) bindSpecInput.value = Array.from(tempSelectedSpecIds).join(',');
    
    if (searchInput && tempSelectedBaseId) {
        const baseItem = baseUnitList.find(u => u.id == parseInt(tempSelectedBaseId));
        if (baseItem) searchInput.value = baseItem.unit_name;
    } else if (searchInput) {
        searchInput.value = '';
    }
    
    if (tempSelectedBaseId) {
        renderGoodsUnitTree(parseInt(tempSelectedBaseId));
        const wrap = document.getElementById('specMultiWrap');
        if (wrap) wrap.style.display = 'block';
    } else {
        const wrap = document.getElementById('specMultiWrap');
        if (wrap) wrap.style.display = 'none';
        const checkBox = document.getElementById('specCheckWrap');
        if (checkBox) checkBox.innerHTML = '';
    }
    
    closeGoodsUnitDropdown();
    // 🔥 更新价格基准规格下拉框
    updatePriceSpecSelect();
}

// 更新价格基准规格下拉框（放在 confirmGoodsUnitSelection 函数后面）
function updatePriceSpecSelect() {
    var select = document.getElementById('add_price_spec_id');
    var bindSpecInput = document.getElementById('bindSpecIds');
    var baseIdInput = document.getElementById('add_base_unit_id');
    if (!select || !bindSpecInput) return;
    
    var specIds = bindSpecInput.value.split(',').filter(function(id) { return id && id.trim() !== ''; });
    var baseId = baseIdInput ? baseIdInput.value : '';
    
    select.innerHTML = '<option value="">请选择规格</option>';
    
    if (specIds.length === 0 || !baseId) {
        select.disabled = true;
        return;
    }
    
    select.disabled = false;
    var baseItem = baseUnitList.find(function(b) { return b.id == parseInt(baseId); });
    
    specIds.forEach(function(specId) {
        var spec = unitSpecList.find(function(s) { return s.id == parseInt(specId); });
        if (spec) {
            var option = document.createElement('option');
            option.value = spec.id;
            option.textContent = spec.show_name + '（' + spec.convert_rate + (baseItem ? baseItem.unit_name : '') + '）';
            select.appendChild(option);
        }
    });
    
    // 如果有已保存的 price_spec_id，自动选中
    var savedValue = select.dataset.savedValue;
    if (savedValue) {
        select.value = savedValue;
    }
}

// 过滤树形下拉 - 搜索时不要重置置顶标志
function filterGoodsUnitTreeDropdown() {
    // 搜索时不重新置顶
    window._shouldPinSelected = false;
    renderGoodsUnitTreeDropdownContent();
}


// 渲染商品单位树形下拉内容（三级层级）
function renderGoodsUnitTreeDropdownContent() {
    const container = document.getElementById('goodsUnitTreeContainer');
    const filterInput = document.getElementById('goodsUnitSearchInput');
    if (!container) return;

    const keyword = filterInput ? filterInput.value.trim().toLowerCase() : '';
    container.innerHTML = '';

    if (baseUnitList.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">暂无单位数据</div>';
        return;
    }

    if (!window._unitExpandState) {
        window._unitExpandState = {};
    }

    let hasMatch = false;

    // 🔥 关键修复：使用缓存的排序列表，保持位置不变
    let sortedBaseList;

    // 在置顶逻辑后面添加滚动
    if (window._shouldPinSelected && tempSelectedBaseId) {
        sortedBaseList = [...baseUnitList].sort((a, b) => a.unit_name.localeCompare(b.unit_name));
        const selectedBase = sortedBaseList.find(b => b.id == tempSelectedBaseId);
        if (selectedBase) {
            const remaining = sortedBaseList.filter(b => b.id != tempSelectedBaseId);
            sortedBaseList = [selectedBase, ...remaining];
            // 🔥 立即滚动到顶部
            setTimeout(function() {
                const containerEl = document.getElementById('goodsUnitTreeContainer');
                if (containerEl) containerEl.scrollTop = 0;
                const dropdownEl = document.getElementById('goodsUnitDropdown');
                if (dropdownEl) dropdownEl.scrollTop = 0;
            }, 50);
        }
        window._shouldPinSelected = false;
        window._cachedSortedBaseList = sortedBaseList;
    } else if (window._cachedSortedBaseList && window._cachedSortedBaseList.length > 0) {
        sortedBaseList = window._cachedSortedBaseList;
        const currentIds = new Set(baseUnitList.map(function(b) { return b.id; }));
        const cachedIds = new Set(sortedBaseList.map(function(b) { return b.id; }));
        if (currentIds.size !== cachedIds.size ||
            !Array.from(currentIds).every(function(id) { return cachedIds.has(id); })) {
            sortedBaseList = [...baseUnitList].sort(function(a, b) { return a.unit_name.localeCompare(b.unit_name); });
            if (tempSelectedBaseId) {
                const selectedBase = sortedBaseList.find(function(b) { return b.id == tempSelectedBaseId; });
                if (selectedBase) {
                    const remaining = sortedBaseList.filter(function(b) { return b.id != tempSelectedBaseId; });
                    sortedBaseList = [selectedBase, ...remaining];
                }
            }
            window._cachedSortedBaseList = sortedBaseList;
        }
    } else {
        sortedBaseList = [...baseUnitList].sort(function(a, b) { return a.unit_name.localeCompare(b.unit_name); });
        if (tempSelectedBaseId) {
            const selectedBase = sortedBaseList.find(function(b) { return b.id == tempSelectedBaseId; });
            if (selectedBase) {
                const remaining = sortedBaseList.filter(function(b) { return b.id != tempSelectedBaseId; });
                sortedBaseList = [selectedBase, ...remaining];
            }
        }
        window._cachedSortedBaseList = sortedBaseList;
    }

    var didPin = (window._shouldPinSelected === false && sortedBaseList[0] && sortedBaseList[0].id == tempSelectedBaseId);

    sortedBaseList.forEach(function(baseItem) {
        var childSpecs = unitSpecList.filter(function(s) { return s.base_unit_id == baseItem.id; });
        childSpecs.sort(function(a, b) { return a.convert_rate - b.convert_rate; });

                var baseMatch = !keyword || baseItem.unit_name.toLowerCase().includes(keyword);
        var specMatch = childSpecs.some(function(s) {
            return s.show_name.toLowerCase().includes(keyword) ||
                String(s.convert_rate).includes(keyword);
        });
        var isVisible = baseMatch || specMatch;
        if (!isVisible) return;
        hasMatch = true;

        // 🔥 核心：只有手动点击选中一级，isBaseSelected 才为 true
        var isBaseSelected = tempSelectedBaseId == baseItem.id;
        // 🔥 二三级是否可操作：只有 isBaseSelected 为 true 时才可操作
        var isBaseActive = isBaseSelected;

        var baseKey = 'base_' + baseItem.id;
        if (keyword) {
            window._unitExpandState[baseKey] = true;
        }
        var isBaseExpanded = window._unitExpandState[baseKey] !== false;
        var checkedCount = childSpecs.filter(function(s) { return tempSelectedSpecIds.has(String(s.id)); }).length;
        // 🔥 修复：定义 hasCheckedSpec
        var hasCheckedSpec = childSpecs.some(function(s) { return tempSelectedSpecIds.has(String(s.id)); });

        // ===== 🔥 一级单位行 =====
        var rowDiv = document.createElement('div');
        rowDiv.style.cssText = 'padding:4px 0; border-bottom:1px solid #f0f0f0; cursor:pointer;';

        // 点击一级行切换选中状态
        rowDiv.onclick = function(e) {
            e.stopPropagation();
            if (e.target.tagName === 'INPUT') return;
            var expandIcon = e.target.closest('.unit-expand-icon');
            if (expandIcon) {
                window._unitExpandState[baseKey] = !window._unitExpandState[baseKey];
                renderGoodsUnitTreeDropdownContent();
                return;
            }
            // 🔥 切换一级选中状态
            toggleBaseUnitSelection(baseItem.id);
        };

        var hasChildren = childSpecs.length > 0;
        var expandIconHtml = hasChildren ?
            '<span class="unit-expand-icon" style="cursor:pointer;font-size:14px;color:#333;margin-right:6px;user-select:none;display:inline-block;width:20px;text-align:center;">' + (isBaseExpanded ? '▶' : '▼') + '</span>' :
            '<span style="font-size:14px;color:#ccc;margin-right:6px;display:inline-block;width:20px;text-align:center;">▼</span>';

        var highlightColor = isBaseActive ? 'color:#1890ff;font-weight:bold;' : '';

        rowDiv.innerHTML =
            '<div style="display:flex;align-items:center;gap:4px;padding:2px 0; ' + (isBaseActive ? 'background:#e6f7ff;border-radius:4px;' : '') + '">' +
            expandIconHtml +
            '<span style="font-size:16px; margin-right:4px; cursor:pointer;" onclick="event.stopPropagation();toggleBaseUnitSelection(' + baseItem.id + ')">' + (isBaseActive ? '✅' : '⏹️') + '</span>' +
            '<span style="font-size:14px; ' + highlightColor + '">' + baseItem.unit_name + '</span>' +
            (isBaseSelected ? '<span style="color:#52c41a;font-size:12px;font-weight:bold;margin-left:4px;">（已选）</span>' : '') +
            (hasCheckedSpec && !isBaseSelected ? '<span style="color:#ff6b6b;font-size:12px;margin-left:4px;">（' + checkedCount + '个规格已选）</span>' : '') +
            '<span style="color:#999;font-size:12px;margin-left:4px;">(' + childSpecs.length + '个规格)</span>' +
            '</div>';
        container.appendChild(rowDiv);

        // ===== 二级和三级内容 =====
        if (hasChildren && isBaseExpanded) {
            var grouped = {};
            childSpecs.forEach(function(spec) {
                if (!grouped[spec.show_name]) {
                    grouped[spec.show_name] = [];
                }
                grouped[spec.show_name].push(spec);
            });

            var sortedGroupNames = Object.keys(grouped).sort();

            sortedGroupNames.forEach(function(groupName) {
                var specs = grouped[groupName];
                specs.sort(function(a, b) { return a.convert_rate - b.convert_rate; });

                var hasCheckedInGroup = specs.some(function(s) { return tempSelectedSpecIds.has(String(s.id)); });
                // 🔥 只有当前一级被选中时，二级才可操作
                var isGroupDisabled = !isBaseSelected;

                var groupKey = 'group_' + baseItem.id + '_' + groupName;
                if (keyword) {
                    window._unitExpandState[groupKey] = true;
                }
                var isGroupExpanded = window._unitExpandState[groupKey] !== false;
                var hasGroupChildren = specs.length > 0;

                var groupDiv = document.createElement('div');
                groupDiv.style.cssText = 'margin-left:30px;padding:3px 0;' + (isGroupDisabled ? 'opacity:0.4;pointer-events:none;' : '');

                var groupCheckbox = document.createElement('div');
                groupCheckbox.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
                groupCheckbox.onclick = function(e) {
                    e.stopPropagation();
                    if (e.target.tagName === 'INPUT') return;
                    var expandIcon = e.target.closest('.group-expand-icon');
                    if (expandIcon) {
                        window._unitExpandState[groupKey] = !window._unitExpandState[groupKey];
                        renderGoodsUnitTreeDropdownContent();
                        return;
                    }
                    // 🔥 如果当前一级未被选中，不允许操作
                    if (!isBaseSelected) {
                        showMsg('请先点击选择"' + baseItem.unit_name + '"单位');
                        return;
                    }

                    var allChecked = specs.every(function(s) { return tempSelectedSpecIds.has(String(s.id)); });
                    specs.forEach(function(s) {
                        if (allChecked) {
                            tempSelectedSpecIds.delete(String(s.id));
                        } else {
                            tempSelectedSpecIds.add(String(s.id));
                        }
                    });
                    renderGoodsUnitTreeDropdownContent();
                };

                var groupExpandIcon = hasGroupChildren ?
                    '<span class="group-expand-icon" style="cursor:pointer;font-size:14px;color:#333;margin-right:4px;user-select:none;display:inline-block;width:20px;text-align:center;">' + (isGroupExpanded ? '▶' : '▼') + '</span>' :
                    '<span style="font-size:14px;color:#ccc;margin-right:4px;display:inline-block;width:20px;text-align:center;">▼</span>';

                var groupNameColor = hasCheckedInGroup ? '#ff4d4f' : '#333';
                var checkedInGroupCount = specs.filter(function(s) { return tempSelectedSpecIds.has(String(s.id)); }).length;

                groupCheckbox.innerHTML =
                    groupExpandIcon +
                    '<input type="checkbox" class="goodsUnitGroupCheck" ' +
                    (hasCheckedInGroup ? 'checked' : '') +
                    (isGroupDisabled ? 'disabled' : '') +
                    ' style="width:15px;height:15px;cursor:' + (isGroupDisabled ? 'not-allowed' : 'pointer') + ';margin-right:2px;">' +
                    '<span style="font-size:13px;' + (isGroupDisabled ? 'color:#999;' : '') + '">' +
                    '📦 ' + groupName +
                    (hasCheckedInGroup ? '<span style="color:#ff4d4f;"> ☑（' + checkedInGroupCount + '/' + specs.length + '）</span>' : '') +
                    '</span>';
                var cb = groupCheckbox.querySelector('input');
                if (cb) {
                    cb.onchange = function(e) {
                        e.stopPropagation();
                        if (isGroupDisabled) return;
                        var checked = this.checked;
                        specs.forEach(function(s) {
                            if (checked) {
                                tempSelectedSpecIds.add(String(s.id));
                            } else {
                                tempSelectedSpecIds.delete(String(s.id));
                            }
                        });
                        renderGoodsUnitTreeDropdownContent();
                    };
                }
                groupDiv.appendChild(groupCheckbox);

                // ===== 🔥 三级：换算关系 =====
                if (isGroupExpanded) {
                    var specContainer = document.createElement('div');
                    specContainer.style.cssText = 'margin-left:30px;padding-bottom:2px;';

                    specs.forEach(function(spec) {
                        var isSpecChecked = tempSelectedSpecIds.has(String(spec.id));
                        // 🔥 只有当前一级被选中时，三级才可操作
                        var isSpecDisabled = !isBaseSelected;

                        var specDiv = document.createElement('div');
                        specDiv.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;padding:2px 0;padding-left:24px;';
                        specDiv.onclick = function(e) {
                            e.stopPropagation();
                            if (e.target.tagName === 'INPUT') return;
                            // 🔥 如果当前一级未被选中，不允许操作
                            if (!isBaseSelected) {
                                showMsg('请先点击选择"' + baseItem.unit_name + '"单位');
                                return;
                            }

                            if (isSpecChecked) {
                                tempSelectedSpecIds.delete(String(spec.id));
                            } else {
                                tempSelectedSpecIds.add(String(spec.id));
                            }
                            renderGoodsUnitTreeDropdownContent();
                        };
                        specDiv.innerHTML =
                            '<span style="display:inline-block;width:20px;"></span>' +
                            '<input type="checkbox" class="goodsUnitSpecCheck" data-spec-id="' + spec.id + '" ' +
                            (isSpecChecked ? 'checked' : '') +
                            (isSpecDisabled ? 'disabled' : '') +
                            ' style="width:14px;height:14px;cursor:' + (isSpecDisabled ? 'not-allowed' : 'pointer') + ';margin-left:4px;">' +
                            '<span style="font-size:13px;color:' + (isSpecDisabled ? '#ccc' : '#333') + ';' + (isSpecChecked ? 'font-weight:bold;color:#ff4d4f;' : '') + '">' +
                            spec.convert_rate + baseItem.unit_name +
                            (isSpecChecked ? ' ☑' : '') +
                            '</span>';
                        var cb2 = specDiv.querySelector('input');
                        if (cb2) {
                            cb2.onchange = function(e) {
                                e.stopPropagation();
                                if (isSpecDisabled) return;
                                if (this.checked) {
                                    tempSelectedSpecIds.add(String(spec.id));
                                } else {
                                    tempSelectedSpecIds.delete(String(spec.id));
                                }
                                renderGoodsUnitTreeDropdownContent();
                            };
                        }
                        specContainer.appendChild(specDiv);
                    });
                    groupDiv.appendChild(specContainer);
                }
                container.appendChild(groupDiv);
            });
        }
    });

    if (!hasMatch) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">无匹配结果</div>';
    }

    if (didPin) {
        container.scrollTop = 0;
        var dropdown = document.getElementById('goodsUnitDropdown');
        if (dropdown) dropdown.scrollTop = 0;
    }
}

// 🔥 新增：切换一级单位选中状态（放在 renderGoodsUnitTreeDropdownContent 函数后面）
function toggleBaseUnitSelection(baseId) {
    var targetId = String(baseId);
    var currentId = tempSelectedBaseId !== null && tempSelectedBaseId !== '' ? String(tempSelectedBaseId) : null;

    if (currentId === targetId) {
        // 取消选中当前一级
        if (tempSelectedSpecIds.size > 0) {
            if (confirm('取消选中将清空已选换算规格，确定？')) {
                tempSelectedSpecIds.clear();
                tempSelectedBaseId = null;
            }
        } else {
            tempSelectedBaseId = null;
        }
    } else {
        // 切换到新一级
        if (tempSelectedSpecIds.size > 0 && currentId !== null) {
            if (!confirm('切换基础单位将清空已选换算规格，确定切换？')) {
                return;
            }
            tempSelectedSpecIds.clear();
        }
        tempSelectedBaseId = targetId;
    }
    renderGoodsUnitTreeDropdownContent();
}

function onGoodsBaseUnitRadioChange(baseId) {
    const hiddenInput = $('add_base_unit_id');
    if (hiddenInput) hiddenInput.value = baseId;
    const baseItem = baseUnitList.find(u => u.id == baseId);
    if (baseItem) {
        const searchInput = $('addBaseUnitSearch');
        if (searchInput) searchInput.value = baseItem.unit_name;
    }
    renderGoodsUnitTree(baseId);
}

// 🔥 劫持 openAddForm - 新增商品时清空单位数据
const oldOpenAddForm = openAddForm;
openAddForm = async function () {
    await oldOpenAddForm();
    await loadAllBaseUnit(); await loadAllUnitSpec();
    currentSelectBaseId = null;
    
    // 清空临时选择状态
    tempSelectedBaseId = null;
    tempSelectedSpecIds = new Set();
    window._unitExpandState = {};
    
    const search = $('addBaseUnitSearch');
    const hidden = $('add_base_unit_id');
    const wrap = $('specMultiWrap');
    const checkBox = $('specCheckWrap');
    const bindInput = $('bindSpecIds');
    const dropdown = document.getElementById('goodsUnitDropdown');
    const priceSpecSelect = document.getElementById('add_price_spec_id');  // 🔥 新增
    
    if (search) search.value = '';
    if (hidden) hidden.value = '';
    if (wrap) wrap.style.display = 'none';
    if (checkBox) checkBox.innerHTML = '';
    if (bindInput) bindInput.value = '';
    if (dropdown) dropdown.style.display = 'none';
    if (priceSpecSelect) {  // 🔥 新增：清空价格基准规格下拉框
        priceSpecSelect.innerHTML = '<option value="">请选择规格</option>';
        priceSpecSelect.disabled = true;
        delete priceSpecSelect.dataset.savedValue;
    }
};

// 🔥 劫持 openEditForm - 编辑商品时回显单位数据
const oldOpenEditForm = openEditForm;
openEditForm = async function (goodsId) {
    await oldOpenEditForm(goodsId);
    await loadAllBaseUnit(); await loadAllUnitSpec();
    const goodsItem = allGoods.find(g => g.id == goodsId);
    if (!goodsItem) return;
    
    // 清空临时选择状态
    tempSelectedBaseId = null;
    tempSelectedSpecIds = new Set();
    window._unitExpandState = {};
    window._shouldPinSelected = false;
    
    // 🔥 保存价格基准规格到下拉框的 data 属性
    const priceSpecSelect = document.getElementById('add_price_spec_id');
    if (priceSpecSelect && goodsItem.price_spec_id) {
        priceSpecSelect.dataset.savedValue = String(goodsItem.price_spec_id);
    }
    
    // 🔥 关键修复：只有存在 base_unit_id 时才填充
    if (goodsItem.base_unit_id) {
        const baseItem = baseUnitList.find(u => u.id == goodsItem.base_unit_id);
        if (baseItem) {
            const search = $('addBaseUnitSearch');
            const hidden = $('add_base_unit_id');
            const bindInput = $('bindSpecIds');
            
            if (search) search.value = baseItem.unit_name;
            if (hidden) hidden.value = baseItem.id;
            
            tempSelectedBaseId = baseItem.id;
            
            const bindRes = await fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind?goods_id=eq.${goodsId}`, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });
            const bindList = await bindRes.json() || [];
            const boundIds = bindList.map(b => b.spec_id);
            boundIds.forEach(id => tempSelectedSpecIds.add(String(id)));
            if (bindInput) bindInput.value = boundIds.join(',');
            
            if (boundIds.length > 0 && tempSelectedBaseId) {
                window._unitExpandState['base_' + tempSelectedBaseId] = true;
                const childSpecs = unitSpecList.filter(s => s.base_unit_id == tempSelectedBaseId);
                const grouped = {};
                childSpecs.forEach(spec => {
                    if (!grouped[spec.show_name]) {
                        grouped[spec.show_name] = [];
                    }
                    grouped[spec.show_name].push(spec);
                });
                Object.keys(grouped).forEach(name => {
                    window._unitExpandState['group_' + tempSelectedBaseId + '_' + name] = true;
                });
            }
            
            renderGoodsUnitTree(baseItem.id);
        }
    } else {
        // 🔥 没有 base_unit_id 时，清空单位字段
        const search = $('addBaseUnitSearch');
        const hidden = $('add_base_unit_id');
        const bindInput = $('bindSpecIds');
        const wrap = $('specMultiWrap');
        const checkBox = $('specCheckWrap');
        
        if (search) search.value = '';
        if (hidden) hidden.value = '';
        if (bindInput) bindInput.value = '';
        if (wrap) wrap.style.display = 'none';
        if (checkBox) checkBox.innerHTML = '';
        
        // 🔥 新增：没有单位时，清空价格基准规格下拉框
        if (priceSpecSelect) {
            priceSpecSelect.innerHTML = '<option value="">请选择规格</option>';
            priceSpecSelect.disabled = true;
            delete priceSpecSelect.dataset.savedValue;
        }
    }
};

const oldSubmitForm = submitForm;
submitForm = async function () {
    const baseIdInput = $('add_base_unit_id');
    if (!baseIdInput) { alert('页面元素不完整'); return; }
    const baseId = baseIdInput.value;  // 🔥 允许为空，不弹窗
    
    // 🔥 获取选中的规格ID（只有 baseId 存在时才处理规格）
    let specIds = [];
    if (baseId) {
        // 从 tempSelectedSpecIds 获取（树形下拉选中状态）
        if (tempSelectedSpecIds.size > 0) {
            specIds = Array.from(tempSelectedSpecIds);
        }
        // 如果 tempSelectedSpecIds 为空，从隐藏字段获取
        if (specIds.length === 0) {
            const bindSpecInput = $('bindSpecIds');
            if (bindSpecInput && bindSpecInput.value) {
                specIds = bindSpecInput.value.split(',').filter(id => id);
            }
        }
        // 从 checkbox 获取
        if (specIds.length === 0) {
            const checkedBoxes = document.querySelectorAll('.goodsUnitSpecCheck:checked');
            if (checkedBoxes.length > 0) {
                specIds = Array.from(checkedBoxes).map(el => el.dataset.specId);
            }
        }
    }
    
    const editId = $('editId') ? $('editId').value : '';
    
    const supplier = $('add_supplier') ? $('add_supplier').value : '';
    const name = $('add_name') ? $('add_name').value : '';
    const spec = $('add_spec') ? $('add_spec').value : '';
    const channel = $('add_channel') ? $('add_channel').value : '';
    const taxRate = $('add_tax_rate');
    const salePrice = $('add_sale_price');
    const onlineCost = $('add_online_cost');
    const warnNum = $('add_warn_num');
    const shelfNum = $('add_shelf_life_num');
    const shelfUnit = $('add_shelf_life_unit');
    if (!supplier || !name || !channel || !salePrice) return alert('必填项不能为空');
    if (+salePrice.value <= 0) return alert('销售单价必须大于0');
    if (isDuplicate(supplier, name, spec, editId)) return alert('同供应商同名同规格商品已存在');

    let oldSalePrice = null;
    let priceChange = false;
    const newSale = +salePrice.value;
    if (editId) {
        const oldGoods = allGoods.find(g => g.id == editId);
        if (oldGoods) {
            oldSalePrice = Number(oldGoods.sale_price);
            if (newSale !== oldSalePrice) priceChange = true;
        }
    }
    
    // 🔥 获取单位名称
    const baseUnitName = $('addBaseUnitSearch') ? $('addBaseUnitSearch').value : '';
    
    // 🔥 获取价格基准规格
    const priceSpecSelect = document.getElementById('add_price_spec_id');
    const priceSpecId = priceSpecSelect ? priceSpecSelect.value : '';
    
    const goodsData = {
        supplier: supplier.trim(), 
        name: name.trim(), 
        spec: spec.trim() || null, 
        channel: channel,
        tax_rate: taxRate ? taxRate.value || null : null,
        sale_price: newSale,
        online_cost: onlineCost ? +onlineCost.value || null : null,
        warn_num: warnNum ? +warnNum.value || null : null,
        shelf_life_num: shelfNum ? +shelfNum.value || null : null,
        shelf_life_unit: shelfUnit ? shelfUnit.value || null : null,
        last_sale_price: editId ? oldSalePrice : null,
        // 🔥 允许单位为空
        base_unit_id: baseId ? +baseId : null,
        base_unit_name: baseUnitName || null,
        // 🔥 新增：保存价格基准规格
        price_spec_id: priceSpecId ? parseInt(priceSpecId) : null
    };
    
    try {
        let goodsRealId = editId;
        if (editId) {
            // 更新 goods 表
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/goods?id=eq.${editId}`, {
                method: 'PATCH',
                headers: { 
                    apikey: SUPABASE_KEY, 
                    Authorization: `Bearer ${SUPABASE_KEY}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(goodsData)
            });
            if (!updateRes.ok) {
                const errText = await updateRes.text();
                throw new Error('更新goods失败: ' + errText);
            }
            if (priceChange) {
                await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${editId}`, {
                    method: 'DELETE',
                    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
                });
                showMsg('价格变更，临时价格已清空');
            }
            goodsRealId = editId;
        } else {
            // 新增 goods
            const res = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
                method: 'POST',
                headers: { 
                    apikey: SUPABASE_KEY, 
                    Authorization: `Bearer ${SUPABASE_KEY}`, 
                    'Content-Type': 'application/json', 
                    'Prefer': 'return=representation' 
                },
                body: JSON.stringify(goodsData)
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error('新增goods失败: ' + errText);
            }
            const newArr = await res.json();
            goodsRealId = newArr[0]?.id;
            if (!goodsRealId) {
                throw new Error('获取新增商品ID失败');
            }
        }
        
        // 🔥 保存单位绑定关系到 goods_unit_bind 表（只有 baseId 存在时才保存）
        if (goodsRealId && baseId) {
            // 先删除旧的绑定
            await fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind?goods_id=eq.${goodsRealId}`, {
                method: 'DELETE',
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });
            
            // 如果有选中的规格，插入新的绑定
            if (specIds.length > 0) {
                let insertSuccess = 0;
                for (const sid of specIds) {
                    if (sid) {
                        try {
                            const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind`, {
                                method: 'POST',
                                headers: { 
                                    apikey: SUPABASE_KEY, 
                                    Authorization: `Bearer ${SUPABASE_KEY}`, 
                                    'Content-Type': 'application/json' 
                                },
                                body: JSON.stringify({ 
                                    goods_id: goodsRealId, 
                                    base_unit_id: baseId ? +baseId : null,
                                    spec_id: sid 
                                })
                            });
                            if (insertRes.ok) {
                                insertSuccess++;
                            } else {
                                console.warn('插入规格绑定失败:', sid, await insertRes.text());
                            }
                        } catch (e) {
                            console.warn('插入规格绑定异常:', sid, e);
                        }
                    }
                }
                console.log(`✅ 已保存 ${insertSuccess}/${specIds.length} 个规格绑定`);
            } else {
                console.log('✅ 已清空所有规格绑定（无选中规格）');
            }
        } else if (goodsRealId && !baseId) {
            // 如果单位为空，清空所有绑定
            await fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind?goods_id=eq.${goodsRealId}`, {
                method: 'DELETE',
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });
        }
        
        showMsg(editId ? '商品编辑成功' : '商品新增成功');
        closeForm();
        
        // 清空临时数据
        tempSelectedBaseId = null;
        tempSelectedSpecIds = new Set();
        window._unitExpandState = {};
        window._shouldPinSelected = false;
        
        await loadGoods(true);
        if (typeof loadAllGoods === 'function') await loadAllGoods();
    } catch (err) { 
        console.error('保存失败:', err);
        showMsg('保存失败：' + err.message); 
    }
};
// ===================== 空白点击关闭下拉 =====================
document.addEventListener('click', function (e) {
    // 原有的关闭逻辑
    const searchInput = $('addBaseUnitSearch');
    const searchBox = $('addBaseUnitListBox');
    if (searchInput && searchBox && !e.target.closest('#addBaseUnitSearch') && !e.target.closest('#addBaseUnitListBox')) {
        searchBox.style.display = 'none';
    }
    const baseInput = $('baseUnitName');
    const baseList = $('baseUnitModalList');
    if (baseInput && baseList && !e.target.closest('#baseUnitName') && !e.target.closest('#baseUnitModalList')) {
        baseList.style.display = 'none';
    }
    const specInput = $('specShowName');
    const specList = $('specModalList');
    if (specInput && specList && !e.target.closest('#specShowName') && !e.target.closest('#specModalList')) {
        specList.style.display = 'none';
    }
    
    // 🔥 修复问题2：点击空白关闭单位下拉弹窗
    const goodsDropdown = document.getElementById('goodsUnitDropdown');
    const addBaseUnitSearch = document.getElementById('addBaseUnitSearch');
    if (goodsDropdown && goodsDropdown.style.display === 'block') {
        // 如果点击的不是下拉框内部，也不是搜索框，则关闭
        if (!e.target.closest('#goodsUnitDropdown') && !e.target.closest('#addBaseUnitSearch')) {
            closeGoodsUnitDropdown();
        }
    }
});

// ===================== 🔥 关键修复：确保 switchGoodsSubTab 存在 =====================
if (typeof switchGoodsSubTab === 'function') {
    const _origSwitchGoodsSubTab = switchGoodsSubTab;
    window.switchGoodsSubTab = async function(tab) {
        await _origSwitchGoodsSubTab(tab);
        if (tab === 'unitSet' || tab === 'sub-unitSet') {
            await loadAllBaseUnit();
            await loadAllUnitSpec();
            renderAllUnitTable();
        }
    };
    switchGoodsSubTab = window.switchGoodsSubTab;
} else {
    console.warn('switchGoodsSubTab 未定义，请检查 goods.js 加载顺序');
}

// ===================== 全局暴露 =====================
window.openUnitEdit = openUnitEdit;
window.closeUnitAllModal = closeUnitAllModal;
window.submitAllUnit = submitAllUnit;
window.deleteBaseUnit = deleteBaseUnit;
window.deleteUnitSpec = deleteUnitSpec;
window.showAddBaseUnitList = showAddBaseUnitList;
window.filterAddBaseUnitList = filterAddBaseUnitList;
window.loadAllBaseUnit = loadAllBaseUnit;
window.loadAllUnitSpec = loadAllUnitSpec;
window.renderAllUnitTable = renderAllUnitTable;
window.selectGoodsBaseUnit = selectGoodsBaseUnit;
window.renderBaseUnitSelectOpt = renderBaseUnitSelectOpt;
window.addSpecToList = addSpecToList;
window.removeSpecFromList = removeSpecFromList;
window.renderSpecList = renderSpecList;
window.clearTempSpecList = clearTempSpecList;
window.loadSpecsToTempList = loadSpecsToTempList;
window.showBaseUnitInModal = showBaseUnitInModal;
window.filterBaseUnitInModal = filterBaseUnitInModal;
window.showSpecInModal = showSpecInModal;
window.filterSpecInModal = filterSpecInModal;
window.onModalBaseUnitChange = onModalBaseUnitChange;
window.createBaseUnitAndSelect = createBaseUnitAndSelect;
window.onGoodsBaseUnitRadioChange = onGoodsBaseUnitRadioChange;
window.renderGoodsUnitTree = renderGoodsUnitTree;
window.renderExistingSpecs = renderExistingSpecs;
window.doUpdateSpec = doUpdateSpec;
window.resetUnitSearch = resetUnitSearch;
window.onUnitFilterInput = onUnitFilterInput;
window.unitGoToPage = unitGoToPage;
window.unitPrevPage = unitPrevPage;
window.unitNextPage = unitNextPage;
window.changeUnitPageSize = changeUnitPageSize;
window.filterUnitData = filterUnitData;
window.renderUnitTable = renderUnitTable;
window.renderUnitPagination = renderUnitPagination;
window.showUnitBaseList = showUnitBaseList;
window.showUnitSpecList = showUnitSpecList;
window.showUnitRateList = showUnitRateList;
console.log('✅ 单位管理模块加载完成');