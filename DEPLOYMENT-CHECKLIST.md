# ✅ PriceKlick - Deployment & Verification Checklist

## Pre-Deployment Checklist

### 🔧 Configuration Files

- [ ] `server/.env` exists and contains all required variables
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - `SERPAPI_KEY` for price comparison
  - `PORT=5050`

- [ ] `web/.env` exists with correct API base URL
  - `VITE_API_BASE=http://localhost:5050` (or your backend URL)

- [ ] `extension/manifest.json` is valid
  - Contains correct version
  - All permissions are set properly

### 📦 Dependencies

- [ ] Backend dependencies installed
  ```bash
  cd server && npm install
  ```

- [ ] Frontend dependencies installed
  ```bash
  cd web && npm install
  ```

### 📁 Directory Structure

- [ ] `extension/` folder contains:
  - [ ] `manifest.json`
  - [ ] `background.js`
  - [ ] `content.js`
  - [ ] `popup.html` and `popup.js`
  - [ ] `service-worker.js`
  - [ ] `icons/` folder with images

- [ ] `server/` folder contains:
  - [ ] `index.js` (main server)
  - [ ] `db.js` (database)
  - [ ] `package.json`
  - [ ] `.env` (configured)
  - [ ] `providers/` folder
  - [ ] `services/` folder

- [ ] `web/` folder contains:
  - [ ] `src/` with all React components
  - [ ] `vite.config.js`
  - [ ] `package.json`
  - [ ] `.env` (configured)
  - [ ] `public/` folder

---

## Startup Verification

### ✅ Backend Server

- [ ] Run: `cd server && npm run dev`
- [ ] Output shows: `Server running on port 5050`
- [ ] Test: `curl http://127.0.0.1:5050/api/health`
- [ ] Should return: `{"ok":true}`
- [ ] No errors in terminal

### ✅ Frontend Application

- [ ] Run: `cd web && npm run dev`
- [ ] Output shows Vite startup messages
- [ ] Shows: `Local: http://localhost:3000/`
- [ ] No build errors
- [ ] Browser loads the page (or can manually visit)

### ✅ Chrome Extension

- [ ] Open Chrome and go to `chrome://extensions/`
- [ ] Toggle "Developer mode" ON
- [ ] Click "Load unpacked"
- [ ] Select the `extension/` folder
- [ ] PriceKlick appears in the extensions list
- [ ] No error messages
- [ ] Extension icon appears in toolbar

---

## Functional Testing

### 🌐 Frontend Testing

Visit `http://localhost:3000` and verify:

- [ ] Page loads without errors
- [ ] Navigation menu works
- [ ] All sections are visible
- [ ] Responsive design (test on mobile view)
- [ ] No console errors (F12 → Console)

### 🔌 Extension Testing

On a supported e-commerce site (Amazon, Walmart, Daraz, BestBuy):

- [ ] Extension popup opens
- [ ] Email input field works
- [ ] "Save Email" button works
- [ ] "Compare price" button sends message to backend
- [ ] "Apply coupon" button works
- [ ] No CORS errors in console (F12)

### 📡 Backend API Testing

Using curl, Postman, or similar:

```bash
# Health check
curl http://127.0.0.1:5050/api/health

# Test privacy consent
curl -X POST http://127.0.0.1:5050/api/privacy/consent \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected responses:
- [ ] Health check returns `{"ok":true}`
- [ ] Consent returns user ID: `{"ok":true,"userId":"..."}`

---

## Port & Network Verification

### 🔍 Port Status

Windows:
```powershell
# Check if ports are in use
netstat -ano | findstr :5050
netstat -ano | findstr :3000
```

If ports are in use, either:
- [ ] Close the application using the port, OR
- [ ] Change PORT in `.env`

### 🌍 Network Access

- [ ] Backend accessible from localhost: `http://127.0.0.1:5050` ✅
- [ ] Frontend accessible from localhost: `http://localhost:3000` ✅
- [ ] Extension can reach backend (no mixed content errors)

---

## Data Persistence Check

### 💾 Local Database

- [ ] `server/data.json` file exists or will be created
- [ ] File contains: `{"users":[],"privacy_events":[],"wishlist":[]}`
- [ ] Data is saved after using the API

Test:
```bash
# Save consent
curl -X POST http://127.0.0.1:5050/api/privacy/consent \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check data.json file - should contain the user
```

---

## Security Checklist

- [ ] `AGENT_SECRET` is not "changeme" (in production)
- [ ] Gmail SMTP password is an app-specific password (not account password)
- [ ] `.env` files are in `.gitignore` (if using Git)
- [ ] Extension manifest V3 permissions are minimal and justified

---

## Environment Variables Validation

### 🔐 Server (.env)

```
PORT=5050                          ✅ Must be 5050 for extension
SMTP_HOST=smtp.gmail.com           ✅ For email notifications
SMTP_USER=your-email@gmail.com     ✅ Replace with real email
SMTP_PASS=app-password             ✅ Use app-specific password
SERPAPI_KEY=your-key               ✅ For price comparison
```

### 🔐 Web (.env)

```
VITE_API_BASE=http://localhost:5050   ✅ Must match server URL
VITE_AGENT_SECRET=changeme            ✅ Should match server
```

---

## Production Deployment Checklist

### 🚀 Before Going Live

- [ ] All configuration validated
- [ ] All tests passed
- [ ] No console errors
- [ ] Security review completed
- [ ] Environment variables secured
- [ ] Database backup created
- [ ] HTTPS enabled (if on internet)

### 📦 Frontend Deployment

```bash
cd web
npm run build      # Creates dist/ folder
# Upload dist/ folder to Vercel, Netlify, or your server
```

- [ ] `dist/` folder created successfully
- [ ] No build errors or warnings
- [ ] Build size is reasonable

### 🖥️ Backend Deployment

Deploy `server/` folder to:
- [ ] Heroku
- [ ] Railway
- [ ] AWS
- [ ] Google Cloud
- [ ] Or any Node.js hosting

Update in `web/.env`:
- [ ] `VITE_API_BASE` points to production backend

### 🔌 Extension Distribution

- [ ] Test thoroughly
- [ ] Update version in `manifest.json`
- [ ] Prepare screenshots and description
- [ ] Submit to Chrome Web Store

---

## Common Issues & Solutions

| Issue | Solution | Status |
|-------|----------|--------|
| Port 5050 in use | `taskkill /PID <PID> /F` | [ ] |
| Port 3000 in use | Close other apps or change port | [ ] |
| Module not found | Run `npm install` in the folder | [ ] |
| CORS error | Ensure backend is on 5050 | [ ] |
| Extension won't load | Enable Developer mode, use Load unpacked | [ ] |
| SMTP errors | Use app password, not account password | [ ] |
| SERPAPI errors | Check API key validity and limits | [ ] |

---

## Final Verification Steps

1. **Full System Test**
   - [ ] All three components running (backend, frontend, extension)
   - [ ] No errors in any console
   - [ ] All data persists correctly

2. **User Experience Test**
   - [ ] Extension loads on supported sites
   - [ ] Can save email
   - [ ] Can compare prices
   - [ ] Can apply coupons
   - [ ] Wishlist functionality works

3. **Performance Check**
   - [ ] Backend responds quickly (< 1s)
   - [ ] Frontend loads in < 3s
   - [ ] Extension doesn't slow down page
   - [ ] No memory leaks

4. **Cross-Browser Test** (if applicable)
   - [ ] Works on Chrome (primary)
   - [ ] Consider Chromium-based browsers

---

## Sign-Off

When all checkboxes are complete:

```
✅ PriceKlick is LIVE and READY for production use!

Date: _______________
Tested by: _______________
Status: APPROVED ✅
```

---

## Need Help?

- 📖 See **SETUP.md** for detailed instructions
- 🚀 See **QUICK-START.md** for quick setup
- 📚 See **README.md** for full documentation

---

**All set! Your PriceKlick is ready to live! 🎉**
