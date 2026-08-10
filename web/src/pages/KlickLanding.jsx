import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Download, Search, Timer, Sparkles,
  MousePointerClick, Tags, ShieldCheck, ListChecks, Store,
} from 'lucide-react'
import './KlickLanding.css'

const oldWay = [
  'Google the product, open eight tabs',
  'Compare prices by hand, lose track',
  'Hunt coupon sites for codes that expired',
  'Give up and pay full price',
]

const newWay = [
  'Klick once — PriceKlick searches for you',
  'Live prices from every provider, ranked',
  'Working codes tested and applied at checkout',
  'You pay the lowest price available',
]

const steps = [
  { icon: MousePointerClick, title: 'Klick', desc: 'Tap the PriceKlick icon instead of typing a search.' },
  { icon: Search, title: 'We search', desc: 'Prices, promos and provider ratings are pulled in seconds.' },
  { icon: Tags, title: 'You save', desc: 'The best offer and best code land in your cart automatically.' },
]

// Reconstruction of the client's <JoinPaths> dual sign-up section.
function JoinPaths({ eyebrow, heading, subheading }) {
  return (
    <section id="get-started" className="kl-section kl-joinpaths">
      <p className="kl-eyebrow kl-eyebrow-center">{eyebrow}</p>
      <h2 className="kl-h2">{heading}</h2>
      <p className="kl-sub">{subheading}</p>
      <div className="kl-join-grid">
        <div className="kl-glass-strong kl-join-card">
          <div className="kl-icon-tile"><Download className="kl-ic-lg" /></div>
          <h3 className="kl-join-title">I'm a shopper</h3>
          <p className="kl-muted">Install the free extension and klick to compare prices and auto-apply the best code at checkout.</p>
          <Link to="/install" className="kl-btn kl-btn-brand kl-btn-block">
            <Download className="kl-ic" /> Download free
          </Link>
        </div>
        <div className="kl-glass kl-join-card">
          <div className="kl-icon-tile"><Store className="kl-ic-lg" /></div>
          <h3 className="kl-join-title">I'm a vendor</h3>
          <p className="kl-muted">List your business and get discovered by shoppers who are actively comparing and ready to buy.</p>
          <Link to="/vendor" className="kl-btn kl-btn-glass kl-btn-block">
            <Store className="kl-ic" /> Sign up as a vendor
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function KlickLanding() {
  return (
    <div className="kl-landing">
      {/* Hero */}
      <section className="kl-hero">
        <div className="kl-hero-inner">
          <div className="kl-badge">
            <Timer className="kl-ic-sm kl-accent" />
            One klick instead of ten tabs
          </div>

          <h1 className="kl-h1">
            Stop Googling,
            <br />
            <span className="kl-grad">Just Klick it!</span>
          </h1>

          <p className="kl-lead">
            Searching, comparing and coupon-hunting is a job. PriceKlick does all three the moment
            you klick — then applies the best working code at checkout.
          </p>

          <div className="kl-cta-row">
            <Link to="/install" className="kl-btn kl-btn-brand">
              <Download className="kl-ic" /> Download free
            </Link>
            <Link to="/vendor" className="kl-btn kl-btn-glass">
              <Store className="kl-ic" /> Sign up as a vendor
            </Link>
          </div>
        </div>
      </section>

      {/* Sticky section nav */}
      <nav aria-label="Page sections" className="kl-secnav">
        <div className="kl-secnav-inner">
          {[
            { href: '#compare', label: 'Old way vs klick' },
            { href: '#how', label: 'How it works' },
            { href: '#get-started', label: 'Sign up' },
          ].map((l) => (
            <a key={l.href} href={l.href} className="kl-secnav-link">{l.label}</a>
          ))}
          <a href="#get-started" className="kl-secnav-cta">
            <Download className="kl-ic-sm" /> Get it free
          </a>
        </div>
      </nav>

      {/* Old vs new */}
      <section id="compare" className="kl-section kl-scroll-mt">
        <h2 className="kl-h2 kl-center">
          Googling it vs <span className="kl-grad">klicking it</span>
        </h2>
        <div className="kl-compare-grid">
          <div className="kl-glass kl-compare-card">
            <p className="kl-eyebrow">The old way</p>
            <ul className="kl-list">
              {oldWay.map((t) => (
                <li key={t} className="kl-li">
                  <span className="kl-dot" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="kl-glass-strong kl-compare-card">
            <p className="kl-eyebrow kl-accent">Just klick it</p>
            <ul className="kl-list kl-list-bright">
              {newWay.map((t) => (
                <li key={t} className="kl-li">
                  <ListChecks className="kl-ic-sm kl-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="how" className="kl-section kl-scroll-mt kl-how">
        <div className="kl-glass-strong kl-how-card">
          <p className="kl-eyebrow kl-accent kl-center">How it works</p>
          <div className="kl-steps-grid">
            {steps.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.title} className="kl-glass kl-step">
                  <div className="kl-icon-tile"><Icon className="kl-ic-lg" /></div>
                  <h3 className="kl-step-title">{s.title}</h3>
                  <p className="kl-muted">{s.desc}</p>
                </div>
              )
            })}
          </div>
          <div className="kl-cta-row kl-center-row">
            <Link to="/how-it-works" className="kl-btn kl-btn-glass">
              Watch the demo <ArrowRight className="kl-ic" />
            </Link>
          </div>
        </div>
      </section>

      {/* Dual sign-up */}
      <JoinPaths
        eyebrow="Sign up"
        heading="Download it, or list on it"
        subheading="Shoppers klick and save. Vendors get discovered by shoppers who are actively comparing."
      />

      {/* Final CTA */}
      <section className="kl-section kl-finalcta-wrap">
        <div className="kl-glass-strong kl-finalcta">
          <div className="kl-finalcta-glow" />
          <Sparkles className="kl-ic-xl kl-accent kl-center-icon" />
          <h2 className="kl-h2 kl-center">
            Don't search. <span className="kl-grad">Klick.</span>
          </h2>
          <p className="kl-sub">
            Free to install, free to use. Your next checkout could be cheaper.
          </p>
          <div className="kl-cta-row kl-center-row">
            <Link to="/install" className="kl-btn kl-btn-brand">
              <Download className="kl-ic" /> Get PriceKlick free
            </Link>
            <Link to="/how-it-works" className="kl-btn kl-btn-glass">
              Join the Klick <ArrowRight className="kl-ic" />
            </Link>
          </div>
          <p className="kl-fineprint">
            <ShieldCheck className="kl-ic-sm kl-success" /> Personalization you can opt out of anytime.
          </p>
        </div>
      </section>
    </div>
  )
}
