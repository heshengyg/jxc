// ===================== 退货管理模块 =====================
// 全局变量
let returnCurrentPage = 1;
// ========== 退货筛选数据 ==========
let returnFilterData = {
    supplier: [],
    goodsName: [],
    settleType: ['线上', '线下']  // 结算方式固定
};
let returnPageSize = 10;
let returnTotalPages = 1;
let returnSortField = '';
let returnSortAsc = true;

// ========== 打印相关全局变量 ==========
let selectedReturnIds = new Set();
let skipReturnAllChange = false;
let returnPrintData = [];

// ========== 加载/刷新 ==========
function refreshReturnGoods() {
    loadReturnGoods();
}

// ========== 退货筛选下拉 ==========
function initReturnFilterData() {
    if (!allReturnGoods || allReturnGoods.length === 0) return;
    returnFilterData.supplier = [...new Set(allReturnGoods.map(item => item.supplier).filter(s => s))].sort();
    returnFilterData.goodsName = [...new Set(allReturnGoods.map(item => item.goods_name).filter(n => n))].sort();
}

function showReturnFilterList(type) {
    const listId = `returnFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    const inputId = `returnFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderReturnFilterList(type, kw);
    box.style.display = 'block';
}

function filterReturnFilterList(type) {
    const inputId = `returnFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderReturnFilterList(type, kw);
    const listId = `returnFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (box) box.style.display = 'block';
}

function renderReturnFilterList(type, keyword = '') {
    const listId = `returnFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    let data = returnFilterData[type] || [];
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
            const inputId = `returnFilter${capitalize(type)}Input`;
            document.getElementById(inputId).value = opt;
            box.style.display = 'none';
            filterReturnGoods();
        };
        box.appendChild(div);
    });
}

function resetReturnSearch() {
    document.getElementById('returnFilterSupplierInput').value = '';
    document.getElementById('returnFilterGoodsNameInput').value = '';
    document.getElementById('returnFilterSettleTypeInput').value = '';
    document.querySelectorAll('[id^="returnFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterReturnGoods();
}

// ========== 退货实时搜索（输入即搜索） ==========
function onReturnFilterInput() {
    filterReturnGoods();
    const supplierInput = document.getElementById('returnFilterSupplierInput');
    const goodsInput = document.getElementById('returnFilterGoodsNameInput');
    const settleInput = document.getElementById('returnFilterSettleTypeInput');
    
    if (document.activeElement === supplierInput) {
        renderReturnFilterList('supplier', supplierInput.value.trim());
        const list = document.getElementById('returnFilterSupplierList');
        if (list) list.style.display = 'block';
    } else if (document.activeElement === goodsInput) {
        renderReturnFilterList('goodsName', goodsInput.value.trim());
        const list = document.getElementById('returnFilterGoodsNameList');
        if (list) list.style.display = 'block';
    } else if (document.activeElement === settleInput) {
        renderReturnFilterList('settleType', settleInput.value.trim());
        const list = document.getElementById('returnFilterSettleTypeList');
        if (list) list.style.display = 'block';
    }
}

async function loadReturnGoods() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        const data = await res.json();
        allReturnGoods = data;
        initReturnFilterData();
        const totalEl = document.getElementById('returnTotalCount');
        if (totalEl) totalEl.textContent = data.length;
        returnCurrentPage = 1;
        filterReturnGoods();
        setTimeout(function() {
            try {
                initReturnPrintControls();
            } catch (e) {
                console.warn('打印控件初始化失败:', e);
            }
        }, 200);
    } catch (e) {
        showMsg('加载退货记录失败：' + e.message);
    }
}

// ========== 初始化打印控件 ==========
function initReturnPrintControls() {
    try {
        const searchBar = document.querySelector('#returnGoods .search-bar');
        if (!searchBar) return;
        if (document.getElementById('returnPrintBtn')) return;

        const printBtn = document.createElement('button');
        printBtn.id = 'returnPrintBtn';
        printBtn.className = 'btn btn-success';
        printBtn.innerHTML = '🖨️ 打印预览';
        printBtn.onclick = previewReturnPrint;
        searchBar.appendChild(printBtn);

        const thead = document.querySelector('#returnGoodsList thead');
        if (!thead) return;
        const firstTh = thead.querySelector('tr th:first-child');
        if (!firstTh) return;
        if (firstTh.querySelector('input[type="checkbox"]')) return;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'returnPrintAllCheck';
        checkbox.style.marginRight = '5px';
        checkbox.onchange = function () {
            if (skipReturnAllChange) return;
            const checked = this.checked;
            document.querySelectorAll('.return-item-checkbox').forEach(cb => cb.checked = checked);
            selectedReturnIds.clear();
            if (checked) {
                filteredReturnGoods.forEach(item => selectedReturnIds.add(item.id));
            }
            skipReturnAllChange = false;
        };
        const textNode = firstTh.childNodes[0];
        if (textNode) {
            firstTh.insertBefore(checkbox, textNode);
        } else {
            firstTh.prepend(checkbox);
        }
    } catch (e) {
        console.warn('初始化打印控件出错:', e);
    }
}

// ========== 搜索/筛选 ==========
function filterReturnGoods() {
    const supplier = document.getElementById('returnFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('returnFilterGoodsNameInput')?.value.trim() || '';
    const settleType = document.getElementById('returnFilterSettleTypeInput')?.value.trim() || '';

    if (!allReturnGoods || !Array.isArray(allReturnGoods)) {
        filteredReturnGoods = [];
    } else {
        filteredReturnGoods = allReturnGoods.filter(item => {
            let match = true;
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.goods_name || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (settleType && !(item.settle_type || '').toLowerCase().includes(settleType.toLowerCase())) match = false;
            return match;
        });
    }

    const searchEl = document.getElementById('returnSearchCount');
    if (searchEl) searchEl.textContent = filteredReturnGoods.length;
    returnCurrentPage = 1;
    renderReturnPagination();
    renderReturnList();
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
        const isChecked = selectedReturnIds.has(item.id);
        const html = `
            <tr>
                <td><input type="checkbox" class="return-item-checkbox" value="${item.id}" ${isChecked ? 'checked' : ''} data-id="${item.id}"></td>
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

    // ========== 底部汇总 ==========
    const groupMap = {};
    filteredReturnGoods.forEach(item => {
        if (!groupMap[item.supplier]) {
            groupMap[item.supplier] = { totalNum: 0, totalReturnAmount: 0, totalSaleAmount: 0 };
        }
        groupMap[item.supplier].totalNum += Number(item.return_num);
        groupMap[item.supplier].totalReturnAmount += Number(item.return_amount);
        groupMap[item.supplier].totalSaleAmount += Number(item.sale_amount);
    });

    let summaryHtml = '';
    Object.keys(groupMap).forEach(supplier => {
        const data = groupMap[supplier];
        summaryHtml += `
            <tr style="background:#f5f5f5;font-weight:bold;">
                <td colspan="2">${supplier} 汇总</td>
                <td colspan="5">退货总数量：${data.totalNum}</td>
                <td colspan="2">退货总金额：${data.totalReturnAmount.toFixed(2)}</td>
                <td colspan="4">销售总金额：${data.totalSaleAmount.toFixed(2)}</td>
            </tr>
        `;
    });
    if (summaryHtml) {
        tb.innerHTML += summaryHtml;
    }

    // ===== 行复选框事件绑定（直接操作，不通过外部函数） =====
document.querySelectorAll('.return-item-checkbox').forEach(cb => {
    cb.onchange = function() {
        const id = Number(this.dataset.id);
        if (this.checked) {
            selectedReturnIds.add(id);
        } else {
            selectedReturnIds.delete(id);
        }
        // 直接更新全选复选框状态
        const allCheckbox = document.getElementById('returnPrintAllCheck');
        if (allCheckbox) {
            const total = filteredReturnGoods.length;
            const allChecked = (selectedReturnIds.size === total && total > 0);
            // 不使用 skipReturnAllChange，直接赋值
            allCheckbox.checked = allChecked;
        }
    };
});

// ===== 渲染完成后强制同步全选复选框状态 =====
const allCheckbox = document.getElementById('returnPrintAllCheck');
if (allCheckbox) {
    const total = filteredReturnGoods.length;
    const allChecked = (selectedReturnIds.size === total && total > 0);
    allCheckbox.checked = allChecked;
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
function resetReturnModal() {
    try {
        const supplierSearch = document.getElementById('returnSupplierSearch');
        if (supplierSearch) supplierSearch.value = '';
        const goodsSearch = document.getElementById('returnGoodsSearch');
        if (goodsSearch) goodsSearch.value = '';
        const specSearch = document.getElementById('returnSpecSearch');
        if (specSearch) specSearch.value = '';
        returnSelectedSupplier = '';
        returnSelectedGoods = '';
        returnSelectedSpec = '';
        selectedBatchInRecordId = null;
        selectedBatchData = null;
        const curGoodsId = document.getElementById('returnCurGoodsId');
        if (curGoodsId) curGoodsId.value = '';
        const specInput = document.getElementById('returnSpec');
        if (specInput) specInput.value = '';
        const settleType = document.getElementById('returnSettleType');
        if (settleType) settleType.value = '';
        const salePrice = document.getElementById('returnSalePrice');
        if (salePrice) salePrice.value = '';
        const inPrice = document.getElementById('returnInPrice');
        if (inPrice) inPrice.value = '';
        const returnNum = document.getElementById('returnNum');
        if (returnNum) returnNum.value = '';
        const batchRemain = document.getElementById('returnBatchRemain');
        if (batchRemain) batchRemain.value = '';
        const remainDisplay = document.getElementById('returnBatchRemainDisplay');
        if (remainDisplay) remainDisplay.textContent = '0';
        const batchInfo = document.getElementById('returnSelectedBatchInfo');
        if (batchInfo) batchInfo.innerHTML = '<div style="padding:12px;text-align:center;color:#999;">请选择批次</div>';
        const batchContainer = document.getElementById('returnBatchListContainer');
        if (batchContainer) batchContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">请选择供应商或商品</div>';
        const supplierBox = document.getElementById('returnSupplierListBox');
        if (supplierBox) supplierBox.style.display = 'none';
        const goodsBox = document.getElementById('returnGoodsListBox');
        if (goodsBox) goodsBox.style.display = 'none';
        const specBox = document.getElementById('returnSpecListBox');
        if (specBox) specBox.style.display = 'none';
    } catch (e) {
        console.error('重置弹窗出错:', e);
    }
}
window.resetReturnModal = resetReturnModal;

// ========== 供应商搜索下拉 ==========
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
            document.getElementById('returnGoodsSearch').value = '';
            document.getElementById('returnSpecSearch').value = '';
            returnSelectedGoods = '';
            returnSelectedSpec = '';
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

// ========== 商品搜索下拉 ==========
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
            returnSelectedSpec = '';
            document.getElementById('returnSpecSearch').value = '';
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

// ========== 规格搜索下拉 ==========
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
    const specInput = document.getElementById('returnSpecSearch').value.trim();
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

// ========== 切换批次选择 ==========
function toggleReturnBatch(index) {
    const allBatches = window._returnBatchListData || [];
    if (index >= allBatches.length) {
        alert('批次数据异常');
        return;
    }
    const batch = allBatches[index];
    if (!batch || !batch.inRecords || batch.inRecords.length === 0) {
        alert('该批次数据异常');
        return;
    }
    const inRecord = batch.inRecords[0];
    if (selectedBatchInRecordId === inRecord.id) {
        selectedBatchInRecordId = null;
        selectedBatchData = null;
        document.getElementById('returnSelectedBatchInfo').innerHTML = '<div style="padding:12px;text-align:center;color:#999;">请选择批次</div>';
        document.getElementById('returnInPrice').value = '';
        document.getElementById('returnBatchRemain').value = '';
        document.getElementById('returnBatchRemainDisplay').textContent = '0';
        document.getElementById('returnNum').value = '';
        document.getElementById('returnNum').max = 0;
        updateReturnBatchList();
        return;
    }
    selectedBatchInRecordId = inRecord.id;
    selectedBatchData = {
        inRecordId: inRecord.id,
        inPrice: inRecord.in_price || 0,
        batchRemain: batch.batchRemain,
        produceDate: batch.produce_date || '',
        expireDate: batch.expire_date || ''
    };
    document.getElementById('returnSupplierSearch').value = batch.supplier;
    document.getElementById('returnCurGoodsId').value = inRecord.id;
    document.getElementById('returnSpec').value = batch.spec || '';
    document.getElementById('returnSettleType').value = batch.settleType || '';
    const goodsInfo = allGoods.find(g => g.supplier === batch.supplier && g.name === batch.goodsName);
    if (goodsInfo) {
        let unitCode = "day";
        if (goodsInfo.shelf_life_unit === "年") unitCode = "year";
        if (goodsInfo.shelf_life_unit === "个月") unitCode = "month";
        const expireResult = calculateExpireDays(goodsInfo.shelf_life_num, goodsInfo.shelf_life_unit);
        let warnDay = 0;
        if (typeof expireResult === 'string' && expireResult.includes('天')) {
            warnDay = parseInt(expireResult) || 0;
        } else if (typeof expireResult === 'number') {
            warnDay = expireResult;
        } else {
            warnDay = Number(expireResult) || 0;
        }
        const bzResult = calcBzStatus(
            batch.produce_date || '',
            batch.expire_date || '',
            goodsInfo.shelf_life_num || 0,
            unitCode,
            warnDay
        );
        const bzStatus = bzResult.statusText || '正常';
        (async function() {
            let price = await getSalePriceByBzStatus(goodsInfo.id, bzStatus, goodsInfo.sale_price);
            document.getElementById('returnSalePrice').value = formatMoney(price);
            window._returnSelectedPrice = price;
        })();
    } else {
        document.getElementById('returnSalePrice').value = '￥0.00';
        window._returnSelectedPrice = 0;
    }
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
    updateReturnBatchList();
    console.log('✅ 已选择批次:', selectedBatchInRecordId, selectedBatchData);
}

// ========== 打开退货弹窗 ==========
function openReturnAddForm() {
    try {
        resetReturnModal();
        const title = document.getElementById('returnFormTitle');
        if (title) title.innerText = '添加退货单据';
        const editId = document.getElementById('returnEditId');
        if (editId) editId.value = '';
        const recordDate = document.getElementById('returnRecordDate');
        if (recordDate) recordDate.value = new Date().toISOString().split('T')[0];
        const modal = document.getElementById('returnModal');
        if (modal) modal.style.display = 'block';
    } catch (e) {
        console.error('打开退货弹窗失败:', e);
        showMsg('打开退货弹窗失败，请刷新页面重试');
    }
}

function closeReturnForm() {
    resetReturnModal();
    document.getElementById('returnModal').style.display = 'none';
}

// ========== 提交退货 ==========
async function submitReturnGoods() {
    let supplier = returnSelectedSupplier || document.getElementById('returnSupplierSearch').value.trim();
    let goodsName = returnSelectedGoods || document.getElementById('returnGoodsSearch').value.trim();
    if (!goodsName && selectedBatchInRecordId) {
        const allBatches = window._returnBatchListData || [];
        for (const batch of allBatches) {
            if (batch.inRecords && batch.inRecords[0] && batch.inRecords[0].id === selectedBatchInRecordId) {
                goodsName = batch.goodsName;
                if (!supplier) {
                    supplier = batch.supplier;
                }
                break;
            }
        }
    }
    const goodsId = document.getElementById('returnCurGoodsId').value;
    const spec = document.getElementById('returnSpec').value;
    const settleType = document.getElementById('returnSettleType').value;
    const salePrice = window._returnSelectedPrice || parseFloat(document.getElementById('returnSalePrice').value.replace('￥', ''));
    const inPrice = selectedBatchData ? selectedBatchData.inPrice : 0;
    const returnNum = +document.getElementById('returnNum').value || 0;
    const recordDate = document.getElementById('returnRecordDate').value;
    const returnReason = document.getElementById('returnReason').value.trim();

    if (!supplier) return alert('请选择供应商');
    if (!goodsName || !goodsId) return alert('请选择商品');
    if (!selectedBatchInRecordId) {
        alert('请选择退货批次');
        return;
    }
    if (returnNum < 1) return alert('退货数量必须大于0');
    if (!recordDate) return alert('请选择录入日期');

    const batchList = getStockBatchList(supplier, goodsName);
    let targetBatch = null;
    for (const batch of batchList) {
        if (batch.inRecords && batch.inRecords.some(r => r.id === selectedBatchInRecordId)) {
            targetBatch = batch;
            break;
        }
    }
    if (!targetBatch) {
        alert('该批次已无库存或已被删除');
        return;
    }
    if (returnNum > targetBatch.batchRemain) {
    alert(`退货数量不能大于批次库存（${targetBatch.batchRemain}）`);
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

// ============================================================
// ===== 删除功能（仅管理员） =====
// ============================================================

async function deleteReturnGoods(id) {
    if (typeof isCurrentUserAdmin !== 'function' || !isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除退货记录');
        return;
    }
    if (!confirm('确定删除该退货记录？')) return;
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

async function batchDeleteReturnGoods() {
    if (typeof isCurrentUserAdmin !== 'function' || !isCurrentUserAdmin()) {
        showMsg('只有管理员可以批量删除退货记录');
        return;
    }
    const ids = [];
    document.querySelectorAll('.return-item-checkbox:checked').forEach(cb => ids.push(cb.value));
    if (ids.length === 0) return showMsg('请选择数据');
    if (!confirm(`确定删除${ids.length}条退货记录？`)) return;
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

function returnToggleSelectAll() {
    const all = document.getElementById('returnSelectAll')?.checked || false;
    document.querySelectorAll('.return-item-checkbox').forEach(cb => cb.checked = all);
    if (all) {
        filteredReturnGoods.forEach(item => selectedReturnIds.add(item.id));
    } else {
        selectedReturnIds.clear();
    }
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

// ============================================================
// ===== 打印预览功能 =====
// ============================================================
function previewReturnPrint() {
    if (selectedReturnIds.size === 0) {
        showMsg('请选择需要打印的退货记录');
        return;
    }

    const groupMap = {};
    filteredReturnGoods.forEach(row => {
        if (selectedReturnIds.has(row.id)) {
            if (!groupMap[row.supplier]) groupMap[row.supplier] = [];
            groupMap[row.supplier].push(row);
        }
    });

    if (Object.keys(groupMap).length === 0) {
        showMsg('请选择需要打印的退货记录');
        return;
    }

    const ROWS_PER_PAGE = 12;
    let allPagesHTML = '';
    const supplierNames = Object.keys(groupMap);

    const SIGNATURE_CONFIG = window.SIGNATURE_CONFIG || {
        storeKeeper: 'images/storeKeeper.png',
        business: 'images/business.png',
        finance: 'images/finance.png'
    };

    supplierNames.forEach(supplier => {
        const rows = groupMap[supplier];
        rows.sort((a, b) => (a.record_date || '').localeCompare(b.record_date || ''));

        const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
        let supTotalQty = 0, supTotalReturnAmount = 0;
        rows.forEach(r => {
            supTotalQty += Number(r.return_num);
            supTotalReturnAmount += Number(r.return_amount);
        });

        for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
            const chunk = rows.slice(i, i + ROWS_PER_PAGE);
            const pageNum = Math.floor(i / ROWS_PER_PAGE) + 1;
            const isLastPage = (pageNum === totalPages);

            let tableRows = '';
            chunk.forEach(row => {
                const price = Number(row.in_price) || 0;
                const qty = Number(row.return_num) || 0;
                const amount = Number(row.return_amount) || 0;
                const date = row.record_date ? row.record_date.replace(/-/g, '/') : '';
                tableRows += `
                    <tr>
                        <td>${date}</td>
                        <td>${supplier}</td>
                        <td>${row.goods_name || ''}</td>
                        <td>${row.spec || ''}</td>
                        <td>￥${price.toFixed(2)}</td>
                        <td>${qty}</td>
                        <td>￥${amount.toFixed(2)}</td>
                    </tr>
                `;
            });

            if (isLastPage) {
                tableRows += `
                    <tr class="total-row">
                        <td colspan="5" class="total-label" style="text-align:center;">${supplier} 汇总</td>
                        <td class="total-qty">${supTotalQty}</td>
                        <td class="total-amount">￥${supTotalReturnAmount.toFixed(2)}</td>
                    </tr>
                `;
            }

            const pageBreak = (i + ROWS_PER_PAGE >= rows.length && supplier === supplierNames[supplierNames.length - 1]) ? '' : 'page-break-after: always;';

            allPagesHTML += `
                <div class="page-block" style="${pageBreak}">
                    <div class="bill-title">商品退货单</div>
                    <div class="bill-header">
                        <span><span class="label">供应商：</span>${supplier}</span>
                        <span><span class="label">打印日期：</span>${new Date().toLocaleDateString('zh-CN')}</span>
                    </div>
                    <table class="goods-table">
                        <thead>
                            <tr>
                                <th>退货日期</th><th>供应商</th><th>商品名称</th><th>规格</th>
                                <th>退货单价</th><th>数量</th><th>退货金额</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="bill-footer">
                        <span>库管员签字：${SIGNATURE_CONFIG.storeKeeper ? `<img src="${SIGNATURE_CONFIG.storeKeeper}" style="height:30px;vertical-align:middle;">` : '___________'}</span>
                        <span>业务员签字：${SIGNATURE_CONFIG.business ? `<img src="${SIGNATURE_CONFIG.business}" style="height:30px;vertical-align:middle;">` : '___________'}</span>
                        <span>财务审核签字：${SIGNATURE_CONFIG.finance ? `<img src="${SIGNATURE_CONFIG.finance}" style="height:30px;vertical-align:middle;">` : '___________'}</span>
                        <span style="font-weight:normal;text-align:right;">第${pageNum}页/共${totalPages}页</span>
                    </div>
                </div>
            `;
        }
    });

    const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>退货单打印</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #fff;
            font-family: "SimSun", "宋体", serif;
        }
        @page {
            size: A5 landscape;
            margin: 1.6cm 1.1cm 1.2cm 1.0cm;
        }
        .print-container {
            width: 100%;
            height: 100%;
        }
        .page-block {
            width: 100%;
            height: 100%;
            position: relative;
            padding-bottom: 2.2cm;
            page-break-after: always;
            margin: 0;
            padding-left: 0;
            padding-right: 0;
        }
        .page-block:last-child {
            page-break-after: avoid;
        }
        .bill-title {
            text-align: center;
            font-size: 22pt;
            font-weight: bold;
            letter-spacing: 6px;
            margin: 0 0 4px 0;
            padding: 0;
        }
        .bill-header {
            display: flex;
            justify-content: space-between;
            font-size: 12pt;
            margin-bottom: 4px;
            padding: 0 1px;
        }
        .bill-header .label { font-weight: bold; }
        .goods-table {
    width: 100% !important;
    border-collapse: collapse;
    font-size: 11pt;
    table-layout: fixed;
    margin-bottom: 0;
}
.goods-table th, .goods-table td {
    border: 1px solid #000;
    padding: 4px 3px;
    text-align: center;
    font-size: 11pt;
    word-break: break-word;
    height: auto;
}
.goods-table th {
    border: 1px solid #000;  /* ✅ 已修改 */
    background: #f5f5f5;
    font-weight: bold;
    font-size: 12pt;
}
.goods-table .total-row td {
    border-top: 1px solid #000;  /* ✅ 已修改 */
    font-weight: bold;
    background: #fafafa;
    font-size: 12pt;
}
        .goods-table th:nth-child(1), .goods-table td:nth-child(1) { width: 14%; }
        .goods-table th:nth-child(2), .goods-table td:nth-child(2) { width: 14%; }
        .goods-table th:nth-child(3), .goods-table td:nth-child(3) { width: 22%; }
        .goods-table th:nth-child(4), .goods-table td:nth-child(4) { width: 14%; }
        .goods-table th:nth-child(5), .goods-table td:nth-child(5) { width: 12%; }
        .goods-table th:nth-child(6), .goods-table td:nth-child(6) { width: 10%; }
        .goods-table th:nth-child(7), .goods-table td:nth-child(7) { width: 14%; }
        .goods-table .total-row td {
            border-top: 1px solid #000;
            font-weight: bold;
            background: #fafafa;
            font-size: 12pt;
        }
        .goods-table .total-label {
            text-align: center;
            padding-right: 8px;
        }
        .bill-footer {
            position: absolute;
            bottom: 0.6cm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            font-size: 12pt;
            padding: 4px 4px 0 4px;
        }
        .bill-footer span {
            min-width: 80px;
        }
        .bill-footer span:last-child {
            min-width: 120px;
            text-align: right;
        }
        @media screen {
            .page-block {
                border: 1px dashed #ccc;
                padding: 12px 18px 2.2cm 18px;
                margin: 20px auto;
                max-width: 1100px;
                min-height: 600px;
                background: #fefefe;
                position: relative;
            }
            body { padding: 20px; background: #f0f2f5; }
            .print-container { max-width: 1100px; margin: 0 auto; }
            .bill-footer { position: absolute; bottom: 0.6cm; left: 18px; right: 18px; }
        }
        @media print {
            html, body, .print-container, .page-block {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                width: 100% !important;
                height: 100% !important;
            }
            .page-block {
                border: none !important;
                page-break-after: always;
                padding-bottom: 2.2cm !important;
            }
            .page-block:last-child { page-break-after: avoid; }
            .bill-title { margin-top: 0 !important; padding-top: 0 !important; }
            .goods-table { width: 100% !important; }
            .bill-footer { bottom: 0.6cm !important; }
            .goods-table td, .goods-table th { height: auto !important; }
        }
    </style>
    </head>
    <body>
        <div class="print-container">
            ${allPagesHTML}
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 300);
            };
            window.onafterprint = function() { window.close(); };
        <\/script>
    </body>
    </html>
    `;

    const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes,resizable=yes');
    if (!win) { showMsg('请允许弹出窗口'); return; }
    win.document.write(fullHTML);
    win.document.close();
    win.focus();
}

// ========== 页面加载时自动加载 ==========
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('returnGoodsList')) {
        loadReturnGoods();
    }
});

// ===== 全局点击关闭下拉列表（退货模块） =====
if (!window._returnClickOutsideBound) {
    window._returnClickOutsideBound = true;
    document.addEventListener('click', function(e) {
        const supInput = document.getElementById('returnSupplierSearch');
        const supList = document.getElementById('returnSupplierListBox');
        if (supList && supList.style.display === 'block') {
            if (supInput && !supInput.contains(e.target) && !supList.contains(e.target)) {
                supList.style.display = 'none';
            }
        }
        const goodsInput = document.getElementById('returnGoodsSearch');
        const goodsList = document.getElementById('returnGoodsListBox');
        if (goodsList && goodsList.style.display === 'block') {
            if (goodsInput && !goodsInput.contains(e.target) && !goodsList.contains(e.target)) {
                goodsList.style.display = 'none';
            }
        }
        const specInput = document.getElementById('returnSpecSearch');
        const specList = document.getElementById('returnSpecListBox');
        if (specList && specList.style.display === 'block') {
            if (specInput && !specInput.contains(e.target) && !specList.contains(e.target)) {
                specList.style.display = 'none';
            }
        }
    });
}

// ===== 全局点击关闭下拉列表（退货筛选） =====
document.addEventListener('click', function(e) {
    const listIds = [
        'returnFilterSupplierList',
        'returnFilterGoodsNameList',
        'returnFilterSettleTypeList'
    ];
    listIds.forEach(id => {
        const box = document.getElementById(id);
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${id.replace('List', 'Input')}`)) {
            box.style.display = 'none';
        }
    });
});

// 全局暴露退货模块所有函数
window.toggleReturnBatch = toggleReturnBatch;
window.refreshReturnGoods = refreshReturnGoods;
window.openReturnAddForm = openReturnAddForm;
window.closeReturnForm = closeReturnForm;
window.submitReturnGoods = submitReturnGoods;
window.deleteReturnGoods = deleteReturnGoods;
window.batchDeleteReturnGoods = batchDeleteReturnGoods;
window.previewReturnPrint = previewReturnPrint;
window.resetReturnModal = resetReturnModal;
window.exportReturnExcel = exportReturnExcel;
window.returnSortTable = returnSortTable;
window.clearReturnSort = clearReturnSort;
window.returnGoToPage = returnGoToPage;
window.returnPrevPage = returnPrevPage;
window.returnNextPage = returnNextPage;
window.changeReturnPageSize = changeReturnPageSize;
window.showReturnSupplierList = showReturnSupplierList;
window.filterReturnSupplierList = filterReturnSupplierList;
window.showReturnGoodsList = showReturnGoodsList;
window.filterReturnGoodsList = filterReturnGoodsList;
window.showReturnSpecList = showReturnSpecList;
window.filterReturnSpecList = filterReturnSpecList;
window.updateReturnBatchList = updateReturnBatchList;
window.resetReturnSearch = resetReturnSearch;
window.onReturnFilterInput = onReturnFilterInput;
window.showReturnFilterList = showReturnFilterList;
window.filterReturnFilterList = filterReturnFilterList;
window.renderReturnFilterList = renderReturnFilterList;