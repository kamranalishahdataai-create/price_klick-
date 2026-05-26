import React from 'react'
import { Link } from 'react-router-dom'
import './Network.css'

export default function Network() {
  return (
    <div className="network-page">
      <div className="network-bg" aria-hidden />
      <div className="container network-wrap">
        <Link to="/services" className="network-back">← Back to services</Link>

        <div className="network-card">
          <span className="nw-pill">🚀 THE PRICEKLICK NETWORK</span>
          <h1 className="nw-title">
            Build your own <span className="nw-grad">dedicated services page</span> inside our ecosystem
          </h1>
          <p className="nw-sub">
            Joining the PriceKlick Network gives you more than a listing. You get a fully
            dedicated web page for your services within our ecosystem — branded to you — and
            the tools to promote those services directly to our entire userbase.
          </p>

          <div className="nw-features">
            <div className="nw-feat">
              <div className="nw-feat-icon">▦</div>
              <div className="nw-feat-title">Your dedicated web page</div>
              <div className="nw-feat-desc">A full page inside priceklick.com showcasing your brand, services, pricing, photos, and offers.</div>
            </div>
            <div className="nw-feat">
              <div className="nw-feat-icon">📣</div>
              <div className="nw-feat-title">Promote to our userbase</div>
              <div className="nw-feat-desc">Push featured placements, specials, and new services straight to active PriceKlick users.</div>
            </div>
            <div className="nw-feat">
              <div className="nw-feat-icon">👥</div>
              <div className="nw-feat-title">Customers actively searching</div>
              <div className="nw-feat-desc">Get discovered by buyers already comparing options in your category and area.</div>
            </div>
            <div className="nw-feat">
              <div className="nw-feat-icon">✓</div>
              <div className="nw-feat-title">Verified network badge</div>
              <div className="nw-feat-desc">Earn the PriceKlick Network badge for trust, ranking boosts, and preferred placement.</div>
            </div>
          </div>

          <div className="nw-checklist">
            <div><span className="nw-check">✓</span> Custom vendor page URL inside our ecosystem</div>
            <div><span className="nw-check">✓</span> Unlimited services &amp; menu items</div>
            <div><span className="nw-check">✓</span> Promote specials to logged-in users</div>
            <div><span className="nw-check">✓</span> Keep 100% of your margins — no forced discounts</div>
          </div>

          <div className="nw-actions">
            <Link to="/register?role=vendor&plan=network" className="nw-btn primary">Join the Network →</Link>
            <Link to="/promote" className="nw-btn outline">📣 Promote My Services</Link>
            <Link to="/login?role=vendor" className="nw-btn ghost">Vendor Login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
