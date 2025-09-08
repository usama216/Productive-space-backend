/**
 * Script to help upload Postman collection to Postman's public documentation
 * This creates a shareable link similar to the one you provided
 */

const fs = require('fs');
const path = require('path');

console.log(`
🚀 Postman Collection Upload Guide
==================================

To create a public Postman documentation link like:
https://documenter.getpostman.com/view/32155605/2sB3BHk8fe

Follow these steps:

1. 📁 Import Collection:
   - Open Postman
   - Click "Import" button
   - Select the file: ${path.join(__dirname, 'postman_collection.json')}
   - Click "Import"

2. 📤 Publish Collection:
   - In Postman, go to your imported collection
   - Click the "..." menu next to the collection name
   - Select "Publish Docs"
   - Choose "Public" visibility
   - Click "Publish Collection"

3. 🔗 Get Shareable Link:
   - After publishing, you'll get a public documentation URL
   - This URL will be similar to: https://documenter.getpostman.com/view/YOUR_COLLECTION_ID/YOUR_VERSION_ID
   - Share this link with your team or clients

4. 🎯 Alternative - Direct Upload:
   - Go to https://documenter.getpostman.com/
   - Click "Import Collection"
   - Upload the postman_collection.json file
   - Follow the publishing steps

📋 Collection Features:
- ✅ All API endpoints organized by category
- ✅ Environment variables configured
- ✅ Example requests with sample data
- ✅ Comprehensive documentation
- ✅ Ready for testing

🔧 Environment Variables to Set:
- baseUrl: http://localhost:3000 (or your server URL)
- userId: Your test user ID
- bookingId: Your test booking ID
- packageId: Your test package ID

📚 Documentation Access:
- Swagger UI: http://localhost:3000/api-docs
- Postman Collection: Import the postman_collection.json file

Happy Testing! 🎉
`);

// Check if the collection file exists
const collectionPath = path.join(__dirname, 'postman_collection.json');
if (fs.existsSync(collectionPath)) {
  console.log('✅ Postman collection file found and ready for import!');
} else {
  console.log('❌ Postman collection file not found. Please run the setup first.');
}

