// extension/background.js
// Proxy fetch to backend from the service worker.
// View logs: chrome://extensions → your extension → "service worker"
const API_BASE = "https://priceklick.com";
const log = (...a) => console.log("[CF BG]", ...a);

chrome.runtime.onInstalled.addListener(() => {
  console.log("PriceKlick extension installed successfully!");
  // Initialize search session ID
  chrome.storage.session?.set?.({ cf_sessionId: crypto.randomUUID?.() || Date.now().toString() });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;

  // --- Proxy fetch handler ---
  if (msg.type === "proxyFetch") {
    const { url, method = "GET", headers = {}, body } = msg;
    log("proxyFetch →", method, url);

    let fetchBody = undefined;
    const hdrs = { ...headers };
    if (body != null) {
      fetchBody = typeof body === "string" ? body : JSON.stringify(body);
      if (!hdrs["Content-Type"]) hdrs["Content-Type"] = "application/json";
    }

    fetch(url, { method, headers: hdrs, body: fetchBody })
      .then(async (r) => {
        const text = await r.text().catch(() => "");
        log("proxyFetch resp", r.status, text.slice(0, 200));
        sendResponse({ ok: r.ok, status: r.status, text });
      })
      .catch((err) => {
        log("proxyFetch FAILED", String(err));
        sendResponse({ ok: false, status: 0, text: "", error: String(err) });
      });

    return true;
  }

  // --- Screenshot capture handler ---
  if (msg.type === "captureScreenshot") {
    chrome.tabs.captureVisibleTab(null, { format: "png", quality: 90 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        log("Screenshot capture failed:", chrome.runtime.lastError.message);
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        log("Screenshot captured successfully");
        sendResponse({ ok: true, dataUrl });
      }
    });
    return true;
  }

  // --- Track search event ---
  if (msg.type === "trackSearch") {
    const { query, brand, product, url } = msg;
    chrome.storage.sync.get(["cf_userId"], async (data) => {
      try {
        const body = {
          userId: data.cf_userId || null,
          sessionId: msg.sessionId || Date.now().toString(),
          query, brand, product, url
        };
        const res = await fetch(`${API_BASE}/api/search/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const json = await res.json().catch(() => ({}));
        log("Search tracked:", json);
        sendResponse({ ok: true, ...json });
      } catch (e) {
        log("Track search failed:", e.message);
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true;
  }

  // --- Get recommendations ---
  if (msg.type === "getRecommendations") {
    chrome.storage.sync.get(["cf_userId"], async (data) => {
      try {
        const userId = data.cf_userId || '';
        const res = await fetch(`${API_BASE}/api/recommendations?userId=${encodeURIComponent(userId)}&limit=10`);
        const json = await res.json().catch(() => ({}));
        sendResponse({ ok: true, ...json });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true;
  }
});
