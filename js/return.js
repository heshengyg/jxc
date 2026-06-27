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

// ========== 渲染列表（移除编辑按钮） ==========
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
let selectedBatchInRecordId = null;
let selectedBatchData = null;

// ========== 重置弹窗搜索 ==========
function resetReturnSearch() {
    document.getElementById('returnSupplierSearch').value = '';
    document.getElementById('returnGoodsSearch').value = '';
    document.getElementById('returnSpecSearch').value = '';
    returnSelectedSupplier = '';
    returnSelectedGoods = '';
    returnSelectedSpec = '';
    selectedBatchInRecordId = null;
    selectedBatchData = null;
    
    document.getElementById('returnCurGoodsId').value = '';
    document.getElementById('returnSpec').value = '';
    document.getElementById('returnSettleType').value = '';
    document.getElementById('returnSalePrice').value = '';
    document.getElementById('returnInPrice').value = '';
    document.getElementById('returnNum').value = '';
    document.getElementById('returnBatchRemain').value = '';
    document.getElementById('returnBatchRemainDisplay').textContent = '0';
    
    document.getElementById('returnSelectedBatchInfo').innerHTML = '<div style="padding:12px;text-align:center;color:#999;">请选择批次</div>';
    document.getElementById('returnBatchListContainer').innerHTML = '<div style="padding:20px;text-align:center;color:#999;">请选择供应商或商品</div>';
    
    document.getElementById('returnSupplierListBox').style.display = 'none';
    document.getElementById('returnGoodsListBox').style.display = 'none';
    document.getElementById('returnSpecListBox').style.display = 'none';
}

// ========== 供应商搜索下拉（从 allStockIn 获取） ==========
function showReturnSupplierList() {
    const box = document.getElementById('returnSupplierListBox');
    if (!box) return;
    
    returnAllSuppliers = [...new Set(allStockIn.map(item => item.supplier).filter(s => s))].sort();
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
    returnAllSuppliers = [...new Set(allStockIn.map(item => item.supplier).filter(s => s))].sort();
    
    if (kw.length > 0) {
        returnFilteredSuppliers = returnAllSuppliers.filter(s => s.toLowerCase().includes(kw));
    } else {
        returnFilteredSuppliers = returnAllSuppliers;
    }
    renderReturnSupplierList(returnFilteredSuppliers);
    box.style.display = 'block';
}

function renderReturnSupplierList(list) {
    const box = document.getElementById('returnSupplierListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:8px;color:#999;">无匹配供应商</div>';
        return;
    }
    list.forEach(sup => {
        const div = document.createElement('div');
        div.textContent = sup;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            document.getElementById('returnSupplierSearch').value = sup;
            returnSelectedSupplier = sup;
            box.style.display = 'none';
            // 清空商品和规格
            document.getElementById('returnGoodsSearch').value = '';
            document.getElementById('returnSpecSearch').value = '';
            returnSelectedGoods = '';
            returnSelectedSpec = '';
            // 清空选中的批次
            selectedBatchInRecordId = null;
            selectedBatchData = null;
            document.getElementById('returnSelectedBatchInfo').innerHTML = '<div style="padding:12px;text-align:center;color:#999;">请选择批次</div>';
            document.getElementById('returnInPrice').value = '';
            document.getElementById('returnBatchRemain').value = '';
            document.getElementById('returnBatchRemainDisplay').textContent = '0';
            document.getElementById('returnNum').value = '';
            document.getElementById('returnNum').max = 0;
            updateReturnBatchList();
        };
        box.appendChild(div);
    });
}

// ========== 商品搜索下拉（从 allStockIn 获取） ==========
function showReturnGoodsList() {
    const box = document.getElementById('returnGoodsListBox');
    if (!box) return;
    
    if (returnSelectedSupplier) {
        const rawList = allStockIn
            .filter(item => item.supplier === returnSelectedSupplier)
            .map(item => ({ supplier: item.supplier, goodsName: item.goodsName, spec: item.spec || '' }));
        const uniqueMap = new Map();
        rawList.forEach(item => {
            const key = item.goodsName + '|' + item.spec;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            }
        });
        returnAllGoodsList = Array.from(uniqueMap.values());
        returnFilteredGoodsList = returnAllGoodsList;
    } else {
        const rawList = allStockIn.map(item => ({ supplier: item.supplier, goodsName: item.goodsName, spec: item.spec || '' }));
        const uniqueMap = new Map();
        rawList.forEach(item => {
            const key = item.goodsName + '|' + item.spec;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            }
        });
        returnAllGoodsList = Array.from(uniqueMap.values());
        returnFilteredGoodsList = returnAllGoodsList;
    }
    renderReturnGoodsList(returnFilteredGoodsList);
    box.style.display = 'block';
}

function filterReturnGoodsList() {
    const box = document.getElementById('returnGoodsListBox');
    if (!box) return;
    const input = document.getElementById('returnGoodsSearch');
    if (!input) return;
    
    const kw = input.value.toLowerCase();
    
    if (returnSelectedSupplier) {
        const rawList = allStockIn
            .filter(item => item.supplier === returnSelectedSupplier)
            .map(item => ({ supplier: item.supplier, goodsName: item.goodsName, spec: item.spec || '' }));
        const uniqueMap = new Map();
        rawList.forEach(item => {
            const key = item.goodsName + '|' + item.spec;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            }
        });
        returnAllGoodsList = Array.from(uniqueMap.values());
    } else {
        const rawList = allStockIn.map(item => ({ supplier: item.supplier, goodsName: item.goodsName, spec: item.spec || '' }));
        const uniqueMap = new Map();
        rawList.forEach(item => {
            const key = item.goodsName + '|' + item.spec;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            }
        });
        returnAllGoodsList = Array.from(uniqueMap.values());
    }
    
    returnFilteredGoodsList = returnAllGoodsList.filter(item => 
        item.goodsName.toLowerCase().includes(kw) || (item.spec && item.spec.toLowerCase().includes(kw))
    );
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
    list.forEach(item => {
        const div = document.createElement('div');
        const specText = item.spec ? ` (${item.spec})` : '';
        div.textContent = `${item.goodsName}${specText}`;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            document.getElementById('returnGoodsSearch').value = item.goodsName;
            returnSelectedGoods = item.goodsName;
            document.getElementById('returnSpec').value = item.spec || '';
            // 从入库记录中获取结算方式和销售单价
            const inRecord = allStockIn.find(record => 
                record.supplier === returnSelectedSupplier && 
                record.goodsName === item.goodsName && 
                (record.spec || '') === (item.spec || '')
            );
            if (inRecord) {
                document.getElementById('returnSettleType').value = inRecord.settleType || '';
                const goodsInfo = allGoods.find(g => g.supplier === inRecord.supplier && g.name === inRecord.goodsName);
                document.getElementById('returnSalePrice').value = goodsInfo ? formatMoney(goodsInfo.sale_price) : '￥0.00';
            }
            // 清空规格选择
            returnSelectedSpec = '';
            document.getElementById('returnSpecSearch').value = '';
            // 清空选中的批次
            selectedBatchInRecordId = null;
            selectedBatchData = null;
            document.getElementById('returnSelectedBatchInfo').innerHTML = '<div style="padding:12px;text-align:center;color:#999;">请选择批次</div>';
            document.getElementById('returnInPrice').value = '';
            document.getElementById('returnBatchRemain').value = '';
            document.getElementById('returnBatchRemainDisplay').textContent = '0';
            document.getElementById('returnNum').value = '';
            document.getElementById('returnNum').max = 0;
            box.style.display = 'none';
            updateReturnBatchList();
        };
        box.appendChild(div);
    });
}

// ========== 规格搜索下拉（从 allStockIn 获取） ==========
function showReturnSpecList() {
    const box = document.getElementById('returnSpecListBox');
    if (!box) return;
    
    const goodsName = document.getElementById('returnGoodsSearch').value.trim();
    if (!returnSelectedSupplier || !goodsName) {
        box.innerHTML = '<div style="padding:8px;color:#999;">请先选择供应商和商品</div>';
        box.style.display = 'block';
        return;
    }
    
    const specList = allStockIn
        .filter(item => item.supplier === returnSelectedSupplier && item.goodsName === goodsName)
        .map(item => item.spec || '');
    const uniqueSpecs = [...new Set(specList)];
    returnAllSpecList = uniqueSpecs;
    returnFilteredSpecList = returnAllSpecList;
    renderReturnSpecList(returnFilteredSpecList);
    box.style.display = 'block';
}

function filterReturnSpecList() {
    const box = document.getElementById('returnSpecListBox');
    if (!box) return;
    const input = document.getElementById('returnSpecSearch');
    if (!input) return;
    
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
        document.getElementById('returnSpecSearch').value = '';
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

// ========== 更新批次列表 ==========
function updateReturnBatchList() {
    const container = document.getElementById('returnBatchListContainer');
    if (!container) return;
    
    const supplier = returnSelectedSupplier || document.getElementById('returnSupplierSearch').value.trim();
    const goodsName = returnSelectedGoods || document.getElementById('returnGoodsSearch').value.trim();
    // 从规格搜索框读取值，用于过滤
    const specInput = document.getElementById('returnSpecSearch').value.trim();
    // 只有当规格搜索框有值，且不是默认值时，才进行规格过滤
    const spec = (specInput && specInput !== '-' && specInput !== '全部规格') ? specInput : '';
    
    if (!supplier && !goodsName) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">请选择供应商或商品</div>';
        return;
    }
    
    let allBatches = [];
    if (supplier && goodsName) {
        allBatches = getStockBatchList(supplier, goodsName);
    } else if (supplier) {
        const goodsList = allStockIn
            .filter(item => item.supplier === supplier)
            .map(item => item.goodsName);
        const uniqueGoods = [...new Set(goodsList)];
        uniqueGoods.forEach(gName => {
            const batches = getStockBatchList(supplier, gName);
            batches.forEach(b => {
                const exists = allBatches.some(existing => 
                    existing.goodsName === b.goodsName && 
                    existing.spec === b.spec &&
                    existing.inRecords && b.inRecords &&
                    existing.inRecords[0]?.id === b.inRecords[0]?.id
                );
                if (!exists) {
                    allBatches.push(b);
                }
            });
        });
    } else if (goodsName) {
        const supplierList = allStockIn
            .filter(item => item.goodsName === goodsName)
            .map(item => item.supplier);
        const uniqueSuppliers = [...new Set(supplierList)];
        uniqueSuppliers.forEach(sup => {
            const batches = getStockBatchList(sup, goodsName);
            batches.forEach(b => {
                const exists = allBatches.some(existing => 
                    existing.goodsName === b.goodsName && 
                    existing.spec === b.spec &&
                    existing.inRecords && b.inRecords &&
                    existing.inRecords[0]?.id === b.inRecords[0]?.id
                );
                if (!exists) {
                    allBatches.push(b);
                }
            });
        });
    }
    
    // 只有当用户主动选择了规格时才过滤
    if (spec) {
        allBatches = allBatches.filter(b => (b.spec || '') === spec);
    }
    
    allBatches = allBatches.filter(b => b.batchRemain > 0);
    
    if (allBatches.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">暂无有库存的批次</div>';
        return;
    }
    
    window._returnBatchListData = allBatches;
    
    let html = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
                <tr style="background:#f5f7fa;">
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;width:50px;">选择</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;">供应商</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;">商品名</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;">规格</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;">生产日期</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;">到期日期</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;width:90px;">入库单价</th>
                    <th style="padding:8px;border:1px solid #ddd;text-align:center;width:80px;">批次库存</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    allBatches.forEach((batch, idx) => {
        const produceDate = batch.produce_date && batch.produce_date !== '-' ? batch.produce_date : '-';
        const expireDate = batch.expire_date && batch.expire_date !== '-' ? batch.expire_date : '-';
        const isSelected = batch.inRecords && batch.inRecords[0] && selectedBatchInRecordId === batch.inRecords[0].id;
        const selectBg = isSelected ? 'style="background:#d4edda;"' : '';
        html += `
            <tr ${selectBg}>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">
                    <input type="radio" name="returnBatchSelect" value="${idx}" ${isSelected ? 'checked' : ''} onclick="toggleReturnBatch(${idx})">
                </td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${batch.supplier}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${batch.goodsName}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${batch.spec || '-'}</td>
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

// ========== 切换批次选择（点击切换选中/取消） ==========
function toggleReturnBatch(index) {
    const allBatches = window._returnBatchListData || [];
    if (index >= allBatches.length) {
        showMsg('批次数据异常');
        return;
    }
    
    const batch = allBatches[index];
    if (!batch || !batch.inRecords || batch.inRecords.length === 0) {
        showMsg('该批次数据异常');
        return;
    }
    
    const inRecord = batch.inRecords[0];
    
    // 如果点击的是已选中的，取消选择
    if (selectedBatchInRecordId === inRecord.id) {
        // 取消选择
        selectedBatchInRecordId = null;
        selectedBatchData = null;
        
        document.getElementById('returnSelectedBatchInfo').innerHTML = '<div style="padding:12px;text-align:center;color:#999;">请选择批次</div>';
        document.getElementById('returnInPrice').value = '';
        document.getElementById('returnBatchRemain').value = '';
        document.getElementById('returnBatchRemainDisplay').textContent = '0';
        document.getElementById('returnNum').value = '';
        document.getElementById('returnNum').max = 0;
        
        // 移除高亮
        updateReturnBatchList();
        return;
    }
    
    // 选中新批次 - 只记录选中状态，不改变过滤条件
    selectedBatchInRecordId = inRecord.id;
    selectedBatchData = {
        inRecordId: inRecord.id,
        inPrice: inRecord.in_price || 0,
        batchRemain: batch.batchRemain,
        produceDate: batch.produce_date || '',
        expireDate: batch.expire_date || ''
    };
    
    // 只更新搜索框的显示值，但不改变过滤变量 returnSelectedSupplier/Goods/Spec
    document.getElementById('returnSupplierSearch').value = batch.supplier;
    document.getElementById('returnGoodsSearch').value = batch.goodsName;
    document.getElementById('returnCurGoodsId').value = inRecord.id;
    document.getElementById('returnSpec').value = batch.spec || '';
    document.getElementById('returnSettleType').value = batch.settleType || '';
    
    const goodsInfo = allGoods.find(g => g.supplier === batch.supplier && g.name === batch.goodsName);
    document.getElementById('returnSalePrice').value = goodsInfo ? formatMoney(goodsInfo.sale_price) : '￥0.00';
    
    const produceDisplay = selectedBatchData.produceDate || '-';
    const expireDisplay = selectedBatchData.expireDate || '-';
    
    document.getElementById('returnSelectedBatchInfo').innerHTML = `
        <div style="background:#f0f9f4;padding:12px;border-radius:4px;border-left:3px solid #52c41a;">
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <span><strong>供应商：</strong>${batch.supplier}</span>
                <span><strong>商品：</strong>${batch.goodsName}</span>
                <span><strong>规格：</strong>${batch.spec || '-'}</span>
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
    
    // 只更新高亮状态，不重新过滤数据
    updateReturnBatchList();
    
    console.log('✅ 已选择批次:', selectedBatchInRecordId, selectedBatchData);
}

// ========== 打开退货弹窗 ==========
function openReturnAddForm() {
    resetReturnSearch();
    document.getElementById('returnFormTitle').innerText = '添加退货单据';
    document.getElementById('returnEditId').value = '';
    document.getElementById('returnRecordDate').value = new Date().toISOString().split('T')[0];
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
    const supplier = returnSelectedSupplier || document.getElementById('returnSupplierSearch').value.trim();
    const goodsName = returnSelectedGoods || document.getElementById('returnGoodsSearch').value.trim();
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
    
    if (!selectedBatchInRecordId) {
        showMsg('请选择退货批次');
        return;
    }
    
    if (returnNum < 1) return showMsg('退货数量必须大于0');
    if (!recordDate) return showMsg('请选择录入日期');

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

        const res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods`, {
            method: 'POST',
            headers,
            body: JSON.stringify(postData)
        });

        if (res.status >= 200 && res.status < 300) {
            showMsg('退货成功');
            closeReturnForm();
            await loadReturnGoods();
            stockDataCache.clear();
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
        stockDataCache.clear();
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
    stockDataCache.clear();
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
                
                // 从入库记录中查找匹配的商品
                const inRecord = allStockIn.find(item => 
                    item.supplier === supplier && 
                    item.goodsName === goodsName && 
                    (item.spec || '') === (spec || '')
                );
                if (!inRecord) { failCount++; continue; }
                
                const batchList = getStockBatchList(supplier, goodsName);
                if (batchList.length === 0) { failCount++; continue; }
                
                const firstBatch = batchList[0];
                if (!firstBatch.inRecords || firstBatch.inRecords.length === 0) { failCount++; continue; }
                
                const inRecordData = firstBatch.inRecords[0];
                const inPrice = inRecordData.in_price || 0;
                const goodsInfo = allGoods.find(g => g.supplier === supplier && g.name === goodsName);
                const salePrice = goodsInfo ? goodsInfo.sale_price : 0;
                
                if (returnNum > firstBatch.batchRemain) { failCount++; continue; }
                
                const postData = {
                    supplier, goods_name: goodsName, spec: spec || null,
                    settle_type: settleType || inRecord.settleType || '',
                    in_record_id: inRecordData.id, in_price: inPrice, return_num: returnNum,
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