# ⚡ Quick Start Guide - PriceKlick

## 30 Seconds Setup ⏱️

### Windows Users

**Option 1: Click to Run (Easiest)**
1. Double-click `SETUP-ALL.bat` → Let it install dependencies
2. Double-click `START-ALL.bat` → Services will start automatically

**Option 2: Command Prompt**
```batch
SETUP-ALL.bat
START-ALL.bat
```

**Option 3: PowerShell**
```powershell
.\SETUP-ALL.ps1
.\START-ALL.ps1
```

---

### macOS/Linux Users

```bash
# Make scripts executable
chmod +x SETUP-ALL.ps1 START-ALL.ps1

# Setup dependencies
./SETUP-ALL.ps1

# Start all services
./START-ALL.ps1
```

---

## What Happens Next? 📱

After running `START-ALL.bat` or `./START-ALL.ps1`:

1. ✅ Backend server starts on **http://127.0.0.1:5050**
2. ✅ Frontend app starts on **http://localhost:3000**
3. ✅ Information display shows next steps

---

## Load the Chrome Extension 🔌

1. Open **Google Chrome**
2. Go to: `chrome://extensions/`
3. Turn ON **"Developer mode"** (top-right toggle)
4. Click **"Load unpacked"**
5. Select the **`extension/`** folder from this project
6. Done! ✅

---

## Test Everything ✅

Open your browser and visit:

- **Backend Health:** http://127.0.0.1:5050/api/health
  - Should show: `{"ok":true}`

- **Frontend App:** http://localhost:3000
  - Should show: PriceKlick landing page

- **Chrome Extension:** 
  - Check `chrome://extensions/`
  - Should see PriceKlick with no errors

---

## Verify Your Setup 🔍

All three should be running:

| Service | URL | Status |
|---------|-----|--------|
| Backend API | http://127.0.0.1:5050 | Check terminal 1 |
| Frontend App | http://localhost:3000 | Check terminal 2 |
| Extension | chrome://extensions/ | Loaded ✅ |

---

## Need Help? 🆘

| Issue | Solution |
|-------|----------|
| Port 5050 in use | Close other apps, or see SETUP.md |
| Port 3000 in use | Close other apps, or see SETUP.md |
| npm not found | Reinstall Node.js |
| Extension won't load | Make sure Developer mode is ON |
| CORS errors | Check backend is running on 5050 |

---

## Next Steps 🚀

1. ✅ Setup complete
2. ✅ Services running
3. ✅ Extension loaded
4. 🎯 **Test on real sites:**
   - Visit: Amazon, Walmart, Daraz, or BestBuy
   - Click extension popup
   - Try "Compare price" or "Apply coupon"

---

## More Help

- **Detailed Guide:** See `SETUP.md`
- **Full Docs:** See `README.md`
- **Architecture:** See `README.md` architecture section

---

## That's It! 🎉

Your PriceKlick is now **LIVE** and ready to find deals! 💰

Enjoy saving money! 🛍️
