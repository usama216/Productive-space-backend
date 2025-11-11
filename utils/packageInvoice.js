const PDFDocument = require('pdfkit');
const fs = require("fs");
const path = require("path");
const { formatSingaporeDate, formatSingaporeTime, getCurrentSingaporeDateTime } = require('./timezoneUtils');

const generatePackageInvoicePDF = (userData, packageData) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Get dynamic payment fee settings
            const { getPaymentSettings } = require('./paymentFeeHelper');
            const feeSettings = await getPaymentSettings();
            const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
            
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            const fileName = `PackageInvoice_${packageData.orderId || packageData.id || Date.now()}.pdf`;
            const filePath = path.join('/tmp', fileName);

           
            
            doc.pipe(fs.createWriteStream(filePath));

            const headerFont = 'Helvetica-Bold';
            const bodyFont = 'Helvetica';
            const titleFontSize = 18;
            const sectionHeaderFontSize = 12;
            const bodyFontSize = 10;
            const smallFontSize = 8;

            // Add logo or company name
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

            // Company Info
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(smallFontSize)
                .text('My Productive Space', 60, 130)  
                .text('Company ID: 53502976D', 60, 140)  
                .text('Blk 208 Hougang st 21 #01-201', 60, 150)  
                .text('Hougang 530208', 60, 160)  
                .text('Singapore', 60, 170)  
                .text('89202462', 60, 180)  
                .text('myproductivespacecontact@gmail.com', 60, 190); 

            // Invoice Title and Number
            const invoiceNumber = `PKG-${String(packageData.orderId || '000001').slice(-6).padStart(6, '0')}`;
            doc.font(headerFont).fontSize(titleFontSize)
                .text('INVOICE', 400, 60)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`# ${invoiceNumber}`, 400, 85);

            // Dates
            const currentDateTime = getCurrentSingaporeDateTime();
            
            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('Invoice Date:', 400, 170).text(currentDateTime.date, 480, 170)
                .text('Invoice Time:', 400, 185).text(currentDateTime.time, 480, 185);

            // Bill To
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Bill To', 50, 230)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(userData.email || '', 50, 265, { width: 200 });

            // Table Header
            const tableTop = 300;
            doc.rect(50, tableTop, 500, 25).fill('#2C3E50').stroke();
            doc.fillColor('#FFFFFF').font(headerFont).fontSize(bodyFontSize)
                .text('#', 60, tableTop + 8)
                .text('Package Details', 90, tableTop + 8)
                .text('Qty', 380, tableTop + 8)
                .text('Rate', 420, tableTop + 8)
                .text('Amount', 480, tableTop + 8);

            let currentY = tableTop + 30;
            doc.rect(50, currentY, 500, 30).fill('#F8F9FA').stroke();

            // Package Item
            const activatedDate = formatSingaporeDate(packageData.activatedAt);
            
            // Calculate expiry date properly: activatedAt + validityDays
            // This ensures the expiry date is always correct even if not provided
            const activatedTime = new Date(packageData.activatedAt).getTime();
            const validityDays = packageData.validityDays || 30;
            const expiryTime = activatedTime + (validityDays * 24 * 60 * 60 * 1000);
            const expiresDate = formatSingaporeDate(new Date(expiryTime));
            
            const description = `${packageData.packageName} (${packageData.packageType} - ${packageData.passCount} Passes) - Valid: ${activatedDate} to ${expiresDate}`;
            const quantity = packageData.quantity || 1;
            const baseAmount = parseFloat(packageData.baseAmount || packageData.totalAmount);
            const cardFee = parseFloat(packageData.cardFee || 0);
            const payNowFee = parseFloat(packageData.payNowFee || 0);
            const totalAmount = parseFloat(packageData.totalAmount);
            const unitPrice = baseAmount / quantity;

            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('1', 60, currentY + 10)
                .text(description, 90, currentY + 10, { width: 280 })
                .text(quantity.toString(), 385, currentY + 10)
                .text(`$${unitPrice.toFixed(2)}`, 420, currentY + 10)
                .text(`$${baseAmount.toFixed(2)}`, 480, currentY + 10);

            currentY += 40;

        

            // Summary
            const pageWidth = 595;
            const summaryWidth = pageWidth * 0.4; 
            const summaryStartX = pageWidth - summaryWidth - 50; 
            
            currentY += 50; 
            doc.font(bodyFont).fontSize(bodyFontSize)
                .text('Sub Total', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${baseAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            if (cardFee > 0) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Card Fee (${cardFeePercentage}%)`, summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`SGD ${cardFee.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            if (payNowFee > 0) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('PayNow Fee', summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`SGD ${payNowFee.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            currentY += 20;
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Total Paid', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${totalAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            console.log("📄 Finalizing PDF document...");
            doc.end();

            doc.on('end', () => {
                console.log("✅ PDF generation completed successfully!");
                console.log("📄 File saved:", filePath);
                console.log("📄 File name:", fileName);
                resolve({ filePath, fileName });
            });

            doc.on('error', (err) => {
                console.error("❌ PDF generation error:", err);
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    generatePackageInvoicePDF
};
