import React from 'react'
import { Link } from 'react-router-dom'
import './Promote.css'

export default function Promote() {
  return (
    <div className="promote-page">
      <div className="promote-bg" aria-hidden />
      <div className="container promote-wrap">
        <Link to="/services" className="promote-back">← Back to services</Link>

        <div className="promote-card">
          <span className="pm-pill">📣 PREFERRED VENDOR ADS</span>
          <h1 className="pm-title">
            Become a <span className="pm-grad">Preferred Vendor</span> in your category
          </h1>
          <p className="pm-sub">
            Get featured at the top of your service category. Customers see verified,
            top-rated providers first — and that can be you.
          </p>

          <div className="pm-tiers">
            <div className="pm-tier">
              <div className="pm-tier-name">BASIC</div>
              <div className="pm-tier-price">$49<span>/mo</span></div>
              <ul className="pm-tier-list">
                <li><span className="pm-spark">✦</span> Verified badge</li>
                <li><span className="pm-spark">✦</span> Category boost</li>
              </ul>
            </div>
            <div className="pm-tier">
              <div className="pm-tier-name">PRO</div>
              <div className="pm-tier-price">$149<span>/mo</span></div>
              <ul className="pm-tier-list">
                <li><span className="pm-spark">✦</span> Top 3 placement</li>
                <li><span className="pm-spark">✦</span> Preferred badge</li>
                <li><span className="pm-spark">✦</span> Analytics</li>
              </ul>
            </div>
            <div className="pm-tier">
              <div className="pm-tier-name">ELITE</div>
              <div className="pm-tier-price">$399<span>/mo</span></div>
              <ul className="pm-tier-list">
                <li><span className="pm-spark">✦</span> #1 in category</li>
                <li><span className="pm-spark">✦</span> Homepage feature</li>
                <li><span className="pm-spark">✦</span> Priority support</li>
              </ul>
            </div>
          </div>

          <div className="pm-actions">
            <Link to="/register?role=vendor&plan=promote" className="pm-btn primary">
              📈 Promote My Listing
            </Link>
            <span className="pm-note">⊘ Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  )
}
