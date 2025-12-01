const axios = require('axios');

// PayFast test credentials (SANDBOX - no real money)
const PAYFAST_CONFIG = {
  merchant_id: '10000100',    // Test merchant ID
  merchant_key: '46f0cd694581a', // Test merchant key
  return_url: 'http://localhost:3000/payment/success',
  cancel_url: 'http://localhost:3000/payment/cancel',
  notify_url: 'http://localhost:3000/payment/notify',
  env: 'sandbox' // Change to 'production' when live
};

// Generate PayFast payment URL
function generatePaymentURL(orderData) {
  const { orderId, amount, itemName, tableNumber } = orderData;
  
  const data = {
    merchant_id: PAYFAST_CONFIG.merchant_id,
    merchant_key: PAYFAST_CONFIG.merchant_key,
    return_url: PAYFAST_CONFIG.return_url,
    cancel_url: PAYFAST_CONFIG.cancel_url,
    notify_url: PAYFAST_CONFIG.notify_url,
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

module.exports = { generatePaymentURL, verifyPayment, PAYFAST_CONFIG };