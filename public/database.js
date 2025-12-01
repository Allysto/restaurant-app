const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'restaurant_system',
  password: 'RestaurantSystem2025!', // Use the password you set during installation
  port: 5432,
});

// Create tables if they don't exist
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(50) UNIQUE NOT NULL,
        table_number INTEGER NOT NULL,
        items JSONB NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Database tables initialized');
    
    // Insert sample menu items if empty
    const menuCount = await pool.query('SELECT COUNT(*) FROM menu_items');
    if (parseInt(menuCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO menu_items (name, price, category) VALUES
        ('Classic Breakfast', 89.00, 'breakfast'),
        ('Eggs Benedict', 95.00, 'breakfast'),
        ('French Toast', 65.00, 'breakfast'),
        ('Chicken Burger', 75.00, 'lunch'),
        ('Caesar Salad', 65.00, 'lunch'),
        ('Grilled Salmon', 120.00, 'dinner'),
        ('Coffee', 25.00, 'drinks'),
        ('Fresh Juice', 35.00, 'drinks');
      `);
      console.log('✅ Sample menu items inserted');
    }
    
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

module.exports = { pool, initializeDatabase };