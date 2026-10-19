# NexTrack — Enterprise Real-Time Inventory & POS System

A high-performance, real-time inventory management and Point of Sale (POS) system built with Node.js, Express, PostgreSQL, and modern web standards. Designed for retail, warehouse, and commercial stock tracking with wireless mobile barcode terminal pairing.

---

## 🌟 Highlights & Key Features

- **Double-Entry Inventory Ledger Architecture**: All inventory changes (Restock, Sale, Audit Adjustment, Damage/Loss) are logged as immutable events within PostgreSQL transactions.
- **Wireless Mobile Barcode Terminal**: Turn any smartphone into a commercial handheld barcode scanner paired via real-time Server-Sent Events (SSE).
- **Dual HTTP & HTTPS Server**: Integrated self-signed TLS/SSL engine with automatic LAN IP Subject Alternative Names (SANs) enabling mobile WebRTC camera access across local Wi-Fi.
- **Photo-Snap Barcode Fallback**: HTML5 direct camera file capture (`capture="environment"`) allowing instant barcode scanning even over plain HTTP or restricted environments.
- **Multi-Language Manager (i18n)**: Instant reactive localization supporting **English (EN)**, **Bahasa Indonesia (ID)**, **Español (ES)**, and **中文 (ZH)** with localStorage persistence.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for `owner`, `manager`, and `cashier` with JWT security.

---

## 📁 Project Architecture & Directory Structure

```text
inventory-tracker/
├── .cert/                     # Auto-generated local SSL/TLS certificates (Git ignored)
├── dist/                      # Production compiled JavaScript bundle
├── public/                    # Frontend presentation layer
│   ├── css/                   # Vanilla CSS design system & stylesheets
│   │   ├── common.css         # Typography, glassmorphism tokens, buttons
│   │   ├── dashboard.css      # Grid layout, charts, KPI styling
│   │   └── login.css          # Shift workstation layout
│   ├── js/                    # Client logic
│   │   ├── app.js             # Core reactive workstation controller
│   │   ├── i18n.js            # Modular multi-language translation engine
│   │   ├── login.js           # Authentication and shift unlock handler
│   │   ├── scanner.js         # Mobile handheld scanner controller
│   │   ├── html5-qrcode.min.js# Barcode & QR code computer vision engine
│   │   └── qrcode.min.js      # On-the-fly QR code generation
│   ├── index.html             # Primary desktop POS & inventory workstation
│   ├── login.html             # Shift login & role selector
│   └── scanner.html           # Standalone mobile handheld terminal
├── src/                       # Backend TypeScript source
│   ├── config/                # Centralized configuration with Zod validation
│   │   └── index.ts
│   ├── middleware/            # Express middlewares
│   │   ├── auth.ts            # JWT authentication & requireRole RBAC
│   │   └── validate.ts        # Zod request validation middleware
│   ├── routes/                # Modular API route controllers
│   │   ├── auth.ts            # Sign-in & token generation
│   │   ├── dashboard.ts       # Real-time KPIs & velocity calculations
│   │   ├── events.ts          # Immutable stock ledger stream
│   │   ├── items.ts           # Product catalog CRUD & barcode lookups
│   │   ├── stock.ts           # Current snapshot, scan endpoint, SSE stream
│   │   └── system.ts          # LAN discovery & pairing metadata
│   ├── schemas/               # Zod validation schemas
│   ├── services/              # Domain business logic
│   │   ├── authService.ts     # Password hashing & JWT verification
│   │   ├── inventoryLedger.ts # Transactional ledger event processing
│   │   ├── networkService.ts  # Network interface discovery & pairing
│   │   └── sslService.ts      # Self-signed certificate management
│   ├── types/                 # Centralized domain models and Express types
│   │   └── index.ts
│   ├── app.ts                 # Express application configuration & security
│   ├── db.ts                  # PostgreSQL connection pool
│   ├── index.ts               # Server bootstrap (dual HTTP/HTTPS listeners)
│   ├── migrate.ts             # Database schema migrations & seed data
│   └── verify_all.ts          # Automated 25-point verification suite
├── .env                       # Environment variables
├── package.json
└── tsconfig.json              # Strict TypeScript compiler options
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **PostgreSQL**: v13 or higher

### 1. Installation
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and verify your PostgreSQL credentials:
```env
DATABASE_URL=postgres://postgres:password@localhost:5432/inventory_tracker_dev
PORT=3000
HTTPS_PORT=3443
ENABLE_HTTPS=true
JWT_SECRET=your-secure-secret-key-2026
FRONTEND_ORIGIN=http://localhost:3000
```

### 3. Run Database Migrations
```bash
npx tsx src/migrate.ts
```

### 4. Build and Start Server
```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or for development with hot-reload:
npm run dev
```

The server will automatically detect your active network interfaces and launch:
- **Local HTTP**: `http://localhost:3000`
- **Network HTTP**: `http://<YOUR_LAN_IP>:3000`
- **Network HTTPS**: `https://<YOUR_LAN_IP>:3443` *(Required for Phone Camera)*

---

## 📱 Mobile Scanner Terminal & Camera Setup

### Why Mobile Browsers Require HTTPS
Modern mobile browsers (Chrome on Android, Safari on iOS) strictly enforce the W3C **Secure Context** specification. They disable `navigator.mediaDevices.getUserMedia` when connecting over plain HTTP across a local network (`http://192.168.x.x`).

NexTrack addresses this through two built-in solutions:

1. **Integrated HTTPS Server (Recommended for Live Video)**:
   - When you open the **Wireless Phone Scanner** modal on your computer, NexTrack provides a QR code linked to `https://<YOUR_LAN_IP>:3443/scanner.html`.
   - When scanning with your phone for the first time, your browser will show a standard self-signed certificate notice (`Connection is not private`).
   - Tap **Advanced → Proceed to <IP>** once. The camera will immediately prompt for permission and start scanning barcodes in real-time.

2. **Photo-Snap Barcode Fallback (Works Everywhere)**:
   - If connected over plain HTTP or on a device with camera streaming restrictions, tap the **📸 Snap Photo to Scan** button.
   - This opens your phone's native camera via HTML5 file capture (`capture="environment"`), takes a photo of the barcode, and decodes it instantly without requiring HTTPS.

---

## 🌐 Multi-Language Manager (i18n)

The localization engine is located at [`public/js/i18n.js`](public/js/i18n.js). It supports instant switching between 4 languages:
- 🇺🇸 **English** (`en`)
- 🇮🇩 **Bahasa Indonesia** (`id`)
- 🇪🇸 **Español** (`es`)
- 🇨🇳 **简体中文** (`zh`)

### Adding a New Language
To add a new language (e.g. Japanese `ja`), simply add an entry to the `translations` object in [`public/js/i18n.js`](public/js/i18n.js):
```javascript
ja: {
  brand_name: 'NexTrack',
  nav_dashboard: 'ダッシュボード',
  nav_scanner: 'バーコードスキャナー',
  ...
}
```
And add it to `availableLanguages`:
```javascript
{ code: 'ja', name: '日本語', flag: '🇯🇵' }
```

---

## 🧪 Verification & Testing

NexTrack includes a 25-point automated verification suite testing security headers, RBAC permissions, stock transactions, ledger immutability, barcode scanning, CSV exports, and telemetry:

```bash
npm test
```

---

## 🛡️ Security Best Practices Implemented

- **Helmet Security Headers**: Strict Content-Security-Policy, X-Content-Type-Options (nosniff), X-Frame-Options (DENY).
- **Express Rate Limiting**: Safeguards against brute-force and DDoS on API routes.
- **SQL Injection Prevention**: Parameterized queries via `pg` across all repository layers.
- **Payload Sanitization & Zod Validation**: Strict schema verification before controllers execute.
- **Constant-Time Password Comparison**: `bcryptjs` salt rounds for secure credential storage.
