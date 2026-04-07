export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050';
export async function post(path, body){ const r = await fetch(`${API_BASE}${path}`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)}); if(!r.ok) throw new Error(`POST ${path} failed`); return r.json(); }
export async function get(path){ const r = await fetch(`${API_BASE}${path}`); if(!r.ok) throw new Error(`GET ${path} failed`); return r.json(); }
