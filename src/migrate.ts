import { pool } from './db';
import bcrypt from 'bcryptjs';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration...');
    await client.query('BEGIN');

    // 1. Businesses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Default business seed
    await client.query(`
      INSERT INTO businesses (id, name)
      VALUES 
        ('00000000-0000-0000-0000-000000000001', 'HQ Convenience Store'),
        ('00000000-0000-0000-0000-000000000002', 'Downtown Branch')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 3. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'cashier'
          CHECK (role IN ('owner', 'manager', 'cashier')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Default Seed Users
    // owner: admin@nextrack.com / admin123
    // manager: manager@nextrack.com / manager123
    // cashier: cashier@nextrack.com / cashier123
    const defaultPasswordHash = await bcrypt.hash('admin123', 10);
    const managerPasswordHash = await bcrypt.hash('manager123', 10);
    const cashierPasswordHash = await bcrypt.hash('cashier123', 10);

    await client.query(`
      INSERT INTO users (business_id, email, password_hash, display_name, role)
      VALUES 
        ('00000000-0000-0000-0000-000000000001', 'admin@nextrack.com', $1, 'Store Owner', 'owner'),
        ('00000000-0000-0000-0000-000000000001', 'manager@nextrack.com', $2, 'Store Manager', 'manager'),
        ('00000000-0000-0000-0000-000000000001', 'cashier@nextrack.com', $3, 'Front Cashier', 'cashier')
      ON CONFLICT (email) DO NOTHING;
    `, [defaultPasswordHash, managerPasswordHash, cashierPasswordHash]);

    // 5. Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_item_id ON inventory_events(item_id);
      CREATE INDEX IF NOT EXISTS idx_events_event_type ON inventory_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON inventory_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_events_store_id ON inventory_events(store_id);
      CREATE INDEX IF NOT EXISTS idx_items_business_id ON items(business_id);
      CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
