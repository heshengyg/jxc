// ===================== 全局变量区（所有模块仅在此声明） =====================
// 页面缓存：存储入库、出库已加载分页数据，切换不用重新请求
let pageCache = {
    stockIn: { data: null, page: 1 },
    stockOut: { data: null, page: 1 }
};
// 新增1：库存计算全局缓存（解决每行重复循环计算库存卡顿）
let stockDataCache = new Map(); 
// key格式：`supplier|goodsName`，value存储{totalStock, batchList}

// 新增2：一次性批量预计算所有商品库存，只执行1次，渲染表格直接读缓存
function refreshAllStockCache(inList, outList) {
    stockDataCache.clear();
    const uniqueKeySet = new Set();
    // 提取所有唯一供应商+商品组合
    inList.forEach(item => {
        const key = `${item.supplier}|${item.goodsName}`;
        uniqueKeySet.add(key);
    });
    // 批量计算存入缓存
    uniqueKeySet.forEach(key => {
        const [sup, gName] = key.split('|');
        stockDataCache.set(key, {
            totalStock: getTotalStockNum(sup, gName),
            batchList: getStockBatchList(sup, gName)
        });
    });
}

// 商品模块
let allGoods = [];
let filteredGoods = [];
let currentPage = 1, pageSize = 10, totalPages = 1;
let sortField = '', sortAsc = true;

// 入库模块【修复：初始每页和页面下拉默认5条保持一致】
let allStockIn = [];
let filteredStockIn = [];
let inCurrentPage = 1, inPageSize = 5, inTotalPages = 1;
let inSortField = '', inSortAsc = true;

// ========== 新增：出库模块全局变量【修复：初始每页5条】 ==========
let allStockOut = [];
let filteredStockOut = [];
let outCurrentPage = 1, outPageSize = 5, outTotalPages = 1;
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

// 标签页切换【修复：避免重复请求，加缓存判断】
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tabId === 'stockIn') {
        // 无缓存才重新加载
        if (!pageCache.stockIn.data) {
            loadStockIn();
        } else {
            filterStockIn();
        }
    }
    if (tabId === 'stockOut') {
        // 先确保入库数据加载完成
        if (!pageCache.stockIn.data) loadStockIn();
        if (!pageCache.stockOut.data) {
            loadStockOut();
        } else {
            filterStockOut();
        }
    }
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
 * 按【供应商+商品名+规格+入库单价+生产日期/到期日期】合并批次库存
 * 先进先出排序：生产日期早 > 到期日期早
 * 同生产/到期：按批次最早入库记录ID升序（先录入先出库）
 */
function getStockBatchList(supplier, goodsName) {
    // 1. 筛选对应商品所有入库记录
    let inList = allStockIn.filter(item => 
        item.supplier === supplier && item.goodsName === goodsName
    );

    // 2. 按批次合并：key = 供应商+商品名+规格+入库单价+生产日期+到期日期
    let batchMap = {};
    inList.forEach(inItem => {
        // 【唯一修改处】新增 in_price 进入批次唯一标识
        let batchKey = `${inItem.supplier}_${inItem.goodsName}_${inItem.spec}_${inItem.in_price || 0}_${inItem.produce_date || ''}_${inItem.expire_date || ''}`;
        
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

    // 4. 过滤库存为0的批次
    let batchList = Object.values(batchMap).filter(b => b.batchRemain > 0);

    // ========== 核心修改：先按生产/到期排序，同日期再按【批次最早入库ID升序】 ==========
    batchList.sort((a, b) => {
        // 第一优先级：生产日期
        if (a.produce_date && b.produce_date) {
            let pdDiff = new Date(a.produce_date) - new Date(b.produce_date);
            if (pdDiff !== 0) return pdDiff;
        }
        if (a.produce_date) return -1;
        if (b.produce_date) return 1;

        // 第二优先级：到期日期
        if (a.expire_date && b.expire_date) {
            let edDiff = new Date(a.expire_date) - new Date(b.expire_date);
            if (edDiff !== 0) return edDiff;
        }

        // 第三优先级：生产/到期完全相同时 → 取批次内第一条入库ID，升序（先录入先出库）
        let aFirstId = a.inRecords[0] ? Number(a.inRecords[0].id) : 0;
        let bFirstId = b.inRecords[0] ? Number(b.inRecords[0].id) : 0;
        return aFirstId - bFirstId;
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