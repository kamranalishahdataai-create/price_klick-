import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, Store, UserPlus, BadgeCheck } from 'lucide-react'

/**
 * Dual sign-up / download paths: one for shoppers (members), one for vendors.
 * Shared across the landing pages so both audiences always have an entry point.
 * Links map to this app's real routes:
 *   members → /install, /register (create account / membership), /login
 *   vendors → /vendor (set-up page), /network, /vendor-login
 */
export default function JoinPaths({
  eyebrow = 'Get started',
  heading = 'Two ways to join PriceKlick',
  subheading = 'Shoppers download the extension and save at checkout. Vendors list their services and promote them to our member base.',
}) {
  return (
    <section id="get-started" className="kl-section kl-joinpaths">
      <div className="kl-jp-head">
        <p className="kl-eyebrow kl-accent">{eyebrow}</p>
        <h2 className="kl-h2 kl-mt-sm">{heading}</h2>
        <p className="kl-sub">{subheading}</p>
      </div>

      <div className="kl-jp-grid">
        {/* Members */}
        <div className="kl-glass-strong kl-jp-card">
          <div className="kl-icon-tile"><Download className="kl-ic-lg" /></div>
          <h3 className="kl-jp-title">For shoppers &amp; members</h3>
          <p className="kl-muted kl-jp-desc">
            Install the free extension, then create a member account to unlock deal drops, saved
            preferences and synced savings.
          </p>
          <ul className="kl-jp-list">
            {['Automatic coupons at checkout', 'Member-only deal drops', 'Free forever — no card required'].map((t) => (
              <li key={t} className="kl-jp-li"><BadgeCheck className="kl-ic-sm kl-success" /> {t}</li>
            ))}
          </ul>
          <div className="kl-jp-actions">
            <Link to="/install" className="kl-btn kl-btn-brand"><Download className="kl-ic-sm" /> Download free</Link>
            <Link to="/register" className="kl-btn kl-btn-glass"><UserPlus className="kl-ic-sm" /> Create account</Link>
          </div>
          <p className="kl-jp-alt">Already a member? <Link to="/login" className="kl-link">Sign in</Link></p>
        </div>

        {/* Vendors */}
        <div className="kl-glass-strong kl-jp-card">
          <div className="kl-icon-tile"><Store className="kl-ic-lg" /></div>
          <h3 className="kl-jp-title">For vendors &amp; businesses</h3>
          <p className="kl-muted kl-jp-desc">
            Join the PriceKlick Network, build your branded service page, and push promotions
            straight to shoppers who are already comparing prices.
          </p>
          <ul className="kl-jp-list">
            {['Your own page inside our ecosystem', 'Promote offers to active buyers', 'Listings appear in Smart Compare'].map((t) => (
              <li key={t} className="kl-jp-li"><BadgeCheck className="kl-ic-sm kl-success" /> {t}</li>
            ))}
          </ul>
          <div className="kl-jp-actions">
            <Link to="/vendor" className="kl-btn kl-btn-brand"><Store className="kl-ic-sm" /> Sign up as a vendor</Link>
            <Link to="/network" className="kl-btn kl-btn-glass">Learn about the Network <ArrowRight className="kl-ic-sm" /></Link>
          </div>
          <p className="kl-jp-alt">Existing vendor? <Link to="/vendor-login" className="kl-link">Vendor sign in</Link></p>
        </div>
      </div>
    </section>
  )
}
