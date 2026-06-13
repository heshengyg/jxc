// ========== 出库管理 stockout.js 【适配 config.js 全局配置】 ==========
let allStockOut = [];
let filteredStockOut = [];
let outCurrentPage = 1;
let outPageSize = 10;

/**
 * 出库页面初始化：切换标签时执行，预加载商品+入库数据
 * 解决：直接进出库页下拉空白
 */
async function initStockOutPage() {
    try {
        if (typeof loadAllGoods === "function") await loadAllGoods();
        if (typeof loadStockInData === "function") await loadStockInData();
        await loadStockOut();
    } catch (err) {
        console.error("出库初始化失败：", err);
    }
}

/**
 * 加载出库列表数据
 */
async function loadStockOut() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        allStockOut = await res.json();
        filteredStockOut = [...allStockOut];
        renderStockOut();
    } catch (err) {
        console.error("加载出库数据失败：", err);
        showMsg("加载出库列表失败");
    }
}

/**
 * 渲染出库表格
 */
function renderStockOut() {
    const start = (outCurrentPage - 1) * outPageSize;
    const pageData = filteredStockOut.slice(start, start + outPageSize);
    const table = document.getElementById("stockOutList");
    if (!table) return;

    table.innerHTML = "";
    pageData.forEach((item, idx) => {
        table.innerHTML += `
            <tr>
                <td><input type="checkbox" class="out-item-checkbox" value="${item.id}"></td>
                <td>${start + idx + 1}</td>
                <td>${item.supplier || ""}</td>
                <td>${item.goodsName || ""}</td>
                <td>${item.spec || ""}</td>
                <td>${item.settleType || ""}</td>
                <td>${formatMoney(item.outPrice)}</td>
                <td>${formatMoney(item.salePrice)}</td>
                <td>${item.outNum}</td>
                <td>${formatMoney(item.outAmount)}</td>
                <td>${formatMoney(item.saleAmount)}</td>
                <td>${item.recordDate || ""}</td>
                <td>
                    <button class="btn btn-primary" onclick="openStockOutForm(${item.id})">编辑</button>
                    <button class="btn btn-danger" onclick="deleteStockOut(${item.id})">删除</button>
                </td>
            </tr>
        `;
    });
}

/**
 * 打开出库弹窗 + 编辑数据回填
 * 解决：编辑表单空白
 */
function openStockOutForm(editId = null) {
    const modal = document.getElementById("outFormModal");
    const editInput = document.getElementById("outEditId");
    if (!modal || !editInput) {
        showMsg("页面元素缺失，请刷新");
        return;
    }

    modal.style.display = "block";
    editInput.value = editId || "";

    // 清空表单
    document.getElementById("outSupSearchInput").value = "";
    document.getElementById("outGoodsSearchInput").value = "";
    document.getElementById("outSpec").value = "";
    document.getElementById("outSettleType").value = "";
    document.getElementById("outSalePrice").value = "";
    document.getElementById("outNum").value = "";
    document.getElementById("outRecordDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("totalStockNum").value = "0";

    // 编辑模式回填数据
    if (editId) {
        const editData = allStockOut.find(d => d.id === editId);
        if (!editData) return;

        document.getElementById("outSupSearchInput").value = editData.supplier || "";
        document.getElementById("outGoodsSearchInput").value = editData.goodsName || "";
        document.getElementById("outSpec").value = editData.spec || "";
        document.getElementById("outSettleType").value = editData.settleType || "";
        document.getElementById("outSalePrice").value = editData.salePrice || "";
        document.getElementById("outNum").value = editData.outNum || "";
        document.getElementById("outRecordDate").value = editData.recordDate || "";

        const stock = getTotalStockNum(editData.supplier, editData.goodsName);
        document.getElementById("totalStockNum").value = stock;
    }
}

/**
 * 关闭出库弹窗
 */
function closeStockOutForm() {
    const modal = document.getElementById("outFormModal");
    if (modal) modal.style.display = "none";
}

/**
 * 提交出库（新增/编辑）
 */
async function submitStockOut() {
    const editId = document.getElementById("outEditId").value;
    const supplier = document.getElementById("outSupSearchInput").value.trim();
    const goodsName = document.getElementById("outGoodsSearchInput").value.trim();
    const spec = document.getElementById("outSpec").value || "";
    const settleType = document.getElementById("outSettleType").value || "";
    let salePrice = parseFloat(document.getElementById("outSalePrice").value.replace("￥", "")) || 0;
    const outNum = Number(document.getElementById("outNum").value) || 0;
    const recordDate = document.getElementById("outRecordDate").value;

    // 基础校验
    if (!supplier) return showMsg("请选择供应商");
    if (!goodsName) return showMsg("请选择商品");
    if (outNum < 1) return showMsg("出库数量必须大于0");
    if (!recordDate) return showMsg("请选择日期");

    const totalStock = getTotalStockNum(supplier, goodsName);
    if (outNum > totalStock) return showMsg(`库存不足，可用：${totalStock}`);

    const outDetail = calcFIFOOut(supplier, goodsName, outNum);
    if (!outDetail.length) return showMsg("无可用库存");

    const linkInId = outDetail[0].inRecordId;
    const linkInItem = allStockIn.find(x => x.id === linkInId);
    let outPrice = 0;

    const goodsItem = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
    if (settleType === "线上") {
        outPrice = goodsItem ? Number(goodsItem.online_cost) : 0;
    } else {
        outPrice = linkInItem ? Number(linkInItem.in_price) : 0;
    }

    const outAmount = Number((outPrice * outNum).toFixed(2));
    const saleAmount = Number((salePrice * outNum).toFixed(2));

    const postData = {
        supplier, goodsName, spec, settleType,
        outPrice, salePrice, outNum, outAmount, saleAmount,
        recordDate, inRecordId: linkInId,
        outDetail: JSON.stringify(outDetail)
    };

    try {
        let res;
        if (editId) {
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${editId}`, {
                method: "PATCH",
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify(postData)
            });
        } else {
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
                method: "POST",
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify(postData)
            });
        }

        if (!res.ok) throw await res.json();
        showMsg(editId ? "编辑出库成功" : "新增出库成功");
        closeStockOutForm();
        loadStockOut();
        loadStockInData();
    } catch (err) {
        console.error("提交失败：", err);
        showMsg("提交出库失败");
    }
}

/**
 * 删除出库记录
 */
async function deleteStockOut(id) {
    if (!confirm("确定删除该记录？")) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`, {
            method: "DELETE",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        if (res.ok) {
            showMsg("删除成功");
            loadStockOut();
            loadStockInData();
        } else {
            showMsg("删除失败");
        }
    } catch (err) {
        console.error("删除失败：", err);
        showMsg("删除失败");
    }
}