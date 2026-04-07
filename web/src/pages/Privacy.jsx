import React from 'react'

export default function Privacy() {
  return (
    <section style={{ minHeight: '80vh', padding: '80px 20px 60px', maxWidth: 800, margin: '0 auto', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>Privacy Policy</h1>
      <p style={{ color: '#6a6880', textAlign: 'center', marginBottom: 40 }}>Last updated: April 7, 2026</p>

      <div style={{ fontSize: 15, color: '#333' }}>
        <h2 style={h2}>1. Introduction</h2>
        <p>PriceKlick ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how our browser extension and website collect, use, and safeguard your information.</p>

        <h2 style={h2}>2. Information We Collect</h2>
        <p><strong>Browser Extension:</strong></p>
        <ul style={ulStyle}>
          <li>Current page URL and domain name — to find relevant coupons and deals</li>
          <li>Product information on shopping pages — to compare prices across stores</li>
          <li>Images you voluntarily upload to Promo Lens — to identify products and promotions</li>
        </ul>
        <p><strong>Website (priceklick.com):</strong></p>
        <ul style={ulStyle}>
          <li>Account information (name, email) when you register</li>
          <li>Usage data for improving our service</li>
        </ul>

        <h2 style={h2}>3. How We Use Your Information</h2>
        <ul style={ulStyle}>
          <li>Find and apply coupon codes at checkout</li>
          <li>Compare prices across retailers</li>
          <li>Identify products from uploaded images (Promo Lens feature)</li>
          <li>Provide personalized deal recommendations</li>
          <li>Improve our services and user experience</li>
        </ul>

        <h2 style={h2}>4. Data Sharing</h2>
        <p>We do <strong>not</strong> sell, trade, or rent your personal information. We may share data with:</p>
        <ul style={ulStyle}>
          <li><strong>AI Service Providers</strong> (OpenAI) — images uploaded to Promo Lens are processed by AI to identify products. These images are not stored after processing.</li>
          <li><strong>Search APIs</strong> — product queries are sent to search services to find real product URLs.</li>
        </ul>

        <h2 style={h2}>5. Data Security</h2>
        <p>We use 256-bit SSL encryption for all data in transit. Passwords are hashed using bcrypt. We do not store credit card or payment information.</p>

        <h2 style={h2}>6. Data Retention</h2>
        <ul style={ulStyle}>
          <li>Uploaded images are processed in real-time and <strong>not stored</strong> on our servers</li>
          <li>Account data is retained until you delete your account</li>
          <li>Coupon usage data is anonymized after 30 days</li>
        </ul>

        <h2 style={h2}>7. Your Rights</h2>
        <p>You can:</p>
        <ul style={ulStyle}>
          <li>Uninstall the extension at any time to stop all data collection</li>
          <li>Request deletion of your account and data by contacting support@priceklick.com</li>
          <li>Access and export your personal data</li>
        </ul>

        <h2 style={h2}>8. Cookies</h2>
        <p>The extension uses <code>chrome.storage.local</code> for preferences. The website uses essential cookies for authentication only. No third-party tracking cookies are used.</p>

        <h2 style={h2}>9. Children's Privacy</h2>
        <p>Our services are not directed to children under 13. We do not knowingly collect personal information from children.</p>

        <h2 style={h2}>10. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.</p>

        <h2 style={h2}>11. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, contact us at:</p>
        <ul style={ulStyle}>
          <li>Email: <a href="mailto:support@priceklick.com" style={{ color: '#6D4AFF' }}>support@priceklick.com</a></li>
          <li>Website: <a href="https://priceklick.com/contact" style={{ color: '#6D4AFF' }}>priceklick.com/contact</a></li>
        </ul>
      </div>
    </section>
  )
}

const h2 = { fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }
const ulStyle = { paddingLeft: 24, marginBottom: 16 }
