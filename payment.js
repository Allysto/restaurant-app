const axios = require('axios');

// PayFast test credentials (SANDBOX - no real money)
// Use environment variables for production
const PAYFAST_CONFIG = {
  merchant_id: process.env.PAYFAST_MERCHANT_ID || '10000100',    // Test merchant ID
  merchant_key: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a', // Test merchant key
  return_url: process.env.PAYFAST_RETURN_URL || 'http://localhost:3000/payment/success',
  cancel_url: process.env.PAYFAST_CANCEL_URL || 'http://localhost:3000/payment/cancel',
  notify_url: process.env.PAYFAST_NOTIFY_URL || 'http://localhost:3000/payment/notify',
  env: process.env.PAYFAST_ENV || 'sandbox' // Change to 'production' when live
};

// Generate PayFast payment URL
function generatePaymentURL(orderData, req = null) {
  const { orderId, amount, itemName, tableNumber } = orderData;
  
  // Determine base URL dynamically
  let baseURL = 'http://localhost:3000';
  if (req) {
    baseURL = `${req.protocol}://${req.get('host')}`;
  } else if (process.env.RENDER_EXTERNAL_URL) {
    baseURL = process.env.RENDER_EXTERNAL_URL;
  }
  
  const data = {
    merchant_id: PAYFAST_CONFIG.merchant_id,
    merchant_key: PAYFAST_CONFIG.merchant_key,
    return_url: `${baseURL}/payment/success`,
    cancel_url: `${baseURL}/payment/cancel`,
    notify_url: `${baseURL}/payment/notify`,
    m_payment_id: orderId,
    amount: amount.toFixed(2),
    item_name: `Table ${tableNumber} - ${itemName}`,
    item_description: `Restaurant Order - ${orderId}`,
    custom_str1: tableNumber.toString(),
    custom_str2: orderId
  };

  // For sandbox testing
  if (PAYFAST_CONFIG.env === 'sandbox') {
    const params = new URLSearchParams(data);
    return `https://sandbox.payfast.co.za/eng/process?${params.toString()}`;
  }
  
  // For production
  const params = new URLSearchParams(data);
  return `https://www.payfast.co.za/eng/process?${params.toString()}`;
}

// Verify PayFast payment (for ITN - Instant Transaction Notification)
function verifyPayment(data) {
  // In production, you'd verify the signature here
  // For sandbox, we'll trust the payment
  return data.payment_status === 'COMPLETE';
}

// Demo payment function for testing on Render
function generateDemoPaymentURL(orderData, req = null) {
  const { orderId, amount, itemName, tableNumber } = orderData;
  
  // For Render demo, create a simple success URL
  let baseURL = 'http://localhost:3000';
  if (req) {
    baseURL = `${req.protocol}://${req.get('host')}`;
  } else if (process.env.RENDER_EXTERNAL_URL) {
    baseURL = process.env.RENDER_EXTERNAL_URL;
  }
  
  return `${baseURL}/payment/success?m_payment_id=${orderId}&amount=${amount}&item_name=Table ${tableNumber} - ${itemName}`;
}

module.exports = { 
  generatePaymentURL, 
  verifyPayment, 
  PAYFAST_CONFIG,
  generateDemoPaymentURL 
};