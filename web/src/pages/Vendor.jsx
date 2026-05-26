import React from 'react'
import { Link } from 'react-router-dom'
import './Vendor.css'

export default function Vendor() {
  return (
    <div className="vendor-page">
      <div className="vendor-bg" />
      <section className="container vendor-wrap">
        <Link to="/services" className="vendor-back">← Back to services</Link>

        <div className="vendor-card">
          <span className="vp-pill">🏪 VENDOR REGISTRATION</span>
          <h1 className="vp-title">
            Join PriceKlick — <span className="vp-grad">no discounting required</span>
          </h1>
          <p className="vp-sub">
            Unlike WagJag, Square, Groupon and other deal sites, we never ask vendors to
            slash prices. You set the price you're comfortable selling at — we categorize you
            by pricepoint so the right customers find you.
          </p>
          <ul className="vp-list">
            <li><span className="vp-check">✓</span> Keep 100% of your margins — no forced discounts</li>
            <li><span className="vp-check">✓</span> Listed by pricepoint category, not by deal</li>
            <li><span className="vp-check">✓</span> Reach budget-aware customers actively searching</li>
            <li><span className="vp-check">✓</span> Manage products, specials, and orders from one dashboard</li>
          </ul>
          <div className="vp-actions">
            <Link to="/register?role=vendor" className="vp-btn primary">Register as a Vendor</Link>
            <Link to="/login?role=vendor" className="vp-btn outline">Vendor Login</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
