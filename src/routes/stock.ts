import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { appendEvent } from '../services/inventoryLedger';

export const stockRouter = Router();

// Store active Server-Sent Event (SSE) clients for real-time remote scanner pairing
interface ScanSubscriber {
  id: string;
  businessId: string;
  res: Response;
}

const sseClients: ScanSubscriber[] = [];

export function broadcastScanEvent(businessId: string, payload: any) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    if (client.businessId === businessId) {
      try {
        client.res.write(message);
      } catch (e) {
        // client disconnected
      }
    }
  });
}

// GET /api/stock/scan-stream - SSE stream for wireless scanner pairing
stockRouter.get('/scan-stream', (req: Request, res: Response) => {
  // Can authenticate via query token or header
  const token = req.query.token as string | undefined;
  let businessId = '00000000-0000-0000-0000-000000000001';

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nextrack-super-secret-jwt-token-key-2026');
      businessId = decoded.businessId;
    } catch (e) {
      // ignore, fallback
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = Math.random().toString(36).substring(2, 9);
  const subscriber: ScanSubscriber = { id: clientId, businessId, res };
  sseClients.push(subscriber);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

stockRouter.use(authenticate);

// GET /api/stock - Snapshot of on-hand inventory scoped to user's business
stockRouter.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const storeId = (req.query.store_id as string) || '00000000-0000-0000-0000-000000000001';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined; // 'all' | 'out' | 'low' | 'healthy'

    const conditions: string[] = ['i.business_id = $1'];
    const params: any[] = [businessId, storeId];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length} OR (i.barcode IS NOT NULL AND i.barcode ILIKE $${params.length}) OR i.category ILIKE $${params.length})`
      );
    }

    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`i.category = $${params.length}`);
    }

    if (status === 'out') {
      conditions.push('COALESCE(css.quantity, 0) <= 0');
    } else if (status === 'low') {
      conditions.push('COALESCE(css.quantity, 0) > 0 AND COALESCE(css.quantity, 0) <= COALESCE(i.min_stock_level, 5)');
    } else if (status === 'healthy') {
      conditions.push('COALESCE(css.quantity, 0) > COALESCE(i.min_stock_level, 5)');
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countRes = await pool.query(
      `SELECT COUNT(*) as total
       FROM items i
       LEFT JOIN current_stock_snapshot css ON i.id = css.item_id AND css.store_id = $2
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    // Data query with stock status calculation
    const dataParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `SELECT i.id as item_id,
              $2 as store_id,
              COALESCE(css.quantity, 0) as quantity,
              css.last_updated,
              i.name as item_name,
              i.sku,
              i.barcode,
              i.category,
              i.unit_cost_default,
              COALESCE(i.min_stock_level, 5) as min_stock_level,
              (COALESCE(css.quantity, 0) * i.unit_cost_default) as valuation,
              CASE
                WHEN COALESCE(css.quantity, 0) <= 0 THEN 'OUT_OF_STOCK'
                WHEN COALESCE(css.quantity, 0) <= COALESCE(i.min_stock_level, 5) THEN 'LOW_STOCK'
                ELSE 'HEALTHY'
              END as stock_status
       FROM items i
       LEFT JOIN current_stock_snapshot css ON i.id = css.item_id AND css.store_id = $2
       WHERE ${whereClause}
       ORDER BY i.name ASC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch stock snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch stock snapshot.' });
  }
});

// POST /api/stock/scan - Barcode scanner endpoint
stockRouter.post('/scan', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { barcode, quantity = 1, event_type = 'RESTOCK', store_id, auto_add = true } = req.body;

    if (!barcode || typeof barcode !== 'string') {
      res.status(400).json({ error: 'Barcode is required.' });
      return;
    }

    const cleanBarcode = barcode.trim();

    // 1. Find item by barcode OR sku
    const itemRes = await pool.query(
      `SELECT id, business_id, sku, barcode, name, category, unit_cost_default, min_stock_level
       FROM items
       WHERE business_id = $1
         AND (
           LOWER(sku) = LOWER($2)
           OR (barcode IS NOT NULL AND LOWER(barcode) = LOWER($2))
           OR id::text = $2
         )
       LIMIT 1`,
      [businessId, cleanBarcode]
    );

    // 2. If item is NOT in inventory catalog:
    if (itemRes.rows.length === 0) {
      // Broadcast to connected desktop scanner sessions
      broadcastScanEvent(businessId, {
        type: 'SCAN_UNKNOWN',
        barcode: cleanBarcode,
        found: false,
        timestamp: new Date().toISOString(),
        operator: req.user!.displayName || req.user!.email,
      });

      res.json({
        found: false,
        barcode: cleanBarcode,
        message: `Product with barcode "${cleanBarcode}" was not found in catalog.`,
      });
      return;
    }

    const item = itemRes.rows[0];
    const targetStoreId = store_id || '00000000-0000-0000-0000-000000000001';
    let savedEvent = null;
    const scanQty = Math.max(1, parseInt(quantity, 10) || 1);
    const mode = String(event_type || 'RESTOCK').toUpperCase();
    const isDeduct = mode === 'SALE' || mode === 'WASTE';
    const deltaQty = isDeduct ? -scanQty : scanQty;

    // 3. If item IS in inventory: record inventory movement (skip if CHECK mode)
    if (auto_add && mode !== 'CHECK') {
      savedEvent = await appendEvent({
        item_id: item.id,
        store_id: targetStoreId,
        business_id: businessId,
        event_type: (mode === 'SALE' || mode === 'RESTOCK' || mode === 'WASTE' || mode === 'RETURN' || mode === 'ADJUSTMENT') ? mode : 'RESTOCK',
        quantity: deltaQty,
        unit_price: Number(item.unit_cost_default || 0),
        note: `Scanned via barcode scanner [${cleanBarcode}]`,
        source: 'CAMERA_SCAN',
      });
    }

    // 4. Fetch updated stock count
    const stockRes = await pool.query(
      `SELECT COALESCE(quantity, 0) as on_hand
       FROM current_stock_snapshot
       WHERE item_id = $1 AND store_id = $2`,
      [item.id, targetStoreId]
    );
    const onHand = stockRes.rows.length > 0 ? stockRes.rows[0].on_hand : 0;

    // 5. Broadcast to connected remote sessions
    broadcastScanEvent(businessId, {
      type: 'SCAN_SUCCESS',
      barcode: cleanBarcode,
      found: true,
      item,
      event_type: mode,
      quantity: deltaQty,
      new_quantity: onHand,
      timestamp: new Date().toISOString(),
      operator: req.user!.displayName || req.user!.email,
    });

    res.json({
      found: true,
      action: auto_add ? (isDeduct ? 'CHECKOUT' : (mode === 'CHECK' ? 'CHECK' : 'RESTOCKED')) : 'FOUND',
      item,
      event_type: mode,
      quantity: deltaQty,
      new_quantity: onHand,
      event: savedEvent,
      message: `${isDeduct ? 'Checked out' : 'Restocked'} ${deltaQty > 0 ? '+' : ''}${deltaQty} unit(s) of "${item.name}". Current on-hand: ${onHand}`,
    });
  } catch (error: any) {
    console.error('Scan processing error:', error);
    res.status(500).json({ error: 'Failed to process barcode scan.' });
  }
});

// GET /api/stock/export - Export current stock snapshot to CSV
stockRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const storeId = (req.query.store_id as string) || '00000000-0000-0000-0000-000000000001';

    const stockRes = await pool.query(
      `SELECT i.sku,
              COALESCE(i.barcode, '') as barcode,
              i.name,
              COALESCE(i.category, 'Uncategorized') as category,
              i.unit_cost_default,
              COALESCE(css.quantity, 0) as on_hand,
              (COALESCE(css.quantity, 0) * i.unit_cost_default) as total_valuation,
              CASE
                WHEN COALESCE(css.quantity, 0) <= 0 THEN 'OUT_OF_STOCK'
                WHEN COALESCE(css.quantity, 0) <= COALESCE(i.min_stock_level, 5) THEN 'LOW_STOCK'
                ELSE 'HEALTHY'
              END as status
       FROM items i
       LEFT JOIN current_stock_snapshot css ON i.id = css.item_id AND css.store_id = $2
       WHERE i.business_id = $1
       ORDER BY i.name ASC`,
      [businessId, storeId]
    );

    const rows = stockRes.rows;
    const headers = ['SKU', 'Barcode', 'Product Name', 'Category', 'Unit Cost (฿)', 'On-Hand Stock', 'Total Valuation (฿)', 'Status'];
    const csvLines = [headers.join(',')];

    rows.forEach(r => {
      const line = [
        `"${(r.sku || '').replace(/"/g, '""')}"`,
        `"${(r.barcode || '').replace(/"/g, '""')}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        Number(r.unit_cost_default).toFixed(2),
        r.on_hand,
        Number(r.total_valuation).toFixed(2),
        r.status
      ];
      csvLines.push(line.join(','));
    });

    const csvContent = csvLines.join('\n');
    const filename = `nextrack_inventory_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Failed to export inventory CSV:', error);
    res.status(500).json({ error: 'Failed to export inventory CSV.' });
  }
});
