const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const { generatePaymentURL, generateDemoPaymentURL } = require('./payment');
const { generateQRCode, generateAllQRCodes } = require('./qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:System2025@localhost:5432/restaurant_system',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active orders in memory for real-time (in addition to database)
let activeOrders = [];

// Initialize database
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
    
    console.log('✅ Database tables ready');
    
    // Load active orders from database
    const result = await pool.query("SELECT * FROM orders WHERE status != 'completed'");
    activeOrders = result.rows.map(row => ({
      id: row.order_id,
      tableNumber: row.table_number,
      items: row.items,
      total: parseFloat(row.total),
      status: row.status,
      timestamp: new Date(row.created_at).toLocaleTimeString()
    }));
    
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initializeDatabase();

// Sample menu data
const sampleMenu = {
  breakfast: [
    { id: 1, name: 'Classic Breakfast', price: 89.00 },
    { id: 2, name: 'Eggs Benedict', price: 95.00 },
    { id: 3, name: 'French Toast', price: 65.00 }
  ],
  lunch: [
    { id: 4, name: 'Chicken Burger', price: 75.00 },
    { id: 5, name: 'Caesar Salad', price: 65.00 }
  ],
  dinner: [
    { id: 6, name: 'Grilled Salmon', price: 120.00 },
    { id: 7, name: 'Ribeye Steak', price: 150.00 }
  ],
  drinks: [
    { id: 8, name: 'Coffee', price: 25.00 },
    { id: 9, name: 'Fresh Juice', price: 35.00 }
  ]
};

// Analytics data
let restaurantAnalytics = {
  totalOrders: 0,
  totalRevenue: 0,
  popularItems: {},
  hourlySales: {},
  tableStats: {}
};

// Update analytics
function updateAnalytics(order) {
  restaurantAnalytics.totalOrders++;
  restaurantAnalytics.totalRevenue += order.total;
  
  order.items.forEach(item => {
    restaurantAnalytics.popularItems[item.name] = (restaurantAnalytics.popularItems[item.name] || 0) + 1;
  });
  
  const hour = new Date().getHours();
  restaurantAnalytics.hourlySales[hour] = (restaurantAnalytics.hourlySales[hour] || 0) + order.total;
  
  restaurantAnalytics.tableStats[order.tableNumber] = (restaurantAnalytics.tableStats[order.tableNumber] || 0) + 1;
  
  io.emit('analytics_update', restaurantAnalytics);
}

// ========== API ENDPOINTS ==========

// Get menu
app.get('/api/menu', (req, res) => {
  res.json({ success: true, menu: sampleMenu });
});

// Place order
app.post('/api/order', async (req, res) => {
  const { tableNumber, items, total } = req.body;
  
  const orderId = 'ORD' + Date.now();
  const newOrder = {
    id: orderId,
    tableNumber: tableNumber,
    items: items,
    total: total,
    status: 'new',
    timestamp: new Date().toLocaleTimeString()
  };
  
  try {
    // Save to database
    await pool.query(
      'INSERT INTO orders (order_id, table_number, items, total, status) VALUES ($1, $2, $3, $4, $5)',
      [orderId, tableNumber, JSON.stringify(items), total, 'new']
    );
    
    // Add to active orders
    activeOrders.push(newOrder);
    
    // Update analytics
    updateAnalytics(newOrder);
    
    console.log('📦 New Order:', orderId);
    
    // Broadcast to all clients
    io.emit('new_order', newOrder);
    
    res.json({
      success: true,
      message: 'Order placed successfully!',
      orderId: orderId
    });
    
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ success: false, error: 'Failed to save order' });
  }
});

// Kitchen orders
app.get('/api/kitchen/orders', (req, res) => {
  res.json({
    success: true,
    orders: activeOrders.filter(order => order.status !== 'completed')
  });
});

// Admin stats
app.get('/api/admin/stats', (req, res) => {
  const todayOrders = activeOrders.length;
  const todayRevenue = activeOrders.reduce((total, order) => total + order.total, 0);
  const activeOrdersCount = activeOrders.filter(order => order.status !== 'completed').length;
  
  res.json({
    success: true,
    todayOrders: todayOrders,
    todayRevenue: todayRevenue.toFixed(2),
    activeOrders: activeOrdersCount,
    recentOrders: activeOrders.slice(-5).reverse()
  });
});

// Analytics
app.get('/api/analytics', (req, res) => {
  res.json({
    success: true,
    analytics: restaurantAnalytics
  });
});

// Menu management
app.post('/api/admin/menu', (req, res) => {
  const { name, price, category } = req.body;
  console.log('📝 Admin added menu item:', { name, price, category });
  res.json({
    success: true,
    message: 'Menu item added successfully! (Demo mode)'
  });
});

// Payment routes
app.post('/api/payment/create', (req, res) => {
  const { orderId, amount, tableNumber, items } = req.body;
  
  const paymentData = {
    orderId: orderId,
    amount: amount,
    itemName: `${items.length} items`,
    tableNumber: tableNumber
  };
  
  // Use demo payment for Render, or real PayFast if configured
  let paymentURL;
  if (process.env.NODE_ENV === 'production' && process.env.PAYFAST_MERCHANT_ID) {
    paymentURL = generatePaymentURL(paymentData, req);
  } else {
    // Demo mode for Render free tier
    paymentURL = generateDemoPaymentURL(paymentData, req);
  }
  
  res.json({
    success: true,
    payment_url: paymentURL,
    message: 'Payment initiated'
  });
});

// Payment success
app.get('/payment/success', (req, res) => {
  const orderId = req.query.m_payment_id || 'Unknown';
  
  // Update order status to paid
  const order = activeOrders.find(order => order.id === orderId);
  if (order) {
    order.status = 'paid';
    console.log(`💰 Order ${orderId} marked as PAID`);
    io.emit('order_updated', { orderId: orderId, status: 'paid' });
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Payment Successful - Restaurant App</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8f0; }
            .success { color: #10b981; font-size: 48px; }
            .message { margin: 20px 0; }
            button { background: #10b981; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="success">✓</div>
        <h1>Payment Successful!</h1>
        <div class="message">Thank you for your order. Your food is being prepared.</div>
        <button onclick="window.close()">Close</button>
    </body>
    </html>
  `);
});

// Payment cancel
app.get('/payment/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Payment Cancelled</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fef2f2; }
            .cancel { color: #dc2626; font-size: 48px; }
            .message { margin: 20px 0; }
            button { background: #dc2626; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="cancel">✗</div>
        <h1>Payment Cancelled</h1>
        <div class="message">Your payment was cancelled. You can try again.</div>
        <button onclick="window.close()">Close</button>
    </body>
    </html>
  `);
});

// QR Code routes - UPDATED for Render
app.get('/api/qrcode/:tableNumber', async (req, res) => {
  const tableNumber = parseInt(req.params.tableNumber);
  
  if (isNaN(tableNumber) || tableNumber < 1) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid table number' 
    });
  }
  
  try {
    const qrData = await generateQRCode(tableNumber, req);
    res.json({
      success: true,
      tableNumber: qrData.tableNumber,
      qrCode: qrData.qrCode, // base64 image
      orderURL: qrData.url
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate QR code' 
    });
  }
});

app.get('/api/qrcodes/generate-all', async (req, res) => {
  try {
    const tableCount = parseInt(req.query.tables) || 20;
    const qrCodes = await generateAllQRCodes(tableCount, req);
    
    res.json({
      success: true,
      generated: qrCodes.length,
      qrCodes: qrCodes
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate QR codes' 
    });
  }
});

// ========== SOCKET.IO ==========

io.on('connection', (socket) => {
  console.log('🔌 Client connected');
  
  // Send current state to new connections
  socket.emit('current_orders', activeOrders);
  socket.emit('analytics_update', restaurantAnalytics);
  
  socket.on('update_order_status', async (data) => {
    const { orderId, status } = data;
    
    try {
      // Update database
      await pool.query(
        'UPDATE orders SET status = $1 WHERE order_id = $2',
        [status, orderId]
      );
      
      // Update local memory
      const order = activeOrders.find(order => order.id === orderId);
      if (order) {
        order.status = status;
        console.log(`🔄 Order ${orderId} status: ${status}`);
        
        // Remove completed orders from active list
        if (status === 'completed') {
          activeOrders = activeOrders.filter(order => order.id !== orderId);
        }
        
        // Broadcast to all clients
        io.emit('order_updated', { orderId, status });
        io.emit('current_orders', activeOrders);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  });
});

// ========== PAGE ROUTES ==========

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/qrcodes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qrcodes.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`🍕 Restaurant system LIVE on port ${PORT}`);
  console.log(`🌐 Access your system:`);
  
  const baseURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`   Customer: ${baseURL}`);
  console.log(`   Kitchen: ${baseURL}/kitchen`);
  console.log(`   Admin: ${baseURL}/admin`);
  console.log(`   QR Codes: ${baseURL}/qrcodes`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});