#!/usr/bin/env node

console.log(`
╔════════════════════════════════════════════════════════════╗
║           🎉 PriceKlick Startup Information 🎉           ║
╚════════════════════════════════════════════════════════════╝

📱 Backend Server:
   URL: http://127.0.0.1:5050
   Health Check: http://127.0.0.1:5050/api/health
   
🌐 Frontend Web App:
   URL: http://localhost:3000
   
🔌 Chrome Extension:
   Location: ./extension
   Load at: chrome://extensions/
   
📂 Project Structure:
   server/  → Node.js Express backend
   web/     → React + Vite frontend
   extension/ → Chrome extension
   
🚀 Quick Commands:
   npm run start-all      → Start all services
   npm run setup-all      → Install all dependencies
   npm run build-web      → Build frontend for production

✅ Verification Steps:
   1. Check backend health: curl http://127.0.0.1:5050/api/health
   2. Visit frontend: http://localhost:3000
   3. Load extension: chrome://extensions → Load unpacked → ./extension

📚 Documentation:
   See SETUP.md for detailed instructions

════════════════════════════════════════════════════════════

Services should be starting now in separate terminals...
`);
