/**
 * NexTrack Enterprise - Multi-Language Manager (i18n)
 * Strictly supports English (en) and Thai (th).
 * Zero runtime dependencies, reactive DOM translation, localStorage persistence.
 */

(function (window) {
  'use strict';

  const translations = {
    en: {
      brand_name: 'NexTrack',
      brand_subtitle: 'HQ Convenience Store',
      nav_dashboard: 'Register Overview',
      nav_management: 'Stock Ledger & Catalog',
      nav_store_tools: 'Store Tools',
      nav_scanner: 'Camera Scanner',
      nav_wireless_pair: 'Wireless Phone Terminal',
      nav_logout: 'Logout',

      header_status_connected: 'Connected',
      header_btn_scan: 'Scan Barcode',
      header_btn_pair: 'Phone Scanner',
      period_today: 'Today',
      period_month: 'This Month',
      period_year: 'This Year',
      period_all: 'All Time',
      period_custom: 'Custom',
      custom_date_from: 'From',
      custom_date_to: 'To',
      custom_date_apply: 'Apply',
      custom_date_cancel: 'Cancel',
      btn_sync: 'Sync',

      // Dashboard
      dashboard_title: 'Daily Register & Sales',
      dashboard_subtitle: 'Point of sale throughput, shift balance, and cashflow audit',
      kpi_total_sales: 'Total Sales',
      kpi_sales_sub: 'Register revenue',
      kpi_gross_profit: 'Gross Profit',
      kpi_profit_sub: 'After item cost',
      kpi_items_sold: 'Items Sold',
      kpi_sold_sub: 'Units checked out',
      kpi_inventory_value: 'Inventory Value',
      kpi_skus: 'SKUs',
      kpi_on_shelf: 'on shelf',

      // Charts & Stream
      chart_sales_analytics: 'Sales Analytics',
      chart_opt_doughnut: 'Share (Doughnut)',
      chart_opt_bar: 'Volume (Bar)',
      chart_opt_line: 'Trend (Line)',
      chart_revenue_trends: 'Revenue Trends',
      chart_revenue_sub: 'Periodic revenue distribution',
      stream_title: 'Live Transaction Stream',
      stream_sub: 'Audited transaction ledger records',
      stream_limit: 'Limit: 20',
      col_item_desc: 'Item Description',
      col_qty: 'Qty',
      col_net_revenue: 'Net Revenue',
      col_timestamp: 'Timestamp',

      // Shift Operations
      shift_title: 'Shift Operations',
      shift_branch: 'Branch HQ',
      shift_inv_status: 'Inventory Status',
      shift_inv_valid: 'All counts valid',
      shift_data_source: 'Data Source',
      shift_data_ledger: 'Direct Event Ledger',
      shift_active: 'Shift Active',
      shift_time: 'Morning / Day',
      btn_open_ledger: 'Open Stock Ledger & Catalog',

      // SKU Margin Performance
      margin_title: 'SKU Performance & Margin Yield',
      margin_sub: 'Unit-level contribution margin and velocity classification',
      margin_search_ph: 'Filter SKU or name...',
      col_sku_name: 'SKU & Item Name',
      col_units_sold: 'Units Sold',
      col_gross_rev: 'Gross Rev',
      col_est_profit: 'Est. Profit',
      col_margin_pct: 'Margin %',
      col_velocity: 'Velocity',
      badge_top_seller: 'Top Seller',
      badge_steady: 'Steady',
      badge_no_sales: 'No Sales',

      // Stock Ledger
      stock_title: 'Stock Management & Operations',
      stock_subtitle: 'Real-time point of sale data and shelf inventory',
      filter_all_products: 'All Products',
      filter_low_stock: '⚠️ Low Stock (≤5)',
      filter_out_stock: '❌ Out of Stock',
      filter_all_categories: 'All Categories',
      stock_search_placeholder: 'Search SKU, Barcode, Name...',
      btn_export_csv: 'Export CSV',
      table_title_stock: 'Live Shelf Stock Status',
      table_sub_stock: 'Real-time inventory levels, reorder alerts, and in-row quick adjustments',
      btn_refresh: '↻ Refresh',
      col_sku_barcode: 'SKU / Barcode',
      col_product_name: 'Product Name',
      col_category: 'Category',
      col_cost: 'Cost',
      col_stock_status: 'Stock & Status',
      col_actions: 'Actions',
      status_healthy: 'Healthy',
      status_low: 'Low Stock',
      status_out: 'Out of Stock',
      btn_edit: 'Edit',

      // Subtabs
      subtab_movement: 'Movement',
      subtab_register: 'Register Item',
      subtab_audit: 'Audit Trail',

      // Movement Form
      form_select_item: 'Select Item',
      form_choose_product: '-- Select Product --',
      form_action_type: 'Action Type',
      form_action_restock: 'Restock (Add)',
      form_action_sale: 'Sale (Deduct)',
      form_action_audit: 'Audit (Set Total)',
      form_action_waste: 'Damaged / Waste',
      form_action_return: 'Customer Return',
      form_quantity: 'Quantity',
      form_unit_price: 'Unit Price (฿)',
      form_note: 'Note / Batch #',
      form_note_placeholder: 'E.g. Delivery #104',
      btn_post_ledger: 'Post to Inventory Ledger',

      // Register Form
      banner_register_hint: 'Fill in product details to register a new SKU into the catalog.',
      field_sku: 'SKU Code *',
      field_barcode: 'Barcode (EAN/UPC)',
      field_name: 'Product Description *',
      field_category: 'Category',
      field_cost: 'Cost (฿)',
      field_cost_req: 'Cost (฿) *',
      field_min_stock: 'Min Alert',
      btn_save_catalog: 'Save to Catalog',
      cashier_reg_notice: 'Catalog registration is restricted to Store Managers and Owners.',

      // Audit Trail
      audit_time: 'Time',
      audit_type: 'Type',
      audit_item: 'Item',
      audit_delta: 'Delta',
      audit_source: 'Source',
      system_events_title: 'Recent System Events',
      btn_clear: 'Clear',

      // Edit Modal
      modal_edit_title: 'Edit Product Details',
      btn_save_changes: 'Save Changes',
      btn_cancel: 'Cancel',

      // Scanner Terminal & Modal
      scanner_title: 'Camera Barcode Scanner',
      scanner_title_short: 'Scanner',
      scanner_subtitle: 'Point camera at product barcode or QR code',
      scanner_mode: 'Scan Mode:',
      scanner_mode_restock: '📥 Restock (+)',
      scanner_mode_sale: '📤 Sale (-)',
      scanner_mode_audit: '🔍 Check',
      scanner_qty: 'Quantity:',
      scanner_step_qty: 'Step Qty:',
      scanner_manual_placeholder: 'Type barcode or SKU manually...',
      scanner_submit: 'Submit',
      scanner_recent_scans: 'Recent Scanned Items',
      scanner_no_scans: 'No barcodes scanned yet this session.',
      scanner_btn_close: 'Close Scanner',
      scanner_btn_switch_cam: 'Switch Camera',
      scanner_btn_torch: 'Toggle Flashlight',
      scanner_btn_snap: '📸 Snap Photo to Scan',
      scanner_camera_starting: 'Starting Camera...',
      scanner_camera_permission: 'Please allow camera permissions if prompted.',
      scanner_https_warning: 'Mobile camera requires HTTPS (Secure Context).',
      scanner_https_btn: 'Switch to Secure HTTPS Terminal',
      scanner_https_hint: 'Mobile browsers block live camera on plain HTTP. Tap below to switch to the secure HTTPS terminal.',
      scanner_unknown_alert: 'Product not in inventory catalog yet.',
      scanner_redirecting: 'Redirecting to Register Form in {sec}s...',
      scanner_btn_reg_now: '➕ Register This Item Now',

      // Wireless Pairing
      pair_title: 'Wireless Phone Scanner',
      pair_subtitle: 'Scan this QR code with your phone camera to use your phone as a handheld barcode scanner.',
      pair_direct_link: 'Direct Phone Link:',
      pair_desc: 'Scanned items on your phone will automatically update stock and sync to this screen in real time!',
      pair_copy_btn: 'Copy Link',
      pair_copied: 'Copied to clipboard!',
      pair_protocol: 'Connection Protocol:',
      pair_https_recommended: 'HTTPS (Recommended for Camera)',
      pair_http_standard: 'HTTP (LAN)',
      pair_network_adapter: 'Network Adapter:',
      pair_done: 'Done',

      // Login
      login_title: 'Select Staff Account',
      login_subtitle: 'Tap operator card to authenticate',
      login_test_badge: 'Store Terminal Access',
      login_btn: 'Sign In to Terminal',

      // Notifications / Toasts
      toast_restock_success: '📥 Restocked +{qty} "{name}"! On hand: {total}',
      toast_sale_success: '🛒 Checked out -{qty} "{name}"! On hand: {total}',
      toast_phone_restock: '📱 Phone Restocked: +{qty} "{name}"! On hand: {total}',
      toast_phone_sale: '📱 Phone Checked Out: -{qty} "{name}"! On hand: {total}',
      toast_unknown_barcode: '⚠️ Barcode "{code}" not found in catalog! Opening register form...',
      toast_saved_success: 'Product "{name}" saved successfully!',
      toast_error: 'Error: {msg}'
    },

    th: {
      brand_name: 'NexTrack',
      brand_subtitle: 'ร้านสะดวกซื้อ สาขาหลัก',
      nav_dashboard: 'ภาพรวมระบบขาย',
      nav_management: 'สต็อกสินค้าและแค็ตตาล็อก',
      nav_store_tools: 'เครื่องมือร้านค้า',
      nav_scanner: 'สแกนเนอร์กล้อง',
      nav_wireless_pair: 'สแกนเนอร์มือถือไร้สาย',
      nav_logout: 'ออกจากระบบ',

      header_status_connected: 'เชื่อมต่อแล้ว',
      header_btn_scan: 'สแกนบาร์โค้ด',
      header_btn_pair: 'สแกนเนอร์มือถือ',
      period_today: 'วันนี้',
      period_month: 'เดือนนี้',
      period_year: 'ปีนี้',
      period_all: 'ทั้งหมด',
      period_custom: 'กำหนดเอง',
      custom_date_from: 'ตั้งแต่',
      custom_date_to: 'ถึง',
      custom_date_apply: 'ตกลง',
      custom_date_cancel: 'ยกเลิก',
      btn_sync: 'ซิงค์ข้อมูล',

      // Dashboard
      dashboard_title: 'ภาพรวมการขายและกะทำงาน',
      dashboard_subtitle: 'ข้อมูลยอดขายเรียลไทม์ ตรวจสอบเงินสด และสมุดบันทึกรายการ',
      kpi_total_sales: 'ยอดขายรวม',
      kpi_sales_sub: 'รายได้จากเครื่องคิดเงิน',
      kpi_gross_profit: 'กำไรขั้นต้น',
      kpi_profit_sub: 'หักต้นทุนสินค้าแล้ว',
      kpi_items_sold: 'จำนวนที่ขายแล้ว',
      kpi_sold_sub: 'ชิ้นที่คิดเงินออกไป',
      kpi_inventory_value: 'มูลค่าสต็อกคงเหลือ',
      kpi_skus: 'รายการสินค้า',
      kpi_on_shelf: 'ชิ้นบนชั้นวาง',

      // Charts & Stream
      chart_sales_analytics: 'สถิติการขาย',
      chart_opt_doughnut: 'สัดส่วนหมวดหมู่ (โดนัท)',
      chart_opt_bar: 'ปริมาณยอดขาย (แท่ง)',
      chart_opt_line: 'แนวโน้มยอดขาย (เส้น)',
      chart_revenue_trends: 'แนวโน้มรายได้',
      chart_revenue_sub: 'การกระจายตัวของรายรับตามช่วงเวลา',
      stream_title: 'รายการบันทึกสดล่าสุด',
      stream_sub: 'ประวัติการทำรายการที่ผ่านการตรวจสอบแล้ว',
      stream_limit: 'แสดง: 20 รายการ',
      col_item_desc: 'รายละเอียดสินค้า',
      col_qty: 'จำนวน',
      col_net_revenue: 'รายรับสุทธิ',
      col_timestamp: 'เวลาบันทึก',

      // Shift Operations
      shift_title: 'การดำเนินงานของกะ',
      shift_branch: 'สาขาหลัก HQ',
      shift_inv_status: 'สถานะคลังสินค้า',
      shift_inv_valid: 'ยอดถูกต้องครบถ้วน',
      shift_data_source: 'แหล่งข้อมูล',
      shift_data_ledger: 'สมุดบันทึกเหตุการณ์ตรง',
      shift_active: 'สถานะกะ',
      shift_time: 'เช้า / บ่าย',
      btn_open_ledger: 'เปิดสต็อกสินค้าและแค็ตตาล็อก',

      // SKU Margin Performance
      margin_title: 'ประสิทธิภาพและอัตรากำไรต่อ SKU',
      margin_sub: 'กำไรส่วนเพิ่มรายสินค้าและการจำแนกความเร็วการขาย',
      margin_search_ph: 'กรองตาม SKU หรือชื่อสินค้า...',
      col_sku_name: 'รหัส SKU และชื่อสินค้า',
      col_units_sold: 'ขายแล้ว',
      col_gross_rev: 'รายรับรวม',
      col_est_profit: 'กำไรประเมิน',
      col_margin_pct: 'อัตรากำไร %',
      col_velocity: 'ความเร็วการขาย',
      badge_top_seller: 'สินค้าขายดี',
      badge_steady: 'ขายสม่ำเสมอ',
      badge_no_sales: 'ยังไม่มียอดขาย',

      // Stock Ledger
      stock_title: 'การจัดการสต็อกสินค้าและคลัง',
      stock_subtitle: 'ข้อมูลสต็อกสินค้าบนชั้นวางแบบเรียลไทม์',
      filter_all_products: 'สินค้าทั้งหมด',
      filter_low_stock: '⚠️ สต็อกเหลือน้อย (≤5)',
      filter_out_stock: '❌ สินค้าหมด',
      filter_all_categories: 'ทุกหมวดหมู่',
      stock_search_placeholder: 'ค้นหา SKU, บาร์โค้ด, ชื่อสินค้า...',
      btn_export_csv: 'ส่งออก CSV',
      table_title_stock: 'สถานะสต็อกบนชั้นวางสด',
      table_sub_stock: 'ระดับสต็อกแบบเรียลไทม์ แจ้งเตือนสั่งซื้อ และปรับสต็อกด่วน',
      btn_refresh: '↻ รีเฟรช',
      col_sku_barcode: 'SKU / บาร์โค้ด',
      col_product_name: 'ชื่อสินค้า',
      col_category: 'หมวดหมู่',
      col_cost: 'ต้นทุน',
      col_stock_status: 'จำนวนและสถานะ',
      col_actions: 'การจัดการ',
      status_healthy: 'ปกติ',
      status_low: 'สต็อกน้อย',
      status_out: 'สินค้าหมด',
      btn_edit: 'แก้ไข',

      // Subtabs
      subtab_movement: 'บันทึกสต็อก',
      subtab_register: 'ลงทะเบียนสินค้าใหม่',
      subtab_audit: 'ประวัติการเคลื่อนไหว',

      // Movement Form
      form_select_item: 'เลือกสินค้า',
      form_choose_product: '-- เลือกสินค้า --',
      form_action_type: 'ประเภทรายการ',
      form_action_restock: 'รับเข้าสต็อก (เพิ่ม)',
      form_action_sale: 'ตัดขายสินค้า (ลด)',
      form_action_audit: 'ตรวจนับ (ตั้งยอดคงเหลือ)',
      form_action_waste: 'ชำรุด / เสียหาย',
      form_action_return: 'ลูกค้านำมาคืน',
      form_quantity: 'จำนวน',
      form_unit_price: 'ราคาต่อหน่วย (บาท)',
      form_note: 'บันทึก / ล็อต #',
      form_note_placeholder: 'เช่น ล็อตจัดส่ง #104',
      btn_post_ledger: 'บันทึกลงระบบคลังสินค้า',

      // Register Form
      banner_register_hint: 'กรอกรายละเอียดสินค้าเพื่อลงทะเบียนสินค้าใหม่เข้าสู่ระบบ',
      field_sku: 'รหัสสินค้า SKU *',
      field_barcode: 'บาร์โค้ด (EAN/UPC)',
      field_name: 'ชื่อสินค้า *',
      field_category: 'หมวดหมู่',
      field_cost: 'ต้นทุน (บาท)',
      field_cost_req: 'ต้นทุน (บาท) *',
      field_min_stock: 'เตือนสต็อกขั้นต่ำ',
      btn_save_catalog: 'บันทึกลงแค็ตตาล็อก',
      cashier_reg_notice: 'การลงทะเบียนสินค้าจำกัดเฉพาะผู้จัดการร้านและเจ้าของร้านเท่านั้น',

      // Audit Trail
      audit_time: 'วันเวลา',
      audit_type: 'ประเภท',
      audit_item: 'สินค้า',
      audit_delta: 'จำนวนเปลี่ยนแปลง',
      audit_source: 'ที่มา',
      system_events_title: 'เหตุการณ์ระบบล่าสุด',
      btn_clear: 'ล้างประวัติ',

      // Edit Modal
      modal_edit_title: 'แก้ไขข้อมูลสินค้า',
      btn_save_changes: 'บันทึกการเปลี่ยนแปลง',
      btn_cancel: 'ยกเลิก',

      // Scanner Terminal & Modal
      scanner_title: 'สแกนเนอร์กล้องบาร์โค้ด',
      scanner_title_short: 'สแกนเนอร์',
      scanner_subtitle: 'ส่องกล้องไปที่บาร์โค้ดหรือคิวอาร์โค้ดของสินค้า',
      scanner_mode: 'โหมดสแกน:',
      scanner_mode_restock: '📥 รับเข้า (+)',
      scanner_mode_sale: '📤 ตัดขาย (-)',
      scanner_mode_audit: '🔍 ตรวจนับ',
      scanner_qty: 'จำนวน:',
      scanner_step_qty: 'จำนวนต่อครั้ง:',
      scanner_manual_placeholder: 'พิมพ์บาร์โค้ดหรือ SKU ด้วยตนเอง...',
      scanner_submit: 'ยืนยัน',
      scanner_recent_scans: 'รายการสแกนล่าสุด',
      scanner_no_scans: 'ยังไม่มีรายการสแกนในรอบนี้',
      scanner_btn_close: 'ปิดสแกนเนอร์',
      scanner_btn_switch_cam: 'สลับกล้อง',
      scanner_btn_torch: 'เปิด/ปิดไฟฉาย',
      scanner_btn_snap: '📸 ถ่ายภาพเพื่อสแกน',
      scanner_camera_starting: 'กำลังเปิดกล้อง...',
      scanner_camera_permission: 'โปรดอนุญาตการเข้าถึงกล้องเมื่อมีข้อความแจ้งเตือน',
      scanner_https_warning: 'การใช้งานกล้องบนมือถือต้องใช้การเชื่อมต่อ HTTPS (Secure Context)',
      scanner_https_btn: 'สลับไปยังเทอร์มินัล HTTPS ที่ปลอดภัย',
      scanner_https_hint: 'เบราว์เซอร์มือถือจะปิดกั้นกล้องบน HTTP ธรรมดา กดปุ่มด้านล่างเพื่อเข้าสู่ HTTPS',
      scanner_unknown_alert: 'สินค้านี้ยังไม่มีในระบบแค็ตตาล็อก',
      scanner_redirecting: 'กำลังนำทางไปหน้าลงทะเบียนสินค้าใน {sec} วินาที...',
      scanner_btn_reg_now: '➕ ลงทะเบียนสินค้านี้ทันที',

      // Wireless Pairing
      pair_title: 'สแกนเนอร์ผ่านมือถือไร้สาย',
      pair_subtitle: 'สแกน QR Code นี้ด้วยมือถือของคุณเพื่อเปลี่ยนมือถือให้เป็นเครื่องสแกนบาร์โค้ดไร้สาย',
      pair_direct_link: 'ลิงก์ตรงสำหรับมือถือ:',
      pair_desc: 'สินค้าที่สแกนบนมือถือจะอัปเดตสต็อกและแสดงผลบนหน้าจอนี้โดยอัตโนมัติแบบเรียลไทม์!',
      pair_copy_btn: 'คัดลอกลิงก์',
      pair_copied: 'คัดลอกลิงก์เรียบร้อยแล้ว!',
      pair_protocol: 'โปรโตคอลการเชื่อมต่อ:',
      pair_https_recommended: 'HTTPS (แนะนำสำหรับกล้องมือถือ)',
      pair_http_standard: 'HTTP (เครือข่ายภายใน LAN)',
      pair_network_adapter: 'การ์ดเครือข่าย:',
      pair_done: 'เสร็จสิ้น',

      // Login
      login_title: 'เลือกบัญชีพนักงาน',
      login_subtitle: 'แตะการ์ดพนักงานเพื่อเข้าสู่ระบบ',
      login_test_badge: 'ระบบจุดขายและสต็อก',
      login_btn: 'เข้าสู่ระบบเทอร์มินัล',

      // Notifications / Toasts
      toast_restock_success: '📥 รับเข้าสต็อกสำเร็จ: +{qty} "{name}"! ยอดคงเหลือ: {total}',
      toast_sale_success: '🛒 ตัดขายสินค้าสำเร็จ: -{qty} "{name}"! ยอดคงเหลือ: {total}',
      toast_phone_restock: '📱 มือถือรับเข้าสต็อก: +{qty} "{name}"! ยอดคงเหลือ: {total}',
      toast_phone_sale: '📱 มือถือตัดขายสินค้า: -{qty} "{name}"! ยอดคงเหลือ: {total}',
      toast_unknown_barcode: '⚠️ ไม่พบบาร์โค้ด "{code}" ในระบบ! กำลังเปิดหน้าต่างลงทะเบียน...',
      toast_saved_success: 'บันทึกสินค้า "{name}" เรียบร้อยแล้ว!',
      toast_error: 'ข้อผิดพลาด: {msg}'
    }
  };

  // Strictly Thai and English only
  const availableLanguages = [
    { code: 'en', name: 'English', short: 'EN', flag: '🇺🇸' },
    { code: 'th', name: 'ไทย', short: 'TH', flag: '🇹🇭' }
  ];

  let currentLang = 'en';
  try {
    const saved = localStorage.getItem('nextrack_lang');
    if (saved === 'th' || saved === 'en') {
      currentLang = saved;
    } else {
      const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (navLang.startsWith('th')) currentLang = 'th';
      else currentLang = 'en';
    }
  } catch (e) {
    currentLang = 'en';
  }

  function t(key, params) {
    const dict = translations[currentLang] || translations.en;
    let text = dict[key] !== undefined ? dict[key] : (translations.en[key] !== undefined ? translations.en[key] : key);

    if (params && typeof params === 'object') {
      Object.keys(params).forEach(p => {
        text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
      });
    }

    return text;
  }

  function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'th') return;
    currentLang = lang;
    try {
      localStorage.setItem('nextrack_lang', lang);
    } catch (e) { }

    document.documentElement.lang = lang;
    applyTranslations();

    // Re-render all switchers across the page
    document.querySelectorAll('[data-language-switcher-rendered]').forEach(el => {
      renderSwitcherInto(el);
    });

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
  }

  function applyTranslations() {
    // 1. Text elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        // If element is an option tag, only update text, preserve value
        if (el.tagName === 'OPTION') {
          el.text = t(key);
        } else {
          el.textContent = t(key);
        }
      }
    });

    // 2. Placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', t(key));
      }
    });

    // 3. Title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', t(key));
      }
    });
  }

  function renderSwitcherInto(container) {
    if (!container) return;
    container.setAttribute('data-language-switcher-rendered', 'true');
    container.innerHTML = `
      <div class="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs shadow-sm select-none" style="background:#090e17; border:1px solid #334155;">
        <button
          type="button"
          onclick="window.i18n.setLanguage('en')"
          class="px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${currentLang === 'en' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}"
          style="${currentLang === 'en' ? 'background-color:#2563eb; color:#ffffff;' : 'background:transparent; color:#94a3b8;'}"
          title="Switch to English"
        >
          🇺🇸 EN
        </button>
        <button
          type="button"
          onclick="window.i18n.setLanguage('th')"
          class="px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${currentLang === 'th' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}"
          style="${currentLang === 'th' ? 'background-color:#2563eb; color:#ffffff;' : 'background:transparent; color:#94a3b8;'}"
          title="เปลี่ยนเป็นภาษาไทย"
        >
          🇹🇭 TH
        </button>
      </div>
    `;
  }

  function createLanguageSelector(containerIdOrElement) {
    const container = typeof containerIdOrElement === 'string'
      ? document.getElementById(containerIdOrElement)
      : containerIdOrElement;
    if (!container) return;
    renderSwitcherInto(container);
  }

  function initAllSelectors() {
    document.querySelectorAll('#language-switcher-container, .language-switcher-target').forEach(el => {
      renderSwitcherInto(el);
    });
  }

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.lang = currentLang;
      applyTranslations();
      initAllSelectors();
    });
  } else {
    document.documentElement.lang = currentLang;
    applyTranslations();
    initAllSelectors();
  }

  // Export to window
  window.i18n = {
    t,
    setLanguage,
    getCurrentLanguage: () => currentLang,
    getAvailableLanguages: () => availableLanguages,
    applyTranslations,
    createLanguageSelector,
    initAllSelectors
  };

})(window);
