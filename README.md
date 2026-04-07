# 🎁 PriceKlick - Full Stack Application

> **Smart PriceKlick and price comparison extension for e-commerce sites**

PriceKlick is a complete full-stack application combining a Chrome extension, backend API, and frontend web dashboard to help users find the best deals and coupons while shopping online.

---

## 🎯 What is PriceKlick?

PriceKlick intelligently:
- 🔍 **Finds coupons** across multiple e-commerce platforms
- 💰 **Compares prices** in real-time across different stores
- 📝 **Applies best deals** automatically
- ❤️ **Saves wishlist items** for later
- 📧 **Sends alerts** for price drops

**Supported Sites**: Daraz.pk, Amazon, Walmart, BestBuy

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Google Chrome                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  PriceKlick Extension                           │  │
│  │  • Detects product pages                         │  │
│  │  • Injects comparison UI                         │  │
│  │  • Communicates with Backend                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTP
┌─────────────────────────────────────────────────────────┐
│           Backend API (Node.js + Express)                │
│                    Port: 5050                            │
│  • Price Comparison (SERPAPI)                           │
│  • Coupon Management                                    │
│  • Email Notifications (Gmail SMTP)                     │
│  • Data Persistence (Local JSON)                        │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTP
┌─────────────────────────────────────────────────────────┐
│       Frontend Web App (React + Vite)                    │
│                    Port: 3000                            │
│  • Landing Page                                         │
│  • User Dashboard                                       │
│  • Features Showcase                                    │
│  • Settings & Preferences                              │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
PriceKlick-fullstack-final/
│
├── 📁 extension/                 # Chrome Extension
│   ├── manifest.json             # Extension configuration (v3)
│   ├── background.js             # Service worker
│   ├── content.js                # Content script (injected on e-commerce sites)
│   ├── popup.html                # Popup UI
│   ├── popup.js                  # Popup logic
│   ├── options.html              # Extension options page
│   ├── options.js                # Options logic
│   ├── service-worker.js         # Service worker
│   └── icons/                    # Extension icons (16, 48, 128px)
│
├── 📁 server/                    # Node.js Backend
│   ├── package.json              # Dependencies
│   ├── index.js                  # Main server file
│   ├── db.js                     # Database layer (local JSON)
│   ├── trends.js                 # Trending data
│   ├── .env                      # Environment variables
│   ├── .env.example              # Example env template
│   ├── data.json                 # Local database file
│   ├── 📁 providers/
│   │   ├── compare.js            # Price comparison logic
│   │   └── surpr.js              # Coupon provider integration
│   └── 📁 services/
│       └── notify.js             # Email notifications
│
├── 📁 web/                       # React Frontend
│   ├── package.json              # Dependencies
│   ├── vite.config.js            # Vite configuration
│   ├── index.html                # Entry HTML file
│   ├── .env                      # Environment variables
│   ├── 📁 src/
│   │   ├── main.jsx              # React entry point
│   │   ├── App.jsx               # Main App component
│   │   ├── 📁 components/        # Reusable components
│   │   ├── 📁 pages/             # Page components
│   │   ├── 📁 context/           # React Context (state)
│   │   ├── 📁 hooks/             # Custom hooks
│   │   ├── 📁 api/               # API client
│   │   ├── 📁 assets/            # Images, SVGs
│   │   └── 📁 styles/            # Global CSS
│   ├── 📁 public/                # Static files
│   └── 📁 dist/                  # Production build output
│
├── 📄 SETUP.md                   # Detailed setup guide
├── 📄 README.md                  # This file
├── 📄 package.json               # Root package.json (for convenience scripts)
├── 🔧 START-ALL.bat              # Windows batch to start all services
├── 🔧 START-ALL.ps1              # Windows PowerShell to start all services
├── 🔧 SETUP-ALL.bat              # Windows batch to install dependencies
├── 🔧 SETUP-ALL.ps1              # Windows PowerShell to install dependencies
└── 📜 print-info.js              # Display startup information
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Google Chrome** browser
- **Windows, macOS, or Linux**

### One-Command Setup

**Windows (Command Prompt or PowerShell):**
```batch
SETUP-ALL.bat
```

**Windows (PowerShell only):**
```powershell
.\SETUP-ALL.ps1
```

**macOS/Linux:**
```bash
chmod +x SETUP-ALL.ps1
./SETUP-ALL.ps1
```

### One-Command Start

**Windows (Command Prompt or PowerShell):**
```batch
START-ALL.bat
```

**Windows (PowerShell only):**
```powershell
.\START-ALL.ps1
```

**macOS/Linux:**
```bash
chmod +x START-ALL.ps1
./START-ALL.ps1
```

---

## 📖 Detailed Setup & Running

See **[SETUP.md](./SETUP.md)** for comprehensive step-by-step instructions.

### Quick Manual Setup

```bash
# 1. Install backend dependencies
cd server
npm install

# 2. Install frontend dependencies
cd ../web
npm install
cd ..

# 3. Start backend (Terminal 1)
cd server
npm run dev

# 4. Start frontend (Terminal 2)
cd web
npm run dev

# 5. Load extension in Chrome
# - Go to chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the extension/ folder
```

---

## 🔌 API Endpoints

### Health Check
- **GET** `/api/health` - Server health status

### User Management
- **POST** `/api/privacy/consent` - Save user email & consent

### Price Comparison
- **POST** `/api/compare` - Compare product prices across stores

### Coupon Management
- **POST** `/api/apply-coupon` - Find and apply best coupon

### Wishlist
- **POST** `/api/wishlist/add` - Add item to wishlist
- **GET** `/api/wishlist` - Get user's wishlist
- **DELETE** `/api/wishlist/:id` - Remove item

---

## 🔧 Environment Configuration

### Backend (.env)
Located at `server/.env`

```properties
# Server
PORT=5050

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="PriceKlick <no-reply@priceklick.com>"

# Price Comparison (SERPAPI)
SERPAPI_KEY=your-serpapi-key

# Agent Settings
AGENT_SECRET=changeme
AGENT_CRON=0 */6 * * *

# Coupon Provider
COUPON_API_BASE=https://couponapi.io/api
```

### Frontend (.env)
Located at `web/.env`

```properties
VITE_API_BASE=http://localhost:5050
VITE_AGENT_SECRET=changeme
```

---

## 📱 Chrome Extension Guide

### Loading the Extension

1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Navigate to the `extension/` folder
6. Select and load

### Extension Features

- **Compare Prices** - See prices across different stores
- **Apply Coupons** - Automatically finds and applies best coupon
- **Save to Wishlist** - Save items for later
- **Email Alerts** - Get notified of price drops
- **Settings** - Configure your preferences

### Supported Sites

- 🇵🇰 Daraz.pk
- 🇺🇸 Amazon.com
- 🇺🇸 Walmart.com
- 🇺🇸 BestBuy.com

---

## 🎨 Frontend Features

### Pages
- **Home** - Landing page with features showcase
- **Dashboard** - User activity and statistics
- **Features** - Detailed feature explanations
- **How It Works** - Tutorial and guide
- **Install** - Extension installation guide
- **Stores** - Supported e-commerce platforms

### Components
- Navigation Bar
- Hero CTA Section
- Feature Grid
- Steps Guide
- Footer
- Toast Notifications
- Loader

---

## 🛠️ Development

### Backend Development

```bash
cd server
npm run dev        # Start with auto-reload
npm start          # Start production
```

### Frontend Development

```bash
cd web
npm run dev        # Start dev server (auto-reload)
npm run build      # Build for production
npm run preview    # Preview production build
```

### Extension Development

- Edit files in `extension/`
- Go to `chrome://extensions/`
- Click the refresh icon for your extension
- Reload the e-commerce site to test

---

## 🐛 Troubleshooting

### Port Already in Use

**Find and kill process on port 5050:**
```bash
# Windows
netstat -ano | findstr :5050
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5050
kill -9 <PID>
```

### Extension Not Loading

1. Verify `manifest.json` is valid JSON
2. Make sure Developer Mode is enabled
3. Load the **folder**, not individual files
4. Check Chrome DevTools for errors (F12)

### Backend/Frontend Connection Issues

1. Ensure backend is running on port 5050
2. Check `VITE_API_BASE` in `web/.env`
3. Verify CORS is enabled in server
4. Check browser console for network errors (F12)

### npm Dependencies Issues

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -r node_modules package-lock.json
npm install
```

---

## 📚 Technologies Used

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variables
- **Nodemailer** - Email sending
- **Axios** - HTTP client
- **node-cron** - Scheduled tasks

### Frontend
- **React** - UI library
- **Vite** - Build tool & dev server
- **React Router** - Client-side routing
- **CSS** - Styling with animations

### Extension
- **Chrome Extension API** - Manifest V3
- **Content Scripts** - DOM manipulation
- **Service Workers** - Background tasks
- **Chrome Storage API** - Data persistence

### APIs
- **SERPAPI** - Price comparison
- **Gmail SMTP** - Email notifications
- **CouponAPI** - Coupon data

---

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd web
npm run build:vercel
# Upload dist/ folder to Vercel
```

### Backend (Node.js Hosting)
```bash
cd server
npm start
# Deploy to Heroku, Railway, or similar
```

### Extension
Submit to [Chrome Web Store](https://chrome.google.com/webstore/)

---

## 📝 License

MIT License - Feel free to use, modify, and distribute.

---

## 💬 Support & Questions

For issues or questions:
1. Check [SETUP.md](./SETUP.md) for detailed instructions
2. Review [Troubleshooting](#troubleshooting) section
3. Check browser console (F12) for errors
4. Review server logs in terminal

---

## ✨ Features Roadmap

- [ ] Multi-store price alerts
- [ ] Browser history integration
- [ ] AI-powered coupon recommendations
- [ ] Cashback integration
- [ ] Mobile app
- [ ] Social sharing
- [ ] User accounts and sync
- [ ] Advanced analytics

---

## 🎊 Ready to Start?

1. Run `SETUP-ALL.bat` (Windows) or `./SETUP-ALL.ps1` (PowerShell/macOS/Linux)
2. Run `START-ALL.bat` (Windows) or `./START-ALL.ps1` (PowerShell/macOS/Linux)
3. Visit `http://localhost:3000`
4. Load extension in Chrome
5. Start finding deals! 🛍️

---

**Happy coding! 🚀**
