import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './Services.css'

const API = import.meta.env.VITE_API_URL || ''

const CATEGORIES = [
  'Auto Repair','Catering','Cleaning','Electrical','HVAC','IT Support',
  'Landscaping','Moving','Painting','Personal Training','Pest Control',
  'Photography','Plumbing','Roofing','Tutoring'
]

const PROVIDERS = [
  { id: '4f0dc22f', initial: 'A', name: 'AutoPro Garage',         cat: 'Auto Repair',        addr: '654 Motor Way',    price: 60,  rating: 4.3, reviews: 156, dist: 8.4,  city: 'Brooklyn, NY', phone: '(718) 555-0505', blurb: 'Full-service auto repair and maintenance' },
  { id: 'c59e53e6', initial: 'F', name: 'Flavor Fusion Catering', cat: 'Catering',           addr: '159 Taste Blvd',   price: 300, rating: 4.7, reviews: 72,  dist: 17.9, city: 'Queens, NY',   phone: '(718) 555-1313', blurb: 'Gourmet catering for any occasion' },
  { id: 'd38e8604', initial: 'C', name: 'Crystal Clean Co',       cat: 'Cleaning',           addr: '789 Pine Rd',      price: 50,  rating: 4.8, reviews: 215, dist: 4.2,  city: 'Brooklyn, NY', phone: '(718) 555-0303', blurb: 'Eco-friendly cleaning for homes and offices' },
  { id: '9a7770e4', initial: 'B', name: 'Bright Spark Electric',  cat: 'Electrical',         addr: '456 Oak Ave',      price: 100, rating: 4.5, reviews: 89,  dist: 17.9, city: 'New York, NY', phone: '(212) 555-0202', blurb: 'Licensed electricians for residential & commercial' },
  { id: '4c5aed01', initial: 'C', name: 'Cool Breeze HVAC',       cat: 'HVAC',               addr: '147 Cool St',      price: 120, rating: 4.4, reviews: 73,  dist: 5.0,  city: 'New York, NY', phone: '(212) 555-0707', blurb: 'Heating and cooling experts' },
  { id: '5975ea1f', initial: 'T', name: 'TechFix IT Support',     cat: 'IT Support',         addr: '468 Byte Rd',      price: 75,  rating: 4.4, reviews: 104, dist: 4.2,  city: 'Brooklyn, NY', phone: '(718) 555-1515', blurb: 'Fast and reliable IT solutions' },
  { id: 'f1b3cdf7', initial: 'G', name: 'Green Thumb Landscaping',cat: 'Landscaping',        addr: '987 Garden Ln',    price: 80,  rating: 4.6, reviews: 92,  dist: 5.1,  city: 'New York, NY', phone: '(212) 555-0606', blurb: 'Beautiful lawns and gardens since 2010' },
  { id: '7c003a97', initial: 'S', name: 'Swift Movers',           cat: 'Moving',             addr: '369 Transit Ave',  price: 150, rating: 4.2, reviews: 134, dist: 6.5,  city: 'Brooklyn, NY', phone: '(718) 555-0909', blurb: 'Stress-free moving, local and long-distance' },
  { id: '83154774', initial: 'P', name: 'Perfect Coat Painters',  cat: 'Painting',           addr: '258 Color Blvd',   price: 200, rating: 4.7, reviews: 48,  dist: 17.9, city: 'Queens, NY',   phone: '(718) 555-0808', blurb: 'Premium painting services' },
  { id: '781f8119', initial: 'F', name: 'FitLife Personal Training',cat: 'Personal Training',addr: '357 Muscle St',    price: 50,  rating: 4.9, reviews: 186, dist: 0.0,  city: 'New York, NY', phone: '(212) 555-1414', blurb: 'Certified personal trainers' },
  { id: 'ddbbac4b', initial: 'S', name: 'Shield Pest Control',    cat: 'Pest Control',       addr: '741 Guard St',     price: 100, rating: 4.5, reviews: 61,  dist: 0.0,  city: 'New York, NY', phone: '(212) 555-1010', blurb: 'Safe and effective pest elimination' },
  { id: '9b508c37', initial: 'C', name: 'Capture Moments Photography',cat: 'Photography',    addr: '963 Lens Ave',     price: 200, rating: 4.8, reviews: 95,  dist: 5.3,  city: 'New York, NY', phone: '(212) 555-1212', blurb: 'Professional event and portrait photography' },
  { id: '10a562da', initial: 'Q', name: 'Quick Fix Plumbing',     cat: 'Plumbing',           addr: '123 Main St',      price: 75,  rating: 4.7, reviews: 128, dist: 0.0,  city: 'New York, NY', phone: '(212) 555-0101', blurb: 'Emergency plumbing services available 24/7' },
  { id: 'd0085adf', initial: 'T', name: 'TopRoof Solutions',      cat: 'Roofing',            addr: '852 High Rd',      price: 500, rating: 4.6, reviews: 38,  dist: 5.1,  city: 'New York, NY', phone: '(212) 555-1111', blurb: 'Certified roofing contractors' },
  { id: '07b5ab99', initial: 'M', name: 'MathWiz Tutoring',       cat: 'Tutoring',           addr: '321 Elm St',       price: 40,  rating: 4.9, reviews: 67,  dist: 5.3,  city: 'New York, NY', phone: '(212) 555-0404', blurb: 'Expert math and science tutoring K-12' },
]

const TRENDING = ['Plumber','Tutor','Electrician','House cleaner','Dog walker','Massage','Mechanic']

function Stars({ r }) {
  return (
    <span className="sv-stars" aria-label={`Rating ${r}`}>
      <span className="sv-star">★</span>
      <span>{r.toFixed(1)}</span>
    </span>
  )
}

function PreferredCard({ p }) {
  return (
    <div className="sv-pref-card">
      <div className="sv-pref-badge">PREFERRED</div>
      <div className="sv-pref-head">
        <div className="sv-avatar">{p.initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sv-pref-name">{p.name}</div>
          <div className="sv-pref-addr">{p.addr}</div>
        </div>
      </div>
      <div className="sv-pref-meta">
        <span className="sv-price">${p.price}</span>
        <Stars r={p.rating} />
        <span className="sv-reviews">({p.reviews})</span>
        <span className="sv-verified">✓ VERIFIED</span>
      </div>
      <p className="sv-pref-blurb">{p.blurb}</p>
    </div>
  )
}

function ProviderRow({ p }) {
  return (
    <div className="sv-row">
      <div className="sv-row-left">
        <div className="sv-avatar lg">{p.initial}</div>
        <div className="sv-row-body">
          <div className="sv-row-name">{p.name} <span className="sv-row-cat">{p.cat}</span></div>
          <div className="sv-row-blurb">{p.blurb}</div>
          <div className="sv-row-meta">
            <Stars r={p.rating} />
            <span className="sv-reviews">({p.reviews})</span>
            <span className="sv-dist">{p.dist.toFixed(1)} km</span>
            <span className="sv-from">from ${p.price}</span>
          </div>
          <div className="sv-row-city">{p.city}</div>
        </div>
      </div>
      <div className="sv-row-actions">
        <Link to={`#`} className="sv-btn primary">View &amp; Buy</Link>
        <a href={`tel:${p.phone}`} className="sv-btn ghost">📞 Call</a>
      </div>
    </div>
  )
}

export default function Services() {
  const [cat, setCat] = useState('All')
  const [view, setView] = useState('list')

  const filtered = useMemo(() => {
    if (cat === 'All') return PROVIDERS
    return PROVIDERS.filter(p => p.cat === cat)
  }, [cat])

  const sortedByRating = useMemo(() => [...filtered].sort((a,b) => b.rating - a.rating), [filtered])
  const preferredByCat = useMemo(() => {
    const map = {}
    PROVIDERS.forEach(p => { if (!map[p.cat]) map[p.cat] = p })
    return map
  }, [])

  return (
    <div className="sv-page">
      <div className="sv-bg" />

      <section className="container sv-hero">
        <div className="sv-kicker">✦ Local Services Marketplace</div>
        <h1 className="sv-title">
          <span>Scroll less,</span>
          <span className="sv-title-grad">save more.</span>
        </h1>
        <p className="sv-sub">
          Discover trusted local pros for every job — vetted by neighbours, priced fairly,
          and ready to book in a click.
        </p>

        <div className="sv-chips">
          <button className={`sv-chip ${cat==='All' ? 'active' : ''}`} onClick={()=>setCat('All')}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} className={`sv-chip ${cat===c ? 'active' : ''}`} onClick={()=>setCat(c)}>{c}</button>
          ))}
        </div>

        <div className="sv-controls">
          <div className="sv-control-group">
            <button className="sv-control active">📍 Near me</button>
            <button className="sv-control">Within 25 km</button>
          </div>
          <div className="sv-control-group">
            <button className={`sv-control ${view==='list' ? 'active' : ''}`} onClick={()=>setView('list')}>📋 List</button>
            <button className={`sv-control ${view==='map' ? 'active' : ''}`} onClick={()=>setView('map')}>🗺 Map</button>
          </div>
        </div>
      </section>

      <section className="container sv-section sv-vendor-cta-section">
        <div className="sv-vendor-cta-grid">
          <div className="sv-vendor-cta-card primary">
            <span className="sv-tag-mini">✦ FOR SERVICE PROS</span>
            <h2>Vendor Registration</h2>
            <p>Join the PriceKlick Preferred network. Reach thousands of local customers actively searching for your services — free to list, pay only when you win the job.</p>
            <ul className="sv-vendor-bullets">
              <li>✓ Free profile + verified badge</li>
              <li>✓ Show up in category search instantly</li>
              <li>✓ Direct messaging &amp; booking inbox</li>
            </ul>
            <Link to="/register?role=vendor" className="sv-btn primary block">Register as a vendor →</Link>
          </div>

          <div className="sv-vendor-cta-card accent">
            <span className="sv-tag-mini">✦ BOOST VISIBILITY</span>
            <h2>Promote My Listing</h2>
            <p>Already a vendor? Climb to the top of category results, get featured in "Preferred Vendors", and unlock priority badges for high-intent buyers.</p>
            <ul className="sv-vendor-bullets">
              <li>★ Top-of-list placement</li>
              <li>★ Featured in PREFERRED carousel</li>
              <li>★ Priority highlight on map view</li>
            </ul>
            <Link to="/dashboard?tab=promote" className="sv-btn ghost block">Promote my listing →</Link>
          </div>
        </div>
      </section>

      <section className="container sv-section">
        <div className="sv-section-head">
          <span className="sv-tag">✦ TRUSTED PARTNERS</span>
          <h2>PriceKlick Preferred Vendors</h2>
          <p>Top-rated, verified service providers hand-picked for quality and value in every industry.</p>
        </div>

        <div className="sv-pref-grid">
          {CATEGORIES.map(c => (
            <div key={c} className="sv-pref-col">
              <div className="sv-pref-cat">{c}</div>
              {preferredByCat[c] && <PreferredCard p={preferredByCat[c]} />}
            </div>
          ))}
        </div>
      </section>

      <section className="container sv-section sv-providers">
        <div className="sv-providers-grid">
          <div>
            <div className="sv-providers-head">
              <h2>All Providers</h2>
              <span className="sv-count">{filtered.length} providers found within 25 km</span>
            </div>
            <div className="sv-rows">
              {sortedByRating.map(p => <ProviderRow key={p.id} p={p} />)}
            </div>
          </div>
          <aside className="sv-side">
            <div className="sv-side-card sv-deal">
              <div className="sv-tag-mini">DEAL OF THE DAY</div>
              <div className="sv-deal-row">
                <Stars r={4.3} />
              </div>
              <div className="sv-deal-name">
                <div className="sv-avatar">A</div>
                <div>
                  <div className="sv-pref-name">AutoPro Garage</div>
                  <div className="sv-pref-addr">Auto Repair</div>
                </div>
              </div>
              <div className="sv-deal-foot">
                <span className="sv-from">from $60</span>
                <span className="sv-verified">✓ Verified</span>
              </div>
            </div>

            <div className="sv-side-card">
              <div className="sv-tag-mini">QUICK FILTERS</div>
              <div className="sv-filter-row">
                <input type="checkbox" id="f1" defaultChecked />
                <label htmlFor="f1">Verified only</label>
              </div>
              <div className="sv-filter-row">
                <input type="checkbox" id="f2" />
                <label htmlFor="f2">Open now</label>
              </div>
              <div className="sv-filter-row">
                <input type="checkbox" id="f3" />
                <label htmlFor="f3">Rated 4.5+</label>
              </div>
              <div className="sv-filter-row">
                <input type="checkbox" id="f4" />
                <label htmlFor="f4">Within 5 km</label>
              </div>
            </div>

            <div className="sv-side-card">
              <div className="sv-tag-mini">TRENDING NEAR YOU</div>
              <div className="sv-trending">
                {TRENDING.map(t => <span key={t} className="sv-trend">{t}</span>)}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
