import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { pool } from './db';
import { appendEvent } from './services/inventoryLedger';
import type { InventoryEvent } from './services/inventoryLedger';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the static test page
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Routes ---

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Create an item
app.post('/api/items', async (req: Request, res: Response) => {
  try {
    const { business_id, sku, name, category, unit_cost_default } = req.body;

    if (!business_id || !sku || !name) {
      res.status(400).json({ error: 'Missing required fields: business_id, sku, name' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO items (business_id, sku, name, category, unit_cost_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [business_id, sku, name, category || null, unit_cost_default || 0]
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
});

// Get product catalog
app.get('/api/items', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM items ORDER BY name ASC');
    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

// Ingest Events
app.post('/api/events', async (req: Request, res: Response) => {
  try {
    const event: InventoryEvent = req.body;
    
    // Basic validation
    if (!event.item_id || !event.store_id || !event.business_id || !event.event_type || event.quantity === undefined || event.unit_price === undefined || !event.source) {
      res.status(400).json({ error: 'Missing required event fields.' });
      return;
    }

    // Special logic for ADJUSTMENT: payload quantity is the absolute shelf count
    if (event.event_type === 'ADJUSTMENT') {
      const stockRes = await pool.query('SELECT quantity FROM current_stock_snapshot WHERE item_id = $1 AND store_id = $2', [event.item_id, event.store_id]);
      const currentQuantity = stockRes.rows.length > 0 ? stockRes.rows[0].quantity : 0;
      const delta = event.quantity - currentQuantity;
      
      if (delta === 0) {
        res.status(200).json({ message: 'No adjustment needed, actual stock matches system.' });
        return;
      }
      event.quantity = delta; // the database records the difference!
    }

    const savedEvent = await appendEvent(event);
    res.status(201).json(savedEvent);
  } catch (error: any) {
    console.error('Failed to append event:', error);
    res.status(500).json({ error: error.message || 'Failed to process inventory event.', detail: error.detail });
  }
});

// Get event log (optionally filtered by item_id and/or store_id)
app.get('/api/events', async (req: Request, res: Response) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.item_id) {
      params.push(req.query.item_id);
      conditions.push(`item_id = $${params.length}`);
    }
    if (req.query.store_id) {
      params.push(req.query.store_id);
      conditions.push(`store_id = $${params.length}`);
    }

    let query = 'SELECT * FROM inventory_events';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY timestamp DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to fetch events:', error);
    res.status(500).json({ error: 'Failed to fetch events.' });
  }
});

// Get stock snapshot
app.get('/api/stock', async (req: Request, res: Response) => {
  try {
    const storeId = req.query.store_id;
    let query = 'SELECT css.*, i.name as item_name, i.sku FROM current_stock_snapshot css JOIN items i ON css.item_id = i.id';
    const params: any[] = [];

    if (storeId) {
      query += ' WHERE css.store_id = $1';
      params.push(storeId);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to fetch stock:', error);
    res.status(500).json({ error: 'Failed to fetch stock.' });
  }
});

// Dashboard Analytics
app.get('/api/dashboard', async (_req: Request, res: Response) => {
  try {
    const revenueRes = await pool.query(`
      SELECT 
        SUM(ABS(quantity) * unit_price) as total_revenue,
        SUM(ABS(quantity)) as total_sold
      FROM inventory_events
      WHERE event_type = 'SALE'
    `);
    
    const recentSalesRes = await pool.query(`
      SELECT e.*, i.name as item_name 
      FROM inventory_events e
      JOIN items i ON e.item_id = i.id
      WHERE e.event_type = 'SALE'
      ORDER BY e.timestamp DESC
      LIMIT 20
    `);

    const salesByItemRes = await pool.query(`
      SELECT i.name, SUM(ABS(e.quantity)) as total_qty
      FROM inventory_events e
      JOIN items i ON e.item_id = i.id
      WHERE e.event_type = 'SALE'
      GROUP BY i.name
      ORDER BY total_qty DESC
      LIMIT 5
    `);

    res.json({
      revenue: parseFloat(revenueRes.rows[0].total_revenue) || 0,
      sold: parseInt(revenueRes.rows[0].total_sold) || 0,
      recent_sales: recentSalesRes.rows,
      sales_by_item: salesByItemRes.rows
    });
  } catch (error: any) {
    console.error('Failed to fetch dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
