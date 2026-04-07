const API_BASE = "https://priceklick.com";

// ======== Dynamic Promo Code Rotation State ========
let promoRotationInterval = null;
let currentPromoCodes = [];
let currentPromoIndex = 0;
let verifiedPromoCode = null; // Set when an actual coupon is confirmed
let currentVendorCheckoutUrl = '';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  return tab;
}

function setStatus(msg) {
  document.getElementById("status").innerText = msg || "";
}

function setSearchStatus(msg) {
  document.getElementById("searchStatus").innerText = msg || "";
}

function setScreenshotStatus(msg, isLoading = false) {
  const el = document.getElementById("screenshotStatus");
  if (isLoading) {
    el.innerHTML = `<span class="loading-spinner"></span> ${msg}`;
  } else {
    el.innerText = msg || "";
  }
}

function displaySearchResults(results) {
  const container = document.getElementById("searchResults");
  container.innerHTML = "";
  
  if (!results || results.length === 0) {
    container.innerHTML = '<div class="muted small">No results found</div>';
    return;
  }
  
  results.forEach(result => {
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <div class="name">${result.name}</div>
      <div class="location">📍 ${result.location}</div>
      <div class="price">💰 $${result.price}${result.rating ? ` • ⭐ ${result.rating}` : ''}</div>
      ${result.phone ? `<div class="muted">📞 ${result.phone}</div>` : ''}
      ${result.description ? `<div class="muted small">${result.description}</div>` : ''}
    `;
    container.appendChild(item);
  });
}

async function ensureConsent(email) {
  if (!email) return null;
  const r = await fetch(`${API_BASE}/api/privacy/consent`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({email})
  });
  const j = await r.json().catch(()=> ({}));
  if (j?.userId) {
    await chrome.storage.sync.set({ cf_email: email, cf_userId: j.userId });
  }
  return j?.userId || null;
}

// --- Proxy fetch via service worker ---
async function proxyFetchViaBackground(url, opts = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "proxyFetch",
        url,
        method: opts.method || "GET",
        headers: opts.headers || {},
        body: opts.body ?? null
      },
      (res) => {
        if (chrome.runtime.lastError) {
          console.log("Background fetch error:", chrome.runtime.lastError.message);
          return resolve({ ok: false, status: 0, data: null, error: chrome.runtime.lastError.message });
        }
        if (!res) {
          console.log("No response from background");
          return resolve({ ok: false, status: 0, data: null, error: "no_response" });
        }
        let data = null;
        try {
          data = res.text ? JSON.parse(res.text) : null;
        } catch (e) {
          console.log("JSON parse failed", e, res.text?.slice(0, 120));
        }
        resolve({ ok: res.ok, status: res.status, data, error: res.error });
      }
    );
  });
}

// --- Search functionality ---
document.getElementById("searchBtn").addEventListener("click", async () => {
  try {
    const service = document.getElementById("service").value.trim();
    const location = document.getElementById("location").value.trim();
    const maxPrice = document.getElementById("maxPrice").value.trim();
    
    if (!service) {
      setSearchStatus("Please enter a service to search");
      return;
    }
    
    setSearchStatus("Searching...");
    displaySearchResults([]);
    
    // Build query params
    const params = new URLSearchParams({ service });
    if (location) params.set('location', location);
    if (maxPrice) params.set('maxPrice', maxPrice);
    
    const url = `${API_BASE}/api/search?${params.toString()}`;
    console.log("Searching:", url);
    
    const res = await proxyFetchViaBackground(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    
    console.log("Search result:", res);
    
    if (res.ok && res.data?.results) {
      const count = res.data.count || 0;
      setSearchStatus(`Found ${count} result${count !== 1 ? 's' : ''}`);
      displaySearchResults(res.data.results);
    } else {
      setSearchStatus("No results found");
      displaySearchResults([]);
    }
  } catch (e) {
    console.error("Search error:", e);
    setSearchStatus("Search failed: " + e.message);
  }
});

document.getElementById("saveEmail").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  if (!email) return setStatus("Enter an email first.");
  setStatus("Saving…");
  const userId = await ensureConsent(email);
  setStatus(userId ? "Saved ✔" : "Could not save email");
});

document.getElementById("optionsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("compareBtn").addEventListener("click", async () => {
  try {
    setStatus("Comparing…");
    const tab = await getActiveTab();
    
    // Try content script first
    chrome.tabs.sendMessage(tab.id, { type: "CF_COMPARE" }, (response) => {
      if (chrome.runtime.lastError) {
        // Fallback: if content script not loaded, call API directly via background
        console.log("Content script not available, using background fetch");
        (async () => {
          try {
            const title = tab.title || "best price";
            const url = `${API_BASE}/api/compare?q=${encodeURIComponent(title.slice(0, 120))}`;
            const res = await proxyFetchViaBackground(url, { 
              method: "GET", 
              headers: { Accept: "application/json" } 
            });
            if (res.ok && res.data?.best) {
              setStatus(`Best: ${res.data.best.source} $${res.data.best.price}`);
            } else {
              setStatus("No results found");
            }
          } catch (e) {
            setStatus("Error: " + e.message);
          }
        })();
      } else if (response?.ok) {
        setStatus(response.message || "Comparison complete");
      } else {
        setStatus(response?.error || "Failed to compare");
      }
    });
  } catch (e) {
    setStatus("Error: " + e.message);
  }
});

document.getElementById("applyBtn").addEventListener("click", async () => {
  try {
    setStatus("Applying coupon…");
    const tab = await getActiveTab();
    
    // Try content script first
    chrome.tabs.sendMessage(tab.id, { type: "CF_APPLY_COUPON" }, (response) => {
      if (chrome.runtime.lastError) {
        // Fallback: if content script not loaded, call API directly via background
        console.log("Content script not available, using background fetch");
        (async () => {
          try {
            const url = `${API_BASE}/api/coupons/apply`;
            const res = await proxyFetchViaBackground(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: { cartUrl: tab.url }
            });
            if (res.ok && res.data?.code) {
              setStatus(`Applied: ${res.data.code}`);
            } else {
              setStatus("No coupon found");
            }
          } catch (e) {
            setStatus("Error: " + e.message);
          }
        })();
      } else if (response?.ok) {
        setStatus(response.message || "Coupon applied");
      } else {
        setStatus(response?.error || "No coupon found");
      }
    });
  } catch (e) {
    setStatus("Error: " + e.message);
  }
});

document.getElementById("wishlistBtn").addEventListener("click", async () => {
  try {
    const email = document.getElementById("email").value.trim();
    const { cf_userId } = await chrome.storage.sync.get(["cf_userId"]);
    if (!cf_userId) {
      const uid = await ensureConsent(email);
      if (!uid) return setStatus("Add your email first.");
    }
    setStatus("Adding to wishlist…");
    const tab = await getActiveTab();
    
    // Try content script first
    chrome.tabs.sendMessage(tab.id, { type: "CF_WISHLIST" }, (response) => {
      if (chrome.runtime.lastError) {
        // Fallback: if content script not loaded, show message
        setStatus("Content script not loaded on this page");
      } else if (response?.ok) {
        setStatus(response.message || "Added to wishlist");
      } else {
        setStatus(response?.error || "Failed to add");
      }
    });
  } catch (e) {
    setStatus("Error: " + e.message);
  }
});

// --- AI Screenshot Coupon Extraction ---
const uploadZone = document.getElementById("uploadZone");
const screenshotInput = document.getElementById("screenshotInput");
const screenshotPreview = document.getElementById("screenshotPreview");
const extractedCouponsContainer = document.getElementById("extractedCoupons");

// Click to upload
uploadZone.addEventListener("click", () => {
  screenshotInput.click();
});

// Drag and drop handlers
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("dragover");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith("image/")) {
    handleScreenshotUpload(files[0]);
  }
});

// File input change
screenshotInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleScreenshotUpload(e.target.files[0]);
  }
});

// Handle screenshot upload
async function handleScreenshotUpload(file) {
  try {
    // Validate file
    if (!file.type.startsWith("image/")) {
      setScreenshotStatus("Please upload an image file");
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setScreenshotStatus("Image must be smaller than 10MB");
      return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result;
      
      // Show preview image
      screenshotPreview.src = imageData;
      screenshotPreview.style.display = "block";
      
      setScreenshotStatus("Analyzing screenshot with AI...", true);
      extractedCouponsContainer.innerHTML = "";
      
      // Send to backend for AI processing
      try {
        const res = await proxyFetchViaBackground(`${API_BASE}/api/coupons/screenshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: { image: imageData }
        });
        
        console.log("Screenshot extraction result:", res);
        
        if (res.ok && res.data?.coupons && res.data.coupons.length > 0) {
          setScreenshotStatus(`✅ Found ${res.data.coupons.length} coupon(s) using ${res.data.provider}`);
          displayExtractedCoupons(res.data.coupons, res.data.storeDetected);
        } else if (res.data?.warning) {
          setScreenshotStatus(`⚠️ ${res.data.warning}`);
          extractedCouponsContainer.innerHTML = `
            <div class="muted small" style="text-align:center; padding:10px;">
              No coupons found. Try a clearer image with visible coupon codes.
            </div>
          `;
        } else if (res.data?.error) {
          setScreenshotStatus(`❌ ${res.data.message || res.data.error}`);
        } else {
          setScreenshotStatus("No coupons found in this image");
          extractedCouponsContainer.innerHTML = `
            <div class="muted small" style="text-align:center; padding:10px;">
              No coupon codes detected. Try uploading a screenshot that clearly shows coupon/promo codes.
            </div>
          `;
        }
      } catch (err) {
        console.error("Screenshot API error:", err);
        setScreenshotStatus("Failed to process image: " + err.message);
      }
    };
    
    reader.readAsDataURL(file);
  } catch (e) {
    console.error("Screenshot upload error:", e);
    setScreenshotStatus("Error: " + e.message);
  }
}

// Display extracted coupons
function displayExtractedCoupons(coupons, storeDetected) {
  extractedCouponsContainer.innerHTML = "";
  
  if (storeDetected) {
    const storeEl = document.createElement("div");
    storeEl.className = "muted small";
    storeEl.style.marginBottom = "8px";
    storeEl.innerHTML = `🏪 Store detected: <strong>${storeDetected}</strong>`;
    extractedCouponsContainer.appendChild(storeEl);
  }
  
  coupons.forEach((coupon, index) => {
    const card = document.createElement("div");
    card.className = "coupon-card";
    
    const confidenceEmoji = coupon.confidence === 'high' ? '🟢' : coupon.confidence === 'medium' ? '🟡' : '🟠';
    
    card.innerHTML = `
      <div class="coupon-code">${coupon.code}</div>
      <div class="coupon-desc">${coupon.description || 'Discount code'}</div>
      ${coupon.expiry ? `<div class="coupon-confidence">📅 Expires: ${coupon.expiry}</div>` : ''}
      <div class="coupon-confidence">${confidenceEmoji} Confidence: ${coupon.confidence || 'unknown'}</div>
      <div class="coupon-actions">
        <button class="btn" data-code="${coupon.code}" onclick="copyExtractedCode(this)">📋 Copy</button>
        <button class="btn primary" data-code="${coupon.code}" onclick="applyExtractedCode(this)">✨ Apply</button>
      </div>
    `;
    
    extractedCouponsContainer.appendChild(card);
  });
}

// Copy extracted coupon code
window.copyExtractedCode = function(btn) {
  const code = btn.getAttribute("data-code");
  navigator.clipboard.writeText(code).then(() => {
    const originalText = btn.innerHTML;
    btn.innerHTML = "✓ Copied!";
    setTimeout(() => { btn.innerHTML = originalText; }, 1500);
  });
};

// Apply extracted coupon code to current page
window.applyExtractedCode = async function(btn) {
  const code = btn.getAttribute("data-code");
  
  try {
    const tab = await getActiveTab();
    
    // Send message to content script to apply the coupon
    chrome.tabs.sendMessage(tab.id, { 
      type: "CF_APPLY_EXTRACTED_COUPON", 
      code: code 
    }, (response) => {
      if (chrome.runtime.lastError) {
        setScreenshotStatus("Could not apply - no checkout page detected");
      } else if (response?.ok) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "✓ Applied!";
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        setScreenshotStatus(`✅ Applied coupon: ${code}`);
      } else {
        setScreenshotStatus(response?.error || "Could not apply coupon");
      }
    });
  } catch (e) {
    setScreenshotStatus("Error applying coupon: " + e.message);
  }
};

(async function init(){
  const { cf_email } = await chrome.storage.sync.get(["cf_email"]);
  if (cf_email) document.getElementById("email").value = cf_email;
  
  // Test if backend is reachable
  try {
    const res = await proxyFetchViaBackground(`${API_BASE}/api/health`);
    if (res.ok) {
      console.log("✓ Backend is reachable");
    } else {
      console.log("✗ Backend returned error:", res.error);
    }
  } catch (e) {
    console.log("✗ Backend unreachable:", e.message);
  }

  // Start dynamic promo code rotation
  startPromoRotation();

  // Load trending & recommendations
  loadTrendingAndRecommendations();

  // Track current page visit
  trackCurrentPage();
})();

// ========================================================
// DYNAMIC PROMO CODE ROTATION
// Continuously rotates codes in the promo area until a verified code is found
// ========================================================

const placeholderCodes = [
  'CHECKING...', 'SAVE??%', 'DEAL????', 'PROMO???', 
  'SEARCHING', 'DISCOUNT?', 'CODE????', 'OFFER???'
];

async function startPromoRotation() {
  const promoDisplay = document.getElementById('promoCodeDisplay');
  const promoStatus = document.getElementById('promoStatus');
  const promoArea = document.getElementById('promoArea');
  const promoActions = document.getElementById('promoActions');

  // Phase 1: Show rotating placeholder codes while searching
  let placeholderIdx = 0;
  promoRotationInterval = setInterval(() => {
    if (verifiedPromoCode) return; // Stop if verified code found
    promoDisplay.textContent = placeholderCodes[placeholderIdx % placeholderCodes.length];
    promoDisplay.style.animation = 'none';
    promoDisplay.offsetHeight; // Reflow
    promoDisplay.style.animation = 'codeFlash 0.5s ease-out';
    placeholderIdx++;
  }, 1500);

  // Phase 2: Try to fetch real coupons for the current page
  try {
    const tab = await getActiveTab();
    if (!tab?.url) return;
    
    const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
    const store = hostname.split('.')[0];
    const isRealSite = hostname.includes('.') && !['newtab', 'extensions', 'chrome', 'localhost'].includes(hostname);

    promoStatus.textContent = `🔍 Scanning ${store} for codes...`;

    // Fetch coupons from backend
    const res = await proxyFetchViaBackground(
      `${API_BASE}/api/coupons/couponfollow?store=${encodeURIComponent(hostname)}`,
      { method: "GET", headers: { Accept: "application/json" } }
    );

    if (res.ok && res.data?.coupons?.length > 0) {
      currentPromoCodes = res.data.coupons;
      
      // Stop placeholder rotation, start real code rotation
      clearInterval(promoRotationInterval);
      
      // Check if any code is verified
      const verified = currentPromoCodes.find(c => c.isVerified);
      
      if (verified) {
        // VERIFIED CODE FOUND - stop rotating
        verifiedPromoCode = verified;
        promoDisplay.textContent = verified.code;
        promoArea.classList.add('promo-verified');
        promoStatus.textContent = `✅ Verified: ${verified.description || verified.code}`;
        promoActions.style.display = 'flex';
        currentVendorCheckoutUrl = isRealSite ? `https://${hostname}/checkout` : '';
      } else {
        // Rotate through real codes
        currentPromoIndex = 0;
        promoRotationInterval = setInterval(() => {
          if (verifiedPromoCode) {
            clearInterval(promoRotationInterval);
            return;
          }
          const code = currentPromoCodes[currentPromoIndex % currentPromoCodes.length];
          promoDisplay.textContent = code.code;
          promoDisplay.style.animation = 'none';
          promoDisplay.offsetHeight;
          promoDisplay.style.animation = 'codeFlash 0.5s ease-out';
          promoStatus.textContent = `🔄 ${code.description || 'Discount code'} (${currentPromoIndex + 1}/${currentPromoCodes.length})`;
          currentPromoIndex++;
        }, 2000);
        
        promoActions.style.display = 'flex';
        currentVendorCheckoutUrl = isRealSite ? `https://${hostname}/checkout` : '';
      }
    } else {
      // No real codes - try generic discovery
      const discoverRes = await proxyFetchViaBackground(
        `${API_BASE}/api/coupons/discover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: { store, productName: tab.title }
        }
      );

      if (discoverRes.ok && discoverRes.data?.coupons?.length > 0) {
        currentPromoCodes = discoverRes.data.coupons;
        clearInterval(promoRotationInterval);
        
        currentPromoIndex = 0;
        promoRotationInterval = setInterval(() => {
          if (verifiedPromoCode) {
            clearInterval(promoRotationInterval);
            return;
          }
          const code = currentPromoCodes[currentPromoIndex % currentPromoCodes.length];
          promoDisplay.textContent = code.code;
          promoDisplay.style.animation = 'none';
          promoDisplay.offsetHeight;
          promoDisplay.style.animation = 'codeFlash 0.5s ease-out';
          promoStatus.textContent = `🔄 ${code.description || 'Possible code'} (${currentPromoIndex + 1}/${currentPromoCodes.length})`;
          currentPromoIndex++;
        }, 2000);
        
        promoActions.style.display = 'flex';
        currentVendorCheckoutUrl = isRealSite ? `https://${hostname}/checkout` : '';
      } else {
        promoStatus.textContent = '⏳ No codes found yet. Keep browsing!';
      }
    }
  } catch (e) {
    console.log("Promo rotation error:", e);
    const promoStatus = document.getElementById('promoStatus');
    promoStatus.textContent = '⏳ Searching for codes...';
  }
}

// Copy promo code button
document.getElementById('copyPromoBtn').addEventListener('click', () => {
  const code = document.getElementById('promoCodeDisplay').textContent;
  if (code && !code.includes('...') && !code.includes('?')) {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('copyPromoBtn');
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy Code'; }, 1500);
    });
  }
});

// Go to checkout button — prioritize Promo Lens validated URLs over generic hostname guesses
document.getElementById('goCheckoutBtn').addEventListener('click', async () => {
  const target = promoLensCheckoutUrl || promoLensProductUrl || currentVendorCheckoutUrl;
  if (target) {
    if (verifiedPromoCode?.code) {
      try { await navigator.clipboard.writeText(verifiedPromoCode.code); } catch (e) {}
    }
    setAutoAddToCartFlag(target);
    const tab = await getActiveTab();
    chrome.tabs.update(tab.id, { url: target });
  }
});

// ========================================================
// TRENDING & RECOMMENDATIONS
// ========================================================

async function loadTrendingAndRecommendations() {
  const trendingSection = document.getElementById('trendingSection');
  const recsSection = document.getElementById('recommendationsSection');

  try {
    // Get recommendations via background
    chrome.runtime.sendMessage({ type: "getRecommendations" }, (res) => {
      if (chrome.runtime.lastError || !res?.ok) {
        trendingSection.innerHTML = '<span class="muted small">Connect to see trends</span>';
        return;
      }

      // Render trending tags
      if (res.trending && res.trending.length > 0) {
        trendingSection.innerHTML = res.trending.map(t => `
          <span class="trending-tag hot" data-brand="${t.brand}" title="${t.totalSearches} searches by ${t.uniqueUsers} users">
            🔥 ${t.brand} <span style="opacity:0.7;font-size:10px;">(${t.uniqueUsers})</span>
          </span>
        `).join('');

        // Click trending tag to search
        trendingSection.querySelectorAll('.trending-tag').forEach(tag => {
          tag.addEventListener('click', () => {
            document.getElementById('service').value = tag.dataset.brand + ' coupons';
            document.getElementById('searchBtn').click();
          });
        });
      } else {
        trendingSection.innerHTML = '<span class="muted small">No trends yet. Start browsing!</span>';
      }

      // Render recommendations
      if (res.recommendations && res.recommendations.length > 0) {
        recsSection.innerHTML = res.recommendations.slice(0, 3).map(r => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0ecff;">
            <span style="font-size:16px;">${r.type === 'hot_trending' ? '🔥' : r.type === 'trending_brand' ? '⭐' : '💡'}</span>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:12px;color:#3a2d7d;">${r.brand}</div>
              <div style="font-size:10px;color:#6a6880;">${r.reason}</div>
            </div>
          </div>
        `).join('');
      }
    });
  } catch (e) {
    console.log("Trends load error:", e);
    trendingSection.innerHTML = '<span class="muted small">Trends unavailable</span>';
  }
}

// ========================================================
// SCREEN MONITOR - Track user page visits for recommendations
// ========================================================

async function trackCurrentPage() {
  try {
    const tab = await getActiveTab();
    if (!tab?.url || tab.url.startsWith('chrome://')) return;

    const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
    const brand = hostname.split('.')[0];

    // Track via background service worker
    chrome.runtime.sendMessage({
      type: "trackSearch",
      query: tab.title || brand,
      brand: brand,
      product: tab.title,
      url: tab.url
    }, (res) => {
      if (res?.alertTriggered) {
        console.log(`🔥 Brand alert triggered for ${brand}!`);
      }
    });
  } catch (e) {
    console.log("Page tracking error:", e);
  }
}

// ========================================================
// GOOGLE LENS-LIKE PROMO FINDER
// Upload promo screenshot → detect brand/URL → redirect to official page
// ========================================================

let promoLensRedirectUrl = null;
let promoLensCheckoutUrl = null;
let promoLensProductUrl = null;
let promoLensData = null; // Full response data for auto-add-to-cart

// Set auto-add-to-cart flag in storage before redirecting to product page
function setAutoAddToCartFlag(targetUrl) {
  if (!promoLensData || !targetUrl) return;
  const isProductPage = promoLensData.productSource &&
    (promoLensData.productSource.includes('exact') || promoLensData.productSource.includes('direct'));
  // Only auto-add when going to a direct product page, not search results
  if (!isProductPage) return;
  chrome.storage.local.set({
    priceklick_auto_add_to_cart: {
      active: true,
      url: targetUrl,
      domain: promoLensData.domain || '',
      product: promoLensData.products?.[0] || '',
      brand: promoLensData.brand || '',
      coupon: promoLensData.coupons?.[0]?.code || '',
      timestamp: Date.now()
    }
  });
}

const promoLensZone = document.getElementById('promoLensZone');
const promoLensInput = document.getElementById('promoLensInput');
const promoLensPreview = document.getElementById('promoLensPreview');

function setPromoLensStatus(msg, isLoading = false) {
  const el = document.getElementById('promoLensStatus');
  el.innerHTML = isLoading ? `<span class="loading"></span> ${msg}` : msg;
}

promoLensZone.addEventListener('click', () => promoLensInput.click());

promoLensZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  promoLensZone.style.borderColor = '#34A853';
});
promoLensZone.addEventListener('dragleave', () => {
  promoLensZone.style.borderColor = '#4285F4';
});
promoLensZone.addEventListener('drop', (e) => {
  e.preventDefault();
  promoLensZone.style.borderColor = '#4285F4';
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    handlePromoLensUpload(files[0]);
  }
});

promoLensInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handlePromoLensUpload(e.target.files[0]);
});

async function handlePromoLensUpload(file) {
  if (!file.type.startsWith('image/')) {
    setPromoLensStatus('Please upload an image file');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setPromoLensStatus('Image must be smaller than 10MB');
    return;
  }

  // Compress image via canvas to reduce payload size for messaging
  function compressImage(dataUrl, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl); // fallback to original
      img.src = dataUrl;
    });
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const rawImageData = e.target.result;

    // Compress before sending (keeps it under ~1-2MB for reliable messaging)
    const imageData = await compressImage(rawImageData);

    // Show preview
    promoLensPreview.src = imageData;
    promoLensPreview.style.display = 'block';

    setPromoLensStatus('🔎 Analyzing image with AI Lens...', true);
    document.getElementById('promoLensResult').style.display = 'none';

    try {
      // Use background service worker proxy (handles CORS & large payloads)
      const res = await proxyFetchViaBackground(`${API_BASE}/api/promo/find-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });

      const d = res.data;

      if (res.ok && d?.redirectUrl) {
        promoLensRedirectUrl = d.redirectUrl;
        promoLensCheckoutUrl = d.checkoutUrl || null;
        promoLensProductUrl = d.productUrl || null;
        promoLensData = d; // Store full response for auto-add-to-cart

        // Show result card
        const resultEl = document.getElementById('promoLensResult');
        resultEl.style.display = 'block';

        document.getElementById('promoLensBrand').textContent = 
          `🏪 ${d.brand || 'Unknown Brand'}` + 
          (d.domain ? ` (${d.domain})` : '');

        document.getElementById('promoLensTitle').textContent = 
          d.promotionTitle || (d.isProductPhoto ? 'Product identified' : 'Promotion detected');

        const discountEl = document.getElementById('promoLensDiscount');
        if (d.discountAmount) {
          discountEl.textContent = `💰 ${d.discountAmount} off`;
          discountEl.style.display = 'block';
        } else {
          discountEl.style.display = 'none';
        }

        // Show product name if detected
        const productEl = document.getElementById('promoLensProduct');
        if (d.products && d.products.length > 0) {
          productEl.textContent = `📦 ${d.products[0]}`;
          productEl.style.display = 'block';
        } else {
          productEl.style.display = 'none';
        }

        // Show price if detected
        const priceEl = document.getElementById('promoLensPrice');
        if (d.productPrice) {
          priceEl.textContent = `💲 ${typeof d.productPrice === 'object' ? (d.productPrice.sale || d.productPrice.original || JSON.stringify(d.productPrice)) : d.productPrice}`;
          priceEl.style.display = 'block';
        } else {
          priceEl.style.display = 'none';
        }

        // Show any detected coupons
        const couponsEl = document.getElementById('promoLensCoupons');
        if (d.coupons && d.coupons.length > 0) {
          couponsEl.innerHTML = d.coupons.map(c => `
            <div style="background:rgba(255,255,255,0.1);padding:4px 8px;border-radius:4px;margin:2px 0;font-size:11px;">
              <span style="font-family:monospace;font-weight:bold;color:#FBBC05;">${c.code}</span>
              <span style="color:#aaa;margin-left:4px;">${c.description || ''}</span>
            </div>
          `).join('');
        } else {
          couponsEl.innerHTML = '';
        }

        // Update button with URL source info
        const goBtn = document.getElementById('promoLensGoBtn');
        const checkoutBtn = document.getElementById('promoLensCheckoutBtn');
        const hasCoupons = d.coupons && d.coupons.length > 0;

        // Determine if we found an exact product page or just search results
        const isExactProduct = d.productSource && (
          d.productSource.includes('exact') || 
          d.productSource.includes('direct') ||
          d.productSource === 'ai_exact_product' ||
          d.productSource === 'ai_direct_product' ||
          d.productSource === 'serp_exact_product' ||
          d.productSource === 'google_shopping_exact' ||
          d.productSource === 'serp_broad_exact'
        );

        // Product button — find product on store website
        const productBtn = document.getElementById('promoLensProductBtn');
        const productName = d.products && d.products.length > 0 ? d.products[0] : null;
        if (promoLensProductUrl) {
          const shortName = productName && productName.length > 30 ? productName.substring(0, 30) + '...' : productName;
          if (isExactProduct) {
            productBtn.textContent = `🎯 Go to ${shortName || d.brand || 'Product'} Page`;
            productBtn.style.background = '#1a73e8';  // Blue for exact match
          } else {
            productBtn.textContent = `🛍️ Find ${shortName || d.brand || 'Product'} on ${d.domain || 'Store'}`;
            productBtn.style.background = '#e67e22';  // Orange for search
          }
          productBtn.style.display = '';
        } else {
          productBtn.style.display = 'none';
        }

        // Checkout button — goes to store cart/checkout
        const checkoutTarget = promoLensCheckoutUrl || promoLensRedirectUrl;
        if (checkoutTarget) {
          checkoutBtn.textContent = hasCoupons
            ? `🛒 Checkout (Code: ${d.coupons[0].code})`
            : `🛒 Go to ${d.brand || 'Store'} Checkout`;
          checkoutBtn.style.display = '';
        } else {
          checkoutBtn.style.display = 'none';
        }

        // View Deal button
        goBtn.textContent = `🔗 View Deal`;

        // Show product source info
        const sourceLabel = isExactProduct ? '🎯 Exact product page found!' : '🔍 Search results page';
        const detectionType = d.isProductPhoto ? 'Product' : (d.brand || 'Promotion');
        setPromoLensStatus(`✅ Found! ${detectionType} → ${d.domain || 'website'} (${sourceLabel})`);

        // Also update promo area if coupons found
        if (d.coupons && d.coupons.length > 0 && d.coupons[0].code) {
          verifiedPromoCode = d.coupons[0];
          const promoDisplay = document.getElementById('promoCodeDisplay');
          const promoArea = document.getElementById('promoArea');
          const promoStatus = document.getElementById('promoStatus');
          clearInterval(promoRotationInterval);
          promoDisplay.textContent = d.coupons[0].code;
          promoArea.classList.add('promo-verified');
          promoStatus.textContent = `✅ Lens: ${d.coupons[0].description || d.coupons[0].code}`;
          document.getElementById('promoActions').style.display = 'flex';
          currentVendorCheckoutUrl = d.checkoutUrl || d.productUrl || d.redirectUrl;

          // Auto-copy coupon code to clipboard
          try {
            await navigator.clipboard.writeText(d.coupons[0].code);
            document.getElementById('promoLensCopied').style.display = 'block';
          } catch (clipErr) { console.log('Clipboard copy failed', clipErr); }
        }

        // Auto-redirect countdown (3 seconds) — goes to product page to find & buy
        let countdown = isExactProduct ? 3 : 4; // Extra second for search results
        const autoRedirectTarget = promoLensProductUrl || promoLensCheckoutUrl || promoLensRedirectUrl;
        const countdownEl = document.getElementById('promoLensCountdown');
        countdownEl.style.display = 'block';
        const targetLabel = isExactProduct ? '🎯 exact product page' : 
          (promoLensProductUrl ? 'product search' : (promoLensCheckoutUrl ? 'checkout' : 'deal page'));
        countdownEl.textContent = `⏳ Redirecting to ${targetLabel} in ${countdown}s...`;
        const countdownTimer = setInterval(async () => {
          countdown--;
          if (countdown <= 0) {
            clearInterval(countdownTimer);
            countdownEl.textContent = '🚀 Redirecting now...';
            // Copy coupon before redirect
            if (verifiedPromoCode?.code) {
              try { await navigator.clipboard.writeText(verifiedPromoCode.code); } catch(e) {}
            }
            // Set auto-add-to-cart flag for the content script
            setAutoAddToCartFlag(autoRedirectTarget);
            const tab = await getActiveTab();
            chrome.tabs.update(tab.id, { url: autoRedirectTarget });
          } else {
            countdownEl.textContent = `⏳ Redirecting to ${targetLabel} in ${countdown}s...`;
          }
        }, 1000);
        // Allow cancel by clicking the countdown text
        countdownEl.style.cursor = 'pointer';
        countdownEl.title = 'Click to cancel auto-redirect';
        countdownEl.addEventListener('click', () => {
          clearInterval(countdownTimer);
          countdownEl.textContent = '⏸ Auto-redirect cancelled';
          countdownEl.style.cursor = 'default';
        }, { once: true });

      } else {
        // Show the most specific error available
        const errorMsg = d?.error || d?.message || res.error || null;
        if (errorMsg) {
          setPromoLensStatus(`❌ ${errorMsg}`);
        } else if (res.status === 0) {
          setPromoLensStatus('❌ Cannot reach server. Make sure the backend is running on port 5050.');
        } else {
          setPromoLensStatus('❌ Could not detect promotion. The AI service may be unavailable — try again later.');
        }
      }
    } catch (err) {
      console.error('Promo Lens error:', err);
      setPromoLensStatus('Failed to analyze: ' + err.message);
    }
  };
  reader.readAsDataURL(file);
}

// Find product button — takes user to the product on the store's website
document.getElementById('promoLensProductBtn').addEventListener('click', async () => {
  const target = promoLensProductUrl || promoLensRedirectUrl;
  if (target) {
    if (verifiedPromoCode?.code) {
      try { await navigator.clipboard.writeText(verifiedPromoCode.code); } catch (e) {}
    }
    setAutoAddToCartFlag(target);
    const tab = await getActiveTab();
    chrome.tabs.update(tab.id, { url: target });
  }
});

// Checkout button — takes user to cart/checkout page
document.getElementById('promoLensCheckoutBtn').addEventListener('click', async () => {
  const target = promoLensCheckoutUrl || promoLensRedirectUrl;
  if (target) {
    // Copy coupon to clipboard if available
    if (verifiedPromoCode?.code) {
      try { await navigator.clipboard.writeText(verifiedPromoCode.code); } catch (e) {}
    }
    const tab = await getActiveTab();
    chrome.tabs.update(tab.id, { url: target });
  }
});

// View promotion / deal page button
document.getElementById('promoLensGoBtn').addEventListener('click', async () => {
  if (promoLensRedirectUrl) {
    // Copy coupon to clipboard if available
    if (verifiedPromoCode?.code) {
      try { await navigator.clipboard.writeText(verifiedPromoCode.code); } catch (e) {}
    }
    const tab = await getActiveTab();
    chrome.tabs.update(tab.id, { url: promoLensRedirectUrl });
  }
});

// ========================================================
// CAPTURE PAGE PROMOTIONS - Screenshot & redirect to checkout
// ========================================================

document.getElementById('capturePageBtn').addEventListener('click', async () => {
  try {
    setScreenshotStatus("📸 Capturing page promotions...", true);
    
    // Capture screenshot via background
    chrome.runtime.sendMessage({ type: "captureScreenshot" }, async (res) => {
      if (chrome.runtime.lastError || !res?.ok) {
        setScreenshotStatus("Failed to capture page");
        return;
      }

      // Show preview
      const preview = document.getElementById('screenshotPreview');
      preview.src = res.dataUrl;
      preview.style.display = 'block';

      setScreenshotStatus("🤖 Analyzing promotions with AI...", true);

      // Get vendor info
      const tab = await getActiveTab();
      const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
      const brand = hostname.split('.')[0];
      const isRealSite = hostname.includes('.') && !['newtab', 'extensions', 'chrome', 'localhost'].includes(hostname);

      // Send to backend for AI + checkout URL generation
      const apiRes = await proxyFetchViaBackground(`${API_BASE}/api/promo/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: {
          image: res.dataUrl,
          vendorUrl: tab.url,
          brand: brand,
          productName: tab.title
        }
      });

      if (apiRes.ok && apiRes.data) {
        const { coupons, checkoutUrl } = apiRes.data;

        if (coupons && coupons.length > 0) {
          setScreenshotStatus(`✅ Found ${coupons.length} promotion(s)! Redirecting to checkout...`);
          displayExtractedCoupons(coupons, brand);

          // Update promo area with verified code
          if (coupons[0]?.code) {
            verifiedPromoCode = coupons[0];
            const promoDisplay = document.getElementById('promoCodeDisplay');
            const promoArea = document.getElementById('promoArea');
            const promoStatus = document.getElementById('promoStatus');
            clearInterval(promoRotationInterval);
            promoDisplay.textContent = coupons[0].code;
            promoArea.classList.add('promo-verified');
            promoStatus.textContent = `✅ Detected: ${coupons[0].description || coupons[0].code}`;
            document.getElementById('promoActions').style.display = 'flex';
            currentVendorCheckoutUrl = checkoutUrl || (isRealSite ? `https://${hostname}/checkout` : '');
          }
        } else {
          setScreenshotStatus("No promotions detected. Try a page with visible deals.");
        }

        // Store checkout URL for redirect
        if (checkoutUrl) {
          currentVendorCheckoutUrl = checkoutUrl;
        }
      } else {
        setScreenshotStatus("Could not analyze page promotions");
      }
    });
  } catch (e) {
    console.error("Capture error:", e);
    setScreenshotStatus("Capture failed: " + e.message);
  }
});
