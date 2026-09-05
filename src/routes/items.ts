import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createItemSchema, listItemsQuerySchema } from '../schemas/items';

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
      conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR category ILIKE $${params.length})`);
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
      `SELECT id, business_id, sku, name, category, unit_cost_default
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

// POST /api/items - Create product (Manager & Owner only)
itemsRouter.post(
  '/',
  requireRole('owner', 'manager'),
  validateBody(createItemSchema),
  async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const { sku, name, category, unit_cost_default } = req.body;

      const result = await pool.query(
        `INSERT INTO items (business_id, sku, name, category, unit_cost_default)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [businessId, sku, name, category || null, unit_cost_default || 0]
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
