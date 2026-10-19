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
let currentStockFilter = 'all'; // 'all' | 'low' | 'out'
let currentStockCategory = 'all';
let customDateFrom = null; // Date object
let customDateTo = null;   // Date object

// Audio Synthesizer (Instant supermarket-style scanner chime)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSuccessBeep() {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.09);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) { }

    if (navigator.vibrate) navigator.vibrate([70]);
}

function playWarningBeep() {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(290, audioCtx.currentTime + 0.18);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) { }

    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

// Toast Notifications System
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <span>${type === 'success' ? '✅' : (type === 'warning' ? '⚠️' : (type === 'error' ? '❌' : 'ℹ️'))}</span>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="text-white/60 hover:text-white font-mono text-sm leading-none">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 250);
    }, 4500);
}

const userRole = (currentUser?.role || 'cashier').toLowerCase();

function setGlobalPeriod(period) {
    currentGlobalPeriod = period;
    ['day', 'month', 'year', 'all', 'custom'].forEach(p => {
        const btn = document.getElementById(`global-filter-${p}`);
        if (btn) {
            btn.className = (p === period)
                ? 'px-2.5 sm:px-3 py-1 rounded text-white bg-blue-600 font-medium transition whitespace-nowrap cursor-pointer' + (p === 'custom' ? ' flex items-center gap-1' : '')
                : 'px-2.5 sm:px-3 py-1 rounded text-slate-400 hover:text-white transition whitespace-nowrap cursor-pointer' + (p === 'custom' ? ' flex items-center gap-1' : '');
        }
    });
    // Hide custom panel when switching to a non-custom period
    if (period !== 'custom') {
        const panel = document.getElementById('custom-date-panel');
        if (panel) panel.classList.add('hidden'), panel.classList.remove('flex');
    }
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
    if (period === 'custom' && customDateFrom && customDateTo) {
        const [fy, fm, fd] = customDateFrom.split('-').map(Number);
        const from = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
        const [ty, tm, td] = customDateTo.split('-').map(Number);
        const to = new Date(ty, tm - 1, td, 23, 59, 59, 999);
        return target >= from && target <= to;
    }
    return true;
}

function toggleCustomDatePanel() {
    const panel = document.getElementById('custom-date-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
        // Pre-fill with today's date if empty
        const fromInput = document.getElementById('custom-date-from');
        const toInput = document.getElementById('custom-date-to');
        if (fromInput && !fromInput.value) {
            const today = new Date().toISOString().slice(0, 10);
            fromInput.value = today;
            toInput.value = today;
        }
    } else {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }
}

function applyCustomDateRange() {
    const fromInput = document.getElementById('custom-date-from');
    const toInput = document.getElementById('custom-date-to');
    if (!fromInput || !toInput || !fromInput.value || !toInput.value) {
        showToast('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด', 'warning');
        return;
    }
    if (fromInput.value > toInput.value) {
        showToast('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด', 'error');
        return;
    }
    customDateFrom = fromInput.value;
    customDateTo = toInput.value;

    // Update label
    const label = document.getElementById('custom-date-label');
    if (label) {
        const isThai = window.i18n && window.i18n.currentLang === 'th';
        const [fy, fm, fd] = customDateFrom.split('-').map(Number);
        const [ty, tm, td] = customDateTo.split('-').map(Number);
        const fromDate = new Date(fy, fm - 1, fd);
        const toDate = new Date(ty, tm - 1, td);
        const fmt = (d) => d.toLocaleDateString(isThai ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        label.textContent = `${fmt(fromDate)} — ${fmt(toDate)}`;
        label.classList.remove('hidden');
    }

    setGlobalPeriod('custom');
}

function cancelCustomDateRange() {
    const panel = document.getElementById('custom-date-panel');
    if (panel) panel.classList.add('hidden'), panel.classList.remove('flex');
    const label = document.getElementById('custom-date-label');
    if (label) label.classList.add('hidden');
    customDateFrom = null;
    customDateTo = null;
    setGlobalPeriod('all');
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
    if (elRev) elRev.innerText = '฿' + periodRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elSold) elSold.innerText = periodSold.toLocaleString('en-US');
    if (elSkus) elSkus.innerText = (cachedDashboardRaw.active_skus || 0).toLocaleString('en-US');

    const countBadge = document.getElementById('stream-count-badge');
    const isThai = window.i18n && window.i18n.currentLang === 'th';
    if (countBadge) {
        countBadge.innerText = `${filteredSales.length} ${isThai ? 'รายการ' : 'records'}`;
    }

    const tbody = document.getElementById('recent-sales-table');
    if (tbody) {
        if (filteredSales.length === 0) {
            const emptyMsg = isThai ? 'ไม่มีรายการธุรกรรมในช่วงเวลานี้' : 'No transactions recorded for this period.';
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-stone-500 h-[120px] align-middle text-xs font-mono">${emptyMsg}</td></tr>`;
        } else {
            const isDayOnly = currentGlobalPeriod === 'day';
            tbody.innerHTML = filteredSales.map(s => {
                const saleDate = new Date(s.timestamp);
                const timeStr = isDayOnly
                    ? saleDate.toLocaleTimeString(isThai ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                    : saleDate.toLocaleDateString(isThai ? 'th-TH' : 'en-GB', { day: '2-digit', month: 'short' }) + ' ' + saleDate.toLocaleTimeString(isThai ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                const rev = Math.abs(s.quantity) * Number(s.unit_price);
                return `<tr>
                    <td class="font-medium text-white truncate max-w-[140px] py-1.5">${s.item_name}</td>
                    <td class="text-right text-stone-300 font-mono py-1.5">${Math.abs(s.quantity)}</td>
                    <td class="text-right text-emerald-400 font-mono font-medium py-1.5">฿${rev.toFixed(2)}</td>
                    <td class="text-right text-stone-400 font-mono text-[11px] pr-2 py-1.5 whitespace-nowrap">${timeStr}</td>
                </tr>`;
            }).join('');
        }
    }

    rawSalesData = Object.values(itemSalesMap);
    renderChart(rawSalesData);

    if (currentGlobalPeriod === 'day') {
        currentTrendPeriod = 'day';
    } else if (currentGlobalPeriod === 'month') {
        currentTrendPeriod = 'day'; // Show daily distribution within this month
    } else if (currentGlobalPeriod === 'year') {
        currentTrendPeriod = 'month'; // Show monthly distribution within this year
    } else if (currentGlobalPeriod === 'custom') {
        if (customDateFrom && customDateTo) {
            const [fy, fm, fd] = customDateFrom.split('-').map(Number);
            const [ty, tm, td] = customDateTo.split('-').map(Number);
            const diffDays = Math.abs(new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / (1000 * 60 * 60 * 24);
            currentTrendPeriod = diffDays <= 45 ? 'day' : (diffDays <= 365 ? 'month' : 'year');
        } else {
            currentTrendPeriod = 'day';
        }
    } else {
        // 'all'
        currentTrendPeriod = 'month';
    }

    rawSalesActivity = filteredSales;
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
        const banner = document.getElementById('reg-form-banner');
        if (banner) {
            banner.className = 'p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300';
            banner.innerHTML = '<strong>Cashier Mode:</strong> Catalog registration is restricted to Store Managers and Owners. Please ask a manager to log in to save this product.';
        }
        const saveBtn = document.getElementById('btn-save-item');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.className = 'btn-primary w-full py-2 text-xs font-semibold mt-1 opacity-50 cursor-not-allowed';
            saveBtn.title = 'Manager or Owner role required to register items';
        }
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

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
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
    if (viewDash) viewDash.classList.toggle('hidden', tabId !== 'dashboard');
    if (viewMgmt) viewMgmt.classList.toggle('hidden', tabId !== 'management');

    const titles = {
        'dashboard': window.i18n ? window.i18n.t('dashboard_title') : 'Daily Register & Sales',
        'management': window.i18n ? window.i18n.t('stock_title') : 'Stock Management & Operations'
    };
    const subtitles = {
        'dashboard': window.i18n ? window.i18n.t('dashboard_subtitle') : 'Point of sale throughput, shift balance, and cashflow audit',
        'management': window.i18n ? window.i18n.t('stock_subtitle') : 'Real-time point of sale data and shelf inventory'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[tabId];
    const subtitleEl = document.getElementById('page-subtitle');
    if (subtitleEl && subtitles[tabId]) subtitleEl.innerText = subtitles[tabId];

    if (tabId === 'dashboard') fetchDashboard();
    if (tabId === 'management') {
        fetchStock();
        fetchItems();
    }

    closeSidebar();
}

function toggleStockSubTab(tab) {
    const logSection = document.getElementById('subview-log-movement');
    const regSection = document.getElementById('subview-register-product');
    const auditSection = document.getElementById('subview-audit-history');

    const tabLogBtn = document.getElementById('tab-log-btn');
    const tabRegBtn = document.getElementById('tab-reg-btn');
    const tabAuditBtn = document.getElementById('tab-audit-btn');

    if (logSection) logSection.classList.toggle('hidden', tab !== 'log');
    if (regSection) regSection.classList.toggle('hidden', tab !== 'register');
    if (auditSection) auditSection.classList.toggle('hidden', tab !== 'audit');

    if (tabLogBtn) {
        tabLogBtn.className = tab === 'log'
            ? 'flex-1 py-1 rounded bg-slate-800 text-white font-medium cursor-pointer'
            : 'flex-1 py-1 rounded text-slate-400 hover:text-white cursor-pointer';
    }
    if (tabRegBtn) {
        tabRegBtn.className = tab === 'register'
            ? 'flex-1 py-1 rounded bg-slate-800 text-white font-medium cursor-pointer'
            : 'flex-1 py-1 rounded text-slate-400 hover:text-white cursor-pointer';
    }
    if (tabAuditBtn) {
        tabAuditBtn.className = tab === 'audit'
            ? 'flex-1 py-1 rounded bg-slate-800 text-white font-medium cursor-pointer'
            : 'flex-1 py-1 rounded text-slate-400 hover:text-white cursor-pointer';
    }

    if (tab === 'audit') fetchAuditEvents();
}

function filterStockTable() {
    const query = (document.getElementById('stock-search')?.value || '').toLowerCase();
    const rows = document.querySelectorAll('#stock-table tr[data-search]');
    rows.forEach(r => {
        const text = r.getAttribute('data-search') || '';
        const cat = r.getAttribute('data-cat') || 'all';
        const status = r.getAttribute('data-status') || 'all';

        const matchesQuery = text.includes(query);
        const matchesCat = currentStockCategory === 'all' || cat === currentStockCategory;
        const matchesStatus = currentStockFilter === 'all' || status === currentStockFilter;

        r.style.display = (matchesQuery && matchesCat && matchesStatus) ? '' : 'none';
    });
}

function setStockFilter(status) {
    currentStockFilter = status;
    ['all', 'low', 'out'].forEach(s => {
        const btn = document.getElementById(`filter-stock-${s}`);
        if (!btn) return;
        btn.className = (s === status)
            ? 'px-2.5 py-1 rounded bg-blue-600 text-white font-medium text-xs transition cursor-pointer'
            : 'px-2.5 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800 hover:text-white text-xs transition cursor-pointer';
    });
    filterStockTable();
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

    const isThai = window.i18n && window.i18n.currentLang === 'th';

    if (!salesData || salesData.length === 0) {
        salesData = [{ name: isThai ? 'ยังไม่มียอดขาย' : 'No sales yet', total_qty: 0 }];
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
                    label: isThai ? 'จำนวนที่ขาย' : 'Units Sold',
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
                    label: isThai ? 'จำนวนที่ขาย' : 'Units Sold',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#60a5fa',
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
    const isThai = window.i18n && window.i18n.currentLang === 'th';
    const locale = isThai ? 'th-TH' : 'en-GB';

    sortedSales.forEach(sale => {
        const dateObj = new Date(sale.timestamp);
        let key = '';

        if (currentTrendPeriod === 'day') {
            key = dateObj.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
        } else if (currentTrendPeriod === 'month') {
            key = dateObj.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
        } else if (currentTrendPeriod === 'year') {
            key = isThai ? (dateObj.getFullYear() + 543).toString() : dateObj.getFullYear().toString();
        }

        const rev = Math.abs(sale.quantity) * Number(sale.unit_price);
        aggregated[key] = (aggregated[key] || 0) + rev;
    });

    let labels = Object.keys(aggregated);
    let data = Object.values(aggregated);

    if (labels.length === 0) {
        labels = [isThai ? 'ไม่มีข้อมูล' : 'No Data'];
        data = [0];
    }

    trendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: isThai ? 'รายได้ (บาท)' : 'Revenue (฿)',
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
                    callbacks: { label: (ctx) => isThai ? ` รายได้: ฿${Number(ctx.raw).toFixed(2)}` : ` Revenue: ฿${Number(ctx.raw).toFixed(2)}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#a39a8a', font: { family: 'IBM Plex Sans', size: 11 } } },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a39a8a', font: { family: 'IBM Plex Mono', size: 11 }, callback: (val) => `฿${val}` }
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
        const barcode = document.getElementById('item-barcode')?.value.trim() || sku;
        const name = document.getElementById('item-name').value.trim();
        const category = document.getElementById('item-cat').value.trim();
        const cost = parseFloat(document.getElementById('item-cost').value);
        const minStock = parseInt(document.getElementById('item-min-stock')?.value, 10) || 5;

        if (!sku || !name) {
            showToast('Please provide both SKU and Product Name', 'warning');
            return;
        }

        const res = await authFetch('/api/items', {
            method: 'POST',
            body: JSON.stringify({
                sku,
                barcode: barcode || null,
                name,
                category: category || null,
                unit_cost_default: isNaN(cost) ? 0 : cost,
                min_stock_level: minStock
            })
        });

        const data = await res.json();
        if (!res.ok) {
            const detail = data.details ? data.details.map(d => d.message).join(', ') : data.error;
            showToast('Error registering product: ' + detail, 'error');
            return;
        }

        playSuccessBeep();
        showToast(`Product "${data.name}" (${data.sku}) added to catalog!`, 'success');
        log(`Success! Product "${data.name}" (${data.sku}) added to catalog.`);

        document.getElementById('item-sku').value = '';
        if (document.getElementById('item-barcode')) document.getElementById('item-barcode').value = '';
        document.getElementById('item-name').value = '';
        document.getElementById('item-cat').value = '';

        await fetchItems();
        await fetchStock();

        // Switch to record movement so user can immediately add stock if desired
        toggleStockSubTab('log');
        const itemSelect = document.getElementById('evt-item');
        if (itemSelect) itemSelect.value = data.id;
        onItemSelectChange();
    } catch (e) {
        showToast('Network error: ' + e.message, 'error');
    }
}

async function logEvent() {
    try {
        let qty = parseInt(document.getElementById('evt-qty').value, 10);
        const eventType = document.getElementById('evt-type').value;
        const price = parseFloat(document.getElementById('evt-price').value) || 0;
        const itemId = document.getElementById('evt-item').value;

        if (!itemId) {
            showToast('Please select a product first.', 'warning');
            return;
        }
        if (isNaN(qty) || qty <= 0) {
            showToast('Quantity must be greater than zero.', 'warning');
            return;
        }

        let signedQty = qty;
        if (eventType === 'SALE' || eventType === 'WASTE') {
            signedQty = -Math.abs(qty);
        } else if (eventType === 'RESTOCK' || eventType === 'RETURN') {
            signedQty = Math.abs(qty);
        }

        const note = document.getElementById('evt-note').value.trim();

        const res = await authFetch('/api/events', {
            method: 'POST',
            body: JSON.stringify({
                item_id: itemId,
                store_id: DEFAULT_STORE_ID,
                event_type: eventType,
                quantity: signedQty,
                unit_price: price,
                note: note || null,
                source: 'MANUAL',
            })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast('Ledger rejected: ' + (data.error || 'Failed'), 'error');
            return;
        }

        playSuccessBeep();
        showToast(`Stock updated: ${eventType} ${Math.abs(signedQty)} units!`, 'success');
        document.getElementById('evt-note').value = '';

        fetchStock();
        if (userRole !== 'cashier') fetchDashboard();
    } catch (e) {
        showToast('Network error: ' + e.message, 'error');
    }
}

async function quickStockChange(itemId, qtyDelta, eventType) {
    try {
        const item = cachedItems.find(i => i.id === itemId);
        const cost = item ? Number(item.unit_cost_default || 0) : 0;

        const res = await authFetch('/api/events', {
            method: 'POST',
            body: JSON.stringify({
                item_id: itemId,
                store_id: DEFAULT_STORE_ID,
                event_type: eventType,
                quantity: qtyDelta,
                unit_price: cost,
                note: `Quick in-row action: ${eventType} ${qtyDelta}`,
                source: 'MANUAL'
            })
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.error || 'Quick action failed', 'error');
            return;
        }

        playSuccessBeep();
        showToast(`${eventType === 'RESTOCK' ? '+1 Restocked' : '-1 Checked out'}: ${item?.name || 'Item'}`, 'success');
        fetchStock();
        if (userRole !== 'cashier') fetchDashboard();
    } catch (e) {
        showToast('Network error: ' + e.message, 'error');
    }
}

async function fetchItems() {
    try {
        const res = await authFetch('/api/items?limit=200');
        if (!res.ok) {
            console.warn('Failed to fetch items catalog, status:', res.status);
            return;
        }
        const json = await res.json();
        cachedItems = json.data || [];

        const select = document.getElementById('evt-item');
        if (select) {
            if (cachedItems.length === 0) {
                select.innerHTML = '<option value="">(No products in catalog)</option>';
            } else {
                const currentVal = select.value;
                select.innerHTML = '<option value="">-- Select Product --</option>' + cachedItems.map(i =>
                    `<option value="${i.id}" data-cost="${i.unit_cost_default || 0}">${i.name} (${i.sku})</option>`
                ).join('');
                if (currentVal && cachedItems.some(i => i.id === currentVal)) {
                    select.value = currentVal;
                }
                onItemSelectChange();
            }
        }
    } catch (e) {
        console.error('Failed to fetch items:', e);
    }
}

async function fetchStock() {
    try {
        const res = await authFetch('/api/stock?limit=200');
        if (!res.ok) return;
        const json = await res.json();
        const stockData = json.data || [];
        cachedStockRaw = stockData;

        const tbody = document.getElementById('stock-table');
        if (!tbody) return;

        if (stockData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-500 py-8 text-xs font-mono">No inventory data available yet.</td></tr>';
            return;
        }

        // Populate Category Filter dropdown dynamically
        const categories = Array.from(new Set(stockData.map(i => i.category).filter(Boolean)));
        const catSelect = document.getElementById('stock-category-filter');
        if (catSelect) {
            const currentVal = catSelect.value;
            catSelect.innerHTML = '<option value="all">All Categories</option>' +
                categories.map(c => `<option value="${c}">${c}</option>`).join('');
            catSelect.value = currentVal || 'all';
        }

        tbody.innerHTML = stockData.map(item => {
            const qty = item.quantity || 0;
            const minStock = item.min_stock_level || 5;

            let statusBadge = '<span class="stock-pill stock-healthy">🟢 In Stock</span>';
            let statusKey = 'healthy';

            if (qty <= 0) {
                statusBadge = '<span class="stock-pill stock-out">🔴 Out of Stock</span>';
                statusKey = 'out';
            } else if (qty <= minStock) {
                statusBadge = `<span class="stock-pill stock-low">🟡 Low (${qty}/${minStock})</span>`;
                statusKey = 'low';
            }

            const itemId = item.item_id || item.id || '';
            const searchString = `${item.sku} ${item.barcode || ''} ${item.item_name} ${item.category || ''}`.toLowerCase();

            return `<tr class="hover:bg-slate-800/30 transition border-b border-slate-800/40" 
                        data-search="${searchString}" 
                        data-cat="${item.category || 'all'}" 
                        data-status="${statusKey}">
                <td class="py-2.5 text-left">
                    <div class="font-mono text-white text-xs font-semibold">${item.sku}</div>
                    <div class="text-[10px] font-mono text-slate-400 mt-0.5">${item.barcode || '—'}</div>
                </td>
                <td class="py-2.5 text-left font-medium text-white truncate max-w-[200px]">${item.item_name}</td>
                <td class="py-2.5 text-left text-slate-400 text-xs">${item.category || '—'}</td>
                <td class="py-2.5 text-right font-mono text-slate-300">฿${Number(item.unit_cost_default || 0).toFixed(2)}</td>
                <td class="py-2.5 text-right font-mono font-bold text-sm">
                    <div class="flex items-center justify-end gap-2">
                        <span class="${qty <= 0 ? 'text-rose-400' : (qty <= minStock ? 'text-amber-400' : 'text-emerald-400')}">${qty}</span>
                        ${statusBadge}
                    </div>
                </td>
                <td class="py-2.5 text-right pr-2">
                    <div class="inline-flex items-center gap-1">
                        <button onclick="quickStockChange('${itemId}', 1, 'RESTOCK')" title="Restock +1" class="action-btn-sm text-emerald-400 hover:text-emerald-300 hover:border-emerald-500">+1</button>
                        <button onclick="quickStockChange('${itemId}', -1, 'SALE')" title="Sale -1" class="action-btn-sm text-rose-400 hover:text-rose-300 hover:border-rose-500">-1</button>
                        ${userRole !== 'cashier' ? `<button onclick="openEditItemModal('${itemId}')" title="Edit Product" class="action-btn-sm text-blue-400 hover:text-blue-300 hover:border-blue-500" data-i18n="btn_edit">Edit</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');

        filterStockTable();
    } catch (e) {
        console.error('Failed to fetch stock snapshot:', e);
    }
}

async function fetchAuditEvents() {
    const tbody = document.getElementById('audit-events-table');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 py-6 text-xs font-mono">Loading audit transactions...</td></tr>';
        const res = await authFetch('/api/events?limit=30');
        if (!res.ok) return;
        const json = await res.json();
        const events = json.data || [];

        if (events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 py-6 text-xs font-mono">No inventory ledger transactions recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = events.map(e => {
            const timeStr = new Date(e.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' });
            let typeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            if (e.event_type === 'RESTOCK' || e.event_type === 'RETURN') typeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            if (e.event_type === 'SALE' || e.event_type === 'WASTE') typeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            if (e.event_type === 'ADJUSTMENT') typeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';

            return `<tr class="hover:bg-slate-800/30 text-xs border-b border-slate-800/40">
                <td class="py-2 font-mono text-slate-400 text-[11px]">${timeStr}</td>
                <td class="py-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono border ${typeColor}">${e.event_type}</span>
                </td>
                <td class="py-2 text-white font-medium truncate max-w-[150px]">${e.item_name}</td>
                <td class="py-2 text-right font-mono font-bold ${e.quantity >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                    ${e.quantity >= 0 ? '+' : ''}${e.quantity}
                </td>
                <td class="py-2 text-slate-400 text-[11px] truncate max-w-[120px] pr-2">${e.source}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-rose-400 py-6 text-xs font-mono">Failed to load audit history: ${err.message}</td></tr>`;
    }
}

// Edit Product Modal
async function openEditItemModal(itemId) {
    let item = cachedItems.find(i => (i.id || i.item_id) === itemId);
    if (!item) {
        const stockItem = (cachedStockRaw || []).find(i => (i.item_id || i.id) === itemId);
        if (stockItem) {
            item = {
                id: stockItem.item_id || stockItem.id,
                sku: stockItem.sku,
                barcode: stockItem.barcode,
                name: stockItem.item_name || stockItem.name,
                category: stockItem.category,
                unit_cost_default: stockItem.unit_cost_default,
                min_stock_level: stockItem.min_stock_level
            };
        }
    }
    if (!item) {
        try {
            const res = await authFetch(`/api/items/${itemId}`);
            if (res.ok) {
                const json = await res.json();
                item = json.data;
            }
        } catch (e) {
            console.error('Failed to fetch item for edit modal:', e);
        }
    }
    if (!item) {
        showToast('Product information could not be found.', 'warning');
        return;
    }

    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-item-sku').value = item.sku || '';
    document.getElementById('edit-item-barcode').value = item.barcode || '';
    document.getElementById('edit-item-name').value = item.name || '';
    document.getElementById('edit-item-cat').value = item.category || '';
    document.getElementById('edit-item-cost').value = Number(item.unit_cost_default || 0).toFixed(2);
    document.getElementById('edit-item-min-stock').value = item.min_stock_level || 5;

    const modal = document.getElementById('edit-item-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEditItemModal() {
    const modal = document.getElementById('edit-item-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveEditItem() {
    try {
        const id = document.getElementById('edit-item-id').value;
        const sku = document.getElementById('edit-item-sku').value.trim();
        const barcode = document.getElementById('edit-item-barcode').value.trim();
        const name = document.getElementById('edit-item-name').value.trim();
        const category = document.getElementById('edit-item-cat').value.trim();
        const cost = parseFloat(document.getElementById('edit-item-cost').value) || 0;
        const minStock = parseInt(document.getElementById('edit-item-min-stock').value, 10) || 5;

        if (!name || !sku) {
            showToast('Product name and SKU are required', 'warning');
            return;
        }

        const res = await authFetch(`/api/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                sku,
                barcode: barcode || null,
                name,
                category: category || null,
                unit_cost_default: cost,
                min_stock_level: minStock
            })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Failed to update product', 'error');
            return;
        }

        showToast(`Product "${data.name}" updated successfully!`, 'success');
        closeEditItemModal();
        fetchItems();
        fetchStock();
    } catch (e) {
        showToast('Network error: ' + e.message, 'error');
    }
}

// Built-in Barcode Scanner Modal Logic
let modalScanner = null;
let lastModalScanTime = 0;

async function openScannerModal() {
    const modal = document.getElementById('scanner-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    // Check secure context
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    const isSecure = window.isSecureContext || isLocalhost;

    const warnEl = document.getElementById('modal-insecure-warning');
    const linkEl = document.getElementById('modal-https-link');
    if (warnEl && linkEl) {
        if (!isSecure && !isHttps) {
            warnEl.classList.remove('hidden');
            linkEl.href = `https://${window.location.hostname}:3443/`;
        } else {
            warnEl.classList.add('hidden');
        }
    }

    try {
        modalScanner = new Html5Qrcode('modal-scanner-reader');
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            throw new Error('Camera hardware access is restricted in this browser context. Please use HTTPS or Snap Photo.');
        }

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
            showToast('No camera detected on this device. You can use Snap Photo fallback.', 'warning');
            return;
        }

        const rearCam = cameras.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('rear') ||
            c.label.toLowerCase().includes('environment')
        ) || cameras[0];

        await modalScanner.start(
            rearCam.id,
            { fps: 15, qrbox: { width: 240, height: 160 }, aspectRatio: 1.33333 },
            onModalBarcodeDetected,
            () => { }
        );
    } catch (e) {
        console.error('Modal camera error:', e);
        const msg = (e && typeof e === 'object' && e.message) ? e.message : (typeof e === 'string' ? e : 'Camera restricted by browser or permission denied.');
        showToast('Camera note: ' + msg, 'warning');
    }
}

async function closeScannerModal() {
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.classList.add('hidden');

    if (modalScanner) {
        try {
            await modalScanner.stop();
        } catch (e) { }
        modalScanner = null;
    }
}

function triggerModalPhotoSnap() {
    const input = document.getElementById('modal-camera-snap-input');
    if (input) input.click();
}

async function handleModalSnapFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
        showToast('Analyzing barcode photo...', 'info');
        const tempScanner = modalScanner || new Html5Qrcode('modal-scanner-reader');
        const decodedText = await tempScanner.scanFile(file, true);
        await onModalBarcodeDetected(decodedText);
    } catch (err) {
        playWarningBeep();
        showToast('Could not detect barcode from image. Please ensure photo is well lit and barcode is clear.', 'warning');
    } finally {
        event.target.value = '';
    }
}

async function onModalBarcodeDetected(decodedText) {
    const now = Date.now();
    if (now - lastModalScanTime < 1800) return;
    lastModalScanTime = now;

    try {
        const mode = document.getElementById('modal-scan-mode')?.value || 'RESTOCK';
        const qty = parseInt(document.getElementById('modal-scan-qty')?.value, 10) || 1;

        const res = await authFetch('/api/stock/scan', {
            method: 'POST',
            body: JSON.stringify({
                barcode: decodedText,
                quantity: qty,
                event_type: mode,
                auto_add: true
            })
        });

        const data = await res.json();
        if (!res.ok) {
            playWarningBeep();
            showToast(data.error || 'Scan error', 'error');
            return;
        }

        if (data.found) {
            playSuccessBeep();
            const isSale = mode === 'SALE';
            if (isSale) {
                showToast(window.i18n ? window.i18n.t('toast_sale_success', { qty, name: data.item.name, total: data.new_quantity }) : `🛒 Checked out -${qty} "${data.item.name}"! On hand: ${data.new_quantity}`, 'success');
            } else {
                showToast(window.i18n ? window.i18n.t('toast_restock_success', { qty, name: data.item.name, total: data.new_quantity }) : `📥 Restocked +${qty} "${data.item.name}"! On hand: ${data.new_quantity}`, 'success');
            }
            fetchStock();
            if (userRole !== 'cashier') fetchDashboard();
        } else {
            playWarningBeep();
            showToast(`⚠️ Barcode "${decodedText}" not found in catalog! Opening register form...`, 'warning');
            await closeScannerModal();
            switchTab('management');
            toggleStockSubTab('register');
            const skuInput = document.getElementById('item-sku');
            const barInput = document.getElementById('item-barcode');
            const nameInput = document.getElementById('item-name');
            if (skuInput) skuInput.value = decodedText;
            if (barInput) barInput.value = decodedText;
            if (nameInput) nameInput.focus();
        }
    } catch (err) {
        playWarningBeep();
        showToast('Error: ' + err.message, 'error');
    }
}

// State for Wireless Pairing
let pairData = null;
let currentPairProto = 'https';
let selectedPairIp = null;

// Wireless Remote Scanner Pairing Modal
async function openWirelessPairModal() {
    const modal = document.getElementById('wireless-pair-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    try {
        const res = await authFetch(`/api/system/pairing-info?token=${encodeURIComponent(token)}`);
        if (res.ok) {
            pairData = await res.json();
        }
    } catch (err) {
        console.warn('Could not fetch server pairing info:', err);
    }

    // Fallback if endpoint didn't respond
    if (!pairData) {
        const host = window.location.hostname;
        pairData = {
            detectedIp: host,
            allIps: [{ name: 'Current Host', ip: host }],
            httpPort: 3000,
            httpsPort: 3443,
            httpsAvailable: true,
            urls: {
                scannerHttps: `https://${host}:3443/scanner.html?token=${encodeURIComponent(token)}`,
                scannerHttp: `http://${host}:3000/scanner.html?token=${encodeURIComponent(token)}`
            }
        };
    }

    if (!selectedPairIp) {
        selectedPairIp = pairData.detectedIp;
    }

    // If accessing via DDNS / Public Domain, prioritize current hostname
    const currentHost = window.location.hostname;
    if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        const hasHost = pairData.allIps && pairData.allIps.some(e => e.ip === currentHost);
        if (!hasHost) {
            if (!pairData.allIps) pairData.allIps = [];
            pairData.allIps.unshift({
                name: `DDNS / Internet (${currentHost})`,
                ip: currentHost
            });
            selectedPairIp = currentHost;
        }
    }

    // Populate adapter select if multiple adapters exist
    const adapterWrapper = document.getElementById('pair-adapter-wrapper');
    const adapterSelect = document.getElementById('pair-adapter-select');
    if (adapterWrapper && adapterSelect) {
        if (pairData.allIps && pairData.allIps.length > 1) {
            adapterWrapper.classList.remove('hidden');
            adapterSelect.innerHTML = pairData.allIps.map(entry => `
                <option value="${entry.ip}" ${entry.ip === selectedPairIp ? 'selected' : ''}>
                    ${entry.name}
                </option>
            `).join('');
        } else {
            adapterWrapper.classList.add('hidden');
        }
    }

    renderPairQrCode();
}

function setPairProtocol(proto) {
    currentPairProto = proto;
    const httpsBtn = document.getElementById('pair-proto-https');
    const httpBtn = document.getElementById('pair-proto-http');

    if (httpsBtn && httpBtn) {
        if (proto === 'https') {
            httpsBtn.className = 'flex-1 py-1 px-2 rounded font-medium bg-emerald-600 text-white transition';
            httpBtn.className = 'flex-1 py-1 px-2 rounded font-medium text-slate-400 hover:text-white transition';
        } else {
            httpBtn.className = 'flex-1 py-1 px-2 rounded font-medium bg-blue-600 text-white transition';
            httpsBtn.className = 'flex-1 py-1 px-2 rounded font-medium text-slate-400 hover:text-white transition';
        }
    }

    renderPairQrCode();
}

function onPairAdapterChange(ip) {
    selectedPairIp = ip;
    renderPairQrCode();
}

function renderPairQrCode() {
    if (!pairData) return;

    const currentHost = window.location.hostname;
    const ip = selectedPairIp || pairData.detectedIp;
    const isHttps = currentPairProto === 'https';
    let port = isHttps ? pairData.httpsPort : pairData.httpPort;
    
    // If user is accessing via DDNS on a mapped custom port, reuse that port
    if (ip === currentHost && window.location.port) {
        if ((isHttps && window.location.protocol === 'https:') || (!isHttps && window.location.protocol === 'http:')) {
            port = window.location.port;
        }
    }

    const scheme = isHttps ? 'https' : 'http';
    const scannerUrl = `${scheme}://${ip}:${port}/scanner.html?token=${encodeURIComponent(token)}`;

    const urlDisplay = document.getElementById('pair-url-display');
    if (urlDisplay) urlDisplay.innerText = scannerUrl;

    const qrContainer = document.getElementById('pair-qrcode-container');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: scannerUrl,
                width: 180,
                height: 180,
                colorDark: '#ffffff',
                colorLight: '#0d1424',
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }
}

function copyPairUrl() {
    const urlDisplay = document.getElementById('pair-url-display');
    if (!urlDisplay) return;
    const url = urlDisplay.innerText;
    navigator.clipboard.writeText(url).then(() => {
        showToast(window.i18n ? window.i18n.t('pair_copied') : 'Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Link copied to clipboard', 'info');
    });
}

function closeWirelessPairModal() {
    const modal = document.getElementById('wireless-pair-modal');
    if (modal) modal.classList.add('hidden');
}

// Real-Time Server-Sent Events (SSE) Stream Listener for remote phone scans
function initRemoteScannerStream() {
    if (!token) return;
    try {
        const evtSource = new EventSource(`/api/stock/scan-stream?token=${encodeURIComponent(token)}`);
        evtSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'SCAN_SUCCESS') {
                    playSuccessBeep();
                    const isSale = data.event_type === 'SALE' || (data.quantity < 0);
                    const absQty = Math.abs(data.quantity);
                    if (isSale) {
                        showToast(window.i18n ? window.i18n.t('toast_phone_sale', { qty: absQty, name: data.item.name, total: data.new_quantity }) : `📱 Phone Checked Out: -${absQty} "${data.item.name}"! On hand: ${data.new_quantity}`, 'success');
                    } else {
                        showToast(window.i18n ? window.i18n.t('toast_phone_restock', { qty: absQty, name: data.item.name, total: data.new_quantity }) : `📱 Phone Restocked: +${absQty} "${data.item.name}"! On hand: ${data.new_quantity}`, 'success');
                    }
                    fetchStock();
                    if (userRole !== 'cashier') fetchDashboard();
                } else if (data.type === 'SCAN_UNKNOWN') {
                    playWarningBeep();
                    showToast(`⚠️ Phone scanned unknown barcode: ${data.barcode}! Opening register form...`, 'warning');
                    switchTab('management');
                    toggleStockSubTab('register');
                    const skuInput = document.getElementById('item-sku');
                    const barInput = document.getElementById('item-barcode');
                    const nameInput = document.getElementById('item-name');
                    if (skuInput) skuInput.value = data.barcode;
                    if (barInput) barInput.value = data.barcode;
                    if (nameInput) nameInput.focus();
                }
            } catch (err) { }
        };
    } catch (err) {
        console.warn('SSE stream error:', err);
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
        const noData = window.i18n && window.i18n.currentLang === 'th' ? 'ไม่พบข้อมูลสินค้าที่ค้นหา' : 'No matching SKU data found.';
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-stone-500 py-6 font-mono text-xs">${noData}</td></tr>`;
        return;
    }

    const tSteady = window.i18n ? window.i18n.t('badge_steady') : 'Steady';
    const tTop = window.i18n ? window.i18n.t('badge_top_seller') : 'Top Seller';
    const tNoSales = window.i18n ? window.i18n.t('badge_no_sales') : 'No Sales';
    const tCost = window.i18n ? window.i18n.t('col_cost') : 'Cost';

    tbody.innerHTML = statsArray.map(item => {
        const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '0.0';

        let velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono text-stone-400 bg-stone-800">${tSteady}</span>`;
        if (item.soldQty >= 5) {
            velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${tTop}</span>`;
        } else if (item.soldQty === 0) {
            velocityBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono text-stone-500 bg-stone-800/40">${tNoSales}</span>`;
        }

        return `<tr class="hover:bg-slate-800/30 transition border-b border-slate-800/30">
            <td class="py-2 text-left truncate">
                <div class="font-medium text-white truncate">${item.name}</div>
                <div class="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-slate-400">
                    <span>${item.sku}</span>
                    <span class="text-slate-600">·</span>
                    <span>${tCost}: ฿${item.cost.toFixed(2)}</span>
                </div>
            </td>
            <td class="py-2 text-right font-mono text-slate-200">${item.soldQty}</td>
            <td class="py-2 text-right font-mono text-slate-200">฿${item.revenue.toFixed(2)}</td>
            <td class="py-2 text-right font-mono font-medium ${item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                ${item.profit >= 0 ? '+' : ''}฿${item.profit.toFixed(2)}
            </td>
            <td class="py-2 text-right font-mono ${Number(margin) >= 30 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}">
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

    if (elProfit) elProfit.innerText = '฿' + totalGrossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elValuation) elValuation.innerText = '฿' + totalInventoryValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elUnits) elUnits.innerText = totalUnitsOnShelf.toLocaleString('en-US');

    const statsArray = Object.values(itemStats);
    statsArray.sort((a, b) => b.profit - a.profit);
    calculatedStatsCache = statsArray;
    renderProfitabilityRows(statsArray);
}

// Initial Boot Sequence
(async function init() {
    if (window.i18n && typeof window.i18n.createLanguageSelector === 'function') {
        window.i18n.createLanguageSelector('language-switcher-container');
        window.addEventListener('languageChanged', () => {
            const isMgmt = !document.getElementById('view-management')?.classList.contains('hidden');
            const currentTab = isMgmt ? 'management' : 'dashboard';
            const titleEl = document.getElementById('page-title');
            if (titleEl) {
                titleEl.innerText = window.i18n.t(currentTab === 'management' ? 'stock_title' : 'dashboard_title');
            }
            const subtitleEl = document.getElementById('page-subtitle');
            if (subtitleEl) {
                subtitleEl.innerText = window.i18n.t(currentTab === 'management' ? 'stock_subtitle' : 'dashboard_subtitle');
            }
            if (typeof fetchStock === 'function') fetchStock();
            if (typeof fetchItems === 'function') fetchItems();
            if (typeof applyGlobalFilter === 'function') applyGlobalFilter();
        });
    }

    initApp();
    await fetchItems();

    // Check if user arrived via redirect to register a new scanned barcode
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'register' && params.get('barcode')) {
        const barcode = params.get('barcode');
        switchTab('management');
        toggleStockSubTab('register');

        const skuInput = document.getElementById('item-sku');
        const barInput = document.getElementById('item-barcode');
        const nameInput = document.getElementById('item-name');

        if (skuInput) skuInput.value = barcode;
        if (barInput) barInput.value = barcode;
        if (nameInput) nameInput.focus();

        showToast(`New barcode scanned: ${barcode}. Enter product details below to register.`, 'info');
    } else {
        if (userRole === 'cashier') {
            switchTab('management');
        } else {
            switchTab('dashboard');
        }
    }

    // Connect to wireless mobile scanner live stream
    initRemoteScannerStream();
})();

// ─── Export Inventory CSV (Authenticated) ─────────────────────────────────────
async function exportInventoryCSV() {
    const btn = document.querySelector('[onclick="exportInventoryCSV()"]');
    const originalHTML = btn ? btn.innerHTML : '';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg><span>Exporting...</span>`;
        }

        const res = await fetch('/api/stock/export', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.error || 'Failed to export CSV.', 'error');
            return;
        }

        const csvText = await res.text();
        const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nextrack_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('📊 Inventory CSV exported successfully!', 'success');
    } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
}