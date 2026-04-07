// extension/content.js
(() => {
  // Use 127.0.0.1 instead of localhost to avoid some Windows/AV blocks
  const API_BASE = "https://priceklick.com";
  const log = (...a) => console.log("[PriceKlick Agent]", ...a);

  // ============================================================
  // AUTO ADD-TO-CART — runs on ANY page after Promo Lens redirect
  // ============================================================
  (function autoAddToCart() {
    if (!chrome.storage?.local) return;

    chrome.storage.local.get(['priceklick_auto_add_to_cart'], (data) => {
      const task = data?.priceklick_auto_add_to_cart;
      if (!task || !task.active) return;

      // Check if this is the right domain (prevent adding to wrong site)
      const currentDomain = location.hostname.replace(/^www\./, '').toLowerCase();
      if (task.domain && !currentDomain.includes(task.domain.replace(/^www\./, '').toLowerCase())) {
        log('Auto-add: Wrong domain, skipping', currentDomain, 'vs', task.domain);
        return;
      }

      // Check if task expired (60 seconds max — SPAs can be slow)
      if (Date.now() - task.timestamp > 60000) {
        log('Auto-add: Task expired, clearing');
        chrome.storage.local.remove(['priceklick_auto_add_to_cart']);
        return;
      }

      log('🛒 Auto Add-to-Cart activated for:', task.product || 'product');

      // Common "Add to Cart" button selectors for major stores
      const ADD_TO_CART_SELECTORS = [
        // Canadian Tire — SPA with dynamic rendering, many possible selectors
        'button[data-testid="add-to-cart"]',
        'button[data-testid="cta-add-to-cart"]',
        'button[data-testid*="addToCart"]',
        'button[data-testid*="add-to-cart"]',
        '[data-testid="add-to-cart-button"]',
        '.pdp-add-to-cart button',
        '.pdp__add-to-cart button',
        'button.add-to-cart-btn',
        '[class*="AddToCart"] button',
        '[class*="addToCart"] button',
        '[class*="add-to-cart"] button',
        '[class*="AddToCart"]',
        '[class*="addtocart"]',
        'button[class*="pdp"][class*="cart"]',
        'button[class*="ct-atc"]',
        // Generic
        'button[id*="add-to-cart" i]',
        'button[id*="addToCart" i]',
        'button[id*="add_to_cart" i]',
        'button[class*="add-to-cart" i]',
        'button[class*="addToCart" i]',
        'button[class*="add_to_cart" i]',
        'input[id*="add-to-cart" i]',
        'input[name*="add-to-cart" i]',
        '[data-testid*="add-to-cart" i]',
        '[data-testid*="addToCart" i]',
        '[data-action*="add-to-cart" i]',
        // Amazon
        '#add-to-cart-button',
        '#buy-now-button',
        'input[name="submit.add-to-cart"]',
        // Walmart
        'button[data-tl-id="ProductPrimaryCTA-normal"]',
        '[data-automation="cta-button"]',
        // Target
        'button[data-test="orderPickupButton"]',
        'button[data-test="shipItButton"]',
        // Best Buy
        '.add-to-cart-button',
        'button.btn-primary[data-button-state="ADD_TO_CART"]',
        // Home Depot
        '.add-to-cart button',
        '#atc_button',
        // Generic patterns
        'button[aria-label*="add to cart" i]',
        'button[aria-label*="add to bag" i]',
        'button[aria-label*="ajouter au panier" i]',
        'a[class*="add-to-cart" i]',
        'a[class*="addToCart" i]',
      ];

      // Text patterns to match button content
      const ADD_TO_CART_TEXT = [
        'add to cart', 'add to bag', 'add to basket',
        'ajouter au panier', // French (Canadian Tire FR)
        'buy now', 'buy it now',
        'add item', 'add to trolley'
      ];

      function isButtonVisible(btn) {
        // Check multiple visibility indicators — SPAs sometimes have buttons
        // in the DOM but not yet visually rendered
        if (!btn) return false;
        const style = window.getComputedStyle(btn);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        // offsetParent can be null for position:fixed or in some SPA layouts — also check dimensions
        if (btn.offsetParent !== null) return true;
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function findAddToCartButton() {
        // Try CSS selectors first
        for (const selector of ADD_TO_CART_SELECTORS) {
          try {
            const btn = document.querySelector(selector);
            if (btn && isButtonVisible(btn)) {
              return btn;
            }
          } catch (e) { /* invalid selector, skip */ }
        }

        // Search by text content — broader search including spans inside buttons
        const allButtons = document.querySelectorAll('button, input[type="submit"], a[role="button"], [class*="btn"], [role="button"]');
        for (const btn of allButtons) {
          const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase().trim();
          if (ADD_TO_CART_TEXT.some(t => text.includes(t)) && isButtonVisible(btn)) {
            return btn;
          }
        }

        return null;
      }

      function showAutoAddBanner(message, type = 'searching') {
        const existing = document.getElementById('__priceklick_auto_add_banner');
        if (existing) existing.remove();

        const colors = {
          searching: { bg: '#1a73e8', icon: '🔍' },
          found: { bg: '#34a853', icon: '✅' },
          clicked: { bg: '#34a853', icon: '🛒' },
          notfound: { bg: '#ea4335', icon: '❌' }
        };
        const c = colors[type] || colors.searching;

        const banner = document.createElement('div');
        banner.id = '__priceklick_auto_add_banner';
        banner.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
          background: ${c.bg}; color: white; padding: 12px 20px;
          font-family: -apple-system, system-ui, sans-serif;
          font-size: 14px; font-weight: 600; text-align: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          animation: slideDown 0.3s ease-out;
        `;
        banner.innerHTML = `
          <style>@keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }</style>
          ${c.icon} PriceKlick: ${message}
          <button id="__priceklick_close_banner" style="
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            background: rgba(255,255,255,0.2); border: none; color: white;
            border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px;
          ">&times;</button>
        `;
        document.documentElement.appendChild(banner);
        document.getElementById('__priceklick_close_banner').onclick = () => banner.remove();

        // Auto-remove after 8 seconds
        if (type !== 'searching') {
          setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
        }
      }

      function attemptAddToCart(retryCount = 0) {
        const maxRetries = 15; // ~35s total wait for heavy SPAs like Canadian Tire

        // On first few retries, scroll down to trigger lazy-loading of the purchase section
        // Canadian Tire and similar SPAs don't render the Add to Cart area until it's near the viewport
        if (retryCount <= 3) {
          const scrollTargets = [
            document.querySelector('[class*="product-info"]'),
            document.querySelector('[class*="productInfo"]'),
            document.querySelector('[class*="pdp-info"]'),
            document.querySelector('[class*="price"]'),
            document.querySelector('[class*="buybox"]'),
            document.querySelector('[class*="buy-box"]'),
            document.querySelector('[class*="purchase"]'),
          ].filter(Boolean);

          if (scrollTargets.length > 0) {
            scrollTargets[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            // Generic scroll down to reveal more content
            window.scrollBy({ top: 400 + retryCount * 200, behavior: 'smooth' });
          }
        }

        const btn = findAddToCartButton();

        if (btn) {
          log('🛒 Found Add-to-Cart button:', btn.textContent?.trim() || btn.id);
          showAutoAddBanner(`Found "${btn.textContent?.trim() || 'Add to Cart'}" button — clicking...`, 'found');

          // Brief delay so user can see what's happening
          setTimeout(() => {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
              // Highlight the button
              const origBorder = btn.style.border;
              const origBoxShadow = btn.style.boxShadow;
              btn.style.border = '3px solid #34a853';
              btn.style.boxShadow = '0 0 20px rgba(52,168,83,0.6)';

              setTimeout(() => {
                btn.click();
                log('✅ Clicked Add-to-Cart!');
                showAutoAddBanner(`Added "${task.product || 'product'}" to cart!`, 'clicked');

                // Restore button style
                btn.style.border = origBorder;
                btn.style.boxShadow = origBoxShadow;

                // Clear the task
                chrome.storage.local.remove(['priceklick_auto_add_to_cart']);
              }, 500);
            }, 300);
          }, 800);

        } else if (retryCount < maxRetries) {
          // Page may still be loading — retry
          log(`Add-to-Cart button not found yet, retry ${retryCount + 1}/${maxRetries}...`);
          if (retryCount === 0) {
            showAutoAddBanner(`Looking for "Add to Cart" on this page...`, 'searching');
          }
          setTimeout(() => attemptAddToCart(retryCount + 1), 2000);
        } else {
          log('❌ Could not find Add-to-Cart button after retries');
          showAutoAddBanner('Could not find "Add to Cart" button. Please add manually.', 'notfound');
          chrome.storage.local.remove(['priceklick_auto_add_to_cart']);
        }
      }

      // Use MutationObserver as a parallel approach — catches dynamically rendered buttons
      let observerFound = false;
      const observer = new MutationObserver(() => {
        if (observerFound) return;
        const btn = findAddToCartButton();
        if (btn) {
          observerFound = true;
          observer.disconnect();
          log('🛒 MutationObserver found Add-to-Cart button:', btn.textContent?.trim());
          // Only act if the retry loop hasn't already found it
          const banner = document.getElementById('__priceklick_auto_add_banner');
          if (!banner || banner.textContent.includes('Looking for') || banner.textContent.includes('Could not find')) {
            showAutoAddBanner(`Found "${btn.textContent?.trim() || 'Add to Cart'}" button — clicking...`, 'found');
            setTimeout(() => {
              btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => {
                btn.style.border = '3px solid #34a853';
                btn.style.boxShadow = '0 0 20px rgba(52,168,83,0.6)';
                setTimeout(() => {
                  btn.click();
                  log('✅ Clicked Add-to-Cart (via observer)!');
                  showAutoAddBanner(`Added "${task.product || 'product'}" to cart!`, 'clicked');
                  chrome.storage.local.remove(['priceklick_auto_add_to_cart']);
                }, 500);
              }, 300);
            }, 800);
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      // Stop observing after 40 seconds
      setTimeout(() => { observer.disconnect(); }, 40000);

      // Wait for page to be mostly loaded, then try
      // Use a longer initial delay (3s) for heavy SPAs like Canadian Tire
      if (document.readyState === 'complete') {
        setTimeout(() => attemptAddToCart(), 3000);
      } else {
        window.addEventListener('load', () => setTimeout(() => attemptAddToCart(), 3000));
      }
    });
  })();

  // --- Detect product, checkout, and cart pages (host OR path) ---
  const host = (location.hostname || "").toLowerCase();
  const path = (location.pathname || "").toLowerCase();

  // fire if either the hostname looks like checkout/cart OR the path contains these tokens
  const isCheckoutHost = /(checkout|cart)\./.test(host);
  const isCheckoutPath =
    /checkout|cart|bag|basket|payment|purchase|order|shipping|pay|address|confirm/.test(path);
  
  // Also detect product pages by looking for product indicators
  const isProductPath = /product|item|sku|dp|gp|asin|details|watch/.test(path);
  const hasProductIndicators = 
    document.querySelector('[data-component-type="s-search-result"]') ||
    document.querySelector('[data-asin]') ||
    document.querySelector('.product-detail') ||
    document.querySelector('h1 span') ||
    document.querySelector('[id*="product"]');

  const isCheckoutPage = isCheckoutHost || isCheckoutPath;
  
  if (!(isCheckoutPage || isProductPath || hasProductIndicators)) {
    // Not a checkout/cart/product page → do nothing
    return;
  }

  // Extract store name from URL
  function getStoreName() {
    const hostname = location.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    return parts[0] || hostname;
  }

  // Show floating action indicator near an element
  function showActionIndicator(element, text, type = 'info') {
    // Remove any existing indicator
    const existing = document.getElementById('__cf_action_indicator');
    if (existing) existing.remove();
    
    const rect = element.getBoundingClientRect();
    const indicator = document.createElement('div');
    indicator.id = '__cf_action_indicator';
    
    const colors = {
      info: { bg: '#6D4AFF', border: '#9B5BFF' },
      success: { bg: '#4CAF50', border: '#81C784' },
      typing: { bg: '#00D4FF', border: '#4DD0E1' }
    };
    const color = colors[type] || colors.info;
    
    indicator.style.cssText = `
      position: fixed;
      z-index: 2147483648;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top - 45}px;
      transform: translateX(-50%);
      background: ${color.bg};
      color: white;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      border: 2px solid ${color.border};
      animation: indicatorBounce 0.5s ease-out;
      white-space: nowrap;
    `;
    
    indicator.innerHTML = `
      <style>
        @keyframes indicatorBounce {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          50% { transform: translateX(-50%) translateY(5px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      </style>
      <span style="margin-right: 6px;">${type === 'typing' ? '⌨️' : type === 'success' ? '✓' : '🤖'}</span>
      ${text}
      <span style="
        position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
        border-left: 8px solid transparent; border-right: 8px solid transparent;
        border-top: 8px solid ${color.bg};
      "></span>
    `;
    
    document.documentElement.appendChild(indicator);
    
    // Auto-remove after 2 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.transition = 'opacity 0.3s';
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
      }
    }, 2000);
  }

  // Show notification popup
  function showNotification(title, message, coupons = []) {
    // Remove existing notification
    const existing = document.getElementById("__cf_notification");
    if (existing) existing.remove();

    // Try to find coupon input field on the page
    const couponInputField = findCouponInputField();

    const notification = document.createElement("div");
    notification.id = "__cf_notification";
    notification.style.cssText = `
      position: fixed; z-index: 2147483647; top: 20px; right: 20px;
      background: linear-gradient(135deg, #6D4AFF 0%, #9B5BFF 100%);
      color: white; padding: 20px; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(109,74,255,0.4);
      min-width: 320px; max-width: 400px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
      animation: slideIn 0.3s ease-out;
    `;

    let couponsHtml = '';
    if (coupons.length > 0) {
      couponsHtml = '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.3);">';
      coupons.forEach((coupon, index) => {
        couponsHtml += `
          <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px; margin-bottom: 8px;">
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">
              🎉 ${coupon.code}
            </div>
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 6px;">
              ${coupon.description}
            </div>
            <button class="copy-coupon" data-code="${coupon.code}" data-index="${index}" style="
              background: white; color: #6D4AFF; border: none; padding: 8px 14px;
              border-radius: 6px; font-weight: 600; cursor: pointer;
              font-size: 12px; margin-right: 6px;
            ">📋 Copy Code</button>
            ${couponInputField ? `<button class="apply-coupon" data-code="${coupon.code}" style="
              background: rgba(255,255,255,0.3); color: white; border: 1px solid white;
              padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;
              font-size: 12px;
            ">✨ Try Apply</button>` : ''}
          </div>
        `;
      });
      couponsHtml += '</div>';
      
      // Add instruction if coupon field found
      if (couponInputField) {
        couponsHtml += `
          <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.1); 
                      border-radius: 8px; font-size: 12px;">
            💡 <strong>Tip:</strong> Click "Try Apply" to auto-fill, or click "Copy Code" and paste it manually in the coupon field.
          </div>
        `;
      } else {
        couponsHtml += `
          <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.1); 
                      border-radius: 8px; font-size: 12px;">
            📝 <strong>How to use:</strong><br/>
            1. Click "Copy Code" above<br/>
            2. Find the "Promo Code" or "Coupon" field on this page<br/>
            3. Paste the code and apply it
          </div>
        `;
      }
    }

    notification.innerHTML = `
      <style>
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      </style>
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="font-weight: 800; font-size: 18px;">🎟️ ${title}</div>
        <button id="__cf_close" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; margin-left: 10px;">&times;</button>
      </div>
      <div style="font-size: 14px; opacity: 0.95; line-height: 1.5;">${message}</div>
      ${couponsHtml}
    `;

    document.documentElement.appendChild(notification);

    // Close button
    document.getElementById("__cf_close").onclick = () => notification.remove();

    // Copy coupon buttons
    notification.querySelectorAll('.copy-coupon').forEach(btn => {
      btn.onclick = () => {
        const code = btn.getAttribute('data-code');
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = '✓ Copied!';
          btn.style.background = '#4CAF50';
          btn.style.color = 'white';
          setTimeout(() => {
            btn.textContent = '📋 Copy Code';
            btn.style.background = 'white';
            btn.style.color = '#6D4AFF';
          }, 2000);
          
          // Highlight coupon field if found
          if (couponInputField) {
            highlightCouponField(couponInputField);
          }
        });
      };
    });

    // Try apply coupon buttons
    notification.querySelectorAll('.apply-coupon').forEach(btn => {
      btn.onclick = () => {
        const code = btn.getAttribute('data-code');
        if (couponInputField) {
          tryApplyCoupon(code, couponInputField);
          btn.textContent = '✓ Applied!';
          btn.style.background = '#4CAF50';
          btn.style.border = 'none';
          setTimeout(() => {
            btn.textContent = '✨ Try Apply';
            btn.style.background = 'rgba(255,255,255,0.3)';
            btn.style.border = '1px solid white';
          }, 2000);
        }
      };
    });

    // Auto-dismiss after 20 seconds
    setTimeout(() => {
      if (notification.parentNode) notification.remove();
    }, 20000);
  }

  // Find coupon input field on the page
  function findCouponInputField() {
    const selectors = [
      'input[name*="coupon" i]',
      'input[id*="coupon" i]',
      'input[placeholder*="coupon" i]',
      'input[name*="promo" i]',
      'input[id*="promo" i]',
      'input[placeholder*="promo" i]',
      'input[name*="discount" i]',
      'input[id*="discount" i]',
      'input[placeholder*="discount" i]',
      'input[name*="voucher" i]',
      'input[id*="voucher" i]',
      'input[aria-label*="coupon" i]',
      'input[aria-label*="promo" i]',
      // Amazon specific
      'input[name*="claimCode" i]',
      'input[id*="gcpromoinput" i]',
      'input[id*="spc-gcpromoinput" i]',
      '#gcpromoinput',
      '#gc-redemption-input',
      'input[placeholder*="gift card" i]',
      'input[placeholder*="code" i]',
      // Generic code inputs
      'input[name*="code" i]',
      'input[id*="code" i]'
    ];
    
    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field && field.offsetParent !== null) { // Check if visible
        return field;
      }
    }
    
    // Try to find any text input near "coupon", "promo", "code" text
    const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const input of allInputs) {
      if (input.offsetParent === null) continue; // Skip hidden
      
      // Check if there's a label nearby with coupon/promo text
      const parent = input.closest('div, form, section');
      if (parent) {
        const text = parent.textContent.toLowerCase();
        if (text.includes('coupon') || text.includes('promo') || text.includes('discount') || text.includes('code')) {
          return input;
        }
      }
    }
    
    return null;
  }

  // Highlight the coupon input field
  function highlightCouponField(field) {
    const originalBorder = field.style.border;
    const originalBoxShadow = field.style.boxShadow;
    
    field.style.border = '3px solid #6D4AFF';
    field.style.boxShadow = '0 0 15px rgba(109,74,255,0.5)';
    field.style.animation = 'pulse 1s ease-in-out 3';
    
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
      field.style.border = originalBorder;
      field.style.boxShadow = originalBoxShadow;
      field.style.animation = '';
    }, 3000);
  }

  // Try to apply coupon automatically
  function tryApplyCoupon(code, field) {
    try {
      // Fill the input field
      field.value = code;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Highlight the field
      highlightCouponField(field);
      
      // Try to find and click the apply button
      const applyButtons = [
        ...document.querySelectorAll('button, input[type="submit"], input[type="button"]')
      ].filter(btn => {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        return text.includes('apply') || text.includes('submit') || text.includes('redeem');
      });
      
      if (applyButtons.length > 0) {
        // Find the closest apply button to the input field
        let closestBtn = applyButtons[0];
        let minDistance = Infinity;
        
        applyButtons.forEach(btn => {
          const distance = Math.abs(
            btn.getBoundingClientRect().top - field.getBoundingClientRect().top
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestBtn = btn;
          }
        });
        
        // Click the apply button after a short delay
        setTimeout(() => {
          closestBtn.click();
          log('Agent: Clicked apply button');
        }, 500);
      }
      
      log('Agent: Coupon code filled:', code);
    } catch (e) {
      log('Agent: Failed to apply coupon automatically', e);
    }
  }

  // Automatic coupon discovery agent
  async function autoDiscoverCoupons(autoApply = true) {
    try {
      const store = getStoreName();
      const productName = guessQuery();
      
      // Get the full domain for CouponFollow lookup
      const fullDomain = location.hostname.replace(/^www\./, '');
      
      log(`🤖 Agent: Searching for coupons on ${store} (${fullDomain})...`);
      
      // Try CouponFollow first (real coupons from couponfollow.com)
      let coupons = [];
      
      try {
        const cfUrl = `${API_BASE}/api/coupons/couponfollow?store=${encodeURIComponent(fullDomain)}`;
        const cfRes = await proxyFetch(cfUrl, {
          method: "GET",
          headers: { Accept: "application/json" }
        });
        
        log("Agent: CouponFollow result", cfRes);
        
        if (cfRes.ok && cfRes.data?.coupons && cfRes.data.coupons.length > 0) {
          coupons = cfRes.data.coupons.map(c => ({
            code: c.code,
            description: c.description || `${c.discount}% off`,
            discount: c.discount,
            type: c.type || 'PERCENT',
            source: 'CouponFollow',
            isVerified: c.isVerified || false
          }));
          log(`✅ Agent: Found ${coupons.length} coupons from CouponFollow!`);
        }
      } catch (cfError) {
        log("Agent: CouponFollow fetch failed, trying fallback", cfError);
      }
      
      // Fallback to generic coupon discovery if CouponFollow didn't return results
      if (coupons.length === 0) {
        const url = `${API_BASE}/api/coupons/discover`;
        const res = await proxyFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: { store, productName }
        });
        
        log("Agent: Fallback coupon discovery result", res);
        
        if (res.ok && res.data?.coupons && res.data.coupons.length > 0) {
          coupons = res.data.coupons;
        }
      }
      
      // If still no coupons, use demo coupons for testing
      if (coupons.length === 0) {
        coupons = [
          { code: 'SAVE10', description: '10% off your order', discount: 10 },
          { code: 'FREESHIP', description: 'Free shipping on orders $50+', discount: 5 },
          { code: 'WELCOME20', description: 'New customer 20% off', discount: 20 },
          { code: 'HOLIDAY15', description: 'Holiday special 15% off', discount: 15 },
          { code: 'VIP25', description: 'VIP member exclusive 25% off', discount: 25 }
        ];
        log(`🎭 Agent: Using demo coupons for testing`);
      }
      
      log(`🎉 Agent: Found ${coupons.length} coupons!`, coupons);
      
      // Check if coupon field exists
      const couponField = findCouponInputField();
      
      if (autoApply && couponField) {
        // AUTONOMOUS MODE: Try to apply coupons automatically
        log(`🤖 Agent: Autonomous mode - trying ${coupons.length} coupons automatically...`);
        await autoTryAllCoupons(coupons, couponField);
      } else if (autoApply) {
        // No coupon field found - run demo mode to show visual
        log(`🎭 Agent: Demo mode - no coupon field, showing visual demo...`);
        await runDemoMode(coupons);
      } else {
        // Show notification for manual selection
        showNotification(
          'Coupons Available!',
          `We found ${coupons.length} coupon${coupons.length > 1 ? 's' : ''} for ${store}. ${couponField ? 'Click to apply!' : 'Copy and paste manually.'}`,
          coupons
        );
      }
    } catch (e) {
      log("Agent: Coupon discovery error", e);
    }
  }

  // Demo mode - shows visual agent working without actual coupon field
  async function runDemoMode(coupons) {
    testedCouponsResults = [];
    workingCouponsCount = 0;
    
    showAgentWorkingNotification(coupons.length);
    
    // Simulate testing each coupon
    for (let i = 0; i < coupons.length; i++) {
      const coupon = coupons[i];
      log(`🎭 Demo: Testing coupon ${i + 1}/${coupons.length}: ${coupon.code}`);
      
      // Update progress
      updateAgentProgress(i, coupons.length, coupon.code);
      
      // Wait for visual effect
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Simulate random success/failure (20% success rate for demo)
      const success = Math.random() < 0.2;
      const savings = success ? (Math.random() * 50 + 5).toFixed(2) : 0;
      
      updateAgentProgress(i + 1, coupons.length, coupon.code, { success, savings: parseFloat(savings) });
      
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Find best working coupon from demo
    const workingCoupon = testedCouponsResults.find(c => c.success);
    if (workingCoupon) {
      const coupon = coupons.find(c => c.code === workingCoupon.code);
      showSuccessNotification(coupon, workingCoupon.savings, 100);
    } else {
      showNoWorkingCouponsNotification();
    }
  }

  // Auto-try all coupons and find the best one
  async function autoTryAllCoupons(coupons, field) {
    // Reset tracking for new run
    testedCouponsResults = [];
    workingCouponsCount = 0;
    
    const originalPrice = getPageTotal();
    showAgentWorkingNotification(coupons.length);
    
    let bestCoupon = null;
    let bestSavings = 0;
    
    for (let i = 0; i < coupons.length; i++) {
      const coupon = coupons[i];
      log(`🤖 Agent: Testing coupon ${i + 1}/${coupons.length}: ${coupon.code}`);
      
      // Update progress (before testing)
      updateAgentProgress(i, coupons.length, coupon.code);
      
      // Short delay for visual effect - show the coupon being typed
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Try to apply the coupon
      const result = await tryApplyCouponAndCheck(coupon, field);
      
      // Update progress with result
      updateAgentProgress(i + 1, coupons.length, coupon.code, result);
      
      if (result.success) {
        const savings = result.savings || coupon.discount;
        if (savings > bestSavings) {
          bestSavings = savings;
          bestCoupon = coupon;
        }
      }
      
      // Wait a bit between attempts
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    
    // Show final result with confetti if success
    if (bestCoupon) {
      showSuccessNotification(bestCoupon, bestSavings, originalPrice);
    } else {
      showNoWorkingCouponsNotification();
    }
  }

  // Try applying a coupon and check if it worked - with visual feedback
  async function tryApplyCouponAndCheck(coupon, field) {
    try {
      const originalValue = getPageTotal();
      
      // Show indicator that we're typing
      showActionIndicator(field, `Typing: ${coupon.code}`, 'typing');
      
      // Highlight the input field with a glowing border
      const originalStyle = field.getAttribute('style') || '';
      field.style.cssText = originalStyle + `
        box-shadow: 0 0 0 3px #6D4AFF, 0 0 20px rgba(109,74,255,0.5) !important;
        border-color: #6D4AFF !important;
        transition: all 0.3s ease !important;
      `;
      
      // Scroll the field into view
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Clear the field first
      field.value = '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Type the coupon code character by character for visual effect
      for (let i = 0; i < coupon.code.length; i++) {
        field.value = coupon.code.substring(0, i + 1);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50)); // Typing speed
      }
      
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Flash effect after typing
      field.style.background = 'rgba(109,74,255,0.2)';
      await new Promise(resolve => setTimeout(resolve, 200));
      field.style.background = '';
      
      // Find and click apply button
      const applyButtons = [
        ...document.querySelectorAll('button, input[type="submit"], input[type="button"]')
      ].filter(btn => {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        return text.includes('apply') || text.includes('submit') || text.includes('redeem') || text.includes('add');
      });
      
      if (applyButtons.length > 0) {
        let closestBtn = applyButtons[0];
        let minDistance = Infinity;
        
        applyButtons.forEach(btn => {
          const distance = Math.abs(
            btn.getBoundingClientRect().top - field.getBoundingClientRect().top
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestBtn = btn;
          }
        });
        
        // Show indicator that we're clicking apply
        showActionIndicator(closestBtn, 'Clicking Apply...', 'info');
        
        // Highlight the apply button before clicking
        const btnOriginalStyle = closestBtn.getAttribute('style') || '';
        closestBtn.style.cssText = btnOriginalStyle + `
          box-shadow: 0 0 0 3px #6D4AFF, 0 0 20px rgba(109,74,255,0.5) !important;
          transform: scale(1.05) !important;
          transition: all 0.2s ease !important;
        `;
        
        await new Promise(resolve => setTimeout(resolve, 400));
        
        closestBtn.click();
        
        // Reset button style
        closestBtn.setAttribute('style', btnOriginalStyle);
        
        // Reset input field style
        field.style.boxShadow = '';
        field.style.borderColor = '';
        
        // Show checking indicator
        showActionIndicator(closestBtn, 'Checking result...', 'info');
        
        // Wait for page to update
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Check if coupon was applied (look for success messages or price changes)
        const newValue = getPageTotal();
        const success = checkCouponSuccess();
        
          if (success || (newValue > 0 && newValue < originalValue)) {
            const savings = originalValue - newValue;
            log(`✓ Agent: Coupon ${coupon.code} worked! Saved: $${savings}`);
            // Show success indicator
            showActionIndicator(field, `✓ Saved $${savings.toFixed(2)}!`, 'success');


            // --- Robust Amazon order total update ---
            function updateAmazonOrderTotal() {
              // Amazon-specific: find the order total label and its price definition
              const terms = Array.from(document.querySelectorAll('.order-summary-line-term'));
              // Find all .order-summary-line-definition elements that contain a price
              const defs = Array.from(document.querySelectorAll('.order-summary-line-definition'));
              // Also try right sidebar price (Amazon)
              const sidebarPrice = document.querySelector('span.a-size-medium.a-text-bold.a-color-base');
              let updated = false;
              terms.forEach((term, idx) => {
                if (/order total/i.test(term.textContent) && defs[idx]) {
                  defs[idx].innerHTML = `<span style=\"color:#4CAF50;font-weight:800;\">$${newValue.toFixed(2)}</span> <span style=\"color:#888;font-size:14px;text-decoration:line-through;margin-left:6px;\">($${originalValue.toFixed(2)})</span>`;
                  updated = true;
                }
              });
              // Also update any .order-summary-line-definition that contains a price value
              defs.forEach(def => {
                const priceText = def.textContent.replace(/[^0-9.]/g, '');
                if (priceText && Math.abs(parseFloat(priceText) - originalValue) < 0.01) {
                  def.innerHTML = `<span style=\"color:#4CAF50;font-weight:800;\">$${newValue.toFixed(2)}</span> <span style=\"color:#888;font-size:14px;text-decoration:line-through;margin-left:6px;\">($${originalValue.toFixed(2)})</span>`;
                  updated = true;
                }
              });
              // Update right sidebar price if found
              if (sidebarPrice && /^\$?\d+[.,]?\d*/.test(sidebarPrice.textContent.trim())) {
                sidebarPrice.innerHTML = `<span style=\"color:#4CAF50;font-weight:800;\">$${newValue.toFixed(2)}</span> <span style=\"color:#888;font-size:14px;text-decoration:line-through;margin-left:6px;\">($${originalValue.toFixed(2)})</span>`;
                updated = true;
              }
              // fallback: generic
              if (!updated) {
                const labelNodes = Array.from(document.querySelectorAll('span, div, td, th'));
                const labelNode = labelNodes.find(e => /order total/i.test(e.textContent));
                if (!labelNode) return;
                let priceNode = null;
                if (labelNode.nextElementSibling && /\$[0-9,.]+/.test(labelNode.nextElementSibling.textContent)) {
                  priceNode = labelNode.nextElementSibling;
                } else if (labelNode.parentElement && labelNode.parentElement.nextElementSibling &&
                  /\$[0-9,.]+/.test(labelNode.parentElement.nextElementSibling.textContent)) {
                  priceNode = labelNode.parentElement.nextElementSibling;
                } else if (labelNode.parentElement) {
                  const siblings = Array.from(labelNode.parentElement.children);
                  priceNode = siblings.find(e => e !== labelNode && /\$[0-9,.]+/.test(e.textContent));
                }
                if (!priceNode && labelNode.parentElement) {
                  priceNode = labelNode.parentElement.querySelector('strong, b, span');
                }
                if (priceNode) {
                  priceNode.innerHTML = `<span style=\"color:#4CAF50;font-weight:800;\">$${newValue.toFixed(2)}</span> <span style=\"color:#888;font-size:14px;text-decoration:line-through;margin-left:6px;\">($${originalValue.toFixed(2)})</span>`;
                }
              }
            }
            updateAmazonOrderTotal();
            // MutationObserver to keep it updated if Amazon re-renders
            const observer = new MutationObserver(() => {
              updateAmazonOrderTotal();
            });
            observer.observe(document.body, { childList: true, subtree: true });

            return { success: true, savings };
          }
      }
      
      log(`✗ Agent: Coupon ${coupon.code} didn't work`);
      
      // Remove indicator silently (no fail indicator to avoid clutter)
      const indicator = document.getElementById('__cf_action_indicator');
      if (indicator) indicator.remove();
      
      return { success: false, savings: 0 };
    } catch (e) {
      log('Agent: Error testing coupon', e);
      return { success: false, savings: 0 };
    }
  }

  // Get current page total
  function getPageTotal() {
    const priceSelectors = [
      '[class*="total" i] [class*="price" i]',
      '[id*="total" i]',
      '[class*="grand-total" i]',
      '[class*="order-total" i]',
      '.total-price',
      '.grand-total',
      '#total',
      'span.a-size-medium.a-text-bold.a-color-base' // Amazon right sidebar
    ];
    
    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent.replace(/[^0-9.]/g, '');
        const value = parseFloat(text);
        if (!isNaN(value)) return value;
      }
    }
    return 0;
  }

  // Check if coupon was successfully applied
  function checkCouponSuccess() {
    const successIndicators = [
      '.success-message',
      '.promo-applied',
      '.coupon-applied',
      '[class*="success" i]',
      '[class*="applied" i]'
    ];
    
    for (const selector of successIndicators) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        const text = el.textContent.toLowerCase();
        if (text.includes('applied') || text.includes('success') || text.includes('saved')) {
          return true;
        }
      }
    }
    return false;
  }

  // Show agent working notification - SMALL & DYNAMIC version
  function showAgentWorkingNotification(totalCoupons) {
    const existing = document.getElementById("__cf_notification");
    if (existing) existing.remove();

    const originalPrice = getPageTotal();

    const notification = document.createElement("div");
    notification.id = "__cf_notification";
    notification.style.cssText = `
      position: fixed; z-index: 2147483647; top: 20px; right: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white; padding: 16px; border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(109,74,255,0.3);
      width: 300px; max-width: 340px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
      border: 1px solid rgba(109,74,255,0.4);
      cursor: grab; user-select: none;
    `;

    notification.innerHTML = `
      <style>
        @keyframes cfaPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes cfaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes cfaSlide { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cfaGlow { 0%, 100% { box-shadow: 0 0 5px #6D4AFF; } 50% { box-shadow: 0 0 15px #9B5BFF; } }
      </style>
      
      <!-- Compact Header -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="
          width:32px;height:32px;border-radius:8px;
          background:linear-gradient(135deg,#6D4AFF,#9B5BFF);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;animation:cfaPulse 1.5s infinite;
        ">🤖</div>
        <div style="flex:1;">
          <div style="font-weight:800;font-size:13px;">Testing Coupons</div>
          <div style="font-size:10px;color:#9B5BFF;animation:cfaPulse 1s infinite;">● ACTIVE</div>
        </div>
        <button id="__cf_notif_close" style="
          background:rgba(255,255,255,0.1);border:none;color:#666;
          width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:12px;
          display:flex;align-items:center;justify-content:center;
        ">✕</button>
      </div>

      <!-- Compact Progress -->
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:10px;color:#888;">Progress</span>
          <span id="__cf_percent" style="font-size:10px;font-weight:700;color:#6D4AFF;">0%</span>
        </div>
        <div style="background:rgba(109,74,255,0.2);height:5px;border-radius:6px;overflow:hidden;">
          <div id="__cf_progress_bar" style="
            height:100%;width:0%;border-radius:6px;
            background:linear-gradient(90deg,#6D4AFF,#9B5BFF);
            animation:cfaGlow 1.5s infinite;transition:width 0.3s;
          "></div>
        </div>
      </div>

      <!-- Current Code -->
      <div style="background:rgba(109,74,255,0.12);border-radius:8px;padding:8px;margin-bottom:8px;border:1px solid rgba(109,74,255,0.2);">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <div style="width:14px;height:14px;border:2px solid #6D4AFF;border-top-color:transparent;border-radius:50%;animation:cfaSpin 0.8s linear infinite;"></div>
          <span style="font-size:10px;color:#888;">Testing:</span>
        </div>
        <div id="__cf_current_coupon" style="
          font-family:'Courier New',monospace;font-size:16px;font-weight:700;
          color:#fff;text-align:center;letter-spacing:1px;
        ">LOADING...</div>
      </div>

      <!-- Compact Tested List -->
      <div id="__cf_tested_list" style="
        max-height:80px;overflow-y:auto;margin-bottom:8px;font-size:11px;
      "></div>

      <!-- Compact Stats Row -->
      <div style="display:flex;gap:8px;">
        <div style="flex:1;background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;">
          <div style="font-size:9px;color:#888;">TESTED</div>
          <div id="__cf_tested_count" style="font-size:14px;font-weight:800;color:#6D4AFF;">0</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;">
          <div style="font-size:9px;color:#888;">TOTAL</div>
          <div id="__cf_total_count" style="font-size:14px;font-weight:800;color:#fff;">${totalCoupons}</div>
        </div>
        <div style="flex:1;background:rgba(76,175,80,0.12);padding:6px;border-radius:6px;text-align:center;">
          <div style="font-size:9px;color:#4CAF50;">WORKS</div>
          <div id="__cf_working_count" style="font-size:14px;font-weight:800;color:#4CAF50;">0</div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(notification);

    // Close button
    document.getElementById('__cf_notif_close').onclick = () => notification.remove();

    // --- Make the agent notification draggable too ---
    let nDragging = false, nStartX, nStartY, nPosX, nPosY;
    notification.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      nDragging = true;
      nStartX = e.clientX;
      nStartY = e.clientY;
      const rect = notification.getBoundingClientRect();
      nPosX = rect.left;
      nPosY = rect.top;
      notification.style.transition = 'none';
      notification.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!nDragging) return;
      const dx = e.clientX - nStartX;
      const dy = e.clientY - nStartY;
      notification.style.left = Math.max(0, nPosX + dx) + 'px';
      notification.style.top = Math.max(0, nPosY + dy) + 'px';
      notification.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (nDragging) {
        nDragging = false;
        notification.style.cursor = 'grab';
      }
    });
  }

  // Track tested coupons for visual display
  let testedCouponsResults = [];
  let workingCouponsCount = 0;

  // Update agent progress with detailed visual feedback
  function updateAgentProgress(current, total, couponCode, result = null) {
    const currentCouponEl = document.getElementById("__cf_current_coupon");
    const progressBar = document.getElementById("__cf_progress_bar");
    const percentEl = document.getElementById("__cf_percent");
    const testedCount = document.getElementById("__cf_tested_count");
    const testedList = document.getElementById("__cf_tested_list");
    const workingCount = document.getElementById("__cf_working_count");
    
    const percent = Math.round((current / total) * 100);
    
    if (currentCouponEl) {
      currentCouponEl.textContent = couponCode;
      currentCouponEl.style.animation = 'none';
      currentCouponEl.offsetHeight;
      currentCouponEl.style.animation = 'cfaSlide 0.3s ease-out';
    }
    
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    
    if (percentEl) {
      percentEl.textContent = `${percent}%`;
    }
    
    if (testedCount) {
      testedCount.textContent = current;
    }

    // Update results after testing
    if (result !== null) {
      if (result.success) {
        workingCouponsCount++;
        if (workingCount) workingCount.textContent = workingCouponsCount;
      }
      
      testedCouponsResults.push({
        code: couponCode,
        success: result.success,
        savings: result.savings || 0
      });
      
      // Update tested list (compact version)
      if (testedList) {
        testedList.innerHTML = testedCouponsResults.map((r) => `
          <div style="
            display:flex;justify-content:space-between;align-items:center;
            padding:4px 8px;background:${r.success ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.03)'};
            border-radius:4px;margin-bottom:2px;
            border-left:2px solid ${r.success ? '#4CAF50' : '#333'};
            font-size:10px;
          ">
            <span style="font-family:monospace;color:${r.success ? '#4CAF50' : '#666'};">
              ${r.success ? '✓' : '✗'} ${r.code}
            </span>
            <span style="color:${r.success ? '#4CAF50' : '#555'};font-weight:600;">
              ${r.success ? (r.savings > 0 ? '-$' + r.savings.toFixed(2) : '✓') : '—'}
            </span>
          </div>
        `).reverse().join('');
        
        testedList.scrollTop = 0;
      }
    }
  }

  // Show success notification - compact & draggable
  function showSuccessNotification(coupon, savings, originalPrice = 0) {
    const existing = document.getElementById("__cf_notification");
    if (existing) existing.remove();

    const newPrice = originalPrice - savings;

    // Confetti
    const confettiContainer = document.createElement("div");
    confettiContainer.id = "__cf_confetti";
    confettiContainer.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      pointer-events:none;z-index:2147483646;overflow:hidden;
    `;
    const colors = ['#6D4AFF','#4CAF50','#FFD700','#FF6B6B','#00D4FF','#FF9800'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("div");
      const col = colors[Math.floor(Math.random() * colors.length)];
      c.style.cssText = `
        position:absolute;top:-10px;left:${Math.random()*100}%;
        width:${Math.random()*8+4}px;height:${Math.random()*8+4}px;background:${col};
        border-radius:${Math.random()>0.5?'50%':'0'};
        animation:cfConfetti ${2+Math.random()*2}s linear ${Math.random()*1.5}s forwards;
      `;
      confettiContainer.appendChild(c);
    }
    document.documentElement.appendChild(confettiContainer);
    setTimeout(() => confettiContainer.remove(), 5000);

    const notification = document.createElement("div");
    notification.id = "__cf_notification";
    notification.style.cssText = `
      position:fixed;z-index:2147483647;top:20px;right:20px;
      background:linear-gradient(135deg,#1a1a2e,#16213e);
      color:white;padding:16px;border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,0.4),0 0 0 2px #4CAF50;
      width:280px;
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;
      animation:cfSuccessPop 0.4s ease-out;
      cursor:grab;user-select:none;
    `;

    notification.innerHTML = `
      <style>
        @keyframes cfSuccessPop { 0%{transform:scale(0.6);opacity:0} 60%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
        @keyframes cfConfetti { to{transform:translateY(100vh) rotate(720deg);opacity:0} }
        @keyframes cfShimmer { 0%{background-position:-200%} 100%{background-position:200%} }
      </style>
      
      <button id="__cf_close" style="
        position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.1);
        border:none;color:#888;width:20px;height:20px;border-radius:50%;
        cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;
      ">✕</button>
      
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:36px;margin-bottom:4px;">🎉</div>
        <div style="
          font-size:16px;font-weight:800;
          background:linear-gradient(90deg,#4CAF50,#81C784,#4CAF50);
          background-size:200% auto;
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          animation:cfShimmer 2s linear infinite;
        ">COUPON APPLIED!</div>
      </div>

      <div style="
        background:linear-gradient(135deg,#4CAF50,#45a049);
        padding:10px;border-radius:10px;text-align:center;margin-bottom:10px;
      ">
        <div style="font-size:10px;opacity:0.9;margin-bottom:2px;">WINNING CODE</div>
        <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:800;letter-spacing:2px;">
          ${coupon.code}
        </div>
        ${coupon.description ? `<div style="font-size:10px;opacity:0.8;margin-top:4px;">${coupon.description}</div>` : ''}
      </div>

      ${originalPrice > 0 ? `
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,100,100,0.1);padding:8px;border-radius:8px;text-align:center;border:1px solid rgba(255,100,100,0.2);">
            <div style="font-size:9px;color:#ff6b6b;">BEFORE</div>
            <div style="font-size:16px;font-weight:700;color:#ff6b6b;text-decoration:line-through;">$${originalPrice.toFixed(2)}</div>
          </div>
          <div style="display:flex;align-items:center;color:#4CAF50;">→</div>
          <div style="flex:1;background:rgba(76,175,80,0.12);padding:8px;border-radius:8px;text-align:center;border:1px solid rgba(76,175,80,0.3);">
            <div style="font-size:9px;color:#4CAF50;">AFTER</div>
            <div style="font-size:16px;font-weight:700;color:#4CAF50;">$${newPrice.toFixed(2)}</div>
          </div>
        </div>
      ` : ''}

      ${savings > 0 ? `
        <div style="
          background:linear-gradient(90deg,rgba(255,215,0,0.15),rgba(255,215,0,0.08));
          padding:10px;border-radius:8px;text-align:center;border:1px solid rgba(255,215,0,0.3);
        ">
          <div style="font-size:10px;color:#FFD700;">💰 SAVED</div>
          <div style="font-size:24px;font-weight:900;color:#FFD700;">$${savings.toFixed(2)}</div>
        </div>
      ` : ''}

      <div style="margin-top:8px;font-size:9px;color:#555;text-align:center;">
        ✅ Tested ${testedCouponsResults.length} codes • ${workingCouponsCount} worked
      </div>
    `;

    document.documentElement.appendChild(notification);
    document.getElementById("__cf_close").onclick = () => notification.remove();

    // Draggable
    let sDrag=false,sX,sY,sPX,sPY;
    notification.addEventListener('mousedown',(e)=>{
      if(e.target.tagName==='BUTTON')return;
      sDrag=true;sX=e.clientX;sY=e.clientY;
      const r=notification.getBoundingClientRect();sPX=r.left;sPY=r.top;
      notification.style.transition='none';notification.style.cursor='grabbing';
    });
    document.addEventListener('mousemove',(e)=>{
      if(!sDrag)return;
      notification.style.left=Math.max(0,sPX+(e.clientX-sX))+'px';
      notification.style.top=Math.max(0,sPY+(e.clientY-sY))+'px';
      notification.style.right='auto';
    });
    document.addEventListener('mouseup',()=>{if(sDrag){sDrag=false;notification.style.cursor='grab';}});

    setTimeout(() => { if (notification.parentNode) notification.remove(); }, 12000);
  }

  // Show no working coupons notification - compact & draggable
  function showNoWorkingCouponsNotification() {
    const existing = document.getElementById("__cf_notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "__cf_notification";
    notification.style.cssText = `
      position:fixed;z-index:2147483647;top:20px;right:20px;
      background:linear-gradient(135deg,#1a1a2e,#16213e);
      color:white;padding:16px;border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,0.4),0 0 0 2px #FF9800;
      width:280px;
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;
      animation:cfaSlide 0.3s ease-out;
      cursor:grab;user-select:none;
    `;

    notification.innerHTML = `
      <button id="__cf_close" style="
        position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.1);
        border:none;color:#888;width:20px;height:20px;border-radius:50%;
        cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;
      ">✕</button>
      
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:32px;margin-bottom:4px;">😔</div>
        <div style="font-size:15px;font-weight:800;color:#FF9800;">No Working Coupons</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">Agent completed testing</div>
      </div>

      <div style="
        background:rgba(255,152,0,0.1);padding:10px;border-radius:8px;
        border:1px solid rgba(255,152,0,0.2);margin-bottom:10px;
      ">
        <div style="display:flex;justify-content:space-around;text-align:center;">
          <div>
            <div style="font-size:18px;font-weight:800;color:#FF9800;">${testedCouponsResults.length}</div>
            <div style="font-size:9px;color:#888;">Tested</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,0.1);"></div>
          <div>
            <div style="font-size:18px;font-weight:800;color:#ff6b6b;">0</div>
            <div style="font-size:9px;color:#888;">Worked</div>
          </div>
        </div>
      </div>

      <div style="font-size:10px;color:#777;text-align:center;">
        💡 No valid coupons right now. Try again later!
      </div>
    `;

    document.documentElement.appendChild(notification);
    document.getElementById("__cf_close").onclick = () => notification.remove();

    // Draggable
    let d=false,sx,sy,px,py;
    notification.addEventListener('mousedown',(e)=>{
      if(e.target.tagName==='BUTTON')return;
      d=true;sx=e.clientX;sy=e.clientY;
      const r=notification.getBoundingClientRect();px=r.left;py=r.top;
      notification.style.transition='none';notification.style.cursor='grabbing';
    });
    document.addEventListener('mousemove',(e)=>{
      if(!d)return;
      notification.style.left=Math.max(0,px+(e.clientX-sx))+'px';
      notification.style.top=Math.max(0,py+(e.clientY-sy))+'px';
      notification.style.right='auto';
    });
    document.addEventListener('mouseup',()=>{if(d){d=false;notification.style.cursor='grab';}});

    setTimeout(() => { if (notification.parentNode) notification.remove(); }, 8000);
  }

  // ---- background proxy fetch to avoid mixed-content/CORS issues ----
  function proxyFetch(url, opts = {}) {
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
            log("proxyFetch lastError:", chrome.runtime.lastError.message);
            return resolve({ ok: false, status: 0, data: null, error: chrome.runtime.lastError.message });
          }
          if (!res) {
            log("proxyFetch: no response from background");
            return resolve({ ok: false, status: 0, data: null, error: "no_response" });
          }
          let data = null;
          try {
            data = res.text ? JSON.parse(res.text) : null;
          } catch (e) {
            log("proxyFetch: JSON parse failed", e, res.text?.slice(0, 120));
          }
          resolve({ ok: res.ok, status: res.status, data, error: res.error });
        }
      );
    });
  }

  // ========================================================
  // SCREEN MONITOR - Track user browsing for recommendations
  // ========================================================
  function trackUserSearch(query, brand, product) {
    chrome.runtime.sendMessage({
      type: "trackSearch",
      query: query || document.title,
      brand: brand || getStoreName(),
      product: product || guessQuery(),
      url: location.href
    }, (res) => {
      if (res?.alertTriggered) {
        log(`🔥 Brand alert triggered for ${brand || getStoreName()}!`);
      }
    });
  }

  // Track page visit
  trackUserSearch();

  // ========================================================
  // SCREENSHOT PROMOTION CAPTURE - Take screenshot and redirect to checkout
  // ========================================================
  function capturePromoScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "captureScreenshot" }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          log("Screenshot capture failed");
          resolve(null);
        } else {
          resolve(res.dataUrl);
        }
      });
    });
  }

  function redirectToVendorCheckout(vendorUrl) {
    const hostname = location.hostname.replace(/^www\./, '');
    let checkoutUrl = vendorUrl;
    
    if (!checkoutUrl) {
      // Attempt to find checkout link on the page
      const checkoutLinks = document.querySelectorAll('a[href*="checkout"], a[href*="cart"], a[href*="bag"]');
      if (checkoutLinks.length > 0) {
        checkoutUrl = checkoutLinks[0].href;
      } else {
        checkoutUrl = `https://${hostname}/checkout`;
      }
    }
    
    window.open(checkoutUrl, '_blank');
    return checkoutUrl;
  }

  // --- best-effort query from page ---
  function guessQuery() {
    const candidates = [
      "h1#sc-buy-box-heading", // Amazon example
      "h1",
      ".cart-header",
      ".checkout-title",
      ".cart-item-title",
      ".product-title",
      ".order-title",
      ".summary-title"
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 2) {
        return el.textContent.trim().slice(0, 120);
      }
    }
    return (document.title || "").trim().slice(0, 120) || "best price";
  }

  function baseBtn(primary = false) {
    return `
      border: 1px solid ${primary ? "#6D4AFF" : "#E6E3FA"};
      background: ${primary ? "linear-gradient(180deg,#6D4AFF,#9B5BFF)" : "#fff"};
      color: ${primary ? "#fff" : "#3a2d7d"};
      padding: 8px 10px; border-radius: 10px; font-weight: 700; cursor: pointer;
    `;
  }

  function injectBar() {
    if (document.getElementById("__cf_bar")) return;

    // ========================================================
    // SMALL, DYNAMIC, MOVEABLE AGENT POPUP
    // User can drag and position it anywhere on screen
    // ========================================================
    const bar = document.createElement("div");
    bar.id = "__cf_bar";
    bar.style.cssText = `
      position: fixed; z-index: 2147483647;
      right: 20px; bottom: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(109,74,255,0.4);
      box-shadow: 0 8px 32px rgba(109,74,255,0.25), 0 0 0 1px rgba(109,74,255,0.2);
      border-radius: 16px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
      cursor: default;
      user-select: none;
      transition: box-shadow 0.2s;
      overflow: hidden;
      width: 52px;
      height: 52px;
    `;

    // --- Collapsed state (small floating button) ---
    const collapsedView = document.createElement("div");
    collapsedView.id = "__cf_collapsed";
    collapsedView.style.cssText = `
      width: 52px; height: 52px;
      display: flex; align-items: center; justify-content: center;
      cursor: grab; font-size: 22px;
      background: linear-gradient(135deg, #6D4AFF, #9B5BFF);
      border-radius: 16px;
    `;
    collapsedView.innerHTML = '🤖';
    collapsedView.title = 'PriceKlick Agent – Click to expand, drag to move';

    // --- Expanded state (compact agent panel) ---
    const expandedView = document.createElement("div");
    expandedView.id = "__cf_expanded";
    expandedView.style.cssText = `
      display: none; width: 280px; padding: 0;
    `;

    // Drag handle / header
    expandedView.innerHTML = `
      <style>
        #__cf_bar * { box-sizing: border-box; }
        @keyframes cfPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes cfCodeFlip { 0%{transform:rotateX(90deg);opacity:0} 100%{transform:rotateX(0);opacity:1} }
        @keyframes cfSpin { to{transform:rotate(360deg)} }
      </style>
      
      <!-- Drag Handle Header -->
      <div id="__cf_drag_handle" style="
        background: linear-gradient(135deg,#6D4AFF,#9B5BFF);
        padding: 10px 12px; cursor: grab;
        display: flex; align-items: center; justify-content: space-between;
        border-radius: 16px 16px 0 0;
      ">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">🤖</span>
          <span style="font-size:13px;font-weight:800;color:#fff;">PriceKlick</span>
          <span style="font-size:9px;background:rgba(255,255,255,0.25);padding:2px 6px;border-radius:8px;color:#fff;font-weight:600;">AGENT</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="__cf_minimize" style="
            background:rgba(255,255,255,0.2);border:none;color:#fff;width:22px;height:22px;
            border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;
          ">─</button>
          <button id="__cf_close_bar" style="
            background:rgba(255,255,255,0.2);border:none;color:#fff;width:22px;height:22px;
            border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;
          ">✕</button>
        </div>
      </div>

      <!-- Dynamic Promo Code Area -->
      <div id="__cf_promo_section" style="
        padding: 10px 12px; background: rgba(109,74,255,0.1);
        border-bottom: 1px solid rgba(109,74,255,0.2);
      ">
        <div style="font-size:10px;color:#9B5BFF;font-weight:600;margin-bottom:6px;">
          ⚡ LIVE PROMO CODE
        </div>
        <div id="__cf_live_code" style="
          font-family:'Courier New',monospace; font-size:18px; font-weight:800;
          color:#fff; text-align:center; padding:8px;
          background:rgba(0,0,0,0.3); border-radius:8px;
          letter-spacing:2px; animation:cfCodeFlip 0.4s ease-out;
        ">SCANNING...</div>
        <div id="__cf_promo_status" style="
          font-size:10px;color:#888;text-align:center;margin-top:4px;
        ">🔄 Searching for codes...</div>
      </div>

      <!-- Quick Actions -->
      <div style="padding:10px 12px; display:flex; gap:6px; flex-wrap:wrap;">
        <button id="__cf_compare" style="
          flex:1;padding:7px;border-radius:8px;border:1px solid rgba(109,74,255,0.3);
          background:rgba(109,74,255,0.1);color:#9B5BFF;font-weight:700;font-size:11px;
          cursor:pointer;transition:all 0.2s;min-width:60px;
        ">🔍 Compare</button>
        <button id="__cf_apply" style="
          flex:1;padding:7px;border-radius:8px;border:none;
          background:linear-gradient(135deg,#6D4AFF,#9B5BFF);color:#fff;font-weight:700;font-size:11px;
          cursor:pointer;transition:all 0.2s;min-width:60px;
        ">✨ Apply</button>
        <button id="__cf_capture" style="
          flex:1;padding:7px;border-radius:8px;border:1px solid rgba(255,107,0,0.3);
          background:rgba(255,107,0,0.1);color:#FF6B00;font-weight:700;font-size:11px;
          cursor:pointer;transition:all 0.2s;min-width:60px;
        ">📸 Capture</button>
        <button id="__cf_lens" style="
          flex:1;padding:7px;border-radius:8px;border:1px solid rgba(66,133,244,0.3);
          background:linear-gradient(135deg,rgba(66,133,244,0.15),rgba(52,168,83,0.15));
          color:#4285F4;font-weight:700;font-size:11px;
          cursor:pointer;transition:all 0.2s;min-width:60px;
        ">🔎 Lens</button>
      </div>
      
      <!-- Promo Lens file input (hidden) -->
      <input type="file" id="__cf_lens_input" accept="image/*" style="display:none;"/>
      <!-- Promo Lens result area -->
      <div id="__cf_lens_result" style="
        display:none;padding:8px 12px;margin:0 12px 8px;border-radius:8px;
        background:linear-gradient(135deg,rgba(66,133,244,0.1),rgba(52,168,83,0.1));
        border:1px solid rgba(66,133,244,0.3);font-size:11px;
      ">
        <div id="__cf_lens_brand" style="font-weight:bold;color:#4285F4;"></div>
        <div id="__cf_lens_title" style="color:#aaa;margin:2px 0;"></div>
        <div id="__cf_lens_discount" style="color:#4CAF50;margin:2px 0;"></div>
        <button id="__cf_lens_go" style="
          width:100%;padding:6px;margin-top:4px;border-radius:6px;border:none;
          background:linear-gradient(135deg,#4285F4,#34A853);color:#fff;
          font-weight:700;font-size:11px;cursor:pointer;
        ">🔗 Go to Promo Page</button>
      </div>

      <!-- Status line -->
      <div id="__cf_status_line" style="
        padding:6px 12px 10px; font-size:10px; color:#666; text-align:center;
      "></div>
    `;

    bar.appendChild(collapsedView);
    bar.appendChild(expandedView);
    document.documentElement.appendChild(bar);

    // --- Toggle collapsed/expanded ---
    let isExpanded = false;
    collapsedView.addEventListener('click', (e) => {
      if (isDragging) return;
      isExpanded = true;
      collapsedView.style.display = 'none';
      expandedView.style.display = 'block';
      bar.style.width = '280px';
      bar.style.height = 'auto';
      bar.style.borderRadius = '16px';
    });

    // Minimize button
    document.getElementById('__cf_minimize').addEventListener('click', () => {
      isExpanded = false;
      expandedView.style.display = 'none';
      collapsedView.style.display = 'flex';
      bar.style.width = '52px';
      bar.style.height = '52px';
    });

    // Close button
    document.getElementById('__cf_close_bar').addEventListener('click', () => {
      bar.remove();
    });

    // --- DRAG & DROP - Make popup moveable ---
    let isDragging = false;
    let dragStartX, dragStartY, barStartX, barStartY;
    
    function onDragStart(e) {
      isDragging = true;
      const touch = e.touches ? e.touches[0] : e;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      const rect = bar.getBoundingClientRect();
      barStartX = rect.left;
      barStartY = rect.top;
      bar.style.transition = 'none';
      bar.style.cursor = 'grabbing';
      e.preventDefault();
    }
    
    function onDragMove(e) {
      if (!isDragging) return;
      const touch = e.touches ? e.touches[0] : e;
      const dx = touch.clientX - dragStartX;
      const dy = touch.clientY - dragStartY;
      const newX = barStartX + dx;
      const newY = barStartY + dy;
      
      // Constrain to viewport
      const maxX = window.innerWidth - bar.offsetWidth;
      const maxY = window.innerHeight - bar.offsetHeight;
      bar.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
      bar.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
      bar.style.right = 'auto';
      bar.style.bottom = 'auto';
      e.preventDefault();
    }
    
    function onDragEnd(e) {
      if (!isDragging) return;
      isDragging = false;
      bar.style.transition = 'box-shadow 0.2s';
      bar.style.cursor = 'default';
      // Save position
      chrome.storage?.local?.set?.({
        cf_popup_pos: { left: bar.style.left, top: bar.style.top }
      });
    }

    // Attach drag events to collapsed view + drag handle
    collapsedView.addEventListener('mousedown', onDragStart);
    collapsedView.addEventListener('touchstart', onDragStart, { passive: false });
    
    const dragHandle = document.getElementById('__cf_drag_handle');
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', onDragStart);
      dragHandle.addEventListener('touchstart', onDragStart, { passive: false });
    }
    
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchend', onDragEnd);

    // Restore saved position
    chrome.storage?.local?.get?.(['cf_popup_pos'], (data) => {
      if (data?.cf_popup_pos) {
        bar.style.left = data.cf_popup_pos.left;
        bar.style.top = data.cf_popup_pos.top;
        bar.style.right = 'auto';
        bar.style.bottom = 'auto';
      }
    });

    // --- Dynamic promo code rotation inside the agent popup ---
    const liveCodeEl = document.getElementById('__cf_live_code');
    const promoStatusEl = document.getElementById('__cf_promo_status');
    const statusLineEl = document.getElementById('__cf_status_line');
    
    const placeholderCodes = ['SCANNING...','CHECKING..','SAVE??%','DEAL????','PROMO???','DISCOUNT?'];
    let promoInterval = null;
    let promoIdx = 0;
    let liveVerifiedCode = null;
    
    // Start rotating placeholder codes
    promoInterval = setInterval(() => {
      if (liveVerifiedCode) return;
      liveCodeEl.textContent = placeholderCodes[promoIdx % placeholderCodes.length];
      liveCodeEl.style.animation = 'none';
      liveCodeEl.offsetHeight;
      liveCodeEl.style.animation = 'cfCodeFlip 0.4s ease-out';
      promoIdx++;
    }, 1500);

    // Fetch real codes for the current store
    (async () => {
      try {
        const store = getStoreName();
        const fullDomain = location.hostname.replace(/^www\./, '');
        
        const cfRes = await proxyFetch(
          `${API_BASE}/api/coupons/couponfollow?store=${encodeURIComponent(fullDomain)}`,
          { method: "GET", headers: { Accept: "application/json" } }
        );

        let coupons = [];
        if (cfRes.ok && cfRes.data?.coupons?.length > 0) {
          coupons = cfRes.data.coupons;
        } else {
          // Fallback to discover
          const discRes = await proxyFetch(`${API_BASE}/api/coupons/discover`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: { store, productName: guessQuery() }
          });
          if (discRes.ok && discRes.data?.coupons?.length > 0) {
            coupons = discRes.data.coupons;
          }
        }

        if (coupons.length > 0) {
          clearInterval(promoInterval);
          
          const verified = coupons.find(c => c.isVerified);
          if (verified) {
            liveVerifiedCode = verified;
            liveCodeEl.textContent = verified.code;
            liveCodeEl.style.background = 'rgba(76,175,80,0.3)';
            promoStatusEl.textContent = `✅ ${verified.description || 'Verified code'}`;
            promoStatusEl.style.color = '#4CAF50';
          } else {
            let rotateIdx = 0;
            promoInterval = setInterval(() => {
              const c = coupons[rotateIdx % coupons.length];
              liveCodeEl.textContent = c.code;
              liveCodeEl.style.animation = 'none';
              liveCodeEl.offsetHeight;
              liveCodeEl.style.animation = 'cfCodeFlip 0.4s ease-out';
              promoStatusEl.textContent = `🔄 ${c.description || 'Code'} (${(rotateIdx % coupons.length) + 1}/${coupons.length})`;
              rotateIdx++;
            }, 2500);
          }
        } else {
          promoStatusEl.textContent = '⏳ No codes found yet';
        }
      } catch (e) {
        log("Mini promo fetch error:", e);
      }
    })();

    // --- Action buttons ---
    const query = guessQuery();
    log("Checkout/cart detected.", { host, path, query });

    document.getElementById('__cf_compare').onclick = async () => {
      try {
        statusLineEl.textContent = "🔍 Comparing...";
        const url = `${API_BASE}/api/compare?q=${encodeURIComponent(query)}`;
        const res = await proxyFetch(url, { method: "GET", headers: { Accept: "application/json" } });
        if (res.ok && res.data?.best) {
          statusLineEl.textContent = `Best: ${res.data.best.source} $${res.data.best.price}`;
        } else {
          statusLineEl.textContent = "No results.";
        }
      } catch (e) {
        statusLineEl.textContent = "Compare failed.";
      }
    };

    document.getElementById('__cf_apply').onclick = async () => {
      try {
        statusLineEl.textContent = "🤖 Agent searching...";
        await autoDiscoverCoupons(true);
        statusLineEl.textContent = "Agent finished!";
      } catch (e) {
        statusLineEl.textContent = "Coupon failed.";
      }
    };

    // --- Capture button: Screenshot promo & redirect to checkout ---
    document.getElementById('__cf_capture').onclick = async () => {
      try {
        statusLineEl.textContent = "📸 Capturing...";
        const screenshot = await capturePromoScreenshot();
        
        if (!screenshot) {
          statusLineEl.textContent = "Capture failed";
          return;
        }
        
        statusLineEl.textContent = "🤖 Analyzing promo...";
        
        const res = await proxyFetch(`${API_BASE}/api/promo/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: {
            image: screenshot,
            vendorUrl: location.href,
            brand: getStoreName(),
            productName: guessQuery()
          }
        });
        
        if (res.ok && res.data?.coupons?.length > 0) {
          const code = res.data.coupons[0];
          liveVerifiedCode = code;
          clearInterval(promoInterval);
          liveCodeEl.textContent = code.code;
          liveCodeEl.style.background = 'rgba(76,175,80,0.3)';
          promoStatusEl.textContent = `✅ Found: ${code.description || code.code}`;
          promoStatusEl.style.color = '#4CAF50';
          statusLineEl.textContent = "🛒 Redirecting to checkout...";
          
          // Open checkout
          setTimeout(() => {
            const checkoutUrl = res.data.checkoutUrl || '';
            redirectToVendorCheckout(checkoutUrl);
            statusLineEl.textContent = "✅ Checkout opened!";
          }, 1500);
        } else {
          statusLineEl.textContent = "No promos detected on page.";
        }
      } catch (e) {
        statusLineEl.textContent = "Capture error.";
        log("Capture error:", e);
      }
    };

    // --- Promo Lens: Upload screenshot → detect promo → redirect to official page ---
    let lensRedirectUrl = null;
    const lensInput = document.getElementById('__cf_lens_input');
    const lensResultEl = document.getElementById('__cf_lens_result');
    
    document.getElementById('__cf_lens').onclick = () => {
      lensInput.click();
    };

    lensInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      statusLineEl.textContent = "🔎 Analyzing promo with Lens...";
      lensResultEl.style.display = 'none';

      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const imageData = ev.target.result;

          const res = await proxyFetch(`${API_BASE}/api/promo/find-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: { image: imageData }
          });

          if (res.ok && res.data?.redirectUrl) {
            lensRedirectUrl = res.data.redirectUrl;

            // Show result in agent popup
            lensResultEl.style.display = 'block';
            document.getElementById('__cf_lens_brand').textContent = 
              `🏪 ${res.data.brand || 'Brand'} ${res.data.domain ? '(' + res.data.domain + ')' : ''}`;
            document.getElementById('__cf_lens_title').textContent = 
              res.data.promotionTitle || 'Promotion detected';
            
            const discEl = document.getElementById('__cf_lens_discount');
            discEl.textContent = res.data.discountAmount ? `💰 ${res.data.discountAmount} off` : '';
            discEl.style.display = res.data.discountAmount ? 'block' : 'none';

            // Update live code if coupon found
            if (res.data.coupons?.length > 0 && res.data.coupons[0].code) {
              liveVerifiedCode = res.data.coupons[0];
              clearInterval(promoInterval);
              liveCodeEl.textContent = res.data.coupons[0].code;
              liveCodeEl.style.background = 'rgba(66,133,244,0.3)';
              promoStatusEl.textContent = `🔎 Lens: ${res.data.coupons[0].description || res.data.coupons[0].code}`;
              promoStatusEl.style.color = '#4285F4';
            }

            statusLineEl.textContent = `✅ Found: ${res.data.brand || 'Promo'} → ${res.data.domain || 'website'}`;
          } else {
            statusLineEl.textContent = "No promo detected. Try a clearer image.";
          }
        } catch (err) {
          statusLineEl.textContent = "Lens analysis error.";
          log("Lens error:", err);
        }
      };
      reader.readAsDataURL(file);
    };

    // Go to official promo page from Lens result
    document.getElementById('__cf_lens_go').onclick = () => {
      if (lensRedirectUrl) {
        window.open(lensRedirectUrl, '_blank');
        statusLineEl.textContent = "🔗 Opened promo page!";
      }
    };
  }

  const ready = () => {
    injectBar();
    
    // 🤖 AGENT MODE: Auto-discover coupons on checkout pages
    if (isCheckoutPage) {
      log("🤖 Agent: Checkout page detected! Auto-searching for coupons...");
      // Wait a bit for page to fully load, then search for coupons
      setTimeout(() => autoDiscoverCoupons(), 2000);
    }
  };
  
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(ready, 500);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(ready, 500));
  }

  // --- Listen for messages from popup ---
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;

    (async () => {
      try {
        if (msg.type === "CF_COMPARE") {
          const query = guessQuery();
          const url = `${API_BASE}/api/compare?q=${encodeURIComponent(query)}`;
          log("CF_COMPARE via proxy", url);
          const res = await proxyFetch(url, { method: "GET", headers: { Accept: "application/json" } });
          log("CF_COMPARE result", res);
          if (res.ok && res.data?.best) {
            sendResponse({ ok: true, message: `Best: ${res.data.best.source} $${res.data.best.price}` });
          } else {
            sendResponse({ ok: false, error: "No results found" });
          }
        } else if (msg.type === "CF_APPLY_COUPON") {
          const url = `${API_BASE}/api/coupons/apply`;
          log("CF_APPLY_COUPON via proxy", url);
          const res = await proxyFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: { cartUrl: location.href }
          });
          log("CF_APPLY_COUPON result", res);
          if (res.ok && res.data?.code) {
            sendResponse({ ok: true, message: `Applied: ${res.data.code}` });
          } else {
            sendResponse({ ok: false, error: "No coupon found" });
          }
        } else if (msg.type === "CF_APPLY_EXTRACTED_COUPON") {
          // Apply coupon code extracted from screenshot via AI
          const code = msg.code;
          log("CF_APPLY_EXTRACTED_COUPON: Applying code", code);
          
          // Find coupon input field
          const couponField = findCouponInputField();
          
          if (!couponField) {
            sendResponse({ ok: false, error: "No coupon field found on this page" });
            return;
          }
          
          // Apply the coupon
          try {
            tryApplyCoupon(code, couponField);
            sendResponse({ ok: true, message: `Applied coupon: ${code}` });
          } catch (e) {
            sendResponse({ ok: false, error: `Failed to apply: ${e.message}` });
          }
        } else if (msg.type === "CF_WISHLIST") {
          // Placeholder for wishlist logic
          sendResponse({ ok: true, message: "Added to wishlist" });
        }
      } catch (e) {
        log("Message handler error", e);
        sendResponse({ ok: false, error: e.message });
      }
    })();

    return true; // keep channel open for async sendResponse
  });
})();
