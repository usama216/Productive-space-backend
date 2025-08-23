const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = (userData, bookingData) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            const fileName = `Invoice_${bookingData.bookingRef || bookingData.id || Date.now()}.pdf`;
            const filePath = path.join('/tmp', fileName);

            const tempDir = path.dirname(filePath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            doc.pipe(fs.createWriteStream(filePath));

            const headerFont = 'Helvetica-Bold';
            const bodyFont = 'Helvetica';
            const titleFontSize = 18;
            const sectionHeaderFontSize = 12;
            const bodyFontSize = 10;
            const smallFontSize = 8;

            // Company Header Section (Top Left) - Adjusted positioning
            doc.rect(50, 50, 250, 120).fill('#F8E8E8').stroke();
            
            // Company Logo Placeholder - positioned exactly as in reference
            doc.rect(60, 60, 25, 25).fill('#FFD700').stroke();
            doc.fillColor('#000000').font(headerFont).fontSize(6).text('LOGO', 63, 70);
            
            // Company name and details - aligned exactly as in reference
            doc.fillColor('#000000')
                .font(headerFont).fontSize(16)
                .text('MY PRODUCTIVE SPACE', 95, 60)
                .font(bodyFont).fontSize(8)
                .text('co-work | co-learn | co-study', 95, 80)
                .text('My Productive Space', 60, 100)
                .text('Company ID: 53502976D', 60, 110)
                .text('Blk 208 Hougang st 21 #01-201', 60, 120)
                .text('Hougang 530208', 60, 130)
                .text('Singapore', 60, 140)
                .text('89202462', 60, 150)
                .text('myproductivespacecontact@gmail.com', 60, 160);

            // Invoice Details (Top Right) - Exact positioning
            const invoiceNumber = `INV-${String(bookingData.id || '000001').slice(-6).padStart(6, '0')}`;
            doc.font(headerFont).fontSize(18)
                .text('INVOICE', 380, 60)
                .font(bodyFont).fontSize(12)
                .text(`# ${invoiceNumber}`, 380, 85);

            // Balance Due Box - Exact size and position
            const balanceDue = bookingData.confirmedPayment ? '0.00' : (bookingData.totalAmount || '0.00');
            doc.rect(380, 105, 130, 35).fill('#4CAF50').stroke();
            doc.fillColor('#FFFFFF').font(bodyFont).fontSize(8)
                .text('Balance Due', 390, 115)
                .font(headerFont).fontSize(12)
                .text(`SGD${balanceDue}`, 390, 130);

            // Dates - Exact alignment
            const currentDate = new Date().toLocaleDateString('en-SG');
            doc.fillColor('#000000').font(bodyFont).fontSize(10)
                .text('Invoice Date:', 380, 160).text(currentDate, 470, 160)
                .text('Terms:', 380, 180).text('Due on Receipt', 470, 180)
                .text('Due Date:', 380, 200).text(currentDate, 470, 200);

            // Bill To Section - Exact positioning
            doc.font(headerFont).fontSize(12)
                .text('Bill To', 50, 200)
                .font(bodyFont).fontSize(10)
                .text(userData.firstName || userData.name || 'Customer', 50, 220)
                .text(userData.email || '', 50, 235, { width: 200 });

            // Itemized Services Table - Exact positioning and alignment
            const tableTop = 270;
            doc.rect(50, tableTop, 500, 25).fill('#2C3E50').stroke();
            doc.fillColor('#FFFFFF').font(headerFont).fontSize(10)
                .text('#', 60, tableTop + 8)
                .text('Item & Description', 90, tableTop + 8)
                .text('Qty', 380, tableTop + 8)
                .text('Rate', 420, tableTop + 8)
                .text('Amount', 480, tableTop + 8);

            let currentY = tableTop + 30;
            
            // Generate itemized rows based on booking data
            const items = generateInvoiceItems(bookingData);
            let rowNumber = 1;
            let subtotal = 0;

            items.forEach(item => {
                doc.rect(50, currentY, 500, 25).fill('#F8F9FA').stroke();
                
                doc.fillColor('#000000').font(bodyFont).fontSize(10)
                    .text(rowNumber.toString(), 60, currentY + 8)
                    .text(item.description, 90, currentY + 8, { width: 280 })
                    .text(item.qty.toFixed(2), 385, currentY + 8)
                    .text(`$${item.rate.toFixed(2)}`, 420, currentY + 8)
                    .text(`$${item.amount.toFixed(2)}`, 480, currentY + 8);
                
                subtotal += item.amount;
                currentY += 25;
                rowNumber++;
            });

            // Financial Summary (Bottom Right) - Exact positioning
            currentY += 15;
            doc.font(headerFont).fontSize(12)
                .text('Total', 380, currentY)
                .font(bodyFont).fontSize(10)
                .text(`SGD${subtotal.toFixed(2)}`, 470, currentY);

            currentY += 20;
            doc.fillColor('#FF0000').font(headerFont).fontSize(12)
                .text('Payment Made', 380, currentY)
                .font(bodyFont).fontSize(10)
                .text(`(-) ${subtotal.toFixed(2)}`, 470, currentY);

            currentY += 20;
            doc.rect(380, currentY - 5, 130, 25).fill('#F0F0F0');
            doc.fillColor('#000000').font(headerFont).fontSize(12)
                .text('Balance Due', 380, currentY)
                .font(bodyFont).fontSize(10)
                .text(`SGD0.00`, 470, currentY);

            // Notes Section (Bottom Left) - Exact positioning
            const footerY = 600;
            doc.font(headerFont).fontSize(12)
                .text('Notes', 50, footerY)
                .font(bodyFont).fontSize(8)
                .text('Thanks for your business. Please refer to attached excel sheet for more details', 50, footerY + 15, { width: 300 });

            // Terms & Conditions - Exact positioning
            doc.font(headerFont).fontSize(12)
                .text('Terms & Conditions', 50, footerY + 50)
                .font(bodyFont).fontSize(8)
                .text('1. Please be inform that full payment is required upon confirmation unless otherwise stated.', 50, footerY + 65, { width: 300 })
                .text('2. Once confirmed, we do not offer refunds.', 50, footerY + 80, { width: 300 })
                .text('3. Please note that seat changes are subject to seats availability.', 50, footerY + 95, { width: 300 });

            doc.end();

            doc.on('end', () => {
                resolve({ filePath, fileName });
            });

            doc.on('error', (err) => {
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
};

// Helper function to generate invoice items
const generateInvoiceItems = (bookingData) => {
    const items = [];
    
    if (bookingData.startAt && bookingData.endAt) {
        const startDate = new Date(bookingData.startAt);
        const endDate = new Date(bookingData.endAt);
        const hours = Math.ceil((endDate - startDate) / (1000 * 60 * 60));
        
        const description = bookingData.location ? 
            `${startDate.toISOString().slice(0, 8).replace(/-/g, '')}-${bookingData.location}` :
            `${startDate.toISOString().slice(0, 8).replace(/-/g, '')}-workspace`;
        
        const rate = bookingData.hourlyRate || (parseFloat(bookingData.totalAmount || 0) / hours) || 10;
        const amount = parseFloat(bookingData.totalAmount || 0);
        
        items.push({
            description: description,
            qty: hours,
            rate: rate,
            amount: amount
        });
    } else {
        // Fallback for basic booking data
        items.push({
            description: `Workspace Booking - ${new Date().toISOString().slice(0, 8).replace(/-/g, '')}`,
            qty: 1,
            rate: parseFloat(bookingData.totalAmount || 0),
            amount: parseFloat(bookingData.totalAmount || 0)
        });
    }
    
    return items;
};

module.exports = {
    generateInvoicePDF
};