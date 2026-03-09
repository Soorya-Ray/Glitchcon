const db = require('./neon');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    // Initialize pool
    db.initPool();

    // Create tables

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('customer','supplier','driver','admin')),
        email TEXT,
        phone TEXT,
        wallet_balance REAL DEFAULT 0,
        is_active INTEGER DEFAULT 0,
        last_active TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS orders_metadata (
        order_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        driver_id TEXT,
        create_request_id TEXT,
        description TEXT,
        pickup_address TEXT,
        delivery_address TEXT,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'CREATED',
        on_chain_tx_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id),
        FOREIGN KEY (supplier_id) REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS delivery_proofs (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        driver_id TEXT NOT NULL,
        image_path TEXT,
        gps_lat REAL,
        gps_lng REAL,
        notes TEXT,
        proof_hash TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders_metadata(order_id),
        FOREIGN KEY (driver_id) REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS reputation_scores (
        user_id TEXT PRIMARY KEY,
        successful_deliveries INTEGER DEFAULT 0,
        disputes_against INTEGER DEFAULT 0,
        disputes_won INTEGER DEFAULT 0,
        avg_delivery_time REAL DEFAULT 0,
        score REAL DEFAULT 5.0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`
    ];

    for (const sql of tables) {
      await db.query(sql);
    }

    // Backward-compatible column migration for existing databases.
    await db.query(`ALTER TABLE orders_metadata ADD COLUMN IF NOT EXISTS on_chain_tx_hash TEXT`);
    await db.query(`ALTER TABLE orders_metadata ADD COLUMN IF NOT EXISTS create_request_id TEXT`);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_request_id
      ON orders_metadata (customer_id, create_request_id)
      WHERE create_request_id IS NOT NULL
    `);

    // Seed demo users if not exists
    const userRes = await db.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(userRes.rows[0].count, 10);

    if (userCount === 0) {
      const hash = bcrypt.hashSync('password123', 10);
      const seedUsers = [
        ['USR-C001', 'customer1', hash, 'Arjun Mehta', 'customer', 'arjun@example.com', '9876543210', 50000],
        ['USR-C002', 'customer2', hash, 'Priya Sharma', 'customer', 'priya@example.com', '9876543214', 35000],
        ['USR-C003', 'customer3', hash, 'Vikram Singh', 'customer', 'vikram@example.com', '9876543215', 42000],
        ['USR-S001', 'supplier1', hash, 'TransCo Logistics', 'supplier', 'transco@example.com', '9876543211', 0],
        ['USR-S002', 'supplier2', hash, 'QuickShip India', 'supplier', 'quickship@example.com', '9876543216', 0],
        ['USR-D001', 'driver1', hash, 'Ravi Kumar', 'driver', 'ravi@example.com', '9876543212', 0],
        ['USR-D002', 'driver2', hash, 'Suresh Yadav', 'driver', 'suresh@example.com', '9876543217', 0],
        ['USR-A001', 'admin1', hash, 'System Admin', 'admin', 'admin@example.com', '9876543213', 0],
      ];

      for (const u of seedUsers) {
        await db.query(`
          INSERT INTO users (id, username, password, name, role, email, phone, wallet_balance) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, u);
        await db.query(`
          INSERT INTO reputation_scores (user_id, successful_deliveries, score) VALUES ($1, 0, 5.0)
        `, [u[0]]);
      }

      console.log('✅ Seeded 8 demo users into Neon PostgreSQL');
    }

    return true;
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

module.exports = initDatabase;
