document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const alertBox = document.getElementById('alert-box');

    function showAlert(msg, isError = true) {
        alertBox.className = `p-3 rounded-lg text-sm mb-4 ${
            isError
                ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
        }`;
        alertBox.innerText = msg;
        alertBox.classList.remove('hidden');
    }

    function clearAlert() {
        alertBox.classList.add('hidden');
    }

    function switchTab(tab) {
        clearAlert();
        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            regForm.classList.add('hidden');
            tabLogin.classList.add('active');
            tabReg.classList.remove('active');
        } else {
            loginForm.classList.add('hidden');
            regForm.classList.remove('hidden');
            tabLogin.classList.remove('active');
            tabReg.classList.add('active');
        }
    }

    function fillCredentials(email, pass) {
        switchTab('login');
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').value = pass;
        clearAlert();
    }

    tabLogin.addEventListener('click', () => switchTab('login'));
    tabReg.addEventListener('click', () => switchTab('register'));

    document.getElementById('btn-preset-owner').addEventListener('click', () => {
        fillCredentials('admin@nextrack.com', 'admin123');
    });
    document.getElementById('btn-preset-manager').addEventListener('click', () => {
        fillCredentials('manager@nextrack.com', 'manager123');
    });
    document.getElementById('btn-preset-cashier').addEventListener('click', () => {
        fillCredentials('cashier@nextrack.com', 'cashier123');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const btn = document.getElementById('btn-login-submit');
        btn.disabled = true;
        btn.innerHTML = '<span>Verifying credentials...</span>';

        try {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                showAlert(data.error || 'Authentication failed');
                return;
            }

            localStorage.setItem('nextrack_token', data.token);
            localStorage.setItem('nextrack_user', JSON.stringify(data.user));

            showAlert('Login successful! Redirecting...', false);
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } catch (err) {
            showAlert('Network error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Sign In to Dashboard</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>';
        }
    });

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (!name || !email || !password) {
            showAlert('Please fill in all required fields (Name, Email, Password)');
            return;
        }

        if (password.length < 6) {
            showAlert('Password must be at least 6 characters');
            return;
        }

        const btn = document.getElementById('btn-reg-submit');
        btn.disabled = true;
        btn.innerHTML = '<span>Creating account...</span>';

        try {
            const payload = {
                display_name: name,
                email: email,
                password: password,
                role: document.getElementById('reg-role').value,
                business_name: document.getElementById('reg-biz').value.trim() || undefined,
            };

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                const detail = data.details ? data.details.map((d) => d.message).join(', ') : data.error;
                showAlert(detail || 'Registration failed');
                return;
            }

            localStorage.setItem('nextrack_token', data.token);
            localStorage.setItem('nextrack_user', JSON.stringify(data.user));

            showAlert('Account created! Redirecting...', false);
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } catch (err) {
            showAlert('Network error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Create Commercial Account</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>';
        }
    });
});