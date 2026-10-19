import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createItemSchema, updateItemSchema, listItemsQuerySchema } from '../schemas/items';

export const itemsRouter = Router();

// Apply authentication to all items routes
itemsRouter.use(authenticate);

// GET /api/items - Paginated list of products scoped to business
itemsRouter.get('/', validateQuery(listItemsQuerySchema), async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string | undefined;

    const conditions: string[] = ['business_id = $1'];
    const params: any[] = [businessId];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR (barcode IS NOT NULL AND barcode ILIKE $${params.length}) OR category ILIKE $${params.length})`
      );
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM items WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    // Data query
    const dataParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `SELECT id, business_id, sku, barcode, name, category, unit_cost_default, min_stock_level
       FROM items
       WHERE ${whereClause}
       ORDER BY name ASC
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
    console.error('Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

// GET /api/items/barcode/:code - Quick Barcode Lookup
itemsRouter.get('/barcode/:code', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const rawCode = req.params.code;
    const code = (typeof rawCode === 'string' ? rawCode : Array.isArray(rawCode) ? rawCode[0] || '' : '').trim();

    const result = await pool.query(
      `SELECT i.id, i.business_id, i.sku, i.barcode, i.name, i.category, i.unit_cost_default, i.min_stock_level,
              COALESCE(css.quantity, 0) as on_hand
       FROM items i
       LEFT JOIN current_stock_snapshot css ON i.id = css.item_id
       WHERE i.business_id = $1
         AND (
           LOWER(i.sku) = LOWER($2)
           OR (i.barcode IS NOT NULL AND LOWER(i.barcode) = LOWER($2))
           OR i.id::text = $2
         )
       LIMIT 1`,
      [businessId, code]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found with this barcode or SKU.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to lookup barcode:', error);
    res.status(500).json({ error: 'Failed to lookup barcode.' });
  }
});

// GET /api/items/:id - Fetch single product by UUID
itemsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const itemId = req.params.id;

    const result = await pool.query(
      `SELECT i.id, i.business_id, i.sku, i.barcode, i.name, i.category, i.unit_cost_default, i.min_stock_level,
              COALESCE(css.quantity, 0) as on_hand
       FROM items i
       LEFT JOIN current_stock_snapshot css ON i.id = css.item_id
       WHERE i.id = $1 AND i.business_id = $2`,
      [itemId, businessId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Item not found in catalog.' });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Failed to get item by ID:', error);
    res.status(500).json({ error: 'Failed to retrieve product details.' });
  }
});

// POST /api/items - Create product (Manager & Owner only)
itemsRouter.post(
  '/',
  requireRole('owner', 'manager'),
  validateBody(createItemSchema),
  async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const { sku, barcode, name, category, unit_cost_default, min_stock_level } = req.body;

      const result = await pool.query(
        `INSERT INTO items (business_id, sku, barcode, name, category, unit_cost_default, min_stock_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [businessId, sku, barcode || null, name, category || null, unit_cost_default || 0, min_stock_level || 5]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error('Failed to create item:', error);
      if (error.code === '23505') {
        res.status(409).json({ error: 'An item with this SKU already exists for this business.' });
        return;
      }
      res.status(500).json({ error: 'Failed to create item.' });
    }
  }
);

// PUT /api/items/:id - Update product (Manager & Owner only)
itemsRouter.put(
  '/:id',
  requireRole('owner', 'manager'),
  validateBody(updateItemSchema),
  async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const itemId = req.params.id;
      const { sku, barcode, name, category, unit_cost_default, min_stock_level } = req.body;

      // Check existence
      const existing = await pool.query(
        'SELECT id FROM items WHERE id = $1 AND business_id = $2',
        [itemId, businessId]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Item not found in catalog.' });
        return;
      }

      const updates: string[] = [];
      const params: any[] = [itemId, businessId];

      if (sku !== undefined) {
        params.push(sku);
        updates.push(`sku = $${params.length}`);
      }
      if (barcode !== undefined) {
        params.push(barcode || null);
        updates.push(`barcode = $${params.length}`);
      }
      if (name !== undefined) {
        params.push(name);
        updates.push(`name = $${params.length}`);
      }
      if (category !== undefined) {
        params.push(category || null);
        updates.push(`category = $${params.length}`);
      }
      if (unit_cost_default !== undefined) {
        params.push(unit_cost_default);
        updates.push(`unit_cost_default = $${params.length}`);
      }
      if (min_stock_level !== undefined) {
        params.push(min_stock_level);
        updates.push(`min_stock_level = $${params.length}`);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields provided for update.' });
        return;
      }

      const query = `
        UPDATE items
        SET ${updates.join(', ')}
        WHERE id = $1 AND business_id = $2
        RETURNING *
      `;

      const result = await pool.query(query, params);
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Failed to update item:', error);
      if (error.code === '23505') {
        res.status(409).json({ error: 'Another item already has this SKU.' });
        return;
      }
      res.status(500).json({ error: 'Failed to update item.' });
    }
  }
);

// DELETE /api/items/:id - Remove item (Manager & Owner only)
itemsRouter.delete(
  '/:id',
  requireRole('owner', 'manager'),
  async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const itemId = req.params.id;

      // Check if item has ledger history
      const historyCheck = await pool.query(
        'SELECT COUNT(*) as count FROM inventory_events WHERE item_id = $1',
        [itemId]
      );
      if (parseInt(historyCheck.rows[0].count, 10) > 0) {
        res.status(400).json({
          error: 'Cannot delete product with existing inventory ledger history. Audited transactions must be preserved.',
        });
        return;
      }

      const result = await pool.query(
        'DELETE FROM items WHERE id = $1 AND business_id = $2 RETURNING id, name',
        [itemId, businessId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Item not found.' });
        return;
      }

      res.json({ message: `Product "${result.rows[0].name}" deleted from catalog.` });
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      res.status(500).json({ error: 'Failed to delete item.' });
    }
  }
);
