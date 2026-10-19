import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';
import { authenticate, requireRole } from '../middleware/auth';

export const dashboardRouter = Router();

// Apply authentication and role check (Owner & Manager only)
dashboardRouter.use(authenticate, requireRole('owner', 'manager'));

// GET /api/dashboard - Analytics for owner/manager
dashboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;

    // Total revenue and units sold (all-time summary, used as a fallback baseline)
    const revenueRes = await pool.query(
      `SELECT 
         COALESCE(SUM(ABS(quantity) * unit_price), 0) as total_revenue,
         COALESCE(SUM(ABS(quantity)), 0) as total_sold
       FROM inventory_events
       WHERE business_id = $1 AND event_type = 'SALE'`,
      [businessId]
    );

    // Active SKUs count
    const skuRes = await pool.query(
      'SELECT COUNT(*) as total_skus FROM items WHERE business_id = $1',
      [businessId]
    );

    // All sales records — returned in full so the frontend can filter by any date range
    const recentSalesRes = await pool.query(
      `SELECT e.id, e.item_id, e.quantity, e.unit_price, e.timestamp, i.name as item_name, i.sku
       FROM inventory_events e
       JOIN items i ON e.item_id = i.id
       WHERE e.business_id = $1 AND e.event_type = 'SALE'
       ORDER BY e.timestamp DESC`,
      [businessId]
    );

    res.json({
      revenue: parseFloat(revenueRes.rows[0].total_revenue) || 0,
      sold: parseInt(revenueRes.rows[0].total_sold, 10) || 0,
      active_skus: parseInt(skuRes.rows[0].total_skus, 10) || 0,
      recent_sales: recentSalesRes.rows,
    });
  } catch (error: any) {
    console.error('Failed to fetch dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics.' });
  }
});

