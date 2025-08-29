const PDFDocument = require('pdfkit');
const fs = require("fs");
const path = require("path");   // put it here, at the top

// IMPORTANT: Logo positioning has been fixed to prevent overlap with company information
// Logo: 60x60 pixels at position (60, 60)
// Company info: starts at y=130 to provide proper spacing below logo (70 pixels gap)
// Right side elements: positioned to avoid overlap with left side content


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

      

try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");

    if (fs.existsSync(logoPath)) {
        // Logo positioned at top left with proper spacing - 60x60 pixels to prevent overlap
        doc.image(logoPath, 60, 60, { width: 150, height: 60 });
        console.log("Logo added to PDF successfully");
    } else {
        doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
        console.log('Logo not added')
    }
} catch (logoError) {
    doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
    console.log("Logo error, using text fallback:", logoError.message);
}




            // Company information positioned below logo with proper spacing to prevent overlap
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(smallFontSize)
                .text('My Productive Space', 60, 130)  // Moved from 95 to 130
                .text('Company ID: 53502976D', 60, 140)  // Moved from 105 to 140
                .text('Blk 208 Hougang st 21 #01-201', 60, 150)  // Moved from 115 to 150
                .text('Hougang 530208', 60, 160)  // Moved from 125 to 160
                .text('Singapore', 60, 170)  // Moved from 135 to 170
                .text('89202462', 60, 180)  // Moved from 145 to 180
                .text('myproductivespacecontact@gmail.com', 60, 190);  // Moved from 155 to 190

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

            // Generate description with role and seat information
            let description = bookingData.location ?
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

            // Add role and seat information below the main table
            currentY += 40;
            
            // Check if we have role information
            const hasRoleInfo = (bookingData.students > 0 || bookingData.members > 0 || bookingData.tutors > 0) || 
                               (bookingData.seatNumbers && bookingData.seatNumbers.length > 0);
            
            if (hasRoleInfo) {
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Role & Seat Information', 50, currentY);
                
                currentY += 20;
                
                // Show role breakdown
                let roleSummary = [];
                if (bookingData.students > 0) roleSummary.push(`${bookingData.students} Student(s)`);
                if (bookingData.members > 0) roleSummary.push(`${bookingData.members} Member(s)`);
                if (bookingData.tutors > 0) roleSummary.push(`${bookingData.tutors} Tutor(s)`);
                
                if (roleSummary.length > 0) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Total: ${roleSummary.join(', ')}`, 50, currentY);
                    currentY += 15;
                }
                
                // Show seat numbers if available
                if (bookingData.seatNumbers && bookingData.seatNumbers.length > 0) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Assigned Seats: ${bookingData.seatNumbers.join(', ')}`, 50, currentY);
                    currentY += 15;
                }
                
            }

            // Add promo code information if applied
            if (bookingData.promoCodeId && bookingData.discountAmount && bookingData.discountAmount > 0) {
                currentY += 20;
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Promo Code Applied', 50, currentY);
                
                currentY += 20;
                
                // Show promo code details
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Code: ${bookingData.promoCode || bookingData.promoCodeId}`, 50, currentY);
                currentY += 15;
                
                // Show promo code name if available
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
                
                // Calculate and show discount percentage
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
                
                currentY += 20; // Add spacing before financial summary
            }

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
            
            // Adjust spacing based on whether role information and promo code were added
            const hasPromoCode = bookingData.promoCodeId && bookingData.discountAmount && bookingData.discountAmount > 0;
            if (hasRoleInfo || hasPromoCode) {
                currentY += 20; // Less spacing since additional sections were already added
            } else {
                currentY += 50; // Original spacing
            } 
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
                
                // Show promo code details if available
               
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

       
            // const footerY = 650;
            // doc.font(headerFont).fontSize(sectionHeaderFontSize)
            //     .text('Notes', 50, footerY)
            //     .font(bodyFont).fontSize(smallFontSize)
            //     .text('Thanks for your business. Please refer to attached excel sheet for more details', 50, footerY + 15, { width: 300 });

            // doc.font(headerFont).fontSize(sectionHeaderFontSize)
            //     .text('Terms & Conditions', 50, footerY + 50)
            //     .font(bodyFont).fontSize(smallFontSize)
            //     .text('1. Please be informed that full payment is required upon confirmation.', 50, footerY + 65, { width: 300 })
            //     .text('2. Once confirmed, we do not offer refunds.', 50, footerY + 80, { width: 300 })
            //     .text('3. Please note that seat changes are subject to seats availability.', 50, footerY + 95, { width: 300 });

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