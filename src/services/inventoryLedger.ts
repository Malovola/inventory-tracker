import { pool } from '../db';

export type EventType = 'RESTOCK' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'WASTE';
export type Source = 'MANUAL' | 'CAMERA_SCAN' | 'HID_SCANNER' | 'POS_WEBHOOK' | 'CSV_IMPORT';

export interface InventoryEvent {
  item_id: string;
  store_id: string;
  business_id: string;
  event_type: EventType;
  quantity: number;
  unit_price: number;
  note?: string;
  source: Source;
}

export async function appendEvent(event: InventoryEvent) {
  const client = await pool.connect();

  try {
    // 1. Begin atomic transaction
    await client.query('BEGIN');

    // 2. Insert into inventory_events
    const insertEventQuery = `
      INSERT INTO inventory_events 
        (item_id, store_id, business_id, event_type, quantity, unit_price, note, source)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const eventValues = [
      event.item_id, 
      event.store_id, 
      event.business_id, 
      event.event_type, 
      event.quantity, 
      event.unit_price, 
      event.note || null, 
      event.source
    ];
    const eventResult = await client.query(insertEventQuery, eventValues);

    // 3. Update current_stock_snapshot (Upsert)
    const upsertSnapshotQuery = `
      INSERT INTO current_stock_snapshot (item_id, store_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (item_id, store_id) 
      DO UPDATE SET 
        quantity = current_stock_snapshot.quantity + EXCLUDED.quantity,
        last_updated = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const snapshotValues = [event.item_id, event.store_id, event.quantity];
    await client.query(upsertSnapshotQuery, snapshotValues);

    // 4. Commit transaction
    await client.query('COMMIT');

    return eventResult.rows[0];
  } catch (error) {
    // 5. Rollback on failure to prevent partial writes
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
