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


// ===================== 公共工具函数：库存计算（最终修复版） =====================
/**
 * 按【供应商+商品名+规格+生产日期/到期日期】合并批次库存
 * 先进先出排序：生产日期早 > 到期日期早
 */
function getStockBatchList(supplier, goodsName) {
    // 1. 筛选对应商品所有入库记录
    let inList = allStockIn.filter(item => 
        item.supplier === supplier && item.goodsName === goodsName
    );

    // 2. 按批次合并：key = 供应商+商品名+规格+生产日期+到期日期
    let batchMap = {};
    inList.forEach(inItem => {
        let batchKey = `${inItem.supplier}_${inItem.goodsName}_${inItem.spec}_${inItem.produce_date || ''}_${inItem.expire_date || ''}`;
        
        if (!batchMap[batchKey]) {
            batchMap[batchKey] = {
                supplier: inItem.supplier,
                goodsName: inItem.goodsName,
                spec: inItem.spec,
                settleType: inItem.settleType,
                produce_date: inItem.produce_date,
                expire_date: inItem.expire_date,
                inRecords: [],
                totalInNum: 0,
                batchRemain: 0
            };
        }
        batchMap[batchKey].inRecords.push(inItem);
        batchMap[batchKey].totalInNum += Number(inItem.in_num);
    });

    // 3. 统计每个批次已出库总量（关键修复：解析JSON字符串）
    Object.values(batchMap).forEach(batch => {
        let outTotal = 0;
        allStockOut.forEach(out => {
            if (out.supplier === supplier && out.goodsName === goodsName) {
                if (out.outDetail) {
                    try {
                        // 先判断outDetail是不是字符串，如果是则解析
                        let detailList = typeof out.outDetail === 'string' 
                            ? JSON.parse(out.outDetail) 
                            : out.outDetail;
                        if (Array.isArray(detailList)) {
                            detailList.forEach(detail => {
                                let isInBatch = batch.inRecords.some(inItem => inItem.id === detail.inRecordId);
                                if (isInBatch) {
                                    outTotal += Number(detail.useNum);
                                }
                            });
                        }
                    } catch (e) {
                        console.error('解析outDetail失败', out.outDetail, e);
                    }
                } else if (out.inRecordId) {
                    // 兼容旧版出库记录
                    let isInBatch = batch.inRecords.some(inItem => inItem.id === out.inRecordId);
                    if (isInBatch) {
                        outTotal += Number(out.outNum);
                    }
                }
            }
        });
        batch.batchRemain = Math.max(0, batch.totalInNum - outTotal);
    });

    // 4. 过滤库存为0的批次，并按先进先出排序
    let batchList = Object.values(batchMap).filter(b => b.batchRemain > 0);
    batchList.sort((a, b) => {
        if (a.produce_date && b.produce_date) {
            return new Date(a.produce_date) - new Date(b.produce_date);
        }
        if (a.produce_date) return -1;
        if (b.produce_date) return 1;
        if (a.expire_date && b.expire_date) {
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
 * 执行出库扣减（按合并批次先进先出）
 * 扣减规则：先扣减最早批次，批次库存用完再扣下一批次
 */
function calcFIFOOut(supplier, goodsName, outNum) {
    let batchList = getStockBatchList(supplier, goodsName);
    let remainOut = outNum;
    let outDetail = [];

    for(let batch of batchList){
        if(remainOut <= 0) break;
        // 当前批次可扣减数量
        let useFromBatch = Math.min(batch.batchRemain, remainOut);
        // 批次内按入库记录ID排序（先进先出）
        let sortedInRecords = [...batch.inRecords].sort((a, b) => a.id - b.id);

        // 分配扣减到批次内的入库记录
        for(let inItem of sortedInRecords){
            if(remainOut <= 0) break;
            // 计算该入库记录的剩余库存
            let outTotalForIn = allStockOut
                .filter(out => out.inRecordId === inItem.id)
                .reduce((sum, out) => sum + Number(out.outNum), 0);
            let inRemain = Math.max(0, Number(inItem.in_num) - outTotalForIn);
            if(inRemain <= 0) continue;

            let useForThisIn = Math.min(inRemain, remainOut);
            outDetail.push({
                inRecordId: inItem.id,
                useNum: useForThisIn
            });
            remainOut -= useForThisIn;
        }
    }
    return outDetail;
}