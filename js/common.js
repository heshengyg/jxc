// ===================== 全局变量区（所有模块仅在此声明） =====================
// 商品模块
let allGoods = [];
let filteredGoods = [];
let currentPage = 1, pageSize = 10, totalPages = 1;
let sortField = '', sortAsc = true;

// 入库模块
let allStockIn = [];
let filteredStockIn = [];
let inCurrentPage = 1, inPageSize = 10, inTotalPages = 1;
let inSortField = '', inSortAsc = true;

// ========== 新增：出库模块全局变量 ==========
let allStockOut = [];
let filteredStockOut = [];
let outCurrentPage = 1, outPageSize = 10, outTotalPages = 1;
let outSortField = '', outSortAsc = true;

// 公共通用变量
const shelfToExpireDays = [
    { shelf: 1, expire: 1 },{ shelf: 7, expire: 2 },{ shelf: 15, expire: 4 },
    { shelf: 30, expire: 5 },{ shelf: 90, expire: 10 },{ shelf: 180, expire: 15 },
    { shelf: 365, expire: 20 },{ shelf: 730, expire: 45 }
];
let currSupplierList = [];
let currGoodsList = [];

// ===================== 公共工具函数（全项目通用） =====================
function formatMoney(num) {
    if (isNaN(num) || num === null || num === undefined) return '￥0.00';
    return '￥' + Number(num).toFixed(2);
}

function calculateExpireDays(shelfLifeNum, shelfLifeUnit) {
    if (!shelfLifeNum || !shelfLifeUnit) return '';
    let shelfDays = 0;
    switch (shelfLifeUnit) {
        case '天': shelfDays = shelfLifeNum * 1; break;
        case '个月': shelfDays = shelfLifeNum * 30; break;
        case '年': shelfDays = shelfLifeNum * 365; break;
        default: return '';
    }
    let target = shelfToExpireDays.find(item => shelfDays <= item.shelf);
    return target ? `${target.expire}天` : '';
}

function showMsg(text) {
    document.getElementById('msgText').innerText = text;
    document.getElementById('msgModal').style.display = 'block';
}

function closeMsg() {
    document.getElementById('msgModal').style.display = 'none';
}

// 标签页切换
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    if (tabId === 'stockIn') loadStockIn();
    // 切换到出库自动加载数据
    if (tabId === 'stockOut') loadStockOut();
}

// 点击空白关闭下拉框
document.addEventListener('click', function(e){
    if(!e.target.closest('.search-select-wrap')){
        document.getElementById('supListBox').style.display = 'none';
        document.getElementById('goodsListBox').style.display = 'none';
        // 关闭出库下拉
        document.getElementById('outSupListBox').style.display = 'none';
        document.getElementById('outGoodsListBox').style.display = 'none';
    }
});

// ========== 核心公共方法：计算【批次库存 + 先进先出可出库批次】 ==========
/**
 * 根据 供应商+商品名 获取所有有效入库批次（已扣减出库）
 * 排序规则：生产日期优先升序 → 到期日期升序（先进先出）
 * @param {string} supplier 供应商
 * @param {string} goodsName 商品名
 * @returns {Array} 排序后的批次列表
 */
function getStockBatchList(supplier, goodsName) {
    // 1. 筛选对应商品所有入库记录
    let inList = allStockIn.filter(item => 
        item.supplier === supplier && item.goodsName === goodsName
    );
    // 2. 统计每个入库批次 已出库总量
    let batchOutMap = {};
    allStockOut.forEach(out => {
        if(out.supplier === supplier && out.goodsName === goodsName){
            if(!batchOutMap[out.inRecordId]) batchOutMap[out.inRecordId] = 0;
            batchOutMap[out.inRecordId] += Number(out.outNum);
        }
    });
    // 3. 计算单批次剩余库存
    let batchList = inList.map(inItem => {
        let outTotal = batchOutMap[inItem.id] || 0;
        let remain = Math.max(0, Number(inItem.inNum) - outTotal);
        return {
            ...inItem,
            batchRemain: remain
        };
    }).filter(b => b.batchRemain > 0); // 过滤库存为0的批次

    // 4. 先进先出排序：生产日期早 → 到期日期早
    batchList.sort((a, b) => {
        // 优先按生产日期
        if(a.produce_date && b.produce_date){
            return new Date(a.produce_date) - new Date(b.produce_date);
        }
        // 有生产日期排在前面
        if(a.produce_date) return -1;
        if(b.produce_date) return 1;
        // 无生产日期 按到期日期
        if(a.expire_date && b.expire_date){
            return new Date(a.expire_date) - new Date(b.expire_date);
        }
        return 0;
    });
    return batchList;
}

/**
 * 获取商品总可用库存
 */
function getTotalStockNum(supplier, goodsName) {
    let batchList = getStockBatchList(supplier, goodsName);
    return batchList.reduce((sum, item) => sum + item.batchRemain, 0);
}

/**
 * 执行出库扣减（逐批次先进先出）
 * @param {string} supplier 供应商
 * @param {string} goodsName 商品名
 * @param {number} outNum 本次出库数量
 * @returns {Array} 扣减明细(批次ID+对应出库数量)
 */
function calcFIFOOut(supplier, goodsName, outNum) {
    let batchList = getStockBatchList(supplier, goodsName);
    let remainOut = outNum;
    let outDetail = [];

    for(let batch of batchList){
        if(remainOut <= 0) break;
        let useNum = Math.min(batch.batchRemain, remainOut);
        outDetail.push({
            inRecordId: batch.id,
            useNum: useNum
        });
        remainOut -= useNum;
    }
    return outDetail;
}