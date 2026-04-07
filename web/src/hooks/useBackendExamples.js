import { useState, useCallback } from 'react'
import { get, post, API_BASE } from '../api/client'
export function useConsent(){ const [userId, setUserId] = useState(null); const giveConsent = useCallback(async (email)=>{ const d = await post('/api/privacy/consent', { email }); setUserId(d.userId); return d.userId; },[]); return { userId, giveConsent } }
export function useWishlist(userId){ const add = useCallback(async (item)=> post('/api/wishlist', { userId, ...item }), [userId]); const list = useCallback(async ()=> get(`/api/wishlist?userId=${userId}`), [userId]); const remove = useCallback(async (id)=>{ const r = await fetch(`${API_BASE}/api/wishlist/${id}`, { method: 'DELETE' }); if(!r.ok) throw new Error('delete failed'); return r.json() },[userId]); return { add, list, remove } }
export function useCompare(){ const compare = useCallback(async (q)=> get(`/api/compare?q=${encodeURIComponent(q)}`), []); return { compare } }
// Now requires originalPrice as argument
export function useCoupons(){
	const apply = useCallback(async (cartUrl, originalPrice) => post('/api/coupons/apply', { cartUrl, originalPrice }), []);
	return { apply };
}
export function useTrends(){ const trends = useCallback(async (keyword)=> get(`/api/analytics/trends?keyword=${encodeURIComponent(keyword)}`), []); return { trends } }
