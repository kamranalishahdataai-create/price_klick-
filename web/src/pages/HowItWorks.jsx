import React from 'react'
import { Link } from 'react-router-dom'
import HeroCTA from '../components/HeroCTA.jsx'
import Section from '../components/Section.jsx'
import Steps from '../components/Steps.jsx'

const features = [
  { icon: '🔍', title: 'AI Promo Lens', desc: 'Upload any product photo or promotional screenshot. Our AI identifies the exact product, brand, and model — then finds the real product page online.', link: '/lens', linkText: 'Try Lens →' },
  { icon: '🏷️', title: 'Auto Coupon Apply', desc: 'At checkout, PriceKlick automatically scans for working coupon codes and applies the one that saves you the most.' },
  { icon: '💰', title: 'Price Comparison', desc: 'See prices for the same product across multiple stores. We search Amazon, Walmart, Target, Best Buy, and more in real time.' },
  { icon: '🛒', title: 'Auto Add-to-Cart', desc: 'When Lens finds an exact product match, it opens the store page and adds the item to your cart automatically.' },
  { icon: '🔔', title: 'Price Drop Alerts', desc: 'Save products to your wishlist and get notified when prices drop at any retailer.' },
  { icon: '🔒', title: 'Private & Secure', desc: 'We don\'t track your browsing. Images are analyzed in real-time and never stored. 256-bit encryption on all data.' }
]

const useCases = [
  { emoji: '📱', title: 'See a product on social media?', desc: 'Screenshot it → upload to Lens → get taken directly to the product page to buy it.' },
  { emoji: '📰', title: 'Got a store flyer in the mail?', desc: 'Snap a photo → Lens extracts the deal, brand, and discount → redirects you to the exact online offer.' },
  { emoji: '🛍️', title: 'Shopping on Amazon?', desc: 'PriceKlick automatically checks if there\'s a cheaper price at Walmart, Target, or other stores.' },
  { emoji: '💳', title: 'Ready to checkout?', desc: 'The extension auto-tests every available coupon code and applies the best one before you pay.' }
]

export default function HowItWorks(){
  return (
    <div>
      <HeroCTA title="How PriceKlick Works" subtitle="Three simple steps to start saving on every purchase"/>
      <Section>
        <Steps/>
      </Section>

      {/* Features grid */}
      <Section>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Powerful Features</h2>
        <p style={{ textAlign: 'center', color: '#6a6880', marginBottom: 36 }}>Everything you need to save money while shopping online.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px #0000000a' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ color: '#6a6880', fontSize: 14, lineHeight: 1.6, marginBottom: f.link ? 10 : 0 }}>{f.desc}</p>
              {f.link && <Link to={f.link} style={{ color: '#6D4AFF', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{f.linkText}</Link>}
            </div>
          ))}
        </div>
      </Section>

      {/* Use cases */}
      <Section>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Real-World Use Cases</h2>
        <p style={{ textAlign: 'center', color: '#6a6880', marginBottom: 36 }}>Here's how people use PriceKlick every day.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {useCases.map((u, i) => (
            <div key={i} style={{ background: 'linear-gradient(135deg, #f8f6ff 0%, #fff 100%)', border: '1px solid #ece8ff', borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{u.emoji}</div>
              <h4 style={{ fontWeight: 700, marginBottom: 6 }}>{u.title}</h4>
              <p style={{ color: '#6a6880', fontSize: 14, lineHeight: 1.6 }}>{u.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA to Lens */}
      <Section>
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'linear-gradient(135deg, #6D4AFF 0%, #4285F4 100%)', borderRadius: 24, color: '#fff' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Try Promo Lens Now</h2>
          <p style={{ opacity: 0.9, marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>Upload any product photo and our AI will find exactly where to buy it at the best price.</p>
          <Link to="/lens" style={{ display: 'inline-block', padding: '14px 36px', background: '#fff', color: '#6D4AFF', borderRadius: 12, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
            🔍 Try Lens for Free
          </Link>
        </div>
      </Section>
    </div>
  )
}