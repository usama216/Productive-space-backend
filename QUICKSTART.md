# 🚀 Quick Start Guide

Get the Productive Space Backend running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js installed (v14+)
- [ ] Supabase account created
- [ ] HitPay account created (for payments)
- [ ] Gmail account with App Password generated

## Step-by-Step Setup

### 1️⃣ Clone & Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/yourusername/Productive-space-backend.git
cd Productive-space-backend

# Install dependencies
npm install
```

### 2️⃣ Set Up Environment Variables (2 minutes)

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

HITPAY_API_URL=https://api.hit-pay.com
HITPAY_API_KEY=your_hitpay_key

EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password

FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000
```

### 3️⃣ Get Your Credentials (3 minutes)

#### Supabase (1 min):
1. Go to [supabase.com](https://supabase.com)
2. Create project → Copy `URL` and `anon key` from Settings → API

#### HitPay (1 min):
1. Go to [hitpayapp.com](https://www.hitpayapp.com/)
2. Sign up → Dashboard → API Keys → Copy key

#### Gmail App Password (1 min):
1. Enable 2FA on Gmail
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate password → Copy it

### 4️⃣ Run the Server (30 seconds)

```bash
npm start
```

You should see:
```
Server running on port 3000
🕐 Scheduled cleanup job started
```

### 5️⃣ Test the API (30 seconds)

Open your browser and visit:
- **API Docs**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/

## 🎉 You're Done!

The backend is now running. You can:
- View API documentation at `/api-docs`
- Start making API calls
- Connect your frontend application

## Common First-Time Issues

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000
# Or change PORT in .env file
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Failed
- Double-check `SUPABASE_URL` and `SUPABASE_KEY`
- Ensure no extra spaces in .env file
- Verify project is not paused in Supabase dashboard

## Next Steps

1. **Set up your database schema** in Supabase
2. **Configure HitPay webhook** URL for payment callbacks
3. **Test API endpoints** using Swagger UI
4. **Connect your frontend** application

Need more details? Check the [main README](./README.md)!

