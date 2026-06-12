// 供应商下拉搜索
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
}

// 商品下拉搜索
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
    document.getElementById('inSalePrice').value = formatMoney(goods.sale_price);

    let priceInput = document.getElementById('inPrice');
    if(goods.channel === '线上'){
        priceInput.disabled = true;
        priceInput.value = '';
    }else{
        priceInput.disabled = false;
    }
}

// 日期互斥
function lockExpireDate(){
    let p = document.getElementById('inProduceDate').value;
    if(p) document.getElementById('inExpireDate').value = '';
}
function lockProduceDate(){
    let e = document.getElementById('inExpireDate').value;
    if(e) document.getElementById('inProduceDate').value = '';
}

function openStockInForm(id=null){
    document.getElementById('inEditId').value = id || '';
    document.getElementById('stockInFormTitle').innerText = id ? '编辑入库单据' : '添加入库单据';

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
            }
        },100);
    }
    document.getElementById('stockInModal').style.display = 'block';
}

function closeStockInForm(){
    document.getElementById('stockInModal').style.display = 'none';
}

async function submitStockIn(){
    let editId = document.getElementById('inEditId').value;
    let supplier = document.getElementById('supSearchInput').value.trim();
    let goodsName = document.getElementById('goodsSearchInput').value.trim();
    let goodsId = document.getElementById('curSelectGoodsId').value;
    let spec = document.getElementById('inSpec').value;
    let settleType = document.getElementById('inSettleType').value;
    let salePriceText = document.getElementById('inSalePrice').value;
    let salePrice = parseFloat(salePriceText.replace('￥',''));
    let inNum = document.getElementById('inNum').value;
    let inPrice = document.getElementById('inPrice').value;
    let recordDate = document.getElementById('inRecordDate').value;
    let produceDate = document.getElementById('inProduceDate').value;
    let expireDate = document.getElementById('inExpireDate').value;

    if(!supplier) return showMsg('请选择供应商');
    if(!goodsName || !goodsId) return showMsg('请选择商品');
    if(!inNum || +inNum < 1) return showMsg('入库数量必须大于0');
    if(!recordDate) return showMsg('请选择录入日期');

    if(settleType === '线下'){
        if(inPrice === '' || isNaN(+inPrice) || +inPrice < 0){
            return showMsg('线下商品必须填写入库单价');
        }
    }
    if(settleType === '线上'){
        if(inPrice !== '' && +inPrice > 0){
            return showMsg('线上商品不允许填写入库单价');
        }
    }
    if (produceDate && expireDate) {
        return showMsg('生产日期和到期日期不能同时填写');
    }

    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec || null,
        settleType: settleType,
        sale_price: salePrice,
        in_price: settleType === '线上' ? 0 : +inPrice,
        in_num: +inNum,
        record_date: recordDate,
        produce_date: produceDate || null,
        expire_date: expireDate || null
    };

    try {
        let res;
        if(editId){
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${editId}`,{
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
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`,{
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
        if(!res.ok) throw new Error('请求异常');
        showMsg(editId ? '编辑成功' : '入库成功');
        closeStockInForm();
        loadStockIn();
    } catch (e) {
        showMsg('入库提交失败');
    }
}

function downloadStockInTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库导入模板");
    XLSX.writeFile(wb, "入库导入模板.xlsx");
}

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
// 补全刷新函数
function refreshStockIn(){
    loadStockIn();
}

// 补全 exportStockInExcel() 函数
function exportStockInExcel(){
    if(filteredStockIn.length === 0) return showMsg('没有数据可导出');
    let data = filteredStockIn.map(item=>[
        item.supplier,
        item.goodsName,
        item.spec,
        item.settleType,
        item.sale_price,
        item.in_price,
        item.in_num,
        item.record_date,
        item.produce_date,
        item.expire_date
    ]);
    let header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    let ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库记录");
    XLSX.writeFile(wb, "入库记录.xlsx");
}

// 补全 importStockInExcel() 函数（之前截断了）
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

            let postData = {
                supplier, goodsName, spec, settleType,
                sale_price: salePrice,
                in_price: settleType === '线上' ? 0 : inPrice,
                in_num: inNum,
                record_date: recordDate,
                produce_date: produceDate,
                expire_date: expireDate
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
        showMsg(`导入完成：成功${successCount}条，失败${failCount}条`);
        loadStockIn();
    };
    reader.readAsArrayBuffer(file);
}

// 确保 loadStockIn() 函数完整
async function loadStockIn() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error('读取失败');
        let list = await res.json();
        allStockIn = list.sort((a,b) => b.id - a.id);
        document.getElementById('inTotalCount').textContent = allStockIn.length;
        filterStockIn();
    } catch (e) {
        showMsg('加载入库记录失败：' + e.message);
    }
}