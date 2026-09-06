const token = localStorage.getItem('nextrack_token');
const userStr = localStorage.getItem('nextrack_user');
let currentUser = null;
try {
    currentUser = userStr ? JSON.parse(userStr) : null;
} catch (e) {
    currentUser = null;
}

if (!token || !currentUser) {
    localStorage.removeItem('nextrack_token');
    localStorage.removeItem('nextrack_user');
    window.location.href = '/login.html';
}

const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";
let salesChart = null;
let cachedItems = [];

const userRole = (currentUser?.role || 'cashier').toLowerCase();

let currentGlobalPeriod = 'all'; // 'day' | 'month' | 'year' | 'all'
let cachedDashboardRaw = null;   // เก็บข้อมูลดิบจาก API ไว้คำนวณซ้ำโดยไม่ต้องยิง request ใหม่
let cachedStockRaw = [];

// ฟังก์ชันสลับช่วงเวลา Global
function setGlobalPeriod(period) {
    currentGlobalPeriod = period;

    // อัปเดตสไตล์ปุ่ม
    ['day', 'month', 'year', 'all'].forEach(p => {
        const btn = document.getElementById(`global-filter-${p}`);
        if (btn) {
            if (p === period) {
                btn.className = 'px-3 py-1 rounded font-medium text-white bg-blue-600 transition';
            } else {
                btn.className = 'px-3 py-1 rounded font-medium text-slate-400 hover:text-white transition';
            }
        }
    });

    applyGlobalFilter();
}

// ตรวจสอบว่า timestamp อยู่ในช่วงเวลาที่เลือกหรือไม่
function isWithinPeriod(timestamp, period) {
    if (period === 'all') return true;

    const target = new Date(timestamp);
    const now = new Date();

    if (period === 'day') {
        return target.getFullYear() === now.getFullYear() &&
               target.getMonth() === now.getMonth() &&
               target.getDate() === now.getDate();
    }
    if (period === 'month') {
        return target.getFullYear() === now.getFullYear() &&
               target.getMonth() === now.getMonth();
    }
    if (period === 'year') {
        return target.getFullYear() === now.getFullYear();
    }
    return true;
}

// ประมวลผลและอัปเดตทุก Element บน Dashboard
function applyGlobalFilter() {
    if (!cachedDashboardRaw) return;

    // 1. กรองรายการขายตามช่วงเวลาที่เลือก
    const filteredSales = (cachedDashboardRaw.recent_sales || []).filter(s => 
        isWithinPeriod(s.timestamp, currentGlobalPeriod)
    );

    // 2. รวมยอด Gross Revenue และ Units Sold ประจำช่วงเวลา
    let periodRevenue = 0;
    let periodSold = 0;
    const itemSalesMap = {};

    filteredSales.forEach(s => {
        const qty = Math.abs(s.quantity);
        const rev = qty * Number(s.unit_price);
        periodRevenue += rev;
        periodSold += qty;

        // จัดกลุ่มสำหรับ Sales Analytics Chart
        if (!itemSalesMap[s.item_name]) {
            itemSalesMap[s.item_name] = { name: s.item_name, total_qty: 0 };
        }
        itemSalesMap[s.item_name].total_qty += qty;
    });

    // 3. อัปเดต KPI Cards
    document.getElementById('dash-revenue').innerText = '$' + periodRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('dash-sold').innerText = periodSold.toLocaleString('en-US');
    document.getElementById('dash-skus').innerText = (cachedDashboardRaw.active_skus || 0).toLocaleString('en-US');

    // 4. อัปเดตตาราง Live Transaction Stream
    const tbody = document.getElementById('recent-sales-table');
    if (tbody) {
        if (filteredSales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-6 text-xs">No transactions in this period.</td></tr>';
        } else {
            tbody.innerHTML = filteredSales.map(s => {
                const saleDate = new Date(s.timestamp);
                const formattedDate = saleDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const formattedTime = saleDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

                return `<tr>
                    <td class="font-medium text-white">${s.item_name}</td>
                    <td>${Math.abs(s.quantity)}</td>
                    <td class="text-emerald-400 font-medium">+$${(Math.abs(s.quantity) * Number(s.unit_price)).toFixed(2)}</td>
                    <td class="text-xs text-slate-400 font-mono">${formattedDate}, ${formattedTime}</td>
                </tr>`;
            }).join('');
        }
    }

    // 5. อัปเดต กราฟ Sales Analytics (ตามสินค้าที่ขายได้ในช่วงเวลาที่เลือก)
    rawSalesData = Object.values(itemSalesMap);
    renderChart(rawSalesData);

    // ปรับมุมมองแกนเวลาของ Trend Chart ให้สัมพันธ์กับ Global Filter
    if (currentGlobalPeriod === 'all' || currentGlobalPeriod === 'day') {
        currentTrendPeriod = 'day';
    } else if (currentGlobalPeriod === 'month') {
        currentTrendPeriod = 'month';
    } else if (currentGlobalPeriod === 'year') {
        currentTrendPeriod = 'year';
    }

    // ส่งรายการขายทั้งหมดเข้า Trend Chart เพื่อให้เห็นแท่งแนวโน้มเปรียบเทียบย้อนหลัง
    rawSalesActivity = cachedDashboardRaw.recent_sales || [];
    renderTrendChart();

    // 6. อัปเดต ตาราง SKU Performance & Profitability
    calculateProductInsights(filteredSales, cachedStockRaw, cachedItems);
}

function initApp() {
    if (!currentUser) return;
    const nameEl = document.getElementById('user-display-name');
    if (nameEl) nameEl.innerText = currentUser.displayName || currentUser.email;

    const bizEl = document.getElementById('user-business-name');
    if (bizEl) bizEl.innerText = currentUser.businessName || 'HQ Store';

    const badgeEl = document.getElementById('user-role-badge');
    const pillEl = document.getElementById('role-pill');

    if (badgeEl) {
        badgeEl.innerText = userRole.toUpperCase();
        badgeEl.className = `role-badge role-${userRole}`;
    }
    if (pillEl) {
        pillEl.innerText = userRole.toUpperCase();
        pillEl.className = `hidden md:inline-block role-badge role-${userRole}`;
    }

    if (userRole === 'cashier') {
        const navDash = document.getElementById('nav-dashboard');
        if (navDash) navDash.classList.add('hidden');
        const regCard = document.getElementById('card-register-product');
        if (regCard) regCard.classList.add('hidden');
        const movCard = document.getElementById('movement-card');
        if (movCard) movCard.style.gridColumn = 'span 3';
    }
}

async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
    if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, options);
    if (res.status === 401) {
        localStorage.removeItem('nextrack_token');
        localStorage.removeItem('nextrack_user');
        window.location.href = '/login.html';
        throw new Error('Session expired, please log in again.');
    }
    return res;
}

function logout() {
    localStorage.removeItem('nextrack_token');
    localStorage.removeItem('nextrack_user');
    window.location.href = '/login.html';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('active');
}

function switchTab(tabId) {
    if (userRole === 'cashier' && tabId === 'dashboard') {
        tabId = 'management';
    }

    document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) activeNav.classList.add('active');

    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-management').classList.add('hidden');

    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    const titles = {
        'dashboard': 'Dashboard Overview',
        'management': 'Stock Management & Operations'
    };
    document.getElementById('page-title').innerText = titles[tabId];

    if (tabId === 'dashboard') fetchDashboard();
    if (tabId === 'management') fetchStock();

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
    }
}

function updateQtyLabel() {
    const type = document.getElementById('evt-type').value;
    const lbl = document.getElementById('lbl-qty');
    if (type === 'ADJUSTMENT') {
        lbl.innerText = 'Actual Shelf Count (Set Total)';
        lbl.classList.add('text-amber-400');
    } else {
        lbl.innerText = 'Quantity';
        lbl.classList.remove('text-amber-400');
    }
}

function onItemSelectChange() {
    const select = document.getElementById('evt-item');
    if (!select || select.selectedIndex < 0) return;
    const selected = select.options[select.selectedIndex];
    const cost = selected.getAttribute('data-cost');
    if (cost) {
        document.getElementById('evt-price').value = cost;
    }
}

function log(msg, ok = true) {
    const el = document.getElementById('log');
    if (!el) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + (ok ? 'log-ok' : 'log-err');
    const time = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    entry.innerHTML = `<span>${msg}</span> <span class="text-xs opacity-75 font-mono">${time}</span>`;
    el.prepend(entry);
}

function clearLogs() {
    document.getElementById('log').innerHTML = '';
}

// เพิ่มตัวแปร global เก็บข้อมูลสำหรับกราฟ
let currentChartType = 'doughnut';
let rawSalesData = [];

// ฟังก์ชันสลับรูปแบบกราฟเมื่อกดเลือก Dropdown
function changeChartType(type) {
    currentChartType = type;
    renderChart(rawSalesData);
}

function renderChart(salesData) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (salesChart) {
        salesChart.destroy();
    }

    if (!salesData || salesData.length === 0) {
        salesData = [{ name: 'No sales yet', total_qty: 0 }];
    }

    const labels = salesData.map(d => d.name);
    const data = salesData.map(d => parseInt(d.total_qty, 10));

    // ชุดสีมาตรฐานสำหรับธีม
    const palette = [
        'rgba(59, 130, 246, 0.85)',
        'rgba(16, 185, 129, 0.85)',
        'rgba(139, 92, 246, 0.85)',
        'rgba(245, 158, 11, 0.85)',
        'rgba(236, 72, 153, 0.85)'
    ];

    let chartConfig = {};

    if (currentChartType === 'doughnut') {
        chartConfig = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: palette,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#cbd5e1', font: { family: 'Inter' } } }
                },
                cutout: '70%'
            }
        };
    } else if (currentChartType === 'bar') {
        chartConfig = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Units Sold',
                    data: data,
                    backgroundColor: palette,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, precision: 0 }
                    }
                }
            }
        };
    } else if (currentChartType === 'line') {
        chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Units Sold',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#60a5fa',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, precision: 0 }
                    }
                }
            }
        };
    }

    salesChart = new Chart(ctx, chartConfig);
}

let trendChart = null;
let currentTrendPeriod = 'day'; // 'day' | 'month' | 'year'
let rawSalesActivity = [];

function renderTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    // 1. เรียงลำดับรายการขายจาก เก่าสุด -> ใหม่สุด ก่อนนำไปจัดกลุ่ม
    const sortedSales = [...rawSalesActivity].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const aggregated = {};

    sortedSales.forEach(sale => {
        const dateObj = new Date(sale.timestamp);
        let key = '';

        if (currentTrendPeriod === 'day') {
            // วัน เดือนสากล เช่น "05 Sep", "06 Sep"
            key = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        } else if (currentTrendPeriod === 'month') {
            // เดือน ปีสากล เช่น "Aug 2026", "Sep 2026"
            key = dateObj.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        } else if (currentTrendPeriod === 'year') {
            key = dateObj.getFullYear().toString();
        }

        const rev = Math.abs(sale.quantity) * Number(sale.unit_price);
        aggregated[key] = (aggregated[key] || 0) + rev;
    });

    let labels = Object.keys(aggregated);
    let data = Object.values(aggregated);

    if (labels.length === 0) {
        labels = ['No Data'];
        data = [0];
    }

    trendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue ($)',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.75)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 45, // ปรับขนาดแท่งกราฟให้พอดี ไม่หนาหรือบางเกินไป
                hoverBackgroundColor: 'rgba(52, 211, 153, 0.9)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` Revenue: $${Number(ctx.raw).toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        callback: (val) => `$${val}`
                    }
                }
            }
        }
    });
}

async function fetchDashboard() {
    if (userRole === 'cashier') return;
    try {
        const [resDash, resStock] = await Promise.all([
            authFetch('/api/dashboard'),
            authFetch('/api/stock?limit=100')
        ]);

        if (!resDash.ok) return;
        cachedDashboardRaw = await resDash.json();
        cachedStockRaw = resStock.ok ? (await resStock.json()).data || [] : [];

        // กระจายผลไปยัง Dashboard ตามตัวกรองปัจจุบัน
        applyGlobalFilter();
    } catch (e) {
        console.error('Error fetching dashboard:', e);
    }
}

async function createItem() {
    try {
        const sku = document.getElementById('item-sku').value.trim();
        const name = document.getElementById('item-name').value.trim();
        const category = document.getElementById('item-cat').value.trim();
        const cost = parseFloat(document.getElementById('item-cost').value);

        if (!sku || !name) {
            log('Please provide both SKU and Product Name', false);
            return;
        }

        const res = await authFetch('/api/items', {
            method: 'POST',
            body: JSON.stringify({
                sku,
                name,
                category: category || null,
                unit_cost_default: isNaN(cost) ? 0 : cost,
            })
        });

        const data = await res.json();
        if (!res.ok) {
            const detail = data.details ? data.details.map(d => d.message).join(', ') : data.error;
            log('Error creating product: ' + detail, false);
            return;
        }

        log(`Success! Product "${data.name}" (${data.sku}) added to catalog.`);
        document.getElementById('item-sku').value = '';
        document.getElementById('item-name').value = '';
        document.getElementById('item-cat').value = '';

        await fetchItems();
        await fetchStock();
    } catch (e) {
        log('Network error: ' + e.message, false);
    }
}

async function logEvent() {
    try {
        let qty = parseInt(document.getElementById('evt-qty').value, 10);
        const eventType = document.getElementById('evt-type').value;
        const price = parseFloat(document.getElementById('evt-price').value) || 0;
        const itemId = document.getElementById('evt-item').value;

        if (!itemId) {
            log('Please select a product from catalog first', false);
            return;
        }

        if (isNaN(qty) && eventType !== 'ADJUSTMENT') {
            log('Please enter a valid quantity', false);
            return;
        }

        if (eventType === 'SALE' || eventType === 'WASTE') {
            qty = -Math.abs(qty);
        } else if (eventType === 'RESTOCK' || eventType === 'RETURN') {
            qty = Math.abs(qty);
        }

        const body = {
            item_id: itemId,
            store_id: DEFAULT_STORE_ID,
            event_type: eventType,
            quantity: qty,
            unit_price: price,
            note: document.getElementById('evt-note').value.trim() || null,
            source: 'MANUAL',
        };

        const res = await authFetch('/api/events', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (!res.ok) {
            const detail = data.details ? data.details.map(d => d.message).join(', ') : data.error;
            log('Failed: ' + (detail || 'Unknown Error'), false);
            return;
        }

        if (data.message) {
            log(data.message, true);
        } else {
            const actionWord = eventType === 'ADJUSTMENT' ? 'adjusted by' : 'logged';
            log(`Success: ${eventType} ${actionWord} ${Math.abs(data.quantity)} units.`);
        }

        fetchStock();
        if (userRole !== 'cashier') {
            fetchDashboard();
        }
    } catch (e) {
        log('Network error: ' + e.message, false);
    }
}

async function fetchItems() {
    try {
        const res = await authFetch('/api/items?limit=100');
        if (!res.ok) return;
        const json = await res.json();
        cachedItems = json.data || [];

        const select = document.getElementById('evt-item');
        if (cachedItems.length === 0) {
            select.innerHTML = '<option value="">(No products in catalog)</option>';
            return;
        }

        select.innerHTML = cachedItems.map(i =>
            `<option value="${i.id}" data-cost="${i.unit_cost_default}">${i.name} (${i.sku})</option>`
        ).join('');

        onItemSelectChange();
    } catch (e) {
        console.error('Failed to fetch items:', e);
    }
}

async function fetchStock() {
    try {
        const res = await authFetch('/api/stock?limit=100');
        if (!res.ok) return;
        const json = await res.json();
        const stockData = json.data || [];

        const tbody = document.getElementById('stock-table');

        if (stockData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-500 py-8">No inventory data available yet.</td></tr>';
            return;
        }

        tbody.innerHTML = stockData.map(item => {
            const qty = item.quantity || 0;
            let status = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">In Stock</span>`;
            if (qty <= 0) {
                status = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25">Out of Stock</span>`;
            } else if (qty < 5) {
                status = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">Low Stock</span>`;
            }

            return `<tr>
                <td class="font-mono text-xs text-slate-400">${item.sku}</td>
                <td class="font-medium text-white">${item.item_name}</td>
                <td>${item.category || '—'}</td>
                <td class="font-mono text-slate-300">$${Number(item.unit_cost_default || 0).toFixed(2)}</td>
                <td class="text-base font-bold ${qty <= 0 ? 'text-red-400' : 'text-slate-100'}">${qty}</td>
                <td>${status}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('Failed to fetch stock snapshot:', e);
    }
}
let calculatedStatsCache = [];

function filterProfitabilityTable() {
    const query = (document.getElementById('sku-table-search')?.value || '').toLowerCase();
    const filtered = calculatedStatsCache.filter(item =>
        item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
    );
    renderProfitabilityRows(filtered);
}

function renderProfitabilityRows(statsArray) {
    const tbody = document.getElementById('profitability-table');
    if (!tbody) return;

    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-500 py-6 font-mono text-xs">No matching SKU data found.</td></tr>';
        return;
    }

    tbody.innerHTML = statsArray.map(item => {
        const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '0.0';

        let velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/80">NORMAL</span>`;
        if (item.soldQty >= 5) {
            velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FAST</span>`;
        } else if (item.soldQty === 0) {
            velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">DEAD</span>`;
        }

        return `<tr class="hover:bg-slate-800/30 transition">
            <td class="py-2.5">
                <div class="font-medium text-white">${item.name}</div>
                <div class="text-[10px] font-mono text-slate-400">${item.sku} · Cost: $${item.cost.toFixed(2)}</div>
            </td>
            <td class="py-2.5 text-right font-mono text-slate-200">${item.soldQty}</td>
            <td class="py-2.5 text-right font-mono text-slate-200">$${item.revenue.toFixed(2)}</td>
            <td class="py-2.5 text-right font-mono font-medium ${item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                ${item.profit >= 0 ? '+' : ''}$${item.profit.toFixed(2)}
            </td>
            <td class="py-2.5 text-right font-mono ${Number(margin) >= 30 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}">
                ${margin}%
            </td>
            <td class="py-2.5 text-center">${velocityBadge}</td>
        </tr>`;
    }).join('');
}
function calculateProductInsights(salesActivity, stockData, itemsList) {
    let totalGrossProfit = 0;
    let totalInventoryValuation = 0;

    // 1. ตั้งต้นข้อมูลสินค้าจาก catalog
    const itemStats = {};
    itemsList.forEach(i => {
        itemStats[i.id] = {
            id: i.id,
            sku: i.sku,
            name: i.name,
            cost: Number(i.unit_cost_default || 0),
            soldQty: 0,
            revenue: 0,
            profit: 0
        };
    });

    // 2. คำนวณมูลค่าสต็อกคงคลังรวม (ดึง cost จาก catalog เพื่อความถูกต้อง)
    stockData.forEach(item => {
        const qty = Math.max(0, item.quantity || 0);
        // ดึง cost จาก itemStats หรือ fallback ไปที่ item.unit_cost_default
        const cost = itemStats[item.item_id]?.cost ?? Number(item.unit_cost_default || 0);
        totalInventoryValuation += qty * cost;
    });

    // 3. รวบรวมยอดขายและกำไรจากประวัติยอดขายจริง
    salesActivity.forEach(sale => {
        const found = itemsList.find(i => i.name === sale.item_name || i.id === sale.item_id);
        const itemId = found ? found.id : sale.item_id;

        if (itemStats[itemId]) {
            const qty = Math.abs(sale.quantity || 0);
            const price = Number(sale.unit_price || 0);
            const cost = itemStats[itemId].cost;
            const rev = qty * price;
            const profit = rev - (qty * cost);

            itemStats[itemId].soldQty += qty;
            itemStats[itemId].revenue += rev;
            itemStats[itemId].profit += profit;
            totalGrossProfit += profit;
        }
    });

    // 4. อัปเดต Metric Cards
    const elProfit = document.getElementById('dash-profit');
    const elValuation = document.getElementById('dash-valuation');

    if (elProfit) {
        elProfit.innerText = '$' + totalGrossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (elValuation) {
        elValuation.innerText = '$' + totalInventoryValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // 5. จัดเรียงและส่งให้ renderProfitabilityRows จัดการแสดงผลจุดเดียว
    const statsArray = Object.values(itemStats);
    statsArray.sort((a, b) => b.profit - a.profit);

    calculatedStatsCache = statsArray;
    renderProfitabilityRows(statsArray);
}
(async function init() {
    initApp();
    await fetchItems();
    if (userRole === 'cashier') {
        switchTab('management');
    } else {
        switchTab('dashboard');
    }
})();