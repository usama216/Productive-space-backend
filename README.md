# Productive Space Backend

A comprehensive backend API for managing co-working space bookings, packages, payments, and user management. Built with Node.js, Express, and Supabase.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Available Scripts](#available-scripts)
- [Key Features](#key-features)

## ✨ Features

- **Booking Management**: Create, update, and manage space bookings
- **Package System**: Purchase and manage booking packages (Half-day, Full-day, Semester bundles)
- **Payment Integration**: HitPay payment gateway integration
- **User Management**: Student verification, user roles (Student, Member, Tutor)
- **Promo Codes**: Discount system with promo code support
- **Credit System**: User credits for bookings
- **Refund System**: Automated refund processing
- **Email Notifications**: Automated booking confirmations with PDF invoices
- **Scheduled Jobs**: Auto-cleanup of unpaid bookings and expired credits
- **Seat Management**: Real-time seat availability checking
- **API Documentation**: Swagger UI integration

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Supabase Account** - [Sign up here](https://supabase.com/)
- **HitPay Account** (for payment processing) - [Sign up here](https://www.hitpayapp.com/)
- **Email Account** (Gmail recommended for SMTP)

## 📥 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/Productive-space-backend.git
cd Productive-space-backend
```

### Step 2: Install Dependencies

```bash
npm install
```

Or if you're using yarn:

```bash
yarn install
```

## 🔐 Environment Variables

Create a `.env` file in the root directory and add the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# HitPay Payment Gateway
HITPAY_API_URL=https://api.hit-pay.com
HITPAY_API_KEY=your_hitpay_api_key

# Email Configuration (Gmail SMTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# Frontend URL (for email links and redirects)
FRONTEND_URL=http://localhost:3000

# Backend URL (for webhooks)
BACKEND_URL=http://localhost:3000
```

### 📝 Getting Your Credentials

#### **Supabase**:
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project
3. Go to Settings → API
4. Copy the `URL` and `anon/public` key

#### **HitPay**:
1. Sign up at [HitPay](https://www.hitpayapp.com/)
2. Go to API Keys section in dashboard
3. Generate and copy your API key

#### **Gmail SMTP**:
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use this app password in `EMAIL_PASSWORD`

## 🚀 Running the Project

### Development Mode

Run the project with auto-reload on file changes:

```bash
npm start
```

The server will start on `http://localhost:3000` (or the PORT you specified in .env)

### Production Mode

```bash
node app.js
```

### Verify Installation

Once the server is running, you should see:

```
Server running on port 3000
🕐 Scheduled cleanup job started - running every 3 minutes
Starting cleanup of unpaid bookings...
```

Visit `http://localhost:3000/api-docs` to view the Swagger API documentation.

## 📁 Project Structure

```
Productive-space-backend/
│
├── config/                    # Configuration files
│   └── database.js           # Supabase connection setup
│
├── controllers/              # Business logic & request handlers
│   ├── bookingController.js  # Booking operations
│   ├── packageController.js  # Package management
│   ├── payment.js           # Payment processing
│   ├── refundController.js  # Refund handling
│   ├── promoCodeController.js
│   ├── creditController.js
│   └── ...
│
├── routes/                   # API route definitions
│   ├── booking.js
│   ├── packages.js
│   ├── payment.js
│   ├── refund.js
│   └── ...
│
├── utils/                    # Helper functions
│   ├── email.js             # Email sending utilities
│   ├── invoice.js           # PDF invoice generation
│   ├── packageUsageHelper.js
│   ├── creditHelper.js
│   └── ...
│
├── templates/               # Email templates
│   ├── bookingConfirmation.js
│   ├── packageConfirmation.js
│   └── refundConfirmation.js
│
├── uploads/                 # File uploads directory
├── public/                  # Static assets
├── scheduledCleanup.js     # Cron job for unpaid bookings
├── scheduledCreditCleanup.js
├── swagger.js              # API documentation config
├── app.js                  # Main application file
└── package.json            # Dependencies & scripts
```

## 📚 API Documentation

Once the server is running, access the interactive API documentation:

**Swagger UI**: `http://localhost:3000/api-docs`

### Main API Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Bookings** | `POST /api/booking/create` | Create a new booking |
| | `GET /api/booking/:id` | Get booking details |
| | `POST /api/booking/confirm-payment` | Confirm booking payment |
| **Packages** | `GET /api/packages/active` | Get active packages |
| | `POST /api/package-payment/create` | Purchase a package |
| | `GET /api/packages/user/:userId` | Get user packages |
| **Payments** | `POST /api/payment/create` | Create payment request |
| | `POST /api/payment/webhook` | HitPay webhook handler |
| **Promo Codes** | `POST /api/promo-codes/apply` | Apply promo code |
| **Credits** | `GET /api/credits/balance/:userId` | Get user credits |
| | `POST /api/credits/use` | Use credits |
| **Refunds** | `POST /api/refund/request` | Request refund |
| | `GET /api/refund/booking/:bookingId` | Get refund status |

## 📜 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Start** | `npm start` | Run server in development mode with nodemon |
| **Test** | `npm test` | Run test suite (to be configured) |

## 🎯 Key Features

### 1. **Booking System**
- Create bookings with date/time selection
- Seat assignment and conflict checking
- Multiple user types (Student, Member, Tutor) with different rates
- Package and promo code support

### 2. **Package System**
- Multiple package types (Half-day, Full-day, Semester)
- Count-based pass system
- Expiration tracking
- Usage history

### 3. **Payment Processing**
- HitPay payment gateway integration
- Webhook handling for payment confirmation
- Credit card fee calculation (5%)
- Payment method tracking

### 4. **Promo Code System**
- Percentage and fixed amount discounts
- Usage limit tracking
- Expiration dates
- Minimum hours requirement

### 5. **Credit System**
- User credit balance
- Credit usage for bookings
- Expiration tracking (30 days)
- Automated cleanup

### 6. **Refund Processing**
- Automated refund calculations
- Admin approval workflow
- HitPay refund integration
- Email notifications

### 7. **Email Notifications**
- Booking confirmations with PDF invoices
- Package purchase confirmations
- Refund notifications
- Extension confirmations

### 8. **Scheduled Jobs**
- Auto-cleanup of unpaid bookings (every 3 minutes)
- Expired credits cleanup (daily)
- Automated booking status updates

## 🛠️ Development Tips

### Testing Webhooks Locally

Use [ngrok](https://ngrok.com/) to expose your local server for webhook testing:

```bash
ngrok http 3000
```

Then update your HitPay webhook URL with the ngrok URL.

### Database Schema

The project uses Supabase (PostgreSQL) with the following main tables:
- `Booking` - Booking records
- `User` - User accounts
- `Package` - Package definitions
- `PackagePurchase` - Package purchases
- `UserPass` - User package passes
- `Payment` - Payment records
- `PromoCode` - Promotional codes
- `Credit` - User credits
- `Refund` - Refund requests

### Common Issues

**Issue**: `Cannot find module './cleanupUnpaidBookings'`
- **Solution**: Ensure all files are restored from git

**Issue**: Email not sending
- **Solution**: Check Gmail app password and 2FA settings

**Issue**: Payment webhook not working
- **Solution**: Verify HitPay webhook URL is correctly configured

## 📞 Support

For issues or questions:
1. Check the existing documentation
2. Review the API documentation at `/api-docs`
3. Check the console logs for error messages

## 📄 License

This project is licensed under the ISC License.

---

**Happy Coding! 🚀**
