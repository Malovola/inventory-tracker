// NexTrack Mobile Barcode Terminal Script
// Authentication check
const urlParams = new URLSearchParams(window.location.search);
const queryToken = urlParams.get('token');
if (queryToken) {
    localStorage.setItem('nextrack_token', queryToken);
}

const token = localStorage.getItem('nextrack_token');
const userStr = localStorage.getItem('nextrack_user');
let currentUser = null;
try {
    currentUser = userStr ? JSON.parse(userStr) : null;
} catch (e) {
    currentUser = null;
}

if (!token) {
    window.location.href = '/login.html';
}

// State
let html5QrCode = null;
let currentCameraId = null;
let currentFacingMode = 'environment';
let availableCameras = [];
let isScanning = false;
let isTorchOn = false;
let currentMode = 'RESTOCK'; // 'RESTOCK' | 'SALE' | 'CHECK'
let currentQuantity = 1;
let lastScannedCode = null;
let lastScannedTime = 0;
let totalScannedUnits = 0;
const scannedItemsHistory = [];

// Audio Synthesizer (Instant local response)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSuccessBeep() {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
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

        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) { }

    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

// Mode & Quantity Switchers
function setScanMode(mode) {
    currentMode = mode;
    ['restock', 'sale', 'audit'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        if (!btn) return;
        const matches = (mode === 'RESTOCK' && m === 'restock') ||
            (mode === 'SALE' && m === 'sale') ||
            (mode === 'CHECK' && m === 'audit');

        if (matches) {
            if (mode === 'SALE') {
                btn.className = 'py-2 px-1 rounded-lg bg-rose-600 text-white font-semibold transition flex items-center justify-center gap-1 shadow-sm whitespace-nowrap';
            } else if (mode === 'CHECK') {
                btn.className = 'py-2 px-1 rounded-lg bg-purple-600 text-white font-semibold transition flex items-center justify-center gap-1 shadow-sm whitespace-nowrap';
            } else {
                btn.className = 'py-2 px-1 rounded-lg bg-blue-600 text-white font-semibold transition flex items-center justify-center gap-1 shadow-sm whitespace-nowrap';
            }
        } else {
            btn.className = 'py-2 px-1 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-1 whitespace-nowrap';
        }
    });
}

function setQuantity(qty) {
    currentQuantity = parseInt(qty, 10);
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.className = 'qty-btn px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 font-mono text-xs hover:text-white';
    });
    const activeBtn = document.getElementById(`qty-${qty}`);
    if (activeBtn) {
        activeBtn.className = 'qty-btn px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/40 font-mono font-bold text-xs';
    }
    const input = document.getElementById('custom-qty');
    if (input) input.value = qty;
}

function setCustomQuantity(val) {
    const parsed = Math.max(1, parseInt(val, 10) || 1);
    currentQuantity = parsed;
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.className = 'qty-btn px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 font-mono text-xs hover:text-white';
    });
}

// Camera Lifecycle
function findRearCamera(cameras) {
    if (!cameras || cameras.length === 0) return null;
    if (cameras.length === 1) return cameras[0];

    // 1. Explicit Back / Rear matches (English + Thai language labels)
    const backCam = cameras.find(c => {
        const lbl = (c.label || '').toLowerCase();
        return lbl.includes('back') || lbl.includes('rear') || lbl.includes('หลัง') || lbl.includes('environment');
    });
    if (backCam) return backCam;

    // 2. Exclude Front / Selfie matches (English + Thai language labels)
    const nonFrontCam = cameras.find(c => {
        const lbl = (c.label || '').toLowerCase();
        return !lbl.includes('front') && !lbl.includes('หน้า') && !lbl.includes('user') && !lbl.includes('selfie') && !lbl.includes('truedepth');
    });
    if (nonFrontCam) return nonFrontCam;

    // 3. Fallback: on iOS Safari, rear camera is typically the last camera index
    return cameras.length > 1 ? cameras[cameras.length - 1] : cameras[0];
}

async function initScanner() {
    // Check if running on mobile non-HTTPS (Insecure Context)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    const isSecureContext = window.isSecureContext || isLocalhost;

    const httpsCard = document.getElementById('https-alert-card');
    const switchBtn = document.getElementById('btn-switch-to-https');

    if (!isSecureContext && !isHttps) {
        if (httpsCard) httpsCard.classList.remove('hidden');
        if (switchBtn) {
            switchBtn.href = `https://${window.location.hostname}:3443/scanner.html?token=${encodeURIComponent(token)}`;
        }
    }

    const loadingEl = document.getElementById('camera-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn('Camera hardware API not exposed in this context.');
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="text-amber-400 text-base mb-1">🔒 Camera Needs HTTPS</div>
                    <p class="text-xs text-slate-300 max-w-xs mb-2">Mobile browsers require HTTPS to stream live video. Tap <strong>Snap Photo</strong> below or switch to HTTPS.</p>
                `;
            }
            return;
        }

        html5QrCode = new Html5Qrcode('reader');
        availableCameras = await Html5Qrcode.getCameras();

        if (!availableCameras || availableCameras.length === 0) {
            showErrorBanner('No camera detected on this device. You can type barcodes below or use Snap Photo.');
            if (loadingEl) loadingEl.classList.add('hidden');
            return;
        }

        // Select rear camera (supporting both Thai and English iOS labels)
        const rearCam = findRearCamera(availableCameras);
        currentCameraId = rearCam ? rearCam.id : availableCameras[0].id;

        await startCamera(currentCameraId);

        // Refresh camera list once permission is active (labels now populated)
        try {
            const updated = await Html5Qrcode.getCameras();
            if (updated && updated.length > 0) {
                availableCameras = updated;
            }
        } catch (e) {}

        if (loadingEl) loadingEl.classList.add('hidden');
    } catch (err) {
        console.warn('Camera initialization warning:', err);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="text-amber-400 text-sm font-semibold mb-1">Live Camera Restricted</div>
                <p class="text-xs text-slate-300 mb-2">Use the <strong>📸 Snap Photo to Scan</strong> button below to scan barcodes instantly.</p>
            `;
        }
    }
}

async function startCamera(cameraId) {
    if (!cameraId) return;
    currentCameraId = cameraId;

    if (isScanning && html5QrCode) {
        try {
            await html5QrCode.stop();
        } catch (e) { }
        isScanning = false;
    }

    try {
        html5QrCode = new Html5Qrcode('reader');
    } catch (e) {}

    const config = {
        fps: 15,
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.333334,
        formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE
        ]
    };

    await html5QrCode.start(
        cameraId,
        config,
        onBarcodeDetected,
        () => { } // suppress verbose scan failures
    );
    isScanning = true;

    // Check torch capability
    const torchBtn = document.getElementById('btn-torch');
    try {
        const track = html5QrCode.getRunningTrackCameraCapabilities();
        if (track && track.torchFeature().isSupported()) {
            if (torchBtn) torchBtn.classList.remove('hidden');
        } else {
            if (torchBtn) torchBtn.classList.add('hidden');
        }
    } catch (e) {
        if (torchBtn) torchBtn.classList.add('hidden');
    }
}

async function switchCamera() {
    if (!availableCameras || availableCameras.length <= 1) return;
    const currentIdx = availableCameras.findIndex(c => c.id === currentCameraId);
    const nextIdx = (currentIdx + 1) % availableCameras.length;
    currentCameraId = availableCameras[nextIdx].id;
    await startCamera(currentCameraId);
}

async function toggleTorch() {
    try {
        isTorchOn = !isTorchOn;
        await html5QrCode.applyVideoConstraints({
            advanced: [{ torch: isTorchOn }]
        });
        const btn = document.getElementById('btn-torch');
        if (btn) {
            btn.className = isTorchOn
                ? 'p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 transition'
                : 'p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700/60 transition';
        }
    } catch (e) {
        console.warn('Torch not supported:', e);
    }
}

// Fallback Photo Snap Trigger
function triggerPhotoSnap() {
    const input = document.getElementById('camera-snap-input');
    if (input) {
        input.click();
    }
}

// Process Photo Snap Barcode Image
async function handleSnapFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
        const loadingEl = document.getElementById('camera-loading');
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
            const txt = loadingEl.querySelector('div.text-sm');
            if (txt) txt.innerText = 'Analyzing captured barcode photo...';
        }

        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode('reader');
        }

        const decodedText = await html5QrCode.scanFile(file, true);
        if (loadingEl) loadingEl.classList.add('hidden');

        await onBarcodeDetected(decodedText);
    } catch (err) {
        const loadingEl = document.getElementById('camera-loading');
        if (loadingEl) loadingEl.classList.add('hidden');
        playWarningBeep();
        showErrorBanner('Could not detect barcode from photo. Please align closer and ensure good lighting.');
    } finally {
        e.target.value = '';
    }
}

// Barcode Processing Logic
async function onBarcodeDetected(decodedText) {
    const now = Date.now();
    // Debounce duplicate scans within 1.5 seconds for the same barcode
    if (decodedText === lastScannedCode && (now - lastScannedTime) < 1500) {
        return;
    }
    lastScannedCode = decodedText;
    lastScannedTime = now;

    await processBarcode(decodedText);
}

async function processBarcode(barcode) {
    const feedbackCard = document.getElementById('feedback-card');
    if (!feedbackCard) return;

    try {
        const res = await fetch('/api/stock/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                barcode: barcode,
                quantity: currentQuantity,
                event_type: currentMode,
                auto_add: true
            })
        });

        const data = await res.json();

        if (!res.ok) {
            playWarningBeep();
            showErrorBanner(data.error || 'Barcode scan failed on server.');
            return;
        }

        if (data.found) {
            playSuccessBeep();
            const isSale = currentMode === 'SALE';
            const isCheck = currentMode === 'CHECK';

            if (isSale) {
                totalScannedUnits -= currentQuantity;
            } else if (!isCheck) {
                totalScannedUnits += currentQuantity;
            }
            updateScanCount();

            const borderBg = isSale
                ? 'border-rose-500/40 bg-rose-950/40'
                : (isCheck ? 'border-purple-500/40 bg-purple-950/40' : 'border-emerald-500/40 bg-emerald-950/40');
            const badgeStyle = isSale
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : (isCheck ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30');
            const qtyColor = isSale ? 'text-rose-400' : (isCheck ? 'text-purple-400' : 'text-emerald-400');
            const sign = isSale ? '-' : (isCheck ? '' : '+');
            const modeText = isSale
                ? (window.i18n ? window.i18n.t('scanner_mode_sale') : 'Sale (-)')
                : (isCheck ? (window.i18n ? window.i18n.t('scanner_mode_audit') : 'Check') : (window.i18n ? window.i18n.t('scanner_mode_restock') : 'Restock (+)'));

            feedbackCard.className = `rounded-xl border ${borderBg} p-3.5 block transition-all shadow-lg`;
            feedbackCard.innerHTML = `
                <div class="flex items-center justify-between mb-1.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeStyle}">
                        ${modeText}
                    </span>
                    <span class="text-xs font-mono ${qtyColor} font-bold">${sign}${currentQuantity} UNIT(S)</span>
                </div>
                <div class="text-sm font-bold text-white truncate">${data.item.name}</div>
                <div class="text-xs text-slate-300 font-mono mt-0.5 flex items-center justify-between">
                    <span>SKU: ${data.item.sku}</span>
                    <span class="${qtyColor} font-bold">On Hand: ${data.new_quantity}</span>
                </div>
            `;

            prependRecentScan({
                name: data.item.name,
                sku: data.item.sku,
                barcode: barcode,
                qty: currentQuantity,
                onHand: data.new_quantity,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                mode: currentMode
            });

        } else {
            // Case 2: Item NOT in inventory catalog -> Redirect to Register Item tab!
            playWarningBeep();

            let redirectCountdown = 2;
            const unknownMsg = window.i18n ? window.i18n.t('scanner_unknown_alert') : 'Product not in inventory catalog yet.';
            const regNowText = window.i18n ? window.i18n.t('scanner_btn_reg_now') : '➕ Register This Item Now';

            feedbackCard.className = 'rounded-xl border border-amber-500/40 bg-amber-950/40 p-3.5 flex flex-col gap-2 transition-all block shadow-lg';
            feedbackCard.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono font-bold tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        NEW BARCODE
                    </span>
                    <span class="text-xs font-mono text-slate-300 font-bold">${barcode}</span>
                </div>
                <div class="text-xs text-amber-200">
                    ${unknownMsg}<br/>
                    <span id="redirect-timer-msg">Redirecting to register form in <strong id="redirect-timer" class="text-white">2s</strong>...</span>
                </div>
                <button
                    onclick="redirectToRegister('${encodeURIComponent(barcode)}')"
                    class="btn-primary !bg-amber-600 hover:!bg-amber-500 text-white font-semibold text-xs py-2 w-full mt-1 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                    <span>${regNowText}</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                </button>
            `;

            const timerInterval = setInterval(() => {
                redirectCountdown--;
                const timerEl = document.getElementById('redirect-timer');
                if (timerEl) timerEl.innerText = `${redirectCountdown}s`;
                if (redirectCountdown <= 0) {
                    clearInterval(timerInterval);
                    redirectToRegister(encodeURIComponent(barcode));
                }
            }, 1000);
        }
    } catch (err) {
        playWarningBeep();
        showErrorBanner('Network communication error: ' + err.message);
    }
}

function redirectToRegister(barcode) {
    window.location.href = `/?action=register&barcode=${barcode}`;
}

function handleManualSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('manual-code');
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    processBarcode(val);
}

function showErrorBanner(msg) {
    const feedbackCard = document.getElementById('feedback-card');
    if (!feedbackCard) return;
    feedbackCard.className = 'rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-300 block shadow-md';
    feedbackCard.innerHTML = `<strong class="text-rose-200">⚠️ Error:</strong> ${msg}`;
}

function updateScanCount() {
    const el = document.getElementById('scan-count');
    if (el) {
        el.innerText = `${totalScannedUnits >= 0 ? '+' : ''}${totalScannedUnits} units`;
    }
}

function prependRecentScan(scan) {
    scannedItemsHistory.unshift(scan);
    const container = document.getElementById('recent-scans');
    if (!container) return;

    container.innerHTML = scannedItemsHistory.slice(0, 15).map(s => {
        const isSale = s.mode === 'SALE';
        const isCheck = s.mode === 'CHECK';
        const sign = isSale ? '-' : (isCheck ? '' : '+');
        const badgeColor = isSale ? 'text-rose-400' : (isCheck ? 'text-purple-400' : 'text-emerald-400');

        return `
        <div class="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div class="min-w-0 flex-1 pr-2">
                <div class="text-white font-semibold truncate text-xs">${s.name}</div>
                <div class="text-[10px] text-slate-400 font-mono">${s.sku} · ${s.barcode}</div>
            </div>
            <div class="text-right flex-shrink-0">
                <span class="${badgeColor} font-bold font-mono">${sign}${s.qty}</span>
                <div class="text-[10px] text-slate-500 font-mono">Stock: ${s.onHand}</div>
            </div>
        </div>`;
    }).join('');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.i18n && typeof window.i18n.createLanguageSelector === 'function') {
        window.i18n.createLanguageSelector('language-switcher-container');
    }
    initScanner();
});
