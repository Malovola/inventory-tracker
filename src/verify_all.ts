const BASE = 'http://localhost:3000';

async function runVerification() {
  console.log('====================================================');
  console.log('       NEXTRACK ENTERPRISE VERIFICATION SUITE       ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  // 1. Health check
  const healthRes = await fetch(`${BASE}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.status === 'ok', '1. Health check endpoint responds with 200 ok');

  // 2. Helmet security headers
  const nosniff = healthRes.headers.get('x-content-type-options');
  const xssFilter = healthRes.headers.get('x-frame-options');
  assert(nosniff === 'nosniff' && !!xssFilter, '2. Helmet security headers present (nosniff, frame-options)');

  // 3. Rate limiting headers
  const rateLimitHeader = healthRes.headers.get('ratelimit-limit') || healthRes.headers.get('x-ratelimit-limit');
  assert(!!rateLimitHeader, '3. Express rate-limiting active with standard headers');

  // 4. Unauthorized rejection
  const unauthRes = await fetch(`${BASE}/api/items`);
  assert(unauthRes.status === 401, '4. Unauthenticated request to /api/items rejected with 401');

  // 5. Invalid login
  const badLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@nextrack.com', password: 'bad-password' }),
  });
  assert(badLoginRes.status === 401, '5. Invalid login credentials rejected with 401');

  // 6. Owner Login
  const ownerRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@nextrack.com', password: 'admin123' }),
  });
  const owner = await ownerRes.json();
  assert(ownerRes.status === 200 && owner.user.role === 'owner' && !!owner.token, '6. Owner login succeeded with JWT');
  const ownerToken = owner.token;

  // 7. Cashier Login
  const cashierRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cashier@nextrack.com', password: 'cashier123' }),
  });
  const cashier = await cashierRes.json();
  assert(cashierRes.status === 200 && cashier.user.role === 'cashier' && !!cashier.token, '7. Cashier login succeeded with JWT');
  const cashierToken = cashier.token;

  // 8. Role check: Cashier blocked from creating items (403)
  const cashierBlockedItem = await fetch(`${BASE}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ sku: 'FORBIDDEN-01', name: 'Cashier Item' }),
  });
  assert(cashierBlockedItem.status === 403, '8. Cashier blocked from creating items (403 Forbidden)');

  // 9. Role check: Cashier blocked from Dashboard (403)
  const cashierBlockedDash = await fetch(`${BASE}/api/dashboard`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  assert(cashierBlockedDash.status === 403, '9. Cashier blocked from accessing dashboard (403 Forbidden)');

  // 10. Owner creates item (201)
  const uniqueSku = `SKU-${Date.now()}`;
  const createItemRes = await fetch(`${BASE}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      sku: uniqueSku,
      name: 'Cold Brew Latte',
      category: 'Beverages',
      unit_cost_default: 4.25,
    }),
  });
  const createdItem = await createItemRes.json();
  assert(createItemRes.status === 201 && createdItem.sku === uniqueSku, '10. Owner registered new product (201 Created)');

  // 11. Paginated GET /api/items
  const listItemsRes = await fetch(`${BASE}/api/items?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const listItemsJson = await listItemsRes.json();
  assert(
    listItemsRes.status === 200 && Array.isArray(listItemsJson.data) && listItemsJson.pagination?.page === 1,
    '11. Paginated GET /api/items works cleanly for all authenticated staff'
  );

  // 12. Cashier logs RESTOCK (50 units)
  const restockRes = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      item_id: createdItem.id,
      store_id: '00000000-0000-0000-0000-000000000001',
      event_type: 'RESTOCK',
      quantity: 50,
      unit_price: 4.25,
      source: 'MANUAL',
      note: 'Morning delivery',
    }),
  });
  const restockData = await restockRes.json();
  assert(restockRes.status === 201 && restockData.quantity === 50, '12. Cashier logged RESTOCK movement (50 units)');

  // 13. Cashier logs SALE (-10 units)
  const saleRes = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      item_id: createdItem.id,
      store_id: '00000000-0000-0000-0000-000000000001',
      event_type: 'SALE',
      quantity: -10,
      unit_price: 6.5,
      source: 'MANUAL',
    }),
  });
  const saleData = await saleRes.json();
  assert(saleRes.status === 201 && saleData.quantity === -10, '13. Cashier logged SALE movement (-10 units)');

  // 14. Stock snapshot reflects 40 units
  const stockRes = await fetch(`${BASE}/api/stock`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const stockJson = await stockRes.json();
  const targetStock = (stockJson.data || []).find((s: any) => s.item_id === createdItem.id);
  assert(
    stockRes.status === 200 && targetStock && targetStock.quantity === 40,
    '14. Stock snapshot shows 40 on-hand units (50 restocked - 10 sold)'
  );

  // 15. ADJUSTMENT calculates delta correctly (Shelf audit: count is 42)
  const auditRes = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      item_id: createdItem.id,
      store_id: '00000000-0000-0000-0000-000000000001',
      event_type: 'ADJUSTMENT',
      quantity: 42,
      unit_price: 4.25,
      source: 'MANUAL',
      note: 'Shift inventory count',
    }),
  });
  const auditData = await auditRes.json();
  assert(auditRes.status === 201 && auditData.quantity === 2, '15. ADJUSTMENT calculated delta (+2) to reconcile stock to 42');

  // 16. Verify new stock is now exactly 42
  const stockRes2 = await fetch(`${BASE}/api/stock`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const stockJson2 = await stockRes2.json();
  const targetStock2 = (stockJson2.data || []).find((s: any) => s.item_id === createdItem.id);
  assert(targetStock2 && targetStock2.quantity === 42, '16. Live stock snapshot confirmed at 42 units');

  // 17. Owner Dashboard analytics
  const dashRes = await fetch(`${BASE}/api/dashboard`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const dashData = await dashRes.json();
  assert(
    dashRes.status === 200 && dashData.revenue >= 65 && Array.isArray(dashData.recent_sales),
    '17. Owner Dashboard returns calculated sales revenue and recent sales'
  );

  // 18. Zod Validation rejection on malformed event
  const invalidEvent = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ item_id: 'bad-id', quantity: 'bad-qty' }),
  });
  assert(invalidEvent.status === 400, '18. Invalid schema input rejected with 400 validation error');

  // 19. Register item with a dedicated barcode for scanner test
  const testBarcode = `BARCODE-${Date.now()}`;
  const barcodeItemRes = await fetch(`${BASE}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      sku: `SCAN-${Date.now()}`,
      barcode: testBarcode,
      name: 'Matcha Green Tea',
      category: 'Beverages',
      unit_cost_default: 3.5,
      min_stock_level: 8,
    }),
  });
  const barcodeItem = await barcodeItemRes.json();
  assert(barcodeItemRes.status === 201 && barcodeItem.barcode === testBarcode, '19. Created product with specific barcode for scanning');

  // 20. Barcode Scan: Existing item auto-restocks +1
  const scanExistRes = await fetch(`${BASE}/api/stock/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ barcode: testBarcode, quantity: 1 }),
  });
  const scanExistData = await scanExistRes.json();
  assert(
    scanExistRes.status === 200 &&
      scanExistData.found === true &&
      scanExistData.action === 'RESTOCKED' &&
      scanExistData.new_quantity === 1,
    '20. Scanned existing barcode automatically added to inventory (+1 restock count)'
  );

  // 21. Barcode Scan: Unknown barcode returns found=false with barcode payload
  const unknownBarcode = `UNKNOWN-${Date.now()}`;
  const scanUnknownRes = await fetch(`${BASE}/api/stock/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ barcode: unknownBarcode }),
  });
  const scanUnknownData = await scanUnknownRes.json();
  assert(
    scanUnknownRes.status === 200 &&
      scanUnknownData.found === false &&
      scanUnknownData.barcode === unknownBarcode,
    '21. Unknown barcode scan returns found:false (triggers register item redirect)'
  );

  // 22. Quick barcode lookup API
  const lookupRes = await fetch(`${BASE}/api/items/barcode/${testBarcode}`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const lookupData = await lookupRes.json();
  assert(
    lookupRes.status === 200 && lookupData.id === barcodeItem.id && lookupData.on_hand === 1,
    '22. Barcode lookup endpoint (/api/items/barcode/:code) resolves correct item and live stock'
  );

  // 23. Owner updates product metadata (min_stock_level, price)
  const updateRes = await fetch(`${BASE}/api/items/${barcodeItem.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ min_stock_level: 15, unit_cost_default: 4.0 }),
  });
  const updateData = await updateRes.json();
  assert(
    updateRes.status === 200 && updateData.min_stock_level === 15 && Number(updateData.unit_cost_default) === 4.0,
    '23. Owner updated item min_stock_level and default unit cost'
  );

  // 24. Low stock status filter in /api/stock
  const lowStockRes = await fetch(`${BASE}/api/stock?status=low`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const lowStockData = await lowStockRes.json();
  const foundLow = (lowStockData.data || []).some((s: any) => s.item_id === barcodeItem.id);
  assert(
    lowStockRes.status === 200 && foundLow,
    '24. Stock filtering by status=low correctly flags item below min_stock_level'
  );

  // 25. Export inventory to CSV
  const exportRes = await fetch(`${BASE}/api/stock/export`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const csvText = await exportRes.text();
  assert(
    exportRes.status === 200 &&
      Boolean(exportRes.headers.get('content-type')?.includes('text/csv')) &&
      csvText.includes('SKU,Barcode,Product Name') &&
      csvText.includes(testBarcode),
    '25. Inventory export (/api/stock/export) returns valid CSV with headers and products'
  );

  console.log('\n====================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} VERIFICATION TESTS PASSED PERFECTLY!`);
  } else {
    console.error(`💥 ${failed} TEST(S) FAILED. ${passed} PASSED.`);
  }
  console.log('====================================================\n');
}

runVerification();

