const qr = require('qr-image');
const fs = require('fs');
const path = require('path');

// Generate QR code for a specific table
function generateQRCode(tableNumber) {
    const qrData = `http://localhost:3000?table=${tableNumber}`;
    const qrPNG = qr.image(qrData, { type: 'png' });
    
    const qrDir = path.join(__dirname, 'public', 'qrcodes');
    
    // Create qrcodes directory if it doesn't exist
    if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
    }
    
    const filename = `table-${tableNumber}.png`;
    const filepath = path.join(qrDir, filename);
    
    qrPNG.pipe(fs.createWriteStream(filepath));
    
    return `/qrcodes/${filename}`;
}

// Generate QR codes for multiple tables
function generateAllQRCodes(tables = 20) {
    const qrCodes = [];
    
    for (let i = 1; i <= tables; i++) {
        const qrPath = generateQRCode(i);
        qrCodes.push({
            tableNumber: i,
            qrCodeURL: qrPath,
            orderURL: `http://localhost:3000?table=${i}`
        });
    }
    
    return qrCodes;
}

module.exports = { generateQRCode, generateAllQRCodes };