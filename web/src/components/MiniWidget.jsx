import React from 'react'
import './MiniWidget.css'

export default function MiniWidget(){
  return (
    <div className="mw-wrap">
      <div className="mw-card">
        <div className="mw-badge">Free</div>
        <div className="mw-head">
          <div className="mw-brand">
            <span className="mw-logo">✦</span>
            <div className="mw-title">
              <div className="mw-name">PriceKlick</div>
              <div className="mw-sub">Searching for deals...</div>
            </div>
          </div>
        </div>

        <div className="mw-row">
          <span className="mw-text">Scanning for coupons</span>
          <span className="mw-dot" />
        </div>

        <div className="mw-bar">
          <div className="mw-fill" />
        </div>

        <div className="mw-stats">
          <span className="mw-count">0</span>
          <span className="mw-amount">$0</span>
        </div>

        <button className="mw-btn">✦ Try Demo</button>
        <div className="mw-secure">Secure</div>
      </div>
    </div>
  )
}
