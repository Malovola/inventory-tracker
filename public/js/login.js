document.addEventListener('DOMContentLoaded', () => {
    if (window.i18n && typeof window.i18n.createLanguageSelector === 'function') {
        window.i18n.createLanguageSelector('language-switcher-container');
    }

    const loginForm = document.getElementById('login-form');
    const alertBox = document.getElementById('alert-box');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const staffButtons = document.querySelectorAll('.staff-card');

    // 1. นาฬิกาหัวจอ Real-time
    function updateClock() {
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.innerText = new Date().toLocaleTimeString('en-GB', { hour12: false });
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 2. ฟังก์ชันแจ้งเตือน
    function showAlert(msg, isError = true) {
        if (!alertBox) return;
        alertBox.className = `p-2.5 rounded text-xs mb-3 font-mono border ${isError
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`;
        alertBox.innerText = msg;
        alertBox.classList.remove('hidden');
    }

    function clearAlert() {
        if (alertBox) alertBox.classList.add('hidden');
    }

    // 3. ฟังก์ชันคลิกเลือก Staff Card
    staffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            clearAlert();
            const email = btn.getAttribute('data-email');
            const pass = btn.getAttribute('data-pass');

            if (emailInput) emailInput.value = email;
            if (passwordInput) passwordInput.value = pass;

            // สลับสถานะ Active Highlight ของการ์ด
            staffButtons.forEach(b => {
                b.classList.remove('border-blue-500', 'bg-slate-800/80');
                b.classList.add('border-slate-800', 'bg-[#121927]');
            });

            btn.classList.remove('border-slate-800', 'bg-[#121927]');
            btn.classList.add('border-blue-500', 'bg-slate-800/80');
        });
    });

    // 4. Form Submit Handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert();

            const btn = document.getElementById('btn-login-submit');
            btn.disabled = true;
            btn.innerHTML = '<span>Verifying Station Access...</span>';

            try {
                const email = emailInput.value.trim();
                const password = passwordInput.value;

                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();
                if (!res.ok) {
                    showAlert(data.error || 'Authentication rejected by station');
                    return;
                }

                localStorage.setItem('nextrack_token', data.token);
                localStorage.setItem('nextrack_user', JSON.stringify(data.user));

                showAlert('Station unlocked! Initializing shift...', false);
                setTimeout(() => {
                    window.location.href = '/';
                }, 400);
            } catch (err) {
                showAlert('Network error: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Unlock Register & Open Shift';
            }
        });
    }
});