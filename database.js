const { Pool } = require('pg');

// Database configuration - USING YOUR NEW PASSWORD
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres', // Connect to default database first
  password: 'System2025', // ✅ Your new password
  port: 5432,
});

// Test database connection and create our database
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Create our restaurant database if it doesn't exist
    try {
      await client.query('CREATE DATABASE restaurant_system');
      console.log('✅ Created restaurant_system database');
    } catch (error) {
      if (error.code === '42P04') { // Database already exists
        console.log('✅ restaurant_system database exists');
      } else {
        throw error;
      }
    }
    
    client.release();
    
    // Now connect to our actual database
    pool.options.database = 'restaurant_system';
    await initializeDatabase();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.log('🚨 Continuing without database for development');
    return false;
  }
  return true;
}

// Create tables
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
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
    
    // Insert sample menu items
    const menuCount = await client.query('SELECT COUNT(*) FROM menu_items');
    if (parseInt(menuCount.rows[0].count) === 0) {
      await client.query(`
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
  } finally {
    client.release();
  }
}

module.exports = { pool, testConnection };