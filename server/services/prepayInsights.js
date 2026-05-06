// server/services/prepayInsights.js
// PrePay v1: aggregates UserActivity over last 30 days and calls OpenAI to
// produce weekly insights — patterns, predicted upcoming spend, suggested
// cheaper alternatives.
import fetch from 'node-fetch';
import UserActivity from '../models/UserActivity.js';

const MIN_ACTIVITIES = 5;

export async function buildActivityDigest(userId) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const activities = await UserActivity.find({
    userId,
    createdAt: { $gte: since }
  }).sort({ createdAt: -1 }).limit(200).lean();

  if (activities.length < MIN_ACTIVITIES) {
    return { ready: false, count: activities.length, minRequired: MIN_ACTIVITIES };
  }

  // Aggregate by type and category
  const byType = {};
  const byCategory = {};
  let totalSpend = 0;
  const topQueries = {};
  const brands = {};

  for (const a of activities) {
    byType[a.type] = (byType[a.type] || 0) + 1;
    if (a.category) byCategory[a.category] = (byCategory[a.category] || 0) + 1;
    if (a.brand) brands[a.brand] = (brands[a.brand] || 0) + 1;
    if (a.query) topQueries[a.query] = (topQueries[a.query] || 0) + 1;
    if (typeof a.price === 'number' && a.price > 0) totalSpend += a.price;
  }

  return {
    ready: true,
    windowDays: 30,
    count: activities.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    byType,
    byCategory,
    topQueries: Object.entries(topQueries).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([q, n]) => ({ query: q, n })),
    topBrands: Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b, n]) => ({ brand: b, n })),
    recent: activities.slice(0, 30).map(a => ({
      type: a.type, query: a.query, category: a.category, brand: a.brand,
      price: a.price, productName: a.productName, at: a.createdAt
    }))
  };
}

const SYSTEM_PROMPT = `You are PrePay, a frugality coach embedded in PriceKlick.
Given a user's recent activity (searches, clicks, purchases, service lookups),
produce concise, actionable insights in JSON only with this shape:
{
  "summary": "1 sentence of what they're shopping for",
  "patterns": ["..."],
  "predictedNextWeekSpend": <number CAD or null>,
  "suggestions": [
    { "title": "...", "rationale": "...", "potentialSavings": <number or null> }
  ],
  "cheaperAlternatives": [
    { "from": "...", "to": "...", "estSavings": "..." }
  ]
}
Be specific. No fluff. CAD currency. Output JSON only.`;

export async function generateInsights(userId) {
  const digest = await buildActivityDigest(userId);
  if (!digest.ready) return { ok: false, ...digest };
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return { ok: false, error: 'openai_key_missing', digest };

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(digest) }
        ]
      })
    });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, error: `openai_${r.status}`, detail: t.slice(0, 200), digest };
    }
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content || '{}';
    let insights;
    try { insights = JSON.parse(raw); } catch { insights = { summary: raw }; }
    return { ok: true, digest, insights, generatedAt: new Date() };
  } catch (e) {
    return { ok: false, error: e.message, digest };
  }
}
