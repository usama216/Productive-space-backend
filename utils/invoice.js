const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = (userData, bookingData) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            const fileName = `Invoice_${bookingData.bookingRef || bookingData.id || Date.now()}.pdf`;
            // const filePath = path.join(__dirname, '../temp', fileName);
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

            // Add logo from temp folder
            try {
                const logoPath = '/tmp/logo.png';
                if (fs.existsSync(logoPath)) {
                    // Add logo image (80x80 pixels)
                    doc.image(logoPath, 60, 60, { width: 80, height: 80 });
                    console.log('Logo added to PDF successfully');
                } else {
                    // Fallback to company name if logo not found
                    doc.rect(50, 50, 230, 130).fill('#F9F9F9').stroke();
                    doc.fillColor('#000000')
                        .font(headerFont).fontSize(titleFontSize)
                        .text('MY PRODUCTIVE SPACE', 60, 60);
                }
            } catch (logoError) {
                // Fallback to company name if logo fails
                doc.rect(50, 50, 230, 130).fill('#F9F9F9').stroke();
                doc.fillColor('#000000')
                    .font(headerFont).fontSize(titleFontSize)
                    .text('MY PRODUCTIVE SPACE', 60, 60);
                console.log('Logo error, using text fallback:', logoError.message);
            }
            
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(smallFontSize)
                .text('My Productive Space', 60, 95)
                .text('Company ID: 53502976D', 60, 105)
                .text('Blk 208 Hougang st 21 #01-201', 60, 115)
                .text('Hougang 530208', 60, 125)
                .text('Singapore', 60, 135)
                .text('89202462', 60, 145)
                .text('myproductivespacecontact@gmail.com', 60, 155);

           const invoiceNumber = `INV-${String(bookingData.id || '000001').slice(-6).padStart(6, '0')}`;
            doc.font(headerFont).fontSize(titleFontSize)
                .text('INVOICE', 400, 60)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`# ${invoiceNumber}`, 400, 85);

            const balanceDue = bookingData.confirmedPayment ? '0.00' : (bookingData.totalAmount || '0.00');
            doc.rect(400, 105, 120, 40).fill('#4CAF50').stroke();
            doc.fillColor('#FFFFFF').font(bodyFont).fontSize(smallFontSize)
                .text('Balance Due', 410, 115)
                .font(headerFont).fontSize(bodyFontSize)
                .text(`SGD ${balanceDue}`, 410, 130);

            // Use Singapore timezone for invoice dates
            const currentDate = new Date().toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' });
            const currentTime = new Date().toLocaleTimeString('en-SG', { 
                timeZone: 'Asia/Singapore',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('Invoice Date:', 400, 170).text(currentDate, 480, 170)
                .text('Invoice Time:', 400, 185).text(currentTime, 480, 185)
                .text('Due Date:', 400, 200).text(currentDate, 480, 200);

            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Bill To', 50, 230)
               
                .text(userData.email || '', 50, 265, { width: 200 });

            const tableTop = 300;
            doc.rect(50, tableTop, 500, 25).fill('#2C3E50').stroke();
            doc.fillColor('#FFFFFF').font(headerFont).fontSize(bodyFontSize)
                .text('#', 60, tableTop + 8)
                .text('Item & Description', 90, tableTop + 8)
                .text('Qty', 380, tableTop + 8)
                .text('Rate', 420, tableTop + 8)
                .text('Amount', 480, tableTop + 8);

            let currentY = tableTop + 30;
            doc.rect(50, currentY, 500, 30).fill('#F8F9FA').stroke();

            // Convert to Singapore timezone (SGT)
            const startDate = bookingData.startAt ? new Date(bookingData.startAt) : new Date();
            const endDate = bookingData.endAt ? new Date(bookingData.endAt) : new Date();
            
            // Format dates in Singapore timezone
            const startDateSGT = startDate.toLocaleDateString('en-SG', { 
                timeZone: 'Asia/Singapore',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const startTimeSGT = startDate.toLocaleTimeString('en-SG', { 
                timeZone: 'Asia/Singapore',
                hour: '2-digit',
                minute: '2-digit'
            });
            const endTimeSGT = endDate.toLocaleTimeString('en-SG', { 
                timeZone: 'Asia/Singapore',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const hours = bookingData.endAt ?
                Math.ceil((endDate - startDate) / (1000 * 60 * 60)) : 1;

            const description = bookingData.location ?
                `${bookingData.location} - ${startDateSGT} (${startTimeSGT} - ${endTimeSGT})` :
                `Workspace Booking - ${startDateSGT} (${startTimeSGT} - ${endTimeSGT})`;

            const rate = bookingData.hourlyRate || (parseFloat(bookingData.totalAmount || 0) / hours) || 10;
            const amount = parseFloat(bookingData.totalAmount || 0);

            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('1', 60, currentY + 10)
                .text(description, 90, currentY + 10, { width: 280 })
                .text((bookingData.pax || 1).toString(), 385, currentY + 10)
                .text(`$${rate.toFixed(2)}`, 420, currentY + 10)
                .text(`$${amount.toFixed(2)}`, 480, currentY + 10);

            // Calculate fee based on payment method or amount difference
            const totalAmount = parseFloat(bookingData.totalAmount || amount);
            const totalCost = parseFloat(bookingData.totalCost || amount);
            const paymentMethod = bookingData.payment_method || (totalAmount !== totalCost ? 'Credit Card' : 'Pay Now (Scan QR code)');
            const isCardPayment = paymentMethod === 'Credit Card' || paymentMethod === 'card';
            const feeAmount = isCardPayment ? totalAmount * 0.05 : 0;
            const baseAmount = totalAmount - feeAmount;

            // Calculate 40% width for financial summary section
            const pageWidth = 595; // A4 width in points
            const summaryWidth = pageWidth * 0.4; // 40% of page width
            const summaryStartX = pageWidth - summaryWidth - 50; // 50 is margin, start from right side
            
            currentY += 50; 
            doc.font(bodyFont).fontSize(bodyFontSize)
                .text('Sub Total', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${baseAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            // Show card processing fee if applicable
            if (isCardPayment) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Card Fee (5%)', summaryStartX, currentY, { width: summaryWidth - 20 })
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`SGD ${feeAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            // Show payment method
            currentY += 20;
            doc.font(bodyFont).fontSize(bodyFontSize)
                .text('Payment Method', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(paymentMethod, summaryStartX + summaryWidth - 80, currentY);

            // Show promo code discount if applied
            if (bookingData.discountAmount && bookingData.discountAmount > 0) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Promo Code Discount', summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`-SGD ${bookingData.discountAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
                
                // Show promo code ID if available
                if (bookingData.promoCodeId) {
                    currentY += 15;
                    doc.font(bodyFont).fontSize(smallFontSize)
                        .text(`Applied Code: ${bookingData.promoCodeId}`, summaryStartX, currentY, { width: summaryWidth - 20 });
                }
            }

            currentY += 20;
            const total = amount - (parseFloat(bookingData.discountAmount) || 0);
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Total', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${total.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            currentY += 20;
            doc.fillColor('#000000').font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Paid', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${amount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

       
            const footerY = 650;
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Notes', 50, footerY)
                .font(bodyFont).fontSize(smallFontSize)
                .text('Thanks for your business. Please refer to attached excel sheet for more details', 50, footerY + 15, { width: 300 });

            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Terms & Conditions', 50, footerY + 50)
                .font(bodyFont).fontSize(smallFontSize)
                .text('1. Please be informed that full payment is required upon confirmation.', 50, footerY + 65, { width: 300 })
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

module.exports = {
    generateInvoicePDF
};