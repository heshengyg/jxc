// ===================== 退货管理模块 =====================
// 全局变量
let returnCurrentPage = 1;
let returnPageSize = 10;
let returnTotalPages = 1;
let returnSortField = '';
let returnSortAsc = true;

// ========== 加载/刷新 ==========
function refreshReturnGoods() {
    loadReturnGoods();
}

async function loadReturnGoods() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        const data = await res.json();
        allReturnGoods = data;
        const totalEl = document.getElementById('returnTotalCount');
        if (totalEl) totalEl.textContent = data.length;
        returnCurrentPage = 1;
        filterReturnGoods();
    } catch (e) {
        showMsg('加载退货记录失败：' + e.message);
    }
}

// ========== 搜索/筛选 ==========
function filterReturnGoods() {
    let field = document.getElementById('returnSearchField').value;
    let kw = document.getElementById('returnSearchKeyword').value.toLowerCase();
    filteredReturnGoods = allReturnGoods.filter(item => 
        String(item[field] || '').toLowerCase().includes(kw)
    );
    const searchEl = document.getElementById('returnSearchCount');
    if (searchEl) searchEl.textContent = filteredReturnGoods.length;
    returnCurrentPage = 1;
    renderReturnPagination();
    renderReturnList();
}

function resetReturnSearch() {
    document.getElementById('returnSearchKeyword').value = '';
    document.getElementById('returnSearchField').selectedIndex = 0;
    filterReturnGoods();
}

function clearReturnSort() {
    returnSortField = '';
    returnSortAsc = true;
    updateReturnSortIcon();
    loadReturnGoods();
}

// ========== 排序 ==========
function returnSortTable(field) {
    returnSortField = field;
    returnSortAsc = returnSortField === field ? !returnSortAsc : true;
    filteredReturnGoods.sort((a, b) => {
        let va = a[returnSortField] || '', vb = b[returnSortField] || '';
        if (['return_num', 'return_amount', 'sale_amount', 'in_price', 'sale_price'].includes(returnSortField)) {
            va = Number(va) || 0;
            vb = Number(vb) || 0;
            return returnSortAsc ? va - vb : vb - va;
        }
        return returnSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateReturnSortIcon();
    renderReturnList();
}

function updateReturnSortIcon() {
    document.querySelectorAll('.returnSortIcon').forEach(i => i.innerText = '');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(
        th => th.onclick?.toString().includes(returnSortField)
    );
    if (idx > -1) document.querySelectorAll('.returnSortIcon')[idx].innerText = returnSortAsc ? '↑' : '↓';
}

// ========== 渲染列表 ==========
function renderReturnList() {
    let start = (returnCurrentPage - 1) * returnPageSize;
    let pageData = filteredReturnGoods.slice(start, start + returnPageSize);
    let tb = document.getElementById('returnGoodsList');
    if (!tb) return;
    tb.innerHTML = '';
    
    if (pageData.length === 0) {
        tb.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:20px;color:#999;">暂无退货记录</td></tr>';
        return;
    }
    
    for (let idx = 0; idx < pageData.length; idx++) {
        const item = pageData[idx];
        const rowNum = start + idx + 1;
        const html = `
            <tr>
                <td><input type="checkbox" class="return-item-checkbox" value="${item.id}"></td>
                <td>${rowNum}</td>
                <td>${item.supplier || ''}</td>
                <td>${item.goods_name || ''}</td>
                <td>${item.spec || '-'}</td>
                <td>${item.settle_type || ''}</td>
                <td>${formatMoney(item.in_price)}</td>
                <td>${item.return_num}</td>
                <td>${formatMoney(item.return_amount)}</td>
                <td>${formatMoney(item.sale_price)}</td>
                <td>${formatMoney(item.sale_amount)}</td>
                <td>${item.record_date || ''}</td>
                <td>
                    <button class="btn btn-primary" onclick="openReturnEditForm(${item.id})">编辑</button>
                    <button class="btn btn-danger" onclick="deleteReturnGoods(${item.id})">删除</button>
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    }
}

// ========== 分页 ==========
function renderReturnPagination() {
    returnTotalPages = Math.ceil(filteredReturnGoods.length / returnPageSize) || 1;
    document.getElementById('returnCurrentPage').textContent = returnCurrentPage;
    document.getElementById('returnTotalPages').textContent = returnTotalPages;

    let pgBox = document.getElementById('returnPageNumbers');
    pgBox.innerHTML = '';
    let s = Math.max(1, returnCurrentPage - 2);
    let e = Math.min(returnTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === returnCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => returnGoToPage(i);
        pgBox.appendChild(btn);
    }

    let btns = document.querySelectorAll('#returnGoods .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (returnCurrentPage === 1);
        btns[1].disabled = (returnCurrentPage === 1);
        btns[btns.length - 2].disabled = (returnCurrentPage === returnTotalPages);
        btns[btns.length - 1].disabled = (returnCurrentPage === returnTotalPages);
    }
}

function returnGoToPage(p) {
    if (p < 1 || p > returnTotalPages) return;
    returnCurrentPage = p;
    renderReturnPagination();
    renderReturnList();
}

function returnPrevPage() { returnGoToPage(returnCurrentPage - 1); }
function returnNextPage() { returnGoToPage(returnCurrentPage + 1); }

function changeReturnPageSize() {
    returnPageSize = +document.getElementById('returnPageSize').value;
    returnCurrentPage = 1;
    renderReturnPagination();
    renderReturnList();
}

// ========== 弹窗搜索下拉相关变量 ==========
let returnAllSuppliers = [];
let returnFilteredSuppliers = [];
let returnAllGoodsList = [];
let returnFilteredGoodsList = [];
let returnAllSpecList = [];
let returnFilteredSpecList = [];

let returnSelectedSupplier = '';
let returnSelectedGoods = '';
let returnSelectedSpec = '';

// ========== 供应商搜索下拉 ==========
function showReturnSupplierList() {
    const box = document.getElementById('returnSupplierListBox');
    if (!box) return;
    const input = document.getElementById('returnSupplierSearch');
    if (!input) return;
    
    returnAllSuppliers = [...new Set(allGoods.map(item => item.supplier).filter(s => s))].sort();
    returnFilteredSuppliers = returnAllSuppliers;
    renderReturnSupplierList(returnFilteredSuppliers);
    box.style.display = 'block';
}

function filterReturnSupplierList() {
    const box = document.getElementById('returnSupplierListBox');
    if (!box) return;
    const input = document.getElementById('returnSupplierSearch');
    if (!input) return;
    
    const kw = input.value.toLowerCase();
    
    // ✅ 如果有搜索关键词，从所有供应商中过滤
    if (kw.length > 0) {
        returnFilteredSuppliers = returnAllSuppliers.filter(s => s.toLowerCase().includes(kw));
        renderReturnSupplierList(returnFilteredSuppliers);
        box.style.display = 'block';
    } else {
        // ✅ 如果清空搜索，显示所有供应商
        returnFilteredSuppliers = returnAllSuppliers;
        renderReturnSupplierList(returnFilteredSuppliers);
        box.style.display = 'block';
    }
}

// ========== 商品搜索下拉 ==========
function showReturnGoodsList() {
    const box = document.getElementById('returnGoodsListBox');
    if (!box) return;
    
    // ✅ 如果没有选供应商，显示所有商品
    if (!returnSelectedSupplier) {
        const allGoodsList = allGoods.map(g => g).sort((a, b) => a.name.localeCompare(b.name));
        renderReturnGoodsList(allGoodsList);
        box.style.display = 'block';
        return;
    }
    
    // ✅ 如果选了供应商，显示该供应商的商品
    renderReturnGoodsList(returnFilteredGoodsList);
    box.style.display = 'block';
}

function filterReturnGoodsList() {
    const box = document.getElementById('returnGoodsListBox');
    if (!box) return;
    const input = document.getElementById('returnGoodsSearch');
    if (!input) return;
    
    const kw = input.value.toLowerCase();
    
    // ✅ 如果没有选供应商，从所有商品中搜索
    if (!returnSelectedSupplier) {
        // 从所有商品中搜索
        const allGoodsList = allGoods.filter(g => g.name.toLowerCase().includes(kw));
        renderReturnGoodsList(allGoodsList);
        box.style.display = 'block';
        return;
    }
    
    // ✅ 如果选了供应商，从该供应商商品中搜索
    returnFilteredGoodsList = returnAllGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderReturnGoodsList(returnFilteredGoodsList);
    box.style.display = 'block';
}

function renderReturnGoodsList(list) {
    const box = document.getElementById('returnGoodsListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:8px;color:#999;">无匹配商品</div>';
        return;
    }
    list.forEach(goods => {
        const div = document.createElement('div');
        div.textContent = `${goods.name}${goods.spec ? ' (' + goods.spec + ')' : ''}`;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            document.getElementById('returnGoodsSearch').value = goods.name;
            returnSelectedGoods = goods.name;
            document.getElementById('returnCurGoodsId').value = goods.id;
            document.getElementById('returnSpec').value = goods.spec || '';
            document.getElementById('returnSettleType').value = goods.channel || '';
            document.getElementById('returnSalePrice').value = formatMoney(goods.sale_price);
            box.style.display = 'none';
            // ✅ 更新规格列表
            updateReturnSpecList();
            // ✅ 更新批次列表
            updateReturnBatchList();
        };
        box.appendChild(div);
    });
}

// ========== 规格搜索下拉 ==========
function showReturnSpecList() {
    const box = document.getElementById('returnSpecListBox');
    if (!box) return;
    if (!returnSelectedSupplier || !returnSelectedGoods) {
        box.innerHTML = '<div style="padding:8px;color:#999;">请先选择供应商和商品</div>';
        box.style.display = 'block';
        return;
    }
    renderReturnSpecList(returnFilteredSpecList);
    box.style.display = 'block';
}

function filterReturnSpecList() {
    const box = document.getElementById('returnSpecListBox');
    if (!box) return;
    const input = document.getElementById('returnSpecSearch');
    if (!input) return;
    
    if (!returnSelectedSupplier || !returnSelectedGoods) {
        box.innerHTML = '<div style="padding:8px;color:#999;">请先选择供应商和商品</div>';
        box.style.display = 'block';
        return;
    }
    
    const kw = input.value.toLowerCase();
    returnFilteredSpecList = returnAllSpecList.filter(s => (s || '-').toLowerCase().includes(kw));
    renderReturnSpecList(returnFilteredSpecList);
    box.style.display = 'block';
}

function renderReturnSpecList(list) {
    const box = document.getElementById('returnSpecListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:8px;color:#999;">无匹配规格</div>';
        return;
    }
    const allDiv = document.createElement('div');
    allDiv.textContent = '全部规格';
    allDiv.style.padding = '6px 10px';
    allDiv.style.cursor = 'pointer';
    allDiv.style.fontWeight = 'bold';
    allDiv.onmouseover = function() { this.style.background = '#e5efff'; };
    allDiv.onmouseout = function() { this.style.background = 'transparent'; };
    allDiv.onclick = function() {
        document.getElementById('returnSpecSearch').value = '全部规格';
        returnSelectedSpec = '';
        box.style.display = 'none';
        updateReturnBatchList();
    };
    box.appendChild(allDiv);
    
    list.forEach(spec => {
        const div = document.createElement('div');
        div.textContent = spec || '-';
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            document.getElementById('returnSpecSearch').value = spec || '-';
            returnSelectedSpec = spec;
            box.style.display = 'none';
            updateReturnBatchList();
        };
        box.appendChild(div);
    });
}

// ========== 更新下拉列表数据 ==========
function updateReturnGoodsList() {
    if (!returnSelectedSupplier) {
        returnAllGoodsList = [];
        returnFilteredGoodsList = [];
        return;
    }
    returnAllGoodsList = allGoods.filter(g => g.supplier === returnSelectedSupplier);
    returnFilteredGoodsList = returnAllGoodsList;
    if (!returnAllGoodsList.some(g => g.name === returnSelectedGoods)) {
        returnSelectedGoods = '';
        document.getElementById('returnGoodsSearch').value = '';
        document.getElementById('returnCurGoodsId').value = '';
        document.getElementById('returnSpec').value = '';
        document.getElementById('returnSettleType').value = '';
        document.getElementById('returnSalePrice').value = '';
        returnSelectedSpec = '';
        document.getElementById('returnSpecSearch').value = '';
        returnAllSpecList = [];
        returnFilteredSpecList = [];
    }
}

function updateReturnSpecList() {
    if (!returnSelectedSupplier || !returnSelectedGoods) {
        returnAllSpecList = [];
        returnFilteredSpecList = [];
        return;
    }
    const goods = allGoods.find(g => g.supplier === returnSelectedSupplier && g.name === returnSelectedGoods);
    if (goods) {
        const batchList = getStockBatchList(returnSelectedSupplier, returnSelectedGoods);
        const specSet = new Set();
        batchList.forEach(batch => {
            specSet.add(batch.spec || '');
        });
        returnAllSpecList = Array.from(specSet);
        returnFilteredSpecList = returnAllSpecList;
        if (returnSelectedSpec && !returnAllSpecList.some(s => s === returnSelectedSpec)) {
            returnSelectedSpec = '';
            document.getElementById('returnSpecSearch').value = '';
        }
    }
}

// ========== 更新批次列表 ==========
let selectedBatchInRecordId = null;
let selectedBatchData = null;

function updateReturnBatchList() {
    const container = document.getElementById('returnBatchListContainer');
    if (!container) return;
    
    // ✅ 如果没有选供应商但有商品搜索关键词，自动匹配
    const goodsSearch = document.getElementById('returnGoodsSearch').value.trim();
    if (!returnSelectedSupplier && goodsSearch) {
        // 尝试自动匹配商品
        const matchedGoods = allGoods.filter(g => g.name === goodsSearch);
        if (matchedGoods.length === 1) {
            returnSelectedSupplier = matchedGoods[0].supplier;
            document.getElementById('returnSupplierSearch').value = returnSelectedSupplier;
            updateReturnGoodsList();
        }
    }
    
    if (!returnSelectedSupplier) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">请先选择供应商</div>';
        return;
    }
    
    let batchList = getStockBatchList(returnSelectedSupplier, returnSelectedGoods || '');
    
    if (returnSelectedGoods) {
        batchList = batchList.filter(b => b.goodsName === returnSelectedGoods);
    }
    
    if (returnSelectedSpec) {
        batchList = batchList.filter(b => (b.spec || '') === returnSelectedSpec);
    }
    
    batchList = batchList.filter(b => b.batchRemain > 0);
    
    if (batchList.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">暂无有库存的批次</div>';
        return;
    }
    
    // ✅ 生产日期和到期日期分两列显示
    let html = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f5f7fa;">
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;width:50px;">选择</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;">生产日期</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;">到期日期</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;width:100px;">入库单价</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;width:80px;">批次库存</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    batchList.forEach((batch, idx) => {
        const produceDate = batch.produce_date && batch.produce_date !== '-' ? batch.produce_date : '-';
        const expireDate = batch.expire_date && batch.expire_date !== '-' ? batch.expire_date : '-';
        const isSelected = batch.inRecords && batch.inRecords[0] && selectedBatchInRecordId === batch.inRecords[0].id;
        const selectBg = isSelected ? 'style="background:#d4edda;"' : '';
        html += `
            <tr ${selectBg}>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">
                    <input type="radio" name="returnBatchSelect" value="${idx}" ${isSelected ? 'checked' : ''} onchange="selectReturnBatch(${idx})">
                </td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${produceDate}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${expireDate}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatMoney(batch.inRecords && batch.inRecords[0] ? batch.inRecords[0].in_price : 0)}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;color:#ff4d4f;">${batch.batchRemain}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function selectReturnBatch(index) {
    const supplier = returnSelectedSupplier;
    const goodsName = returnSelectedGoods;
    if (!supplier || !goodsName) {
        showMsg('请先选择供应商和商品');
        return;
    }
    
    let batchList = getStockBatchList(supplier, goodsName);
    if (returnSelectedSpec) {
        batchList = batchList.filter(b => (b.spec || '') === returnSelectedSpec);
    }
    batchList = batchList.filter(b => b.batchRemain > 0);
    
    if (index >= batchList.length) return;
    
    const batch = batchList[index];
    if (!batch || !batch.inRecords || batch.inRecords.length === 0) {
        showMsg('该批次数据异常');
        return;
    }
    
    const inRecord = batch.inRecords[0];
    selectedBatchInRecordId = inRecord.id;
    selectedBatchData = {
        inRecordId: inRecord.id,
        inPrice: inRecord.in_price || 0,
        batchRemain: batch.batchRemain,
        produceDate: batch.produce_date || '',
        expireDate: batch.expire_date || ''
    };
    
    // ✅ 显示生产日期和到期日期
    const produceDisplay = selectedBatchData.produceDate || '-';
    const expireDisplay = selectedBatchData.expireDate || '-';
    
    document.getElementById('returnSelectedBatchInfo').innerHTML = `
        <div style="background:#f0f9f4;padding:12px;border-radius:4px;border-left:3px solid #52c41a;">
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <span><strong>生产日期：</strong>${produceDisplay}</span>
                <span><strong>到期日期：</strong>${expireDisplay}</span>
                <span><strong>入库单价：</strong>${formatMoney(selectedBatchData.inPrice)}</span>
                <span><strong>批次库存：</strong><span style="color:#ff4d4f;font-weight:bold;">${selectedBatchData.batchRemain}</span></span>
            </div>
        </div>
    `;
    document.getElementById('returnInPrice').value = formatMoney(selectedBatchData.inPrice);
    document.getElementById('returnBatchRemain').value = selectedBatchData.batchRemain;
    document.getElementById('returnBatchRemainDisplay').textContent = selectedBatchData.batchRemain;
    document.getElementById('returnNum').max = selectedBatchData.batchRemain;
    document.getElementById('returnNum').value = '';
    
    updateReturnBatchList();
}

// ========== 打开退货弹窗 ==========
function openReturnAddForm() {
    returnSelectedSupplier = '';
    returnSelectedGoods = '';
    returnSelectedSpec = '';
    selectedBatchInRecordId = null;
    selectedBatchData = null;
    
    document.getElementById('returnFormTitle').innerText = '添加退货单据';
    document.getElementById('returnEditId').value = '';
    document.getElementById('returnSupplierSearch').value = '';
    document.getElementById('returnGoodsSearch').value = '';
    document.getElementById('returnSpecSearch').value = '';
    document.getElementById('returnCurGoodsId').value = '';
    document.getElementById('returnSpec').value = '';
    document.getElementById('returnSettleType').value = '';
    document.getElementById('returnSalePrice').value = '';
    document.getElementById('returnInPrice').value = '';
    document.getElementById('returnNum').value = '';
    document.getElementById('returnBatchRemain').value = '';
    document.getElementById('returnBatchRemainDisplay').textContent = '0';
    document.getElementById('returnReason').value = '';
    document.getElementById('returnRecordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('returnSelectedBatchInfo').innerHTML = '<div style="padding:12px;text-align:center;color:#999;">请选择批次</div>';
    document.getElementById('returnBatchListContainer').innerHTML = '<div style="padding:20px;text-align:center;color:#999;">请先选择供应商</div>';
    
    returnAllSuppliers = [];
    returnFilteredSuppliers = [];
    returnAllGoodsList = [];
    returnFilteredGoodsList = [];
    returnAllSpecList = [];
    returnFilteredSpecList = [];
    
    document.getElementById('returnModal').style.display = 'block';
}

async function openReturnEditForm(id) {
    const item = allReturnGoods.find(x => x.id === id);
    if (!item) return;
    
    document.getElementById('returnFormTitle').innerText = '编辑退货单据';
    document.getElementById('returnEditId').value = id;
    
    returnSelectedSupplier = item.supplier;
    document.getElementById('returnSupplierSearch').value = item.supplier;
    updateReturnGoodsList();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    returnSelectedGoods = item.goods_name;
    document.getElementById('returnGoodsSearch').value = item.goods_name;
    document.getElementById('returnCurGoodsId').value = item.in_record_id;
    updateReturnSpecList();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    returnSelectedSpec = item.spec || '';
    document.getElementById('returnSpecSearch').value = item.spec || '-';
    document.getElementById('returnSpec').value = item.spec || '';
    document.getElementById('returnSettleType').value = item.settle_type || '';
    document.getElementById('returnSalePrice').value = formatMoney(item.sale_price);
    document.getElementById('returnInPrice').value = formatMoney(item.in_price);
    document.getElementById('returnNum').value = item.return_num;
    document.getElementById('returnReason').value = item.return_reason || '';
    document.getElementById('returnRecordDate').value = item.record_date || '';
    
    selectedBatchInRecordId = item.in_record_id;
    selectedBatchData = {
        inRecordId: item.in_record_id,
        inPrice: item.in_price,
        batchRemain: 999,
        produceDate: '',
        expireDate: ''
    };
    document.getElementById('returnBatchRemain').value = 999;
    document.getElementById('returnBatchRemainDisplay').textContent = '不限';
    document.getElementById('returnNum').max = 999;
    
    document.getElementById('returnSelectedBatchInfo').innerHTML = `
        <div style="background:#f0f9f4;padding:12px;border-radius:4px;border-left:3px solid #52c41a;">
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <span><strong>已选批次：</strong>${item.goods_name}</span>
                <span><strong>入库单价：</strong>${formatMoney(item.in_price)}</span>
            </div>
        </div>
    `;
    
    updateReturnBatchList();
    document.getElementById('returnModal').style.display = 'block';
}

function closeReturnForm() {
    document.getElementById('returnModal').style.display = 'none';
}

// ========== 检查退货数量 ==========
function checkReturnNum() {
    const num = +document.getElementById('returnNum').value || 0;
    const remain = +document.getElementById('returnBatchRemain').value || 0;
    if (num > remain && remain > 0) {
        document.getElementById('returnNum').value = remain;
        showMsg(`退货数量不能大于批次库存（${remain}）`);
    }
}

// ========== 提交退货 ==========
async function submitReturnGoods() {
    const editId = document.getElementById('returnEditId').value;
    const supplier = returnSelectedSupplier;
    const goodsName = returnSelectedGoods;
    const goodsId = document.getElementById('returnCurGoodsId').value;
    const spec = document.getElementById('returnSpec').value;
    const settleType = document.getElementById('returnSettleType').value;
    const salePrice = parseFloat(document.getElementById('returnSalePrice').value.replace('￥', ''));
    const inPrice = selectedBatchData ? selectedBatchData.inPrice : 0;
    const returnNum = +document.getElementById('returnNum').value || 0;
    const recordDate = document.getElementById('returnRecordDate').value;
    const returnReason = document.getElementById('returnReason').value.trim();

    if (!supplier) return showMsg('请选择供应商');
    if (!goodsName || !goodsId) return showMsg('请选择商品');
    if (!selectedBatchInRecordId) return showMsg('请选择退货批次');
    if (returnNum < 1) return showMsg('退货数量必须大于0');
    if (!recordDate) return showMsg('请选择录入日期');

    if (!editId) {
        const batchList = getStockBatchList(supplier, goodsName);
        let targetBatch = null;
        for (const batch of batchList) {
            if (batch.inRecords && batch.inRecords.some(r => r.id === selectedBatchInRecordId)) {
                targetBatch = batch;
                break;
            }
        }
        if (!targetBatch) {
            showMsg('该批次已无库存或已被删除');
            return;
        }
        if (returnNum > targetBatch.batchRemain) {
            showMsg(`退货数量不能大于批次库存（${targetBatch.batchRemain}）`);
            return;
        }
    }

    const returnAmount = inPrice * returnNum;
    const saleAmount = salePrice * returnNum;

    const postData = {
        supplier: supplier,
        goods_name: goodsName,
        spec: spec || null,
        settle_type: settleType,
        in_record_id: selectedBatchInRecordId,
        in_price: inPrice,
        return_num: returnNum,
        return_amount: returnAmount,
        sale_price: salePrice,
        sale_amount: saleAmount,
        record_date: recordDate,
        return_reason: returnReason || null
    };

    try {
        const headers = {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        let res;
        if (editId) {
            res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?id=eq.${editId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(postData)
            });
        } else {
            res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods`, {
                method: 'POST',
                headers,
                body: JSON.stringify(postData)
            });
        }

        if (res.status >= 200 && res.status < 300) {
            showMsg(editId ? '编辑成功' : '退货成功');
            closeReturnForm();
            await loadReturnGoods();
            refreshAllStockCache(allStockIn, allStockOut);
            if (typeof loadStockStock === 'function') {
                loadStockStock();
            }
        } else {
            throw new Error('请求失败');
        }
    } catch (e) {
        showMsg('操作失败');
    }
}

// ========== 删除 ==========
async function deleteReturnGoods(id) {
    if (!confirm('确定删除？')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/return_goods?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        showMsg('删除成功');
        await loadReturnGoods();
        refreshAllStockCache(allStockIn, allStockOut);
        if (typeof loadStockStock === 'function') {
            loadStockStock();
        }
    } catch (e) {
        showMsg('删除失败');
    }
}

// ========== 批量删除 ==========
async function batchDeleteReturnGoods() {
    const ids = [];
    document.querySelectorAll('.return-item-checkbox').forEach(cb => {
        if (cb.checked) ids.push(cb.value);
    });
    if (ids.length === 0) return showMsg('请选择数据');
    if (!confirm(`确定删除${ids.length}条？`)) return;
    for (const id of ids) {
        await fetch(`${SUPABASE_URL}/rest/v1/return_goods?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
    }
    showMsg('批量删除成功');
    await loadReturnGoods();
    refreshAllStockCache(allStockIn, allStockOut);
    if (typeof loadStockStock === 'function') {
        loadStockStock();
    }
}

// ========== 全选 ==========
function returnToggleSelectAll() {
    const all = document.getElementById('returnSelectAll').checked;
    document.querySelectorAll('.return-item-checkbox').forEach(cb => cb.checked = all);
}

// ========== 导出Excel ==========
function exportReturnExcel() {
    if (filteredReturnGoods.length === 0) {
        showMsg("暂无数据可导出");
        return;
    }
    const header = ["供应商", "商品名称", "规格", "结算方式", "退货单价", "退货数量", "退货金额", "销售单价", "销售金额", "录入日期", "退货原因"];
    const expData = filteredReturnGoods.map(item => [
        item.supplier || "",
        item.goods_name || "",
        item.spec || "",
        item.settle_type || "",
        item.in_price || 0,
        item.return_num || 0,
        item.return_amount || 0,
        item.sale_price || 0,
        item.sale_amount || 0,
        item.record_date || "",
        item.return_reason || ""
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "退货记录");
    XLSX.writeFile(wb, "退货记录.xlsx");
}

// ========== 导入模板 ==========
function downloadReturnTemplate() {
    const header = ["供应商", "商品名称", "规格", "结算方式", "退货数量", "录入日期", "退货原因"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "退货导入模板");
    XLSX.writeFile(wb, "退货导入模板.xlsx");
}

// ========== 导入退货 ==========
async function importReturnExcel() {
    const file = document.getElementById('returnFileInput').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (rows.length < 2) {
                showMsg('模板无有效数据！');
                return;
            }
            let failCount = 0, successCount = 0;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const supplier = String(row[0] || '').trim();
                const goodsName = String(row[1] || '').trim();
                const spec = String(row[2] || '').trim();
                const settleType = String(row[3] || '').trim();
                const returnNum = parseInt(row[4]) || 0;
                const recordDate = row[5] || '';
                const returnReason = String(row[6] || '').trim();
                
                if (!supplier || !goodsName || returnNum < 1 || !recordDate) { failCount++; continue; }
                
                const goods = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
                if (!goods) { failCount++; continue; }
                
                const batchList = getStockBatchList(supplier, goodsName);
                if (batchList.length === 0) { failCount++; continue; }
                
                const firstBatch = batchList[0];
                if (!firstBatch.inRecords || firstBatch.inRecords.length === 0) { failCount++; continue; }
                
                const inRecord = firstBatch.inRecords[0];
                const inPrice = inRecord.in_price || 0;
                const salePrice = goods.sale_price || 0;
                
                if (returnNum > firstBatch.batchRemain) { failCount++; continue; }
                
                const postData = {
                    supplier, goods_name: goodsName, spec: spec || null,
                    settle_type: settleType || goods.channel || '',
                    in_record_id: inRecord.id, in_price: inPrice, return_num: returnNum,
                    return_amount: inPrice * returnNum, sale_price: salePrice,
                    sale_amount: salePrice * returnNum, record_date: recordDate,
                    return_reason: returnReason || null
                };
                try {
                    await fetch(`${SUPABASE_URL}/rest/v1/return_goods`, {
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
            showMsg(`导入完成：成功${successCount}条，失败${failCount}`);
            loadReturnGoods();
            refreshAllStockCache(allStockIn, allStockOut);
            if (typeof loadStockStock === 'function') {
                loadStockStock();
            }
        } catch (err) {
            showMsg('导入失败：' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ========== 点击空白关闭下拉 ==========
document.addEventListener('click', function(e) {
    if (!e.target.closest('#returnSupplierSearch') && !e.target.closest('#returnSupplierListBox')) {
        const box = document.getElementById('returnSupplierListBox');
        if (box) box.style.display = 'none';
    }
    if (!e.target.closest('#returnGoodsSearch') && !e.target.closest('#returnGoodsListBox')) {
        const box = document.getElementById('returnGoodsListBox');
        if (box) box.style.display = 'none';
    }
    if (!e.target.closest('#returnSpecSearch') && !e.target.closest('#returnSpecListBox')) {
        const box = document.getElementById('returnSpecListBox');
        if (box) box.style.display = 'none';
    }
});

// ========== 页面加载时自动加载 ==========
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('returnGoodsList')) {
        loadReturnGoods();
    }
});