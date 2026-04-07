import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'
export default function Footer(){
  return (
    <div className="footer">
      <div className="container footer-content">
        <div className="footer-brand">
          <span className="brand-badge">✦</span>
          <strong>PriceKlick</strong>
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <Link to="/contact" style={{ color: '#aaa', fontSize: 13, textDecoration: 'none' }}>Contact</Link>
          <Link to="/privacy" style={{ color: '#aaa', fontSize: 13, textDecoration: 'none' }}>Privacy Policy</Link>
        </div>
        <div className="muted small">© {new Date().getFullYear()} PriceKlick — priceklick.com • 256‑bit encryption • No data tracking</div>
      </div>
    </div>
  )
}