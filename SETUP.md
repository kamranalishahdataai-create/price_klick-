# PriceKlick - Full Setup Guide 🎉

This is a **full-stack application** with:
- **Backend Server** (Node.js Express on port 5050)
- **Frontend Web App** (React + Vite on port 3000)
- **Chrome Extension** (loaded manually)

---

## 📋 Prerequisites

Make sure you have installed:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Google Chrome** browser
- **Git** (optional)

Verify installation:
```bash
node --version
npm --version
```

---

## 🚀 Quick Start (All-in-One)

### Windows PowerShell

```powershell
# 1. Navigate to project root
cd c:\Users\kamran ali shah\OneDrive\Desktop\PriceKlick-fullstack-final\PriceKlick-fullstack-final

# 2. Install all dependencies
npm run setup-all

# 3. Start all services (opens 3 terminals)
npm run start-all
```

---

## 📦 Step-by-Step Setup

### Step 1: Install Server Dependencies

```powershell
cd server
npm install
cd ..
```

### Step 2: Install Web Frontend Dependencies

```powershell
cd web
npm install
cd ..
```

### Step 3: Verify Environment Configuration

**Server Environment** (`server/.env`)
- Already configured with API keys (SERPAPI_KEY, SMTP, etc.)
- Change `AGENT_SECRET=changeme` if needed for security

**Web Frontend** (`web/.env`)
- `VITE_API_BASE=http://localhost:5050` (backend URL)
- `VITE_AGENT_SECRET=changeme` (should match server)

---

## ▶️ Running the Application

### Option A: Run All Services Together (Recommended)

```powershell
# From project root
npm run start-all
```

This will open separate windows/terminals for:
1. **Backend Server** → http://127.0.0.1:5050
2. **Frontend App** → http://localhost:3000
3. **Chrome Extension** → (manual loading required)

---

### Option B: Run Services Individually

#### Terminal 1 - Start Backend Server

```powershell
cd server
npm run dev
```

Expected output:
```
Server running on port 5050
```

#### Terminal 2 - Start Frontend

```powershell
cd web
npm run dev
```

Expected output:
```
  VITE v5.4.20  ready in XXX ms

  ➜  Local:   http://localhost:3000/
```

#### Terminal 3 - Load Chrome Extension

1. Open **Google Chrome**
2. Go to: `chrome://extensions/`
3. Enable **"Developer mode"** (top-right toggle)
4. Click **"Load unpacked"**
5. Navigate to: `extension/` folder
6. Select the folder and load it

---

## ✅ Verification Checklist

After starting services:

- [ ] **Backend** accessible: http://127.0.0.1:5050/api/health
  - Should return: `{"ok":true}`
  
- [ ] **Frontend** accessible: http://localhost:3000/
  - Should show PriceKlick landing page
  
- [ ] **Extension** loaded in Chrome
  - Should appear in `chrome://extensions/`
  - No errors in the service worker (click "service worker" link)

---

## 🧩 How Each Component Works

### Backend Server (`server/`)
- **Main entry**: `server/index.js`
- **Port**: 5050
- **Key endpoints**:
  - `POST /api/privacy/consent` - Save user email
  - `GET /api/health` - Health check
  - `POST /api/compare` - Compare prices across stores
  - `POST /api/apply-coupon` - Apply best coupon
  - Includes email notifications, cron jobs, and data persistence

### Frontend Web App (`web/`)
- **Main entry**: `web/src/main.jsx`
- **Port**: 3000
- **Framework**: React + Vite
- **Features**: Landing page, dashboard, features showcase

### Chrome Extension (`extension/`)
- **Main files**:
  - `manifest.json` - Extension configuration
  - `background.js` - Service worker
  - `content.js` - Injected on e-commerce sites
  - `popup.html/js` - Extension popup UI
  - `popup.html` - Options page
- **Supported Sites**: Daraz.pk, Amazon, Walmart, BestBuy
- **Port**: Communicates with backend on 5050

---

## 🔧 Available npm Commands

### From Project Root
```bash
npm run setup-all      # Install all dependencies
npm run start-all      # Start all services
```

### From `server/`
```bash
npm run dev            # Start server with auto-reload
npm start              # Start server (production)
```

### From `web/`
```bash
npm run dev            # Start dev server
npm run build          # Build for production
npm run preview        # Preview production build
```

---

## 🛠️ Troubleshooting

### Issue: Port 5050 already in use
```powershell
# Find process using port 5050
netstat -ano | findstr :5050

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F
```

### Issue: Port 3000 already in use
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F
```

### Issue: Extension not loading
1. Make sure Developer Mode is enabled in `chrome://extensions/`
2. Load the `extension/` folder (not individual files)
3. Refresh the extension after changes

### Issue: CORS errors
- Backend must be running on 5050
- Check that `localhost` is not in manifest permissions (use 127.0.0.1)
- Verify `CORS` is enabled in server (it is by default)

### Issue: npm command not found
- Reinstall Node.js
- Restart your PowerShell terminal
- Check `node -v` and `npm -v`

---

## 📁 Project Structure

```
PriceKlick-fullstack-final/
├── extension/              # Chrome Extension
│   ├── manifest.json       # Extension config
│   ├── background.js       # Service worker
│   ├── content.js          # Injected script
│   ├── popup.html/js       # Extension UI
│   └── icons/              # Extension icons
│
├── server/                 # Backend Server
│   ├── package.json        # Dependencies
│   ├── index.js            # Main server file
│   ├── db.js               # Data persistence
│   ├── .env                # Environment config
│   ├── providers/          # Price comparison
│   ├── services/           # Email notifications
│   └── data.json           # Local database
│
├── web/                    # Frontend App
│   ├── package.json        # Dependencies
│   ├── vite.config.js      # Vite config
│   ├── .env                # Environment config
│   ├── src/                # React components
│   ├── public/             # Static files
│   └── index.html          # Entry HTML
│
└── SETUP.md               # This file
```

---

## 🎯 Next Steps

1. **Run the application** using the Quick Start section
2. **Visit** http://localhost:3000 in your browser
3. **Load the extension** in Chrome (see "Loading Chrome Extension")
4. **Test on e-commerce sites** (Daraz, Amazon, Walmart, BestBuy)
5. **Check console logs** for debugging (F12 → Console)

---

## 💬 Support

If you encounter issues:
1. Check that all prerequisites are installed
2. Verify all services are running on correct ports
3. Check browser console for errors (F12)
4. Check server logs in terminal
5. Review `.env` files for correct configuration

---

## 🎊 You're all set!

Your PriceKlick application is ready to use. Enjoy finding the best deals! 🛍️
