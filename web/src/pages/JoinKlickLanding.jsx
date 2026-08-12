import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Sparkles, Zap, ShieldCheck, Users, Tags,
  BadgeCheck, Download, Heart, MessageCircle, Gift,
} from 'lucide-react'
import JoinPaths from '../components/JoinPaths'
import './KlickLanding.css'

const perks = [
  { icon: Zap, title: 'Instant savings', desc: 'Codes are found, tested and stacked at checkout in under three seconds.' },
  { icon: Gift, title: 'Member deal drops', desc: 'Community-surfaced offers that never make it onto public coupon sites.' },
  { icon: ShieldCheck, title: 'Catered to you — your choice', desc: 'We use your shopping activity to tailor deals and recommendations. You can opt out anytime.' },
  { icon: MessageCircle, title: 'A real community', desc: 'Members share wins, flag dead codes and keep every deal honest.' },
]

const steps = [
  { n: '1', title: 'Add the extension', desc: 'One click on Chrome, Edge, Firefox or Safari.' },
  { n: '2', title: 'Shop like normal', desc: 'PriceKlick wakes up the moment you hit a checkout.' },
  { n: '3', title: 'Klick and save', desc: 'The best working code lands in your cart automatically.' },
]

const liveCodes = [
  { code: 'SAVE20', note: '20% off · applied' },
  { code: 'FREESHIP2025', note: 'Free shipping · applied' },
  { code: 'WELCOME15', note: '15% off · applied' },
  { code: 'BUNDLE25', note: '$25 off bundle · applied' },
]

const faqs = [
  { q: 'Does it cost anything?', a: 'No. PriceKlick is free to install and free to use, with no paid tier for members.' },
  { q: 'Do I need an account?', a: 'Not to save money. An account only unlocks member deal drops and saved preferences.' },
  { q: 'Can I turn off personalization?', a: 'Yes — switch it off in member settings at any time. Coupons still apply at checkout.' },
  { q: 'Which browsers work?', a: 'Chrome, Edge, Firefox and Safari.' },
]

export default function JoinKlickLanding() {
  return (
    <div className="kl-landing">
      {/* Hero */}
      <section className="kl-hero">
        <div className="kl-hero-inner">
          <div className="kl-badge">
            <Sparkles className="kl-ic-sm kl-accent" />
            Free forever · No sign-up required
          </div>

          <h1 className="kl-h1 kl-h1-xl">
            Join the <span className="kl-grad">Klick!</span>
          </h1>

          <p className="kl-lead">
            One klick is all it takes. Shoppers who join stop hunting for coupon codes forever —
            PriceKlick does the searching, testing and stacking while you check out.
          </p>

          <div className="kl-cta-row">
            <Link to="/install" className="kl-btn kl-btn-brand">
              <Download className="kl-ic" /> Add to browser — Free
            </Link>
            <Link to="/demo" className="kl-btn kl-btn-glass">
              Watch it work <ArrowRight className="kl-ic" />
            </Link>
          </div>

          <div className="kl-trust-row">
            <span className="kl-chip"><BadgeCheck className="kl-ic-sm kl-success" /> 100% free</span>
            <span className="kl-chip"><ShieldCheck className="kl-ic-sm kl-success" /> Personalization you can opt out of</span>
            <span className="kl-chip"><Zap className="kl-ic-sm kl-accent" /> Works at checkout</span>
          </div>
        </div>
      </section>

      {/* Section nav */}
      <nav aria-label="Page sections" className="kl-secnav">
        <div className="kl-secnav-inner">
          {[
            { href: '#perks', label: 'Why join' },
            { href: '#how-it-works', label: 'How it works' },
            { href: '#community', label: 'Community' },
            { href: '#privacy', label: 'Your data' },
          ].map((l) => (
            <a key={l.href} href={l.href} className="kl-secnav-link">{l.label}</a>
          ))}
          <Link to="/install" className="kl-secnav-cta"><Download className="kl-ic-sm" /> Get it free</Link>
        </div>
      </nav>

      {/* Perks */}
      <section id="perks" className="kl-section kl-scroll-mt">
        <p className="kl-eyebrow kl-accent kl-center">Why join</p>
        <h2 className="kl-h2 kl-center kl-mt-sm">What you get when you klick</h2>
        <div className="kl-perks-grid">
          {perks.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.title} className="kl-glass-strong kl-perk">
                <div className="kl-icon-tile"><Icon className="kl-ic-lg" /></div>
                <h3 className="kl-step-title">{p.title}</h3>
                <p className="kl-muted">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Steps */}
      <section id="how-it-works" className="kl-section kl-scroll-mt kl-how">
        <div className="kl-glass-strong kl-how-card">
          <p className="kl-eyebrow kl-accent kl-center">Three klicks to save</p>
          <div className="kl-steps-grid kl-steps-numbered">
            {steps.map((s) => (
              <div key={s.n} className="kl-glass kl-step kl-step-num-card">
                <span className="kl-step-num">{s.n}</span>
                <h3 className="kl-step-title">{s.title}</h3>
                <p className="kl-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section id="community" className="kl-section kl-scroll-mt kl-community">
        <div className="kl-community-left">
          <div className="kl-badge"><Users className="kl-ic-sm kl-accent" /> The community</div>
          <h2 className="kl-h2 kl-mt-sm">
            Savings are better <span className="kl-grad">together</span>
          </h2>
          <p className="kl-muted kl-mt-sm">
            Every klick teaches PriceKlick which codes actually work. Members flag expired offers,
            share the ones that land, and the whole community checks out cheaper because of it.
          </p>
          <div className="kl-cta-row">
            <Link to="/register" className="kl-btn kl-btn-brand">
              Join the Klick <ArrowRight className="kl-ic" />
            </Link>
            <Link to="/vendor" className="kl-btn kl-btn-glass">I'm a vendor</Link>
          </div>
        </div>

        <div className="kl-glass-strong kl-community-card">
          <div className="kl-community-head">
            <div className="kl-icon-tile kl-icon-tile-sm"><Sparkles className="kl-ic" /></div>
            <div>
              <p className="kl-community-title">Live from the community</p>
              <p className="kl-muted kl-xs">Codes klicked in the last hour</p>
            </div>
          </div>
          <div className="kl-code-list">
            {liveCodes.map((c) => (
              <div key={c.code} className="kl-code-row">
                <span className="kl-code"><Tags className="kl-ic-sm kl-success" /> {c.code}</span>
                <span className="kl-code-note">{c.note}</span>
              </div>
            ))}
          </div>
          <p className="kl-muted kl-xs kl-community-foot">
            <Heart className="kl-ic-sm kl-accent" /> Shared by members, verified automatically.
          </p>
        </div>
      </section>

      {/* Data transparency */}
      <section id="privacy" className="kl-section kl-scroll-mt kl-data-wrap">
        <div className="kl-glass-strong kl-data-card">
          <div className="kl-badge"><ShieldCheck className="kl-ic-sm kl-accent" /> How we use your data</div>
          <h2 className="kl-h2 kl-mt-sm">
            Plain language, <span className="kl-grad">no fine print</span>
          </h2>
          <div className="kl-data-body">
            <p><span className="kl-strong">We do track your shopping activity.</span> Stores you visit, carts, and the codes you klick are used to find better prices and to build deals and recommendations catered to you.</p>
            <p><span className="kl-strong">You can opt out at any time.</span> Personalization can be switched off in your member settings — PriceKlick still applies coupons at checkout, it just stops tailoring offers to you.</p>
            <p><span className="kl-strong">We may share or sell aggregated and de-identified shopping data to partners.</span> This is how the extension stays free. Opting out of personalization also opts you out of this sharing, and you can request deletion of your data whenever you want.</p>
          </div>
          <p className="kl-muted kl-xs kl-mt-sm">
            This page is maintained by PriceKlick to answer common privacy questions. It summarizes our
            practices and is not a certification or legal advice — please confirm the exact wording with
            your privacy policy before launch.
          </p>
        </div>
      </section>

      {/* Dual sign-up */}
      <JoinPaths />

      {/* FAQ */}
      <section className="kl-section kl-faq-wrap">
        <h2 className="kl-h2 kl-center">Common questions</h2>
        <div className="kl-faq">
          {faqs.map((f) => (
            <details key={f.q} className="kl-glass kl-faq-item">
              <summary className="kl-faq-summary">
                {f.q}
                <ArrowRight className="kl-ic kl-accent kl-faq-chevron" />
              </summary>
              <p className="kl-muted kl-faq-answer">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section id="start" className="kl-section kl-scroll-mt kl-finalcta-wrap">
        <div className="kl-glass-strong kl-finalcta">
          <div className="kl-finalcta-glow" />
          <h2 className="kl-h2 kl-center">
            Ready? <span className="kl-grad">Join the Klick!</span>
          </h2>
          <p className="kl-sub">Free to install, free to use, free forever. Your next checkout could be cheaper.</p>
          <div className="kl-cta-row kl-center-row">
            <Link to="/install" className="kl-btn kl-btn-brand">
              <Download className="kl-ic" /> Get PriceKlick free
            </Link>
            <Link to="/services" className="kl-btn kl-btn-glass">
              Browse services <ArrowRight className="kl-ic" />
            </Link>
          </div>
          <p className="kl-fineprint">
            Are you a business? <Link to="/network" className="kl-link">Join the PriceKlick Network</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
