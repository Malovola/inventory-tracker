import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';

export const stockRouter = Router();

stockRouter.use(authenticate);

// GET /api/stock - Snapshot of on-hand inventory scoped to user's business
stockRouter.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const storeId = req.query.store_id as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['i.business_id = $1'];
    const params: any[] = [businessId];

    if (storeId) {
      params.push(storeId);
      conditions.push(`css.store_id = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRes = await pool.query(
      `SELECT COUNT(*) as total
       FROM current_stock_snapshot css
       JOIN items i ON css.item_id = i.id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    // Data query
    const dataParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `SELECT css.item_id, css.store_id, css.quantity, css.last_updated,
              i.name as item_name, i.sku, i.category, i.unit_cost_default
       FROM current_stock_snapshot css
       JOIN items i ON css.item_id = i.id
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
