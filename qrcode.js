const QRCode = require('qrcode');

// Generate QR code for a specific table (base64 for Render)
async function generateQRCode(tableNumber, req = null) {
    try {
        // Dynamic URL for production
        let url;
        if (req) {
            // Use request to get dynamic URL
            url = `${req.protocol}://${req.get('host')}?table=${tableNumber}`;
        } else {
            // Fallback for direct calls
            url = `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}?table=${tableNumber}`;
        }
        
        // Generate base64 QR code (no file system needed)
        const qrCodeBase64 = await QRCode.toDataURL(url);
        
        return {
            tableNumber: tableNumber,
            qrCode: qrCodeBase64, // Base64 image data
            url: url,
            orderURL: url
        };
    } catch (error) {
        console.error('QR generation error:', error);
        throw error;
    }
}

// Generate QR codes for multiple tables
async function generateAllQRCodes(tables = 20, req = null) {
    const qrCodes = [];
    
    for (let i = 1; i <= tables; i++) {
        const qrData = await generateQRCode(i, req);
        qrCodes.push(qrData);
    }
    
    return qrCodes;
}

module.exports = { generateQRCode, generateAllQRCodes };