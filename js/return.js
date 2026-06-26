<!-- 退货弹窗 -->
<div class="form-modal" id="returnModal">
    <div class="form-container" style="max-width: 820px; padding: 25px 30px;">
        <h4 id="returnFormTitle" style="margin:0 0 20px 0; text-align:center; font-size:18px;">添加退货单据</h4>
        <input type="hidden" id="returnEditId">
        
        <!-- 第一行：供应商 -->
        <div style="display:flex; gap:20px; margin-bottom:14px; flex-wrap:wrap;">
            <div style="flex:1; display:flex; align-items:center; gap:8px; white-space:nowrap; min-width:200px;">
                <label style="width:70px; text-align:right; font-weight:bold; font-size:14px; flex-shrink:0;">供应商：</label>
                <div style="position:relative; flex:1; min-width:0;">
                    <input type="text" id="returnSupplierSearch" placeholder="搜索/选择供应商" onfocus="showReturnSupplierList()" oninput="filterReturnSupplierList()" style="width:100%; padding:6px 10px; border:1px solid #ddd; border-radius:4px; font-size:14px;">
                    <div id="returnSupplierListBox" style="position:absolute;top:100%;left:0;width:100%;max-height:180px;overflow-y:auto;background:#fff;border:1px solid #ddd;z-index:9999;display:none;"></div>
                </div>
            </div>
            <div style="flex:1; display:flex; align-items:center; gap:8px; white-space:nowrap; min-width:200px;">
                <label style="width:70px; text-align:right; font-weight:bold; font-size:14px; flex-shrink:0;">商品名：</label>
                <div style="position:relative; flex:1; min-width:0;">
                    <input type="text" id="returnGoodsSearch" placeholder="选择供应商后可用" onfocus="showReturnGoodsList()" oninput="filterReturnGoodsList()" style="width:100%; padding:6px 10px; border:1px solid #ddd; border-radius:4px; font-size:14px; background:#fafafa;">
                    <div id="returnGoodsListBox" style="position:absolute;top:100%;left:0;width:100%;max-height:180px;overflow-y:auto;background:#fff;border:1px solid #ddd;z-index:9999;display:none;"></div>
                </div>
                <input type="hidden" id="returnCurGoodsId">
            </div>
        </div>
        
        <!-- 第二行：规格 + 结算方式 -->
        <div style="display:flex; gap:20px; margin-bottom:14px; flex-wrap:wrap;">
            <div style="flex:1; display:flex; align-items:center; gap:8px; white-space:nowrap; min-width:200px;">
                <label style="width:70px; text-align:right; font-weight:bold; font-size:14px; flex-shrink:0;">规格：</label>
                <div style="position:relative; flex:1; min-width:0;">
                    <input type="text" id="returnSpecSearch" placeholder="选择商品后可用" onfocus="showReturnSpecList()" oninput="filterReturnSpecList()" style="width:100%; padding:6px 10px; border:1px solid #ddd; border-radius:4px; font-size:14px; background:#fafafa;">
                    <div id="returnSpecListBox" style="position:absolute;top:100%;left:0;width:100%;max-height:180px;overflow-y:auto;background:#fff;border:1px solid #ddd;z-index:9999;display:none;"></div>
                </div>
                <input type="hidden" id="returnSpec" value="">
            </div>
            <div style="flex:1; display:flex; align-items:center; gap:8px; white-space:nowrap; min-width:200px;">
                <label style="width:70px; text-align:right; font-weight:bold; font-size:14px; flex-shrink:0;">结算方式：</label>
                <input type="text" id="returnSettleType" readonly placeholder="自动带出" style="flex:1; padding:6px 10px; border:1px solid #ddd; border-radius:4px; background:#f5f5f5; font-size:14px;">
            </div>
        </div>
        
        <!-- 第三行：批次列表 -->
        <div style="margin-bottom:14px;">
            <label style="display:block;font-weight:bold;font-size:14px;margin-bottom:6px;">选择退货批次：</label>
            <div id="returnBatchListContainer" style="max-height:200px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;padding:6px;background:#fafafa;">
                <div style="padding:20px;text-align:center;color:#999;">请先选择供应商</div>
            </div>
        </div>
        
        <!-- 第四行：已选批次信息 + 退货数量 -->
        <div style="display:flex; gap:20px; margin-bottom:14px; flex-wrap:wrap;">
            <div style="flex:2; min-width:250px;">
                <div id="returnSelectedBatchInfo" style="padding:10px 12px;border:1px solid #e8e8e8;border-radius:4px;background:#fafafa;min-height:50px;">
                    <div style="color:#999;">请选择批次</div>
                </div>
            </div>
            <div style="flex:1; display:flex; align-items:center; gap:8px; white-space:nowrap; min-width:150px;">
                <label style="width:70px; text-align:right; font-weight:bold; font-size:14px; flex-shrink:0;">退货数量：</label>
                <input type="number" id="returnNum" min="1" placeholder="必填" oninput="checkReturnNum()" style="flex:1; padding:6px 10px; border:1px solid #ddd; border-radius:4px; font-size:14px;">
                <span style="font-size:12px;color:#999;white-space:nowrap;">库存: <span id="returnBatchRemainDisplay">0</span></span>
                <input type="hidden" id="returnBatchRemain" value="0">
                <input type="hidden" id="returnInPrice" value="0">
                <input type="hidden" id="returnSalePrice" value="0">
            </div>
        </div>
        
        <!-- 第五行：录入日期 + 退货原因 -->
        <div style="display:flex; gap:20px; margin-bottom:14px; flex-wrap:wrap;">
            <div style="flex:1; display:flex; align-items:center; gap:8px; white-space:nowrap; min-width:200px;">
                <label style="width:70px; text-align:right; font-weight:bold; font-size:14px; flex-shrink:0;">录入日期：</label>
                <input type="date" id="returnRecordDate" style="flex:1; padding:6px 10px; border:1px solid #ddd; border-radius:4px; font-size:14px;">
            </div>
            <div style="flex:2; display:flex; align-items:center; gap:8px; white-space:nowrap; min-width:200px;">
                <label style="width:70px; text-align:right; font-weight:bold; font-size:14px; flex-shrink:0;">退货原因：</label>
                <input type="text" id="returnReason" placeholder="选填" style="flex:1; padding:6px 10px; border:1px solid #ddd; border-radius:4px; font-size:14px;">
            </div>
        </div>
        
        <!-- 按钮 -->
        <div style="text-align:center; padding-top:15px; border-top:1px solid #eee;">
            <button class="btn btn-primary" onclick="submitReturnGoods()" style="padding:8px 50px; font-size:15px; border-radius:4px;">提交</button>
            <button class="btn btn-default" onclick="closeReturnForm()" style="padding:8px 50px; margin-left:15px; font-size:15px; border-radius:4px;">取消</button>
        </div>
    </div>
</div>