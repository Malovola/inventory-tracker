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
let trendChart = null;
let cachedItems = [];
let rawSalesData = [];
let rawSalesActivity = [];
let calculatedStatsCache = [];
let cachedDashboardRaw = null;
let cachedStockRaw = [];
let currentGlobalPeriod = 'all';
let currentTrendPeriod = 'day';
let currentChartType = 'doughnut';

const userRole = (currentUser?.role || 'cashier').toLowerCase();

function setGlobalPeriod(period) {
    currentGlobalPeriod = period;
    ['day', 'month', 'year', 'all'].forEach(p => {
        const btn = document.getElementById(`global-filter-${p}`);
        if (btn) {
            btn.className = (p === period)
                ? 'px-3 py-1 rounded text-white bg-blue-600 font-medium transition'
                : 'px-3 py-1 rounded text-slate-400 hover:text-white transition';
        }
    });
    applyGlobalFilter();
}

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

function applyGlobalFilter() {
    if (!cachedDashboardRaw) return;

    const filteredSales = (cachedDashboardRaw.recent_sales || []).filter(s =>
        isWithinPeriod(s.timestamp, currentGlobalPeriod)
    );

    let periodRevenue = 0;
    let periodSold = 0;
    const itemSalesMap = {};

    filteredSales.forEach(s => {
        const qty = Math.abs(s.quantity);
        const rev = qty * Number(s.unit_price);
        periodRevenue += rev;
        periodSold += qty;

        if (!itemSalesMap[s.item_name]) {
            itemSalesMap[s.item_name] = { name: s.item_name, total_qty: 0 };
        }
        itemSalesMap[s.item_name].total_qty += qty;
    });

    const elRev = document.getElementById('dash-revenue');
    const elSold = document.getElementById('dash-sold');
    const elSkus = document.getElementById('dash-skus');
    if (elRev) elRev.innerText = '$' + periodRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elSold) elSold.innerText = periodSold.toLocaleString('en-US');
    if (elSkus) elSkus.innerText = (cachedDashboardRaw.active_skus || 0).toLocaleString('en-US');

    const tbody = document.getElementById('recent-sales-table');
    if (tbody) {
        if (filteredSales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-stone-500 h-[120px] align-middle text-xs font-mono">No transactions recorded for this period.</td></tr>';
        } else {
            tbody.innerHTML = filteredSales.map(s => {
                const saleDate = new Date(s.timestamp);
                const formattedDate = saleDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const formattedTime = saleDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

                // ดึง 8 ตัวแรกของ UUID มาแสดงเป็น Ref No. สั้นๆ เช่น #6143052d
                const shortTxId = s.id ? s.id.substring(0, 8) : '--------';
                const shortItemId = s.item_id ? s.item_id.substring(0, 8) : '';

                return `<tr class="hover:bg-stone-800/30 transition group">
    <td class="py-2 text-left">
        <div class="font-medium text-white truncate max-w-[200px]" title="${s.item_name}">${s.item_name}</div>
        <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[10px] font-mono text-stone-400 cursor-pointer hover:text-orange-400 transition" 
                  title="Transaction UUID: ${s.id} (Click to copy)" 
                  onclick="navigator.clipboard.writeText('${s.id}'); log('Copied Tx ID: ${shortTxId}', true);">
                Tx #${shortTxId}
            </span>
            ${s.sku ? `<span class="text-[9px] font-mono text-stone-500">· ${s.sku}</span>` : ''}
        </div>
    </td>
    <td class="py-2 text-right font-mono text-stone-300 align-top pt-2.5">${Math.abs(s.quantity)}</td>
    <td class="py-2 text-right font-mono font-medium text-emerald-400 align-top pt-2.5">+$${(Math.abs(s.quantity) * Number(s.unit_price)).toFixed(2)}</td>
    <td class="py-2 text-right font-mono text-[11px] text-stone-400 pr-2 whitespace-nowrap align-top pt-2.5">${formattedDate}, ${formattedTime}</td>
</tr>`;
            }).join('');
        }
    }

    rawSalesData = Object.values(itemSalesMap);
    renderChart(rawSalesData);

    if (currentGlobalPeriod === 'all' || currentGlobalPeriod === 'day') {
        currentTrendPeriod = 'day';
    } else if (currentGlobalPeriod === 'month') {
        currentTrendPeriod = 'month';
    } else if (currentGlobalPeriod === 'year') {
        currentTrendPeriod = 'year';
    }

    rawSalesActivity = cachedDashboardRaw.recent_sales || [];
    renderTrendChart();
    calculateProductInsights(filteredSales, cachedStockRaw, cachedItems);
}

function initApp() {
    if (!currentUser) return;
    const nameEl = document.getElementById('user-display-name');
    if (nameEl) nameEl.innerText = currentUser.displayName || currentUser.email;

    const bizEl = document.getElementById('user-business-name');
    if (bizEl) bizEl.innerText = currentUser.businessName || 'HQ Store';

    const badgeEl = document.getElementById('user-role-badge');
    if (badgeEl) {
        badgeEl.innerText = userRole.toUpperCase();
        badgeEl.className = `role-badge role-${userRole}`;
    }

    if (userRole === 'cashier') {
        const navDash = document.getElementById('nav-dashboard');
        if (navDash) navDash.classList.add('hidden');
        const regTab = document.getElementById('tab-reg-btn');
        if (regTab) regTab.classList.add('hidden');
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
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('active');
}

function switchTab(tabId) {
    if (userRole === 'cashier' && tabId === 'dashboard') {
        tabId = 'management';
    }

    document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) activeNav.classList.add('active');

    const viewDash = document.getElementById('view-dashboard');
    const viewMgmt = document.getElementById('view-management');
    if (viewDash) viewDash.classList.add('hidden');
    if (viewMgmt) viewMgmt.classList.add('hidden');

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.remove('hidden');

    const titles = {
        'dashboard': 'Daily Register & Sales',
        'management': 'Stock Management & Operations'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[tabId];

    if (tabId === 'dashboard') fetchDashboard();
    if (tabId === 'management') fetchStock();

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    }
}

function toggleStockSubTab(tab) {
    const isLog = tab === 'log';
    const logSection = document.getElementById('subview-log-movement');
    const regSection = document.getElementById('subview-register-product');
    const tabLogBtn = document.getElementById('tab-log-btn');
    const tabRegBtn = document.getElementById('tab-reg-btn');

    if (logSection) logSection.classList.toggle('hidden', !isLog);
    if (regSection) regSection.classList.toggle('hidden', isLog);

    if (tabLogBtn) {
        tabLogBtn.className = isLog
            ? 'flex-1 py-1 rounded bg-slate-800 text-white font-medium'
            : 'flex-1 py-1 rounded text-slate-400 hover:text-white';
    }
    if (tabRegBtn) {
        tabRegBtn.className = !isLog
            ? 'flex-1 py-1 rounded bg-slate-800 text-white font-medium'
            : 'flex-1 py-1 rounded text-slate-400 hover:text-white';
    }
}

function filterStockTable() {
    const query = (document.getElementById('stock-search')?.value || '').toLowerCase();
    const rows = document.querySelectorAll('#stock-table tr');
    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(query) ? '' : 'none';
    });
}

function updateQtyLabel() {
    const type = document.getElementById('evt-type').value;
    const lbl = document.getElementById('lbl-qty');
    if (!lbl) return;
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
    const el = document.getElementById('log');
    if (el) el.innerHTML = '';
}

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

    const palette = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#64748b'];
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
                    legend: { position: 'right', labels: { color: '#a39a8a', font: { family: 'IBM Plex Sans' } } }
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
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#a39a8a', font: { family: 'IBM Plex Sans', size: 11 } } },
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a39a8a', font: { family: 'IBM Plex Mono', size: 11 }, precision: 0 } }
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
                    borderColor: '#c2661c',
                    backgroundColor: 'rgba(194, 102, 28, 0.15)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#e2a066',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#a39a8a', font: { family: 'IBM Plex Sans', size: 11 } } },
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a39a8a', font: { family: 'IBM Plex Mono', size: 11 }, precision: 0 } }
                }
            }
        };
    }

    salesChart = new Chart(ctx, chartConfig);
}

function renderTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    const sortedSales = [...rawSalesActivity].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const aggregated = {};

    sortedSales.forEach(sale => {
        const dateObj = new Date(sale.timestamp);
        let key = '';

        if (currentTrendPeriod === 'day') {
            key = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        } else if (currentTrendPeriod === 'month') {
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
                backgroundColor: '#2563eb',
                borderRadius: 4,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx) => ` Revenue: $${Number(ctx.raw).toFixed(2)}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#a39a8a', font: { family: 'IBM Plex Sans', size: 11 } } },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a39a8a', font: { family: 'IBM Plex Mono', size: 11 }, callback: (val) => `$${val}` }
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
        if (!tbody) return;

        if (stockData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-stone-500 py-8 text-xs font-mono">No inventory data available yet.</td></tr>';
            return;
        }

        tbody.innerHTML = stockData.map(item => {
            const qty = item.quantity || 0;
            let qtyColor = 'text-emerald-400';
            if (qty <= 0) {
                qtyColor = 'text-rose-400';
            } else if (qty < 5) {
                qtyColor = 'text-amber-400';
            }

            const itemId = item.item_id || item.id || '';
            const shortId = itemId ? itemId.substring(0, 8) : '--------';

            return `<tr class="hover:bg-stone-800/30 transition">
        <td class="py-2.5 text-left truncate">
            <div class="font-mono text-stone-300 text-xs">${item.sku}</div>
            <div class="text-[10px] font-mono text-stone-500 cursor-pointer hover:text-orange-400 transition" 
                 title="Full Product UUID: ${itemId} (Click to copy)" 
                 onclick="navigator.clipboard.writeText('${itemId}'); log('Copied Product ID: ${shortId}', true);">
                #${shortId}
            </div>
        </td>
        <td class="py-2.5 text-left font-medium text-white truncate">${item.item_name}</td>
        <td class="py-2.5 text-left text-stone-400 truncate">${item.category || '—'}</td>
        <td class="py-2.5 text-right font-mono text-stone-300">$${Number(item.unit_cost_default || 0).toFixed(2)}</td>
        <td class="py-2.5 text-right font-mono font-bold ${qtyColor} pr-3">${qty}</td>
    </tr>`;
        }).join('');
    } catch (e) {
        console.error('Failed to fetch stock snapshot:', e);
    }
}

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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-stone-500 py-6 font-mono text-xs">No matching SKU data found.</td></tr>';
        return;
    }

    tbody.innerHTML = statsArray.map(item => {
        const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '0.0';

        let velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono text-stone-400 bg-stone-800">Steady</span>`;
        if (item.soldQty >= 5) {
            velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Top Seller</span>`;
        } else if (item.soldQty === 0) {
            velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono text-stone-500 bg-stone-800/40">No Sales</span>`;
        }

        return `<tr class="hover:bg-stone-800/30 transition">
    <td class="py-2 text-left truncate">
        <div class="font-medium text-white truncate">${item.name}</div>
        <div class="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-stone-400">
            <span>${item.sku}</span>
            <span class="text-stone-600">·</span>
            <span class="cursor-pointer text-stone-400 hover:text-orange-400 transition" 
                  title="Product Master UUID: ${item.id} (Click to copy)" 
                  onclick="navigator.clipboard.writeText('${item.id}'); log('Copied Item ID: ${item.id.substring(0, 8)}', true);">
                Item #${item.id ? item.id.substring(0, 8) : '--------'}
            </span>
            <span class="text-stone-600">·</span>
            <span>Cost: $${item.cost.toFixed(2)}</span>
        </div>
    </td>
    <td class="py-2 text-right font-mono text-stone-200">${item.soldQty}</td>
    <td class="py-2 text-right font-mono text-stone-200">$${item.revenue.toFixed(2)}</td>
    <td class="py-2 text-right font-mono font-medium ${item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
        ${item.profit >= 0 ? '+' : ''}$${item.profit.toFixed(2)}
    </td>
    <td class="py-2 text-right font-mono ${Number(margin) >= 30 ? 'text-emerald-400 font-semibold' : 'text-stone-300'}">
        ${margin}%
    </td>
    <td class="py-2 text-center">${velocityBadge}</td>
</tr>`;
    }).join('');
}

function calculateProductInsights(salesActivity, stockData, itemsList) {
    let totalGrossProfit = 0;
    let totalInventoryValuation = 0;
    let totalUnitsOnShelf = 0;

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

    // รวมมูลค่าสต็อกและจำนวนชิ้นสินค้าคงคลังทั้งหมดบนเชลฟ์
    stockData.forEach(item => {
        const qty = Math.max(0, item.quantity || 0);
        const cost = itemStats[item.item_id]?.cost ?? Number(item.unit_cost_default || 0);
        totalInventoryValuation += qty * cost;
        totalUnitsOnShelf += qty;
    });

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

    const elProfit = document.getElementById('dash-profit');
    const elValuation = document.getElementById('dash-valuation');
    const elUnits = document.getElementById('dash-total-units');

    if (elProfit) {
        elProfit.innerText = '$' + totalGrossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (elValuation) {
        elValuation.innerText = '$' + totalInventoryValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (elUnits) {
        elUnits.innerText = totalUnitsOnShelf.toLocaleString('en-US');
    }

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