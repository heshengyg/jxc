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
}

// 点击空白关闭下拉框
document.addEventListener('click', function(e){
    if(!e.target.closest('.search-select-wrap')){
        document.getElementById('supListBox').style.display = 'none';
        document.getElementById('goodsListBox').style.display = 'none';
    }
});