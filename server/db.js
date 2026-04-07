import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);
const file = path.join(__dirname, 'data.json');
function ensure(){ const dir = path.dirname(file); if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true}); }
function read(){ try{ if(!fs.existsSync(file)) return {users:[],privacy_events:[],wishlist:[]}; const raw=fs.readFileSync(file,'utf8'); return raw?JSON.parse(raw):{users:[],privacy_events:[],wishlist:[]}; }catch{ return {users:[],privacy_events:[],wishlist:[]}; }
}
function write(data){ ensure(); fs.writeFileSync(file, JSON.stringify(data,null,2),'utf8'); }
export const db = { data: read(), async read(){ this.data = read(); }, async write(){ write(this.data); } };
export async function init(){ await db.read(); db.data.users ||= []; db.data.privacy_events ||= []; db.data.wishlist ||= []; await db.write(); }
