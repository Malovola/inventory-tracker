import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createEventSchema, listEventsQuerySchema } from '../schemas/events';
import { appendEvent } from '../services/inventoryLedger';
import type { InventoryEvent } from '../services/inventoryLedger';

export const eventsRouter = Router();

// Apply authentication to all events routes
eventsRouter.use(authenticate);

// GET /api/events - Paginated event log scoped to business
eventsRouter.get('/', validateQuery(listEventsQuerySchema), async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['e.business_id = $1'];
    const params: any[] = [businessId];

    if (req.query.item_id) {
      params.push(req.query.item_id);
      conditions.push(`e.item_id = $${params.length}`);
    }
    if (req.query.store_id) {
      params.push(req.query.store_id);
      conditions.push(`e.store_id = $${params.length}`);
    }
    if (req.query.event_type) {
      params.push(req.query.event_type);
      conditions.push(`e.event_type = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM inventory_events e WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    // Data query with item details
    const dataParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `SELECT e.id, e.item_id, e.store_id, e.business_id, e.event_type, e.quantity, e.unit_price, e.timestamp, e.note, e.source,
              i.name as item_name, i.sku
       FROM inventory_events e
       JOIN items i ON e.item_id = i.id
       WHERE ${whereClause}
       ORDER BY e.timestamp DESC
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
    console.error('Failed to fetch events:', error);
    res.status(500).json({ error: 'Failed to fetch inventory events.' });
  }
});

// POST /api/events - Ingest inventory event
eventsRouter.post('/', validateBody(createEventSchema), async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const event: InventoryEvent = {
      ...req.body,
      business_id: businessId,
    };

    // Verify item belongs to this business
    const itemCheck = await pool.query(
      'SELECT id FROM items WHERE id = $1 AND business_id = $2',
      [event.item_id, businessId]
    );

    if (itemCheck.rows.length === 0) {
      res.status(404).json({ error: 'Item not found in your business catalog.' });
      return;
    }

    // Special logic for ADJUSTMENT: payload quantity is the absolute shelf count
    if (event.event_type === 'ADJUSTMENT') {
      const stockRes = await pool.query(
        'SELECT quantity FROM current_stock_snapshot WHERE item_id = $1 AND store_id = $2',
        [event.item_id, event.store_id]
      );
      const currentQuantity = stockRes.rows.length > 0 ? stockRes.rows[0].quantity : 0;
      const delta = event.quantity - currentQuantity;

      if (delta === 0) {
        res.status(200).json({ message: 'No adjustment needed, actual stock matches system snapshot.' });
        return;
      }
      event.quantity = delta; // Record the calculated difference
    }

    const savedEvent = await appendEvent(event);
    res.status(201).json(savedEvent);
  } catch (error: any) {
    console.error('Failed to append event:', error);
    res.status(500).json({
      error: error.message || 'Failed to process inventory event.',
      detail: error.detail,
    });
  }
});
