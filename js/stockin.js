// ===================== 入库模块 - 终极速度优化版（原有所有业务逻辑100%保留） =====================
// 全局变量：页面初始化时静默预加载出库数据，彻底消除切换页面阻塞
let allStockOutReadyPromise;

// ========== 入库筛选数据 ==========
let inFilterData = {
    supplier: [],
    goodsName: [],
    settleType: ['线上', '线下']  // 结算方式固定
};

// 页面全局初始化：脚本加载时就后台预拉取出库数据，不用等点击入库按钮
(function initPreLoadOut() {
    allStockOutReadyPromise = (async function () {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            });
            if (res.ok) {
                allStockOut = await res.json();
            }
        } catch (err) {
            console.warn("全局预加载出库数据失败，不影响基础功能", err);
        }
    })();
})();

/**
 * 校验：后端ID比对（RPC/接口查询出库表，移除前端数组遍历）
 * @param {number|string} inId
 * @returns {Promise<boolean>}
 */
async function checkInUsedByOut(inId) {
    if (!inId) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?inRecordId=eq.${inId}`, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const list = await res.json();
        return list.length > 0;
    } catch (e) {
        console.error("出库校验异常", e);
        return false;
    }
}

/**
 * 校验：是否存在退货记录
 * @param {number|string} inId
 * @returns {Promise<boolean>}
 */
async function checkInUsedByReturn(inId) {
    if (!inId) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?in_record_id=eq.${inId}`, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const list = await res.json();
        return list.length > 0;
    } catch (e) {
        console.error("退货校验异常", e);
        return false;
    }
}

/**
 * 校验：是否存在出库或退货记录（合并判断）
 * @param {number|string} inId
 * @returns {Promise<boolean>}
 */
async function checkInUsed(inId) {
    const outUsed = await checkInUsedByOut(inId);
    const returnUsed = await checkInUsedByReturn(inId);
    return outUsed || returnUsed;
}

// 刷新入库列表
async function refreshStockIn(){
    await loadStockIn();
}

// ========== 入库筛选下拉 ==========
function initInFilterData() {
    if (!allStockIn || allStockIn.length === 0) return;
    inFilterData.supplier = [...new Set(allStockIn.map(item => item.supplier).filter(s => s))].sort();
    inFilterData.goodsName = [...new Set(allStockIn.map(item => item.goodsName).filter(n => n))].sort();
}

function showInFilterList(type) {
    const listId = `inFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    // ✅ 获取当前输入框的值作为关键词
    const inputId = `inFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderInFilterList(type, kw);
    box.style.display = 'block';
}
function filterInFilterList(type) {
    const inputId = `inFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderInFilterList(type, kw);
    const listId = `inFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (box) box.style.display = 'block';
}

function renderInFilterList(type, keyword = '') {
    const listId = `inFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    let data = inFilterData[type] || [];
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
            const inputId = `inFilter${capitalize(type)}Input`;
            document.getElementById(inputId).value = opt;
            box.style.display = 'none';
            filterStockIn();
        };
        box.appendChild(div);
    });
}

function resetInSearch() {
    document.getElementById('inFilterSupplierInput').value = '';
    document.getElementById('inFilterGoodsNameInput').value = '';
    document.getElementById('inFilterSettleTypeInput').value = '';
    // 关闭所有下拉
    document.querySelectorAll('[id^="inFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterStockIn();
}

// ========== 入库实时搜索（输入即搜索） ==========
function onInFilterInput() {
    // 1. 实时筛选列表
    filterStockIn();
    
    // 2. 实时更新下拉列表
    // 判断当前哪个输入框有焦点或内容，刷新对应的下拉
    const supplierInput = document.getElementById('inFilterSupplierInput');
    const goodsInput = document.getElementById('inFilterGoodsNameInput');
    const settleInput = document.getElementById('inFilterSettleTypeInput');
    
    if (document.activeElement === supplierInput) {
        renderInFilterList('supplier', supplierInput.value.trim());
        document.getElementById('inFilterSupplierList').style.display = 'block';
    } else if (document.activeElement === goodsInput) {
        renderInFilterList('goodsName', goodsInput.value.trim());
        document.getElementById('inFilterGoodsNameList').style.display = 'block';
    } else if (document.activeElement === settleInput) {
        renderInFilterList('settleType', settleInput.value.trim());
        document.getElementById('inFilterSettleTypeList').style.display = 'block';
    }
}
// ========= 预加载兜底：等待全局初始化的出库请求完成，不再重复发起网络请求 =========
async function preLoadStockOutData() {
    // 直接等待页面初始化时已经发起的全局请求，不会新增任何网络耗时
    await allStockOutReadyPromise;
}

// 供应商下拉
function showSupList(){
    currSupplierList = [...new Set(allGoods.map(item=>item.supplier).filter(s=>s))];
    renderSupplierList(currSupplierList);
    document.getElementById('supListBox').style.display = 'block';
}
function filterSupplierList(){
    let kw = document.getElementById('supSearchInput').value.toLowerCase();
    let res = currSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderSupplierList(res);
    document.getElementById('supListBox').style.display = 'block';
}
function renderSupplierList(list){
    let box = document.getElementById('supListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(sup=>{
        let div = document.createElement('div');
        div.innerText = sup;
        div.onclick = function(){
            document.getElementById('supSearchInput').value = sup;
            document.getElementById('supListBox').style.display = 'none';
            loadGoodsBySupplier(sup);
        };
        box.appendChild(div);
    });
}
function loadGoodsBySupplier(supplier){
    currGoodsList = allGoods.filter(g => g.supplier === supplier);
    document.getElementById('goodsSearchInput').value = '';
    document.getElementById('curSelectGoodsId').value = '';
    document.getElementById('inSpec').value = '';
    document.getElementById('inSettleType').value = '';
    document.getElementById('inSalePrice').value = '';
    document.getElementById('inPrice').value = '';
    document.getElementById('inPrice').disabled = false;
    // ✅ 隐藏入库单价提醒
    hideInPriceReminder();
}

// 商品下拉
function showGoodsList(){
    renderGoodsSelectList(currGoodsList);
    document.getElementById('goodsListBox').style.display = 'block';
}
function filterGoodsList(){
    let kw = document.getElementById('goodsSearchInput').value.toLowerCase();
    let res = currGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderGoodsSelectList(res);
    document.getElementById('goodsListBox').style.display = 'block';
}
function renderGoodsSelectList(list){
    let box = document.getElementById('goodsListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(goods=>{
        let div = document.createElement('div');
        div.innerText = goods.name;
        div.onclick = function(){
            selectInGoods(goods);
            document.getElementById('goodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}
function selectInGoods(goods){
    document.getElementById('goodsSearchInput').value = goods.name;
    document.getElementById('curSelectGoodsId').value = goods.id;
    document.getElementById('inSpec').value = goods.spec || '';
    document.getElementById('inSettleType').value = goods.channel || '';
    // ✅ 先显示正常价，等用户选日期后再匹配（不强制显示价格）
    document.getElementById('inSalePrice').value = formatMoney(goods.sale_price);
    const salePriceInput = document.getElementById('inSalePrice');
    salePriceInput.placeholder = '';
    salePriceInput.style.color = '';
    let priceInput = document.getElementById('inPrice');
    if(goods.channel === '线上'){
        priceInput.disabled = true;
        priceInput.value = '';
        // ✅ 隐藏提醒
        hideInPriceReminder();
    }else{
        priceInput.disabled = false;
        // ✅ 自动加载最近入库单价并显示提醒
        loadLastInPriceAndRemind(goods);
    }
    // ✅ 触发日期变化事件，根据已有日期匹配价格
    updateInPriceByDate();
}
// 日期互斥
function lockExpireDate(){
    let p = document.getElementById('inProduceDate').value;
    if(p) {
        document.getElementById('inExpireDate').value = '';
        updateInPriceByDate(); // ✅ 新增
    }
}
function lockProduceDate(){
    let e = document.getElementById('inExpireDate').value;
    if(e) {
        document.getElementById('inProduceDate').value = '';
        updateInPriceByDate(); // ✅ 新增
    }
}

// ========== 新增：根据日期更新销售价 ==========
// ========== 新增：根据日期更新销售价 ==========
async function updateInPriceByDate() {
    const goodsId = document.getElementById('curSelectGoodsId').value;
    const produceDate = document.getElementById('inProduceDate').value;
    const expireDate = document.getElementById('inExpireDate').value;
    
    if (!goodsId) return;
    
    const goods = allGoods.find(g => g.id == goodsId);
    if (!goods) return;
    
    if (produceDate || expireDate) {
        // 计算保质期天数对应的临期天数
        let unitCode = "day";
        if (goods.shelf_life_unit === "年") unitCode = "year";
        if (goods.shelf_life_unit === "个月") unitCode = "month";
        
        // 获取临期天数
        const expireResult = calculateExpireDays(goods.shelf_life_num, goods.shelf_life_unit);
        let warnDay = 0;
        if (typeof expireResult === 'string' && expireResult.includes('天')) {
            warnDay = parseInt(expireResult) || 0;
        } else if (typeof expireResult === 'number') {
            warnDay = expireResult;
        } else {
            warnDay = Number(expireResult) || 0;
        }
        
        // 调用统一的计算函数
        const bzResult = calcBzStatus(
            produceDate,
            expireDate,
            goods.shelf_life_num || 0,
            unitCode,
            warnDay
        );
        const bzStatus = bzResult.statusText || '正常';
        
        // ✅ 入库时：获取价格，如果为 null 则显示为空（不阻止入库）
        const price = await getSalePriceByBzStatus(goodsId, bzStatus, goods.sale_price);
        if (price === null || price === undefined) {
            // 价格未录入，显示为空
            document.getElementById('inSalePrice').value = '';
            // 可以添加一个视觉提示，但不阻止操作
            const salePriceInput = document.getElementById('inSalePrice');
            salePriceInput.placeholder = '价格未录入';
            salePriceInput.style.color = '#ff6b6b';
        } else {
            document.getElementById('inSalePrice').value = formatMoney(price);
            const salePriceInput = document.getElementById('inSalePrice');
            salePriceInput.placeholder = '';
            salePriceInput.style.color = '';
        }
    } else {
        // 没有日期，显示正常的 sale_price
        document.getElementById('inSalePrice').value = formatMoney(goods.sale_price);
        const salePriceInput = document.getElementById('inSalePrice');
        salePriceInput.placeholder = '';
        salePriceInput.style.color = '';
    }
}

// ========== 新增：绑定日期事件 ==========
function bindInDateEvents() {
    const produceInput = document.getElementById('inProduceDate');
    const expireInput = document.getElementById('inExpireDate');
    if (produceInput) {
        produceInput.addEventListener('change', updateInPriceByDate);
    }
    if (expireInput) {
        expireInput.addEventListener('change', updateInPriceByDate);
    }
}

// ============================================================
// ========== 入库单价自动填充与提醒功能 ==========
// ============================================================

/**
 * 获取商品最近一次入库单价（通用）
 */
async function getLastInPrice(supplier, goodsName, spec) {
    try {
        const encodedSupplier = encodeURIComponent(supplier);
        const encodedGoodsName = encodeURIComponent(goodsName);
        const encodedSpec = encodeURIComponent(spec || '');
        
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}&spec=eq.${encodedSpec}&order=record_date.desc&limit=1`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const data = await res.json();
        if (data && data.length > 0 && data[0].in_price) {
            return {
                price: data[0].in_price,
                recordDate: data[0].record_date,
                inNum: data[0].in_num
            };
        }
        return null;
    } catch (e) {
        console.warn('获取最近入库单价失败:', e);
        return null;
    }
}

/**
 * 获取最近入库单价（排除自身ID，用于编辑时）
 */
async function getLastInPriceExcludeSelf(supplier, goodsName, spec, excludeId) {
    try {
        const encodedSupplier = encodeURIComponent(supplier);
        const encodedGoodsName = encodeURIComponent(goodsName);
        const encodedSpec = encodeURIComponent(spec || '');
        
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}&spec=eq.${encodedSpec}&id=neq.${excludeId}&order=record_date.desc&limit=1`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const data = await res.json();
        if (data && data.length > 0 && data[0].in_price) {
            return {
                price: data[0].in_price,
                recordDate: data[0].record_date,
                inNum: data[0].in_num
            };
        }
        return null;
    } catch (e) {
        console.warn('获取最近入库单价（排除自身）失败:', e);
        return null;
    }
}

/**
 * 加载最近入库单价并显示提醒
 */
async function loadLastInPriceAndRemind(goods) {
    const supplier = document.getElementById('supSearchInput').value.trim();
    const goodsName = goods.name;
    const spec = goods.spec || '';
    const editId = document.getElementById('inEditId').value;
    
    if (!supplier || !goodsName) return;
    
    const getLastFn = editId ? getLastInPriceExcludeSelf : getLastInPrice;
    const lastRecord = await getLastFn(supplier, goodsName, spec, editId);
    const priceInput = document.getElementById('inPrice');
    
    if (lastRecord && lastRecord.price > 0) {
        priceInput.value = lastRecord.price;
        showInPriceReminder(lastRecord.price, lastRecord.recordDate);
    } else {
        priceInput.value = '';
        showNoHistoryReminder();
    }
}

/**
 * 显示入库单价提醒（有历史记录）
 */
function showInPriceReminder(lastPrice, lastDate) {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    const formattedDate = lastDate ? new Date(lastDate).toISOString().split('T')[0] : '未知日期';
    const formattedPrice = formatMoney(lastPrice);
    reminderEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#ff6b6b; font-weight:bold;">⚠️ 调用的是上次入库单价，请确认！</span>
        </div>
        <div style="color:#999; font-size:13px; margin-top:4px;">
            上次入库价：<strong style="color:#333;">${formattedPrice}</strong>
            （录入日期：${formattedDate}）
        </div>
    `;
    // ✅ 改为居中 + 自适应宽度（只影响自身，不影响父容器其他子元素）
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    // ✅ 使用 left: 50%; transform: translateX(-50%) 实现居中，不影响父容器
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#fff3cd';
    reminderEl.style.border = '1px solid #ffc107';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    // ✅ 移除父容器的 textAlign 设置（不再修改父容器）
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #ffc107;
    `;
    reminderEl.appendChild(arrowEl);
}
/**
 * 显示无历史记录提示
 */
function showNoHistoryReminder() {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    reminderEl.innerHTML = `
        ℹ️ <span style="color:#17a2b8;">该商品暂无入库记录，请手动输入入库单价</span>
    `;
    // ✅ 改为居中 + 自适应宽度（只影响自身，不影响父容器其他子元素）
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    // ✅ 使用 left: 50%; transform: translateX(-50%) 实现居中
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#d1ecf1';
    reminderEl.style.border = '1px solid #17a2b8';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    // ✅ 移除父容器的 textAlign 设置
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #17a2b8;
    `;
    reminderEl.appendChild(arrowEl);
}

/**
 * 隐藏入库单价提醒
 */
function hideInPriceReminder() {
    const reminderEl = document.getElementById('inPriceReminder');
    if (reminderEl) {
        reminderEl.style.display = 'none';
        reminderEl.innerHTML = '';
        // ✅ 重置自身样式
        reminderEl.style.position = '';
        reminderEl.style.left = '';
        reminderEl.style.transform = '';
        reminderEl.style.marginTop = '';
        reminderEl.style.background = '';
        reminderEl.style.border = '';
        reminderEl.style.borderRadius = '';
        reminderEl.style.padding = '';
        reminderEl.style.fontSize = '';
        reminderEl.style.borderTop = '';
        reminderEl.style.boxShadow = '';
        // ✅ 清除可能残留的箭头元素
        while (reminderEl.firstChild) {
            reminderEl.removeChild(reminderEl.firstChild);
        }
    }
}
/**
 * 显示价格一致的提醒（绿色）
 */
function showPriceConsistentReminder(lastPrice, lastDate) {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    const formattedDate = lastDate ? new Date(lastDate).toISOString().split('T')[0] : '未知日期';
    const formattedPrice = formatMoney(lastPrice);
    reminderEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#28a745; font-weight:bold;">✅ 入库单价与上次一致</span>
        </div>
        <div style="color:#999; font-size:13px; margin-top:4px;">
            上次入库价：<strong style="color:#333;">${formattedPrice}</strong>
            （${formattedDate}）
        </div>
    `;
    // ✅ 改为居中 + 自适应宽度（只影响自身）
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#d4edda';
    reminderEl.style.border = '1px solid #28a745';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    // ✅ 移除父容器的 textAlign 设置
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #28a745;
    `;
    reminderEl.appendChild(arrowEl);
}

/**
 * 显示价格变更的提醒（红色）
 */
function showPriceChangedReminder(lastPrice, currentPrice, lastDate) {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    const formattedDate = lastDate ? new Date(lastDate).toISOString().split('T')[0] : '未知日期';
    const formattedLastPrice = formatMoney(lastPrice);
    const formattedCurrentPrice = formatMoney(currentPrice);
    reminderEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#dc3545; font-weight:bold;">⚠️ 入库单价已变更，请确认！</span>
        </div>
        <div style="color:#999; font-size:13px; margin-top:4px;">
            上次入库价：<strong style="color:#dc3545;">${formattedLastPrice}</strong>
            → 当前价：<strong style="color:#007bff;">${formattedCurrentPrice}</strong>
            （上次日期：${formattedDate}）
        </div>
    `;
    // ✅ 改为居中 + 自适应宽度（只影响自身）
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#f8d7da';
    reminderEl.style.border = '1px solid #dc3545';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    // ✅ 移除父容器的 textAlign 设置
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #dc3545;
    `;
    reminderEl.appendChild(arrowEl);
}
// ========== 绑定入库单价输入事件 ==========
function bindInPriceEvents() {
    const priceInput = document.getElementById('inPrice');
    if (!priceInput) return;
    
    priceInput.removeEventListener('input', onPriceInputChange);
    priceInput.addEventListener('input', onPriceInputChange);
}

function onPriceInputChange() {
    const currentPrice = parseFloat(this.value);
    if (isNaN(currentPrice) || currentPrice <= 0) {
        const supplier = document.getElementById('supSearchInput').value.trim();
        const goodsName = document.getElementById('goodsSearchInput').value.trim();
        if (supplier && goodsName) {
            const goods = currGoodsList.find(g => g.name === goodsName);
            if (goods) {
                loadLastInPriceAndRemind(goods);
            }
        }
        return;
    }
    
    const supplier = document.getElementById('supSearchInput').value.trim();
    const goodsName = document.getElementById('goodsSearchInput').value.trim();
    const spec = document.getElementById('inSpec').value || '';
    const editId = document.getElementById('inEditId').value;
    
    if (supplier && goodsName) {
        const getLastFn = editId ? getLastInPriceExcludeSelf : getLastInPrice;
        getLastFn(supplier, goodsName, spec, editId).then(lastRecord => {
            if (lastRecord && lastRecord.price > 0) {
                if (Math.abs(lastRecord.price - currentPrice) < 0.01) {
                    showPriceConsistentReminder(lastRecord.price, lastRecord.recordDate);
                } else {
                    showPriceChangedReminder(lastRecord.price, currentPrice, lastRecord.recordDate);
                }
            }
        });
    }
}

// 打开添加入库弹窗（异步校验）
async function openStockInForm(id=null){
    // ----- 新增：重置所有字段和下拉列表 -----
    document.getElementById('supSearchInput').value = '';
    document.getElementById('goodsSearchInput').value = '';
    document.getElementById('curSelectGoodsId').value = '';
    document.getElementById('inSpec').value = '';
    document.getElementById('inSettleType').value = '';
    document.getElementById('inSalePrice').value = '';
    document.getElementById('inNum').value = '';
    document.getElementById('inPrice').value = '';
    document.getElementById('inPrice').disabled = false;
    document.getElementById('inRecordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inProduceDate').value = '';
    document.getElementById('inExpireDate').value = '';
    // ✅ 新增：隐藏入库单价提醒
    hideInPriceReminder();
    // 重置销售价输入框样式
    const salePriceInput = document.getElementById('inSalePrice');
    salePriceInput.placeholder = '';
    salePriceInput.style.color = '';
    // 强制关闭下拉列表
    document.getElementById('supListBox').style.display = 'none';
    document.getElementById('goodsListBox').style.display = 'none';
    // ----- 新增结束 -----

    if (id && await checkInUsed(id)) {
        showMsg('该入库记录已生成出库或退货单据，禁止编辑！');
        return;
    }
    document.getElementById('inEditId').value = id || '';
    document.getElementById('stockInFormTitle').innerText = id ? '编辑入库单据' : '添加入库单据';
    
    if(id){
        let item = allStockIn.find(x=>x.id === id);
        if(!item) return;
        document.getElementById('supSearchInput').value = item.supplier;
        loadGoodsBySupplier(item.supplier);
        setTimeout(()=>{
            let targetGoods = currGoodsList.find(g => g.name === item.goodsName);
            if(targetGoods){
                selectInGoods(targetGoods);
                document.getElementById('inNum').value = item.in_num;
                document.getElementById('inPrice').value = item.in_price;
                document.getElementById('inRecordDate').value = item.record_date;
                document.getElementById('inProduceDate').value = item.produce_date || '';
                document.getElementById('inExpireDate').value = item.expire_date || '';
                
                // ✅ 编辑时也显示提醒（根据当前编辑的单价）
                if (item.settleType === '线下' && item.in_price) {
                    // 获取最近一次入库单价（排除自身）
                    getLastInPriceExcludeSelf(item.supplier, item.goodsName, item.spec || '', item.id).then(lastRecord => {
                        if (lastRecord && lastRecord.price > 0) {
                            showInPriceReminder(lastRecord.price, lastRecord.recordDate);
                        } else {
                            showNoHistoryReminder();
                        }
                    });
                }
                
                // ✅ 关键修改：加载完日期后，调用 updateInPriceByDate 匹配状态价格
                setTimeout(() => {
                    updateInPriceByDate();
                }, 50);
            }
        },100);
    }
    // ✅ 绑定日期事件
    bindInDateEvents();
    // ✅ 绑定入库单价输入事件
    bindInPriceEvents();
    document.getElementById('stockInModal').style.display = 'block';
}
function closeStockInForm(){
    document.getElementById('stockInModal').style.display = 'none';
}

// 提交入库
async function submitStockIn(){
    let editId = document.getElementById('inEditId').value;
    let supplier = document.getElementById('supSearchInput').value.trim();
    let goodsName = document.getElementById('goodsSearchInput').value.trim();
    let goodsId = document.getElementById('curSelectGoodsId').value;
    let spec = document.getElementById('inSpec').value;
    let settleType = document.getElementById('inSettleType').value;
    let salePriceText = document.getElementById('inSalePrice').value;
    // ✅ 修复：如果 salePriceText 为空或无效，设置 salePrice 为 0
    let salePrice = 0;
    if (salePriceText && salePriceText.trim() !== '') {
        const cleaned = salePriceText.replace('￥', '').trim();
        salePrice = parseFloat(cleaned) || 0;
    }
    let inNum = document.getElementById('inNum').value;
    let inPrice = document.getElementById('inPrice').value;
    let recordDate = document.getElementById('inRecordDate').value;
    let produceDate = document.getElementById('inProduceDate').value;
    let expireDate = document.getElementById('inExpireDate').value;

    if(!supplier) return alert('请选择供应商');
    if(!goodsName || !goodsId) return alert('请选择商品');
    if(!inNum || +inNum < 1) return alert('入库数量必须大于0');
    if(!recordDate) return alert('请选择录入日期');
    if(settleType === '线下'){
        if(inPrice === '' || isNaN(+inPrice) || +inPrice < 0){
            return alert('线下商品必须填写入库单价');
        }
    }
    if(settleType === '线上'){
        // 只有【新增单据】才拦截手动填写单价；编辑单据直接跳过校验
        if(!editId && inPrice !== '' && +inPrice > 0){
            return alert('线上商品不允许填写入库单价');
        }
    }
    if (produceDate && expireDate) {
        return alert('生产日期和到期日期不能同时填写');
    }

    let targetGoods = allGoods.find(g => g.id == goodsId);
    let finalInPrice = 0;
    if(settleType === '线上'){
        finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
    }else{
        finalInPrice = +inPrice;
    }

    // 修正逻辑：线下默认未开票，线上赋值空字符串（表格展示空白）
    let invoiceStatus = settleType === '线下' ? '未开票' : '';

    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec || null,
        settleType: settleType,
        sale_price: salePrice,  // ✅ 现在 salePrice 不会是 NaN
        in_price: finalInPrice,
        in_num: +inNum,
        record_date: recordDate,
        produce_date: produceDate || null,
        expire_date: expireDate || null,
        invoice_status: invoiceStatus
    };

    try {
        let res;
        const headers = {
            apikey:SUPABASE_KEY,
            Authorization:`Bearer ${SUPABASE_KEY}`,
            'Content-Type':'application/json',
            'Prefer':'return=representation'
        };

        if(editId){
            // 编辑时不修改发票状态，保留自动核销后的结果
            delete postData.invoice_status;
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${editId}`,{
                method:'PATCH',
                headers,
                body:JSON.stringify(postData)
            });
        }else{
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`,{
                method:'POST',
                headers,
                body:JSON.stringify(postData)
            });
        }

        // 兼容 201/200 成功状态，不再单纯依赖 res.ok
        if (res.status >= 200 && res.status < 300) {
            // 忽略空响应解析报错
            try { await res.json(); } catch {}
            showMsg(editId ? '编辑成功' : '入库成功');
            closeStockInForm();
            await loadStockIn();
            return;
        }
        // 非成功状态才抛出异常
        throw new Error('请求失败');
    } catch (e) {
        showMsg('入库提交失败');
    }
}

// 下载导入模板
function downloadStockInTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库导入模板");
    XLSX.writeFile(wb, "入库导入模板.xlsx");
}

// 导出Excel【仅修改：表头增加发票号码列】
function exportStockInExcel(){
    try {
        console.log('🚀 开始导出入库记录');
        // 如果筛选结果为空，则使用全部数据（保证有数据时能导出）
        let dataToExport = filteredStockIn && filteredStockIn.length > 0 ? filteredStockIn : allStockIn;
        if(!dataToExport || dataToExport.length === 0){
            showMsg("暂无数据可导出");
            return;
        }
        console.log(`📊 共 ${dataToExport.length} 条数据待导出`);

        // 额外检查：确保数据有效（至少有一个字段有值）
        let validData = dataToExport.filter(item => item && typeof item === 'object' && Object.keys(item).length > 0);
        if(validData.length === 0){
            showMsg("数据格式异常，无法导出");
            return;
        }

        let header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
        let expData = validData.map(item=>[
    item.supplier||"",
    item.goodsName||"",
    item.spec||"",
    item.settleType||"",
    item.sale_price||0,
    item.in_price||0,
    item.in_num||0,
    item.record_date||"",
    item.produce_date||"",
    item.expire_date||""
]);
        
        console.log('📝 开始生成 Excel 工作簿');
        let ws = XLSX.utils.aoa_to_sheet([header,...expData]);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "入库记录");
        console.log('💾 开始下载文件');
        XLSX.writeFile(wb, "入库记录.xlsx");
        console.log('✅ 导出完成（无弹窗）');
        // 不显示成功弹窗，只控制台提示
    } catch (err) {
        console.error('❌ 导出失败:', err);
        showMsg('导出失败：' + err.message);
    }
}
// Excel导入
async function importStockInExcel() {
    let file = document.getElementById('fileInput').files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
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
            let salePrice = parseFloat(row[4]) || 0;
            let inPrice = parseFloat(row[5]) || 0;
            let inNum = parseInt(row[6]) || 0;
            let recordDate = row[7] || '';
            let produceDate = row[8] || null;
            let expireDate = row[9] || null;
            if (!supplier || !goodsName || inNum < 1 || !recordDate) { failCount++; continue; }
            if (produceDate && expireDate) { failCount++; continue; }
            if(settleType === '线下' && (inPrice === 0 || isNaN(inPrice))) { failCount++; continue; }
            if(settleType === '线上' && inPrice > 0) { failCount++; continue; }
            let targetGoods = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
            let finalInPrice = 0;
            if(settleType === '线上'){
                finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
            }else{
                finalInPrice = inPrice;
            }
            // 导入同样修正规则：线下未开票，线上空字符串
            let invoiceStatus = settleType === '线下' ? '未开票' : '';
            let postData = {
                supplier, goodsName, spec, settleType,
                sale_price: salePrice,
                in_price: finalInPrice,
                in_num: inNum,
                record_date: recordDate,
                produce_date: produceDate,
                expire_date: expireDate,
                invoice_status: invoiceStatus
            };
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
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
        loadStockIn();
    };
    reader.readAsArrayBuffer(file);
}

// 加载入库列表【完全保留你原有代码，未新增任何全局缓存、不改动逻辑】
async function loadStockIn() {
    await preLoadStockOutData();
    try {
        const fetchAll = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allData = await fetchAll.json();
        allStockIn = allData;
       initInFilterData();
        document.getElementById('inTotalCount').textContent = allData.length;
        
        // ✅ 确保缓存刷新
        refreshAllStockCache(allStockIn, allStockOut);
        
        inCurrentPage = 1;
        filterStockIn();
    } catch (e) {
        showMsg('加载入库记录失败：' + e.message);
    }
}
// 搜索筛选 - 模糊匹配
function filterStockIn() {
    const supplier = document.getElementById('inFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('inFilterGoodsNameInput')?.value.trim() || '';
    const settleType = document.getElementById('inFilterSettleTypeInput')?.value.trim() || '';

    if (!allStockIn || !Array.isArray(allStockIn)) {
        filteredStockIn = [];
    } else {
        filteredStockIn = allStockIn.filter(item => {
            let match = true;
            // ✅ 改为模糊匹配（includes）
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (settleType && !(item.settleType || '').toLowerCase().includes(settleType.toLowerCase())) match = false;
            return match;
        });
    }

    document.getElementById('inSearchCount').textContent = filteredStockIn.length;
    inCurrentPage = 1;
    renderInPagination();
    renderStockIn();
}

// 列表排序
function inSortTable(field) {
    inSortField = field;
    inSortAsc = (inSortField === field) ? !inSortAsc : true;
    filteredStockIn.sort((a,b)=>{
        let va=a[inSortField]||'', vb=b[inSortField]||'';
        if(['in_price','in_num','sale_price'].includes(inSortField)){
            va=Number(va)||0; vb=Number(vb)||0;
            return inSortAsc ? va-vb : vb-va;
        }
        return inSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateInSortIcon(); renderStockIn();
}
function updateInSortIcon() {
    document.querySelectorAll('.inSortIcon').forEach(i=>i.innerText='');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th=>th.onclick?.toString().includes(inSortField));
    if(idx>-1) document.querySelectorAll('.inSortIcon')[idx].innerText = inSortAsc?'↑':'↓';
}

// 渲染入库表格
async function renderStockIn() {
    let start = (inCurrentPage - 1) * inPageSize;
    let pageData = filteredStockIn.slice(start, start + inPageSize);
    let tb = document.getElementById('stockInList'); 
    if (!tb) {
        console.error('找不到入库列表DOM元素');
        return;
    }
    tb.innerHTML = '';
    let idUsedMap = {};
if (pageData.length > 0) {
    const promises = pageData.map(item => checkInUsed(item.id));
    const results = await Promise.all(promises);
    pageData.forEach((item, index) => {
        idUsedMap[item.id] = results[index];
    });
}
    let fullHtml = '';
    
    for (let idx = 0; idx < pageData.length; idx++) {
        try {
            const item = pageData[idx];
            const cacheKey = `${item.supplier}|${item.goodsName}`;
            const cache = stockDataCache ? stockDataCache.get(cacheKey) : null;
            
            let batchRemain = 0;
            let totalStock = 0;
            if (cache && cache.batchList && cache.batchList.length > 0) {
                const batchList = cache.batchList;
                const batch = batchList.find(b => {
                    if (!b || !b.inRecords) return false;
                    return b.inRecords.some(inItem => inItem.id === item.id);
                });
                batchRemain = batch ? batch.batchRemain : 0;
                totalStock = cache.totalStock || 0;
            }

            let amount = formatMoney((item.in_price || 0) * item.in_num);
            let isUsed = idUsedMap[item.id] || false;
            let btnHtml = '';
            
            if(isUsed){
                btnHtml = `
                    <button class="btn btn-primary" disabled style="opacity:0.5">编辑</button>
                    <button class="btn btn-danger" disabled style="opacity:0.5">删除</button>
                `;
            }else{
                btnHtml = `
                    <button class="btn btn-primary" onclick="openStockInForm(${item.id})">编辑</button>
                    <button class="btn btn-danger" onclick="deleteStockIn(${item.id})">删除</button>
                `;
            }
            
            fullHtml += `
    <tr>
        <td><input type="checkbox" class="in-item-checkbox" value="${item.id}" ${isUsed ? 'disabled' : ''}></td>
        <td>${start + idx + 1}</td>
        <td>${item.supplier || ''}</td>
        <td>${item.goodsName || ''}</td>
        <td>${item.spec || '-'}</td>
        <td>${item.settleType || ''}</td>
        <td>${formatMoney(item.in_price)}</td>
        <td>${item.in_num}</td>
        <td>${amount}</td>
        <td>${batchRemain}</td>
        <td>${totalStock}</td>
        <td>${item.produce_date || ''}</td>
        <td>${item.expire_date || ''}</td>
        <td>${item.record_date || ''}</td>
        <td>${btnHtml}</td>
    </tr>
`;
        } catch (e) {
            console.error('渲染第', idx + 1, '行时出错:', e, pageData[idx]);
            // 继续渲染下一行
            continue;
        }
    }
    tb.innerHTML = fullHtml;
}

// 分页渲染
function renderInPagination() {
    inTotalPages = Math.ceil(filteredStockIn.length / inPageSize) || 1;
    document.getElementById('inCurrentPage').textContent = inCurrentPage;
    document.getElementById('inTotalPages').textContent = inTotalPages;

    let pgBox = document.getElementById('inPageNumbers');
    pgBox.innerHTML = '';
    let s = Math.max(1, inCurrentPage - 2);
    let e = Math.min(inTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === inCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => inGoToPage(i);
        pgBox.appendChild(btn);
    }

    // ✅ 首尾定位
    let btns = document.querySelectorAll('#stockIn .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (inCurrentPage === 1);
        btns[1].disabled = (inCurrentPage === 1);
        btns[btns.length - 2].disabled = (inCurrentPage === inTotalPages);
        btns[btns.length - 1].disabled = (inCurrentPage === inTotalPages);
    }
}

function inGoToPage(p){ if(p<1||p>inTotalPages)return; inCurrentPage=p; renderInPagination(); renderStockIn(); }
function inPrevPage(){ inGoToPage(inCurrentPage-1); }
function inNextPage(){ inGoToPage(inCurrentPage+1); }
function changeInPageSize(){
    inPageSize = +document.getElementById('inPageSize').value;
    inCurrentPage = 1;
    renderInPagination();
    renderStockIn();  // ✅ 添加这行
}
// 全选 - 只勾选未被禁用的checkbox
function inToggleSelectAll(){
    let all = document.getElementById('inSelectAll').checked;
    document.querySelectorAll('.in-item-checkbox').forEach(function(cb) {
        // ✅ 只勾选未被禁用的checkbox（即有出库记录的被禁用，不可勾选）
        if (!cb.disabled) {
            cb.checked = all;
        }
    });
}
// 单条删除（后端校验）
async function deleteStockIn(id) {
    // ===== 新增：管理员权限检查 =====
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除入库记录');
        return;
    }

    if (await checkInUsed(id)) {
        showMsg('该入库记录已生成出库或退货单据，禁止删除！');
        return;
    }
    if (!confirm('确定删除？')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        showMsg('删除成功');
        await loadStockIn();
    } catch (e) {
        showMsg('删除失败');
    }
}

// 批量删除（后端校验）- 跳过已被禁用的行
async function batchDeleteStockIn() {
    // ===== 新增：管理员权限检查 =====
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以批量删除入库记录');
        return;
    }

    let ids = [];
    let hasDisabled = false;
    
    document.querySelectorAll('.in-item-checkbox').forEach(function(cb) {
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
            showMsg('选中的记录中存在已生成出库或退货单据的数据，无法删除！');
        } else {
            showMsg('请选择数据');
        }
        return;
    }
    
    // 再次校验选中的记录是否真的可以删除（双重保险）
    let usedIds = [];
    for (let id of ids) {
        if (await checkInUsed(id)) {
            usedIds.push(id);
        }
    }

    if (usedIds.length > 0) {
        showMsg(`选中数据中有 ${usedIds.length} 条已关联出库或退货单据，无法删除！`);
        return;
    }
    
    if (!confirm(`确定删除${ids.length}条？`)) return;
    for (let id of ids) {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
    }
    showMsg('批量删除成功');
    await loadStockIn();
}

// 清空排序、重置搜索
function clearInSort(){
    inSortField = ''; inSortAsc = true; updateInSortIcon(); loadStockIn();
}

// ===== 全局点击关闭下拉列表（入库模块） =====
(function() {
    if (window._stockInClickOutsideBound) return;
    window._stockInClickOutsideBound = true;
    document.addEventListener('click', function(e) {
        // 供应商下拉
        const supInput = document.getElementById('supSearchInput');
        const supList = document.getElementById('supListBox');
        if (supList && supList.style.display === 'block') {
            if (supInput && !supInput.contains(e.target) && !supList.contains(e.target)) {
                supList.style.display = 'none';
            }
        }
        // 商品下拉
        const goodsInput = document.getElementById('goodsSearchInput');
        const goodsList = document.getElementById('goodsListBox');
        if (goodsList && goodsList.style.display === 'block') {
            if (goodsInput && !goodsInput.contains(e.target) && !goodsList.contains(e.target)) {
                goodsList.style.display = 'none';
            }
        }
    });
})();

// ===== 全局点击关闭下拉列表（入库筛选） =====
document.addEventListener('click', function(e) {
    const listIds = [
        'inFilterSupplierList',
        'inFilterGoodsNameList',
        'inFilterSettleTypeList'
    ];
    listIds.forEach(id => {
        const box = document.getElementById(id);
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${id.replace('List', 'Input')}`)) {
            box.style.display = 'none';
        }
    });
});