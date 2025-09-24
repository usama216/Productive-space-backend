const PDFDocument = require('pdfkit');
const fs = require("fs");
const path = require("path");

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

      

try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");

    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, 60, { width: 150, height: 60 });
    } else {
        doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
    }
} catch (logoError) {
    doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
}




            doc.fillColor('#000000')
                .font(bodyFont).fontSize(smallFontSize)
                .text('My Productive Space', 60, 130)  
                .text('Company ID: 53502976D', 60, 140)  
                .text('Blk 208 Hougang st 21 #01-201', 60, 150)  
                .text('Hougang 530208', 60, 160)  
                .text('Singapore', 60, 170)  
                .text('89202462', 60, 180)  
                .text('myproductivespacecontact@gmail.com', 60, 190); 

           const invoiceNumber = `INV-${String(bookingData.id || '000001').slice(-6).padStart(6, '0')}`;
            doc.font(headerFont).fontSize(titleFontSize)
                .text('INVOICE', 400, 60)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`# ${invoiceNumber}`, 400, 85);

          
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
                .font(bodyFont).fontSize(bodyFontSize)
                .text(userData.email || '', 50, 265, { width: 200 });

            const tableTop = 300;
            doc.rect(50, tableTop, 500, 25).fill('#2C3E50').stroke();
            doc.fillColor('#FFFFFF').font(headerFont).fontSize(bodyFontSize)
                .text('#', 60, tableTop + 8)
                .text('Location & Date/Time', 90, tableTop + 8)
                .text('Hours', 380, tableTop + 8)
                .text('Rate', 420, tableTop + 8)
                .text('Amount', 480, tableTop + 8);

            let currentY = tableTop + 30;
            doc.rect(50, currentY, 500, 30).fill('#F8F9FA').stroke();

            const startDate = bookingData.startAt ? new Date(bookingData.startAt) : new Date();
            const endDate = bookingData.endAt ? new Date(bookingData.endAt) : new Date();
            
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
            
            // Format hours with decimal places for more accurate display
            const hoursDecimal = bookingData.endAt ?
                ((endDate - startDate) / (1000 * 60 * 60)) : 1;
            const formattedHours = hoursDecimal % 1 === 0 ? 
                `${hoursDecimal} Hours` : 
                `${hoursDecimal.toFixed(1)} Hours`;

            let description = bookingData.location ?
                `${bookingData.location} - ${startDateSGT} (${startTimeSGT} - ${endTimeSGT})` :
                `Workspace Booking - ${startDateSGT} (${startTimeSGT} - ${endTimeSGT})`;

            const rate = bookingData.hourlyRate || (parseFloat(bookingData.totalAmount || 0) / hours) || 10;
            const amount = parseFloat(bookingData.totalAmount || 0);

            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('1', 60, currentY + 10)
                .text(description, 90, currentY + 10, { width: 280 })
                .text(formattedHours, 385, currentY + 10)
                .text(`$${rate.toFixed(2)}`, 420, currentY + 10)
                .text(`$${amount.toFixed(2)}`, 480, currentY + 10);

            currentY += 40;
            
            const hasRoleInfo = (bookingData.students > 0 || bookingData.members > 0 || bookingData.tutors > 0) || 
                               (bookingData.seatNumbers && bookingData.seatNumbers.length > 0);
            
            if (hasRoleInfo) {
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Role & Seat Information', 50, currentY);
                
                currentY += 20;
                
                let roleSummary = [];
                if (bookingData.students > 0) roleSummary.push(`${bookingData.students} Student(s)`);
                if (bookingData.members > 0) roleSummary.push(`${bookingData.members} Member(s)`);
                if (bookingData.tutors > 0) roleSummary.push(`${bookingData.tutors} Tutor(s)`);
                
                if (roleSummary.length > 0) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Total: ${roleSummary.join(', ')}`, 50, currentY);
                    currentY += 15;
                }
                
                if (bookingData.seatNumbers && bookingData.seatNumbers.length > 0) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Assigned Seats: ${bookingData.seatNumbers.join(', ')}`, 50, currentY);
                    currentY += 15;
                }
                
            }

            if (bookingData.promoCodeId && bookingData.discountAmount && bookingData.discountAmount > 0) {
                currentY += 20;
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Promo Code Applied', 50, currentY);
                
                currentY += 20;
                
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Code: ${bookingData.promoCode || bookingData.promoCodeId}`, 50, currentY);
                currentY += 15;
                
                if (bookingData.promoCodeName) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Name: ${bookingData.promoCodeName}`, 50, currentY);
                    currentY += 15;
                }
                
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Original Amount: SGD ${(parseFloat(bookingData.totalCost) || 0).toFixed(2)}`, 50, currentY);
                currentY += 15;
                
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Discount Amount: SGD ${(parseFloat(bookingData.discountAmount) || 0).toFixed(2)}`, 50, currentY);
                currentY += 15;
                
                const originalAmount = parseFloat(bookingData.totalCost) || 0;
                const discountAmount = parseFloat(bookingData.discountAmount) || 0;
                if (originalAmount > 0 && discountAmount > 0) {
                    const discountPercentage = ((discountAmount / originalAmount) * 100).toFixed(1);
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Discount: ${discountPercentage}%`, 50, currentY);
                    currentY += 15;
                }
                
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Final Amount: SGD ${(parseFloat(bookingData.totalAmount) || 0).toFixed(2)}`, 50, currentY);
                
                currentY += 20;
            }

            const { calculatePaymentDetails } = require('./calculationHelper');
            const paymentDetails = calculatePaymentDetails(bookingData);

            const pageWidth = 595;
            const summaryWidth = pageWidth * 0.4; 
            const summaryStartX = pageWidth - summaryWidth - 50; 
            
            const hasPromoCode = bookingData.promoCodeId && bookingData.discountAmount && bookingData.discountAmount > 0;
            if (hasRoleInfo || hasPromoCode) {
                currentY += 20; 
            } else {
                currentY += 50; 
            } 
            doc.font(bodyFont).fontSize(bodyFontSize)
                .text('Sub Total', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${paymentDetails.originalAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            if (paymentDetails.discount && paymentDetails.discount.discountAmount > 0) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Promo Code Discount', summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`-SGD ${paymentDetails.discount.discountAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            if (paymentDetails.isCardPayment) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Card Fee (5%)', summaryStartX, currentY, { width: summaryWidth - 20 })
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`SGD ${paymentDetails.cardFee.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            currentY += 20;
            doc.font(bodyFont).fontSize(bodyFontSize)
                .text('Payment Method', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(paymentDetails.paymentMethod, summaryStartX + summaryWidth - 80, currentY);

            currentY += 20;
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Total', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${paymentDetails.finalTotal.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            currentY += 20;
            doc.fillColor('#000000').font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Paid', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${paymentDetails.finalTotal.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

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