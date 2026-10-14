// Small key-value store for wishlists, extension users and privacy events.
// Persists to MongoDB when connected — the container filesystem is wiped on
// every Railway deploy, so data.json alone lost everyone's wishlist. The JSON
// file is only used locally before Mongo connects (and is migrated on first use).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);
const file = path.join(__dirname, 'data.json');
const EMPTY = () => ({ users: [], privacy_events: [], wishlist: [] });
const DOC_ID = 'filedb';

function ensure(){ const dir = path.dirname(file); if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true}); }
function readFile(){ try{ if(!fs.existsSync(file)) return EMPTY(); const raw=fs.readFileSync(file,'utf8'); return raw?JSON.parse(raw):EMPTY(); }catch{ return EMPTY(); }
}
function writeFile(data){ ensure(); fs.writeFileSync(file, JSON.stringify(data,null,2),'utf8'); }

const mongoReady = () => mongoose.connection?.readyState === 1;
const store = () => mongoose.connection.db.collection('app_state');

async function readMongo(fallback){
  const doc = await store().findOne({ _id: DOC_ID });
  if (doc) return doc.data || EMPTY();
  // First run on Mongo: carry over whatever the local file had.
  await store().updateOne({ _id: DOC_ID }, { $set: { data: fallback } }, { upsert: true });
  return fallback;
}

function withDefaults(d){ d.users ||= []; d.privacy_events ||= []; d.wishlist ||= []; return d; }

export const db = {
  data: readFile(),
  async read(){
    this.data = withDefaults(mongoReady() ? await readMongo(this.data) : readFile());
  },
  async write(){
    if (mongoReady()) await store().updateOne({ _id: DOC_ID }, { $set: { data: this.data } }, { upsert: true });
    else writeFile(this.data);
  }
};
export async function init(){ await db.read(); await db.write(); }
