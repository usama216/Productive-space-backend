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

            doc.rect(50, 50, 230, 130).fill('#F9F9F9').stroke();

            doc.fillColor('#000000')
                .font(headerFont).fontSize(titleFontSize)
                .text('MY PRODUCTIVE SPACE', 60, 60)
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
                .text(`$${balanceDue}`, 410, 130);

            const currentDate = new Date().toLocaleDateString('en-SG');
            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('Invoice Date:', 400, 170).text(currentDate, 480, 170)
                .text('Due Date:', 400, 200).text(currentDate, 480, 200);

            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Bill To', 50, 230)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(userData.firstName || 'Customer', 50, 250)
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

            const startDate = bookingData.startAt ? new Date(bookingData.startAt) : new Date();
            const hours = bookingData.endAt ?
                Math.ceil((new Date(bookingData.endAt) - startDate) / (1000 * 60 * 60)) : 1;

            const description = bookingData.location ?
                `${bookingData.location} - ${startDate.toLocaleDateString('en-SG')}` :
                `Workspace Booking - ${startDate.toLocaleDateString('en-SG')}`;

            const rate = bookingData.hourlyRate || (parseFloat(bookingData.totalAmount || 0) / hours) || 10;
            const amount = parseFloat(bookingData.totalAmount || 0);

            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('1', 60, currentY + 10)
                .text(description, 90, currentY + 10, { width: 280 })
                .text((bookingData.pax || 1).toString(), 385, currentY + 10)
                .text(`$${rate.toFixed(2)}`, 420, currentY + 10)
                .text(`$${amount.toFixed(2)}`, 480, currentY + 10);

            // Calculate fee if payment method is card
            const isCardPayment = bookingData.payment_method === 'card';
            const feeAmount = isCardPayment ? amount * 0.05 : 0;
            const baseAmount = amount - feeAmount;

            currentY += 50; 
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Sub Total', 400, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`$${baseAmount.toFixed(2)}`, 480, currentY);

            // Show card processing fee if applicable
            if (isCardPayment) {
                currentY += 20;
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Card Processing Fee (5%)', 400, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`$${feeAmount.toFixed(2)}`, 480, currentY);
            }

            if (bookingData.discountAmount && bookingData.discountAmount > 0) {
                currentY += 20;
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Discount', 400, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`-$${bookingData.discountAmount.toFixed(2)}`, 480, currentY);
            }

            currentY += 20;
            const total = amount - (parseFloat(bookingData.discountAmount) || 0);
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Total', 400, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`${total.toFixed(2)} SGD`, 465, currentY);

            currentY += 20;
            doc.fillColor('#FF0000').font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Paid', 400, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`${amount.toFixed(2)} SGD`, 470, currentY);

            currentY += 20;
            doc.fillColor('#000000').font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Balance Due', 400, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`$${balanceDue}`, 480, currentY);

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