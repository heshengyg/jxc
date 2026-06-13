// ===================== 出库管理模块（最终版） =====================
let allStockOut = [];
let filteredStockOut = [];
let outCurrentPage = 1;
let outPageSize = 10;

// 加载商品数据
async function loadAllGoods() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/goods`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        allGoods = await res.json();
    } catch (e) {
        console.error('加载商品数据失败', e);
    }
}

// 加载入库数据
async function loadStockInData() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        allStockIn = await res.json();
        filteredStockIn = [...allStockIn];
    } catch (e) {
        console.error('加载入库数据失败', e);
    }
}

// 出库页面初始化
async function initStockOut() {
    try {
        await Promise.all([
            loadAllGoods(),
            loadStockInData() // 直接调用common.js里的全局函数
        ]);
        await loadStockOut();
    } catch (e) {
        console.error('出库页面初始化失败', e);
    }
}
// 加载出库列表
async function loadStockOut() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        allStockOut = await res.json();
        filteredStockOut = [...allStockOut];
        renderStockOut();
        renderStockOutPagination();
    } catch (e) {
        console.error('加载出库记录失败', e);
        showMsg('加载出库记录失败');
    }
}

// 渲染出库列表
function renderStockOut() {
    let start = (outCurrentPage-1)*outPageSize;
    let pageData = filteredStockOut.slice(start, start+outPageSize);
    let tb = document.getElementById('stockOutList');
    if(!tb) return;
    tb.innerHTML = '';
    pageData.forEach((item, idx) => {
        let html = `
            <tr>
                <td><input type="checkbox" class="out-item-checkbox" value="${item.id}"></td>
                <td>${start+idx+1}</td>
                <td>${item.supplier||''}</td>
                <td>${item.goodsName||''}</td>
                <td>${item.spec||''}</td>
                <td>${item.settleType||''}</td>
                <td>${formatMoney(item.outPrice)}</td>
                <td>${formatMoney(item.salePrice)}</td>
                <td>${item.outNum}</td>
                <td>${formatMoney(item.outAmount)}</td>
                <td>${formatMoney(item.saleAmount)}</td>
                <td>${item.recordDate||''}</td>
                <td>
                    <button class="btn btn-primary" onclick="openStockOutForm(${item.id})">编辑</button>
                    <button class="btn btn-danger" onclick="deleteStockOut(${item.id})">删除</button>
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    });
}

// 渲染分页（如果没有可以暂时忽略）
function renderStockOutPagination() {
    // 这里放你原来的分页代码即可
}

// 打开出库表单
function openStockOutForm(editId = null) {
    let modal = document.getElementById('outFormModal');
    if(!modal) {
        console.error('找不到出库弹窗DOM元素 #outFormModal');
        showMsg('弹窗加载失败，请刷新页面重试');
        return;
    }

    modal.style.display = 'block';
    document.getElementById('outEditId').value = editId || '';

    // 清空表单
    document.getElementById('outSupSearchInput').value = '';
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outSpec').value = '自动带出';
    document.getElementById('outSettleType').value = '自动带出';
    document.getElementById('outSalePrice').value = '自动带出';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';
    document.getElementById('outRecordDate').value = new Date().toISOString().split('T')[0].replace(/-/g, '/');

    // 编辑模式填充数据
    if (editId) {
        let editData = allStockOut.find(out => out.id === editId);
        if (!editData) {
            showMsg('未找到该出库记录');
            closeStockOutForm();
            return;
        }

        document.getElementById('outSupSearchInput').value = editData.supplier || '';
        document.getElementById('outGoodsSearchInput').value = editData.goodsName || '';
        document.getElementById('outSpec').value = editData.spec || '自动带出';
        document.getElementById('outSettleType').value = editData.settleType || '自动带出';
        document.getElementById('outSalePrice').value = editData.salePrice ? formatMoney(editData.salePrice) : '自动带出';
        document.getElementById('outNum').value = editData.outNum || '';
        document.getElementById('outRecordDate').value = editData.recordDate ? editData.recordDate.replace(/-/g, '/') : new Date().toISOString().split('T')[0].replace(/-/g, '/');

        let totalStock = getTotalStockNum(editData.supplier, editData.goodsName);
        document.getElementById('totalStockNum').value = totalStock;
    }
}

// 关闭出库表单
function closeStockOutForm() {
    let modal = document.getElementById('outFormModal');
    if(modal) modal.style.display = 'none';
}

// 提交出库
async function submitStockOut(){
    let editId = document.getElementById('outEditId').value;
    let supplier = document.getElementById('outSupSearchInput').value.trim();
    let goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    let spec = document.getElementById('outSpec').value || '';
    let settleType = document.getElementById('outSettleType').value || '';
    let salePriceText = document.getElementById('outSalePrice').value;
    let salePrice = parseFloat(salePriceText.replace('￥','')) || 0;
    let outNum = Number(document.getElementById('outNum').value) || 0;
    let recordDate = document.getElementById('outRecordDate').value;

    if(!supplier) return showMsg('请选择供应商');
    if(!goodsName) return showMsg('请选择商品');
    if(outNum < 1) return showMsg('出库数量必须大于0');
    if(!recordDate) return showMsg('请选择录入日期');

    let totalStock = getTotalStockNum(supplier, goodsName);
    if(outNum > totalStock){
        return showMsg(`库存不足！当前可用库存：${totalStock}`);
    }

    let outDetail = calcFIFOOut(supplier, goodsName, outNum);
    if(outDetail.length === 0) return showMsg('无可用库存批次');

    let linkInId = outDetail[0].inRecordId;
    let linkInItem = allStockIn.find(x => x.id === linkInId);
    let outPrice = 0;
    let goodsItem = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
    if(settleType === '线上'){
        outPrice = goodsItem ? Number(goodsItem.online_cost) : 0;
    }else{
        outPrice = linkInItem ? Number(linkInItem.in_price) : 0;
    }

    let outAmount = Number((outPrice * outNum).toFixed(2));
    let saleAmount = Number((salePrice * outNum).toFixed(2));

    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec,
        settleType: settleType,
        outPrice: outPrice,
        salePrice: salePrice,
        outNum: outNum,
        outAmount: outAmount,
        saleAmount: saleAmount,
        recordDate: recordDate,
        inRecordId: linkInId,
        outDetail: JSON.stringify(outDetail)
    };

    try {
        let res;
        if(editId){
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${editId}`,{
                method:'PATCH',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body:JSON.stringify(postData)
            });
        }else{
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`,{
                method:'POST',
                headers:{
                    apikey:SUPABASE_KEY,
                    Authorization:`Bearer ${SUPABASE_KEY}`,
                    'Content-Type':'application/json',
                    'Prefer':'return=representation'
                },
                body:JSON.stringify(postData)
            });
        }
        if(!res.ok) {
            let err = await res.json();
            console.error('出库提交错误详情：', err);
            throw new Error(`请求异常：${JSON.stringify(err)}`);
        }
        showMsg(editId ? '编辑出库成功' : '出库提交成功');
        closeStockOutForm();
        loadStockOut();
        loadStockInData();
    } catch (e) {
        console.error('出库提交失败', e);
        showMsg('出库提交失败：' + e.message);
    }
}

// 删除出库记录（如果没有可以加上）
async function deleteStockOut(id) {
    if(!confirm('确定要删除这条出库记录吗？')) return;
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`,{
            method:'DELETE',
            headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
        });
        if(res.ok){
            showMsg('删除成功');
            loadStockOut();
            loadStockInData();
        }else{
            showMsg('删除失败');
        }
    } catch (e) {
        console.error('删除出库记录失败', e);
        showMsg('删除失败');
    }
}

// 页面加载时初始化出库模块
document.addEventListener('DOMContentLoaded', function() {
    initStockOut();
});