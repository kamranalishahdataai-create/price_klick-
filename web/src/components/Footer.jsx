import React from 'react'
import './Footer.css'
export default function Footer(){
  return (
    <div className="footer">
      <div className="container footer-content">
        <div className="footer-brand">
          <span className="brand-badge">✦</span>
          <strong>PriceKlick</strong>
        </div>
        <div className="muted small">© {new Date().getFullYear()} PriceKlick — priceklick.com • 256‑bit encryption • No data tracking</div>
      </div>
    </div>
  )
}