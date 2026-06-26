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

function clearReturnSort() {
    returnSortField = '';
    returnSortAsc = true;
    updateReturnSortIcon();
    loadReturnGoods();
}

// ========== 渲染列表 ==========
async function renderReturnList() {
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

// ========== 供应商下拉 ==========
let currReturnSupplierList = [];
let currReturnGoodsList = [];

function showReturnSupList() {
    currReturnSupplierList = [...new Set(allGoods.map(item => item.supplier).filter(s => s))];
    renderReturnSupplierList(currReturnSupplierList);
    document.getElementById('returnSupListBox').style.display = 'block';
}

function filterReturnSupplierList() {
    let kw = document.getElementById('returnSupSearchInput').value.toLowerCase();
    let res = currReturnSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderReturnSupplierList(res);
    document.getElementById('returnSupListBox').style.display = 'block';
}

function renderReturnSupplierList(list) {
    let box = document.getElementById('returnSupListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:8px;color:#999;">无匹配数据</div>';
        return;
    }
    list.forEach(sup => {
        let div = document.createElement('div');
        div.innerText = sup;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            document.getElementById('returnSupSearchInput').value = sup;
            document.getElementById('returnSupListBox').style.display = 'none';
            loadReturnGoodsBySupplier(sup);
        };
        box.appendChild(div);
    });
}

function loadReturnGoodsBySupplier(supplier) {
    currReturnGoodsList = allGoods.filter(g => g.supplier === supplier);
    document.getElementById('returnGoodsSearchInput').value = '';
    document.getElementById('returnCurGoodsId').value = '';
    document.getElementById('returnSpec').value = '';
    document.getElementById('returnSettleType').value = '';
    document.getElementById('returnSalePrice').value = '';
    document.getElementById('returnInPrice').value = '';
    document.getElementById('returnBatchRemain').value = '';
}

// ========== 商品下拉 ==========
function showReturnGoodsList() {
    renderReturnGoodsSelectList(currReturnGoodsList);
    document.getElementById('returnGoodsListBox').style.display = 'block';
}

function filterReturnGoodsList() {
    let kw = document.getElementById('returnGoodsSearchInput').value.toLowerCase();
    let res = currReturnGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderReturnGoodsSelectList(res);
    document.getElementById('returnGoodsListBox').style.display = 'block';
}

function renderReturnGoodsSelectList(list) {
    let box = document.getElementById('returnGoodsListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div style="padding:8px;color:#999;">无匹配数据</div>';
        return;
    }
    list.forEach(goods => {
        let div = document.createElement('div');
        div.innerText = goods.name;
        div.style.padding = '6px 10px';
        div.style.cursor = 'pointer';
        div.onmouseover = function() { this.style.background = '#e5efff'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function() {
            selectReturnGoods(goods);
            document.getElementById('returnGoodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

function selectReturnGoods(goods) {
    document.getElementById('returnGoodsSearchInput').value = goods.name;
    document.getElementById('returnCurGoodsId').value = goods.id;
    document.getElementById('returnSpec').value = goods.spec || '';
    document.getElementById('returnSettleType').value = goods.channel || '';
    document.getElementById('returnSalePrice').value = formatMoney(goods.sale_price);
    
    // 获取该商品当前总库存
    let totalStock = getTotalStockNum(goods.supplier, goods.name);
    document.getElementById('returnBatchRemain').value = totalStock;
    
    // 获取入库单价（取最早批次的入库单价）
    let batchList = getStockBatchList(goods.supplier, goods.name);
    let priceInput = document.getElementById('returnInPrice');
    if (batchList && batchList.length > 0 && batchList[0].inRecords && batchList[0].inRecords.length > 0) {
        priceInput.value = formatMoney(batchList[0].inRecords[0].in_price || 0);
    } else {
        priceInput.value = '￥0.00';
    }
}

// ========== 弹窗操作 ==========
function openReturnAddForm() {
    document.getElementById('returnFormTitle').innerText = '添加退货单据';
    document.getElementById('returnEditId').value = '';
    document.getElementById('returnSupSearchInput').value = '';
    document.getElementById('returnGoodsSearchInput').value = '';
    document.getElementById('returnCurGoodsId').value = '';
    document.getElementById('returnSpec').value = '';
    document.getElementById('returnSettleType').value = '';
    document.getElementById('returnSalePrice').value = '';
    document.getElementById('returnInPrice').value = '';
    document.getElementById('returnNum').value = '';
    document.getElementById('returnBatchRemain').value = '';
    document.getElementById('returnReason').value = '';
    document.getElementById('returnRecordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('returnModal').style.display = 'block';
}

async function openReturnEditForm(id) {
    let item = allReturnGoods.find(x => x.id === id);
    if (!item) return;
    
    document.getElementById('returnFormTitle').innerText = '编辑退货单据';
    document.getElementById('returnEditId').value = id;
    document.getElementById('returnSupSearchInput').value = item.supplier;
    loadReturnGoodsBySupplier(item.supplier);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    document.getElementById('returnGoodsSearchInput').value = item.goods_name;
    document.getElementById('returnCurGoodsId').value = item.in_record_id;
    document.getElementById('returnSpec').value = item.spec || '';
    document.getElementById('returnSettleType').value = item.settle_type || '';
    document.getElementById('returnSalePrice').value = formatMoney(item.sale_price);
    document.getElementById('returnInPrice').value = formatMoney(item.in_price);
    document.getElementById('returnNum').value = item.return_num;
    document.getElementById('returnReason').value = item.return_reason || '';
    document.getElementById('returnRecordDate').value = item.record_date || '';
    
    let totalStock = getTotalStockNum(item.supplier, item.goods_name);
    document.getElementById('returnBatchRemain').value = totalStock;
    
    document.getElementById('returnModal').style.display = 'block';
}

function closeReturnForm() {
    document.getElementById('returnModal').style.display = 'none';
}

// ========== 检查退货数量 ==========
function checkReturnNum() {
    let num = +document.getElementById('returnNum').value || 0;
    let remain = +document.getElementById('returnBatchRemain').value || 0;
    if (num > remain) {
        document.getElementById('returnNum').value = remain;
        showMsg(`退货数量不能大于当前库存（${remain}）`);
    }
}

// ========== 提交退货 ==========
async function submitReturnGoods() {
    let editId = document.getElementById('returnEditId').value;
    let supplier = document.getElementById('returnSupSearchInput').value.trim();
    let goodsName = document.getElementById('returnGoodsSearchInput').value.trim();
    let goodsId = document.getElementById('returnCurGoodsId').value;
    let spec = document.getElementById('returnSpec').value;
    let settleType = document.getElementById('returnSettleType').value;
    let salePrice = parseFloat(document.getElementById('returnSalePrice').value.replace('￥', ''));
    let inPrice = parseFloat(document.getElementById('returnInPrice').value.replace('￥', ''));
    let returnNum = +document.getElementById('returnNum').value || 0;
    let recordDate = document.getElementById('returnRecordDate').value;
    let returnReason = document.getElementById('returnReason').value.trim();

    if (!supplier) return showMsg('请选择供应商');
    if (!goodsName || !goodsId) return showMsg('请选择商品');
    if (returnNum < 1) return showMsg('退货数量必须大于0');
    if (!recordDate) return showMsg('请选择录入日期');

    // 检查库存
    let totalStock = getTotalStockNum(supplier, goodsName);
    if (returnNum > totalStock) {
        return showMsg(`退货数量不能大于当前库存（${totalStock}）`);
    }

    let returnAmount = inPrice * returnNum;
    let saleAmount = salePrice * returnNum;

    let postData = {
        supplier: supplier,
        goods_name: goodsName,
        spec: spec || null,
        settle_type: settleType,
        in_record_id: parseInt(goodsId),
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
            // 刷新库存缓存
            refreshAllStockCache(allStockIn, allStockOut);
            // 刷新库存查看
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
    let ids = [];
    document.querySelectorAll('.return-item-checkbox').forEach(cb => {
        if (cb.checked) ids.push(cb.value);
    });
    if (ids.length === 0) return showMsg('请选择数据');
    if (!confirm(`确定删除${ids.length}条？`)) return;
    for (let id of ids) {
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
    let all = document.getElementById('returnSelectAll').checked;
    document.querySelectorAll('.return-item-checkbox').forEach(cb => cb.checked = all);
}

// ========== 导出Excel ==========
function exportReturnExcel() {
    if (filteredReturnGoods.length === 0) {
        showMsg("暂无数据可导出");
        return;
    }
    let header = ["供应商", "商品名称", "规格", "结算方式", "退货单价", "退货数量", "退货金额", "销售单价", "销售金额", "录入日期", "退货原因"];
    let expData = filteredReturnGoods.map(item => [
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
    let ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    let wb = XLSX.utils.book_new();
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
    let file = document.getElementById('returnFileInput').files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, { type: 'array' });
            let sheet = workbook.Sheets[workbook.SheetNames[0]];
            let rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (rows.length < 2) {
                showMsg('模板无有效数据！');
                return;
            }
            let failCount = 0, successCount = 0;
            for (let i = 1; i < rows.length; i++) {
                let row = rows[i];
                let supplier = String(row[0] || '').trim();
                let goodsName = String(row[1] || '').trim();
                let spec = String(row[2] || '').trim();
                let settleType = String(row[3] || '').trim();
                let returnNum = parseInt(row[4]) || 0;
                let recordDate = row[5] || '';
                let returnReason = String(row[6] || '').trim();
                
                if (!supplier || !goodsName || returnNum < 1 || !recordDate) { failCount++; continue; }
                
                let goods = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
                if (!goods) { failCount++; continue; }
                
                let totalStock = getTotalStockNum(supplier, goodsName);
                if (returnNum > totalStock) { failCount++; continue; }
                
                let batchList = getStockBatchList(supplier, goodsName);
                let inPrice = 0;
                if (batchList && batchList.length > 0 && batchList[0].inRecords && batchList[0].inRecords.length > 0) {
                    inPrice = batchList[0].inRecords[0].in_price || 0;
                }
                let salePrice = goods.sale_price || 0;
                
                let postData = {
                    supplier, goods_name: goodsName, spec: spec || null, 
                    settle_type: settleType || goods.channel || '',
                    in_record_id: goods.id, in_price: inPrice, return_num: returnNum,
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
    if (!e.target.closest('#returnSupSearchInput') && !e.target.closest('#returnSupListBox')) {
        const box1 = document.getElementById('returnSupListBox');
        if (box1) box1.style.display = 'none';
    }
    if (!e.target.closest('#returnGoodsSearchInput') && !e.target.closest('#returnGoodsListBox')) {
        const box2 = document.getElementById('returnGoodsListBox');
        if (box2) box2.style.display = 'none';
    }
});

// ========== 页面加载时自动加载 ==========
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('returnGoodsList')) {
        loadReturnGoods();
    }
});