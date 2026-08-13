import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchServices, enrichProvider, trackProviderClick, resolveUserLocation, getSpendingPatterns, trackActivity, findServiceDeals, getProviderMenu } from '../api/services'
import ServiceMap from '../components/ServiceMap'
import './Services.css'

// ── Category taxonomy (two levels: broad category → subcategories) ─────────────
// Every broad category that has natural subdivisions carries a `subs` array, so
// e.g. Auto Repair → Tires / Oil Change, Restaurants → Burgers / Pizza, etc.
const CATEGORY_GROUPS = [
  { id: 'food', icon: '🍽️', label: 'Food & Dining', items: [
    { name: 'Restaurants', subs: ['Burgers','Pizza','Sushi','Italian','Chinese','Mexican','Indian','Thai','Steakhouse','Seafood','Vegan','BBQ','Breakfast','Fast Food'] },
    { name: 'Coffee & Tea', subs: ['Cafés','Espresso Bars','Bubble Tea','Juice Bars'] },
    { name: 'Bakeries', subs: ['Cakes','Pastries','Bread','Donuts','Cupcakes'] },
    { name: 'Bars', subs: ['Sports Bars','Wine Bars','Pubs','Cocktail Bars','Breweries'] },
    { name: 'Catering', subs: ['Wedding Catering','Corporate Catering','Event Catering','Drop-off Catering'] },
    { name: 'Food Trucks' },
    { name: 'Meal Prep' },
  ]},
  { id: 'home', icon: '🏠', label: 'Home Services', items: [
    { name: 'Plumbing', subs: ['Leak Repair','Drain Cleaning','Water Heater','Toilet Repair','Pipe Installation'] },
    { name: 'Electrical', subs: ['Wiring','Panel Upgrade','Lighting','EV Charger','Outlet Repair'] },
    { name: 'HVAC', subs: ['AC Repair','Furnace Repair','Duct Cleaning','Thermostat','Heat Pump'] },
    { name: 'House Cleaning', subs: ['Deep Cleaning','Move-out Cleaning','Recurring Cleaning','Carpet Cleaning','Window Cleaning'] },
    { name: 'Landscaping', subs: ['Lawn Care','Tree Service','Snow Removal','Garden Design','Irrigation'] },
    { name: 'Pest Control', subs: ['Rodents','Insects','Termites','Bed Bugs'] },
    { name: 'Roofing', subs: ['Roof Repair','Roof Replacement','Gutters','Shingles'] },
    { name: 'Painting', subs: ['Interior','Exterior','Cabinet Painting'] },
    { name: 'Moving', subs: ['Local Movers','Long Distance','Packing','Storage'] },
    { name: 'Handyman' },
  ]},
  { id: 'auto', icon: '🚗', label: 'Auto & Transport', items: [
    { name: 'Auto Repair', subs: ['Oil Change','Tires','Brakes','Transmission','Engine Repair','Battery','Muffler & Exhaust','Wheel Alignment','AC Repair','Diagnostics'] },
    { name: 'Car Wash', subs: ['Hand Wash','Auto Detailing','Interior Cleaning','Ceramic Coating'] },
    { name: 'Body Shop', subs: ['Collision Repair','Dent Removal','Auto Painting','Windshield'] },
    { name: 'Tire Shop', subs: ['New Tires','Tire Rotation','Wheel Alignment','Flat Repair'] },
    { name: 'Towing' },
    { name: 'Mechanics' },
  ]},
  { id: 'health', icon: '🏥', label: 'Health & Medical', items: [
    { name: 'Doctors', subs: ['Family Doctor','Walk-in Clinic','Pediatrician','Dermatologist','Cardiologist'] },
    { name: 'Dentists', subs: ['Cleaning','Braces','Implants','Whitening','Emergency Dentist'] },
    { name: 'Therapists', subs: ['Counseling','Physiotherapy','Occupational Therapy','Speech Therapy'] },
    { name: 'Gyms', subs: ['Fitness Center','CrossFit','Yoga Studio','Pilates','Boxing'] },
    { name: 'Massage', subs: ['Deep Tissue','Swedish','Sports Massage','Thai Massage'] },
    { name: 'Optometrists' },
    { name: 'Chiropractors' },
    { name: 'Pharmacies' },
  ]},
  { id: 'beauty', icon: '💇', label: 'Beauty & Care', items: [
    { name: 'Hair Salons', subs: ['Haircut','Coloring','Balayage','Extensions','Blowout'] },
    { name: 'Barbers', subs: ['Haircut','Beard Trim','Hot Shave','Kids Cut'] },
    { name: 'Nail Salons', subs: ['Manicure','Pedicure','Gel Nails','Acrylics'] },
    { name: 'Spas', subs: ['Facials','Body Treatments','Couples Spa','Sauna'] },
    { name: 'Makeup Artists', subs: ['Bridal','Special Event','Lessons'] },
    { name: 'Waxing' },
    { name: 'Eyelash Extensions' },
    { name: 'Tanning' },
  ]},
  { id: 'education', icon: '📚', label: 'Education', items: [
    { name: 'Tutoring', subs: ['Math','Science','English','Languages','Exam Prep'] },
    { name: 'Music Lessons', subs: ['Piano','Guitar','Violin','Singing','Drums'] },
    { name: 'Language Classes', subs: ['English (ESL)','French','Spanish','Mandarin'] },
    { name: 'Driving School' },
    { name: 'Dance Classes', subs: ['Ballet','Hip Hop','Salsa','Contemporary'] },
    { name: 'Coding Classes' },
    { name: 'Test Prep' },
    { name: 'Personal Training' },
  ]},
  { id: 'professional', icon: '💼', label: 'Professional', items: [
    { name: 'Accountants', subs: ['Tax Prep','Bookkeeping','Payroll','Audit'] },
    { name: 'Lawyers', subs: ['Family Law','Real Estate Law','Immigration','Criminal','Business Law'] },
    { name: 'IT Support', subs: ['Computer Repair','Network Setup','Data Recovery','Managed IT'] },
    { name: 'Photography', subs: ['Wedding','Portrait','Product','Real Estate','Events'] },
    { name: 'Marketing', subs: ['SEO','Social Media','Web Design','Branding'] },
    { name: 'Real Estate' },
    { name: 'Financial Advisors' },
  ]},
  { id: 'events', icon: '🎉', label: 'Events', items: [
    { name: 'Event Planning', subs: ['Weddings','Corporate','Birthdays','Conferences'] },
    { name: 'DJs', subs: ['Wedding DJ','Club DJ','Party DJ'] },
    { name: 'Venues', subs: ['Banquet Halls','Wedding Venues','Conference Rooms','Outdoor'] },
    { name: 'Florists', subs: ['Wedding Flowers','Bouquets','Event Arrangements'] },
    { name: 'Photo Booths' },
    { name: 'Entertainment' },
  ]},
  { id: 'pet', icon: '🐾', label: 'Pet Services', items: [
    { name: 'Vets', subs: ['Checkups','Vaccinations','Surgery','Emergency Vet','Dental'] },
    { name: 'Pet Grooming', subs: ['Bath & Brush','Full Groom','Nail Trim','De-shedding'] },
    { name: 'Dog Walking' },
    { name: 'Pet Boarding', subs: ['Overnight','Daycare','Cat Boarding'] },
    { name: 'Pet Training' },
  ]},
  { id: 'contractor', icon: '🔨', label: 'Contractors', items: [
    { name: 'General Contractors', subs: ['Home Additions','Renovations','New Builds'] },
    { name: 'Flooring', subs: ['Hardwood','Tile','Laminate','Carpet','Vinyl'] },
    { name: 'Carpentry', subs: ['Custom Cabinets','Trim & Molding','Decks','Framing'] },
    { name: 'Remodeling', subs: ['Kitchen','Bathroom','Basement'] },
    { name: 'Masonry', subs: ['Brick','Stone','Concrete','Pavers'] },
    { name: 'Drywall' },
    { name: 'Windows & Doors' },
  ]},
  { id: 'hospitality', icon: '🏨', label: 'Hospitality', items: [
    { name: 'Hotels', subs: ['Luxury','Budget','Boutique','Business'] },
    { name: 'Bed & Breakfast' },
    { name: 'Vacation Rentals' },
    { name: 'Resorts' },
    { name: 'Motels' },
    { name: 'Hostels' },
  ]},
  { id: 'childcare', icon: '👶', label: 'Child & Family', items: [
    { name: 'Childcare', subs: ['Infant Care','Toddler Care','After School'] },
    { name: 'Daycare' },
    { name: 'Nannies' },
    { name: 'Kids Activities', subs: ['Sports','Art Classes','Camps'] },
    { name: 'Family Counseling' },
    { name: 'Pediatrics' },
  ]},
]

const TRENDING = ['Plumber','Electrician','House Cleaner','Restaurant','Mechanic','Personal Trainer','Dog Walker','Tutor','Hair Salon','Massage']

// ── Pre Pay AI — localStorage pattern tracking ─────────────
const PREPAY_KEY = 'pk_search_history'

function trackSearch(category) {
  try {
    const h = JSON.parse(localStorage.getItem(PREPAY_KEY) || '[]')
    h.push({ category, ts: Date.now() })
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000
    localStorage.setItem(PREPAY_KEY, JSON.stringify(h.filter(x => x.ts > cutoff).slice(-100)))
  } catch (_) {}
}

function getPrePayRecs() {
  try {
    const h = JSON.parse(localStorage.getItem(PREPAY_KEY) || '[]')
    const counts = {}
    h.forEach(x => { counts[x.category] = (counts[x.category] || 0) + 1 })
    return Object.entries(counts)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }))
  } catch (_) { return [] }
}

// ── Helpers ────────────────────────────────────────────────
function Stars({ r }) {
  return (
    <span className="sv-stars" aria-label={`${r} stars`}>
      <span className="sv-star">★</span>
      <span>{Number(r).toFixed(1)}</span>
    </span>
  )
}

function initialOf(p) { return (p.name || '?').trim().charAt(0).toUpperCase() }
function shortAddr(p) { return p.address || p.addr || p.city || '' }
function priceLabel(p) {
  if (p.priceValue) return `from $${p.priceValue}`
  if (p.price && typeof p.price === 'string') return p.price
  if (p.price) return `$${p.price}`
  return ''
}
function distLabel(p) {
  if (typeof p.distanceKm === 'number') return `${p.distanceKm.toFixed(1)} km`
  if (typeof p.dist === 'number') return `${p.dist.toFixed(1)} km`
  return ''
}

// ── Category group browser (two-level: group → category → subcategory) ────────
function CategoryGroupGrid({ selectedCat, selectedSub, onSelectCat, onSelectSub }) {
  const selectedGroup = CATEGORY_GROUPS.find(g => g.items.some(it => it.name === selectedCat))
  const [expanded, setExpanded] = useState(selectedGroup?.id || null)

  useEffect(() => {
    if (selectedGroup) setExpanded(selectedGroup.id)
  }, [selectedCat])

  const activeGroup = CATEGORY_GROUPS.find(g => g.id === expanded)
  const activeItem = activeGroup?.items.find(it => it.name === selectedCat)

  return (
    <div className="sv-cat-groups">
      <div className="sv-cat-group-row">
        {CATEGORY_GROUPS.map(grp => (
          <button
            key={grp.id}
            className={`sv-cat-group-btn ${expanded === grp.id ? 'active' : ''} ${grp.items.some(it => it.name === selectedCat) ? 'has-sel' : ''}`}
            onClick={() => setExpanded(expanded === grp.id ? null : grp.id)}
          >
            <span className="sv-cat-group-icon">{grp.icon}</span>
            <span className="sv-cat-group-label">{grp.label}</span>
          </button>
        ))}
      </div>

      {/* Level 2 — broad categories */}
      {activeGroup && (
        <div className="sv-cat-items">
          {activeGroup.items.map(item => (
            <button
              key={item.name}
              className={`sv-chip ${selectedCat === item.name ? 'active' : ''}`}
              onClick={() => onSelectCat(item.name === selectedCat ? null : item.name)}
            >
              {item.name}
              {item.subs?.length ? <span className="sv-chip-caret"> ▾</span> : null}
            </button>
          ))}
        </div>
      )}

      {/* Level 3 — subcategories of the selected broad category */}
      {activeItem?.subs?.length > 0 && (
        <div className="sv-subcat-row">
          <span className="sv-subcat-lbl">{activeItem.name}:</span>
          {activeItem.subs.map(sub => (
            <button
              key={sub}
              className={`sv-subchip ${selectedSub === sub ? 'active' : ''}`}
              onClick={() => onSelectSub(sub === selectedSub ? null : sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Provider card ──────────────────────────────────────────
function ProviderCard({ p, onEnrich, enriching, onScrape, scraping, compareSet, onToggleCompare, deal, budget }) {
  const key = p.placeId || p.name
  const inCompare = compareSet.has(key)
  const canAdd = inCompare || compareSet.size < 3
  const phoneHref = p.phone ? `tel:${String(p.phone).replace(/[^\d+]/g, '')}` : null
  const mapsHref = p.mapsUrl || (p.lat && p.lng
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || '')}`)
  const isEnriching = enriching === key
  const isScraping = scraping === key
  return (
    <div className={`sv-card ${inCompare ? 'sv-card-selected' : ''} ${deal ? 'sv-card-deal' : ''}`}>
      {deal && (
        <div className="sv-deal-ribbon">
          <span className="sv-deal-ribbon-tag">🎉 DEAL{deal.price ? ` · ${deal.price}` : ''}</span>
          <span className="sv-deal-ribbon-text">
            {deal.title || 'Special offer'}{budget ? ` — under your $${budget} budget` : ''}
          </span>
          {deal.url && (
            <a className="sv-deal-ribbon-link" href={deal.url} target="_blank" rel="noopener noreferrer">View deal →</a>
          )}
        </div>
      )}
      <div className="sv-card-left">
        {p.thumbnail
          ? <img className="sv-avatar lg img" src={p.thumbnail} alt="" />
          : <div className="sv-avatar lg">{initialOf(p)}</div>}
        <div className="sv-card-body">
          <div className="sv-card-name">
            {p.name}
            {p.category && <span className="sv-row-cat">{p.category}</span>}
          </div>
          {(p.description || p.blurb) && (
            <div className="sv-card-blurb">{p.description || p.blurb}</div>
          )}
          <div className="sv-card-meta">
            {p.rating != null && <Stars r={p.rating} />}
            {p.reviewsCount != null && <span className="sv-reviews">({p.reviewsCount.toLocaleString()})</span>}
            {distLabel(p) && <span className="sv-dist">📍 {distLabel(p)}</span>}
            {priceLabel(p) && <span className="sv-from">{priceLabel(p)}</span>}
          </div>
          {shortAddr(p) && <div className="sv-card-city">{shortAddr(p)}</div>}
        </div>
      </div>
      <div className="sv-card-actions">
        <button
          className={`sv-compare-toggle ${inCompare ? 'active' : ''} ${!canAdd ? 'sv-compare-toggle-disabled' : ''}`}
          onClick={() => canAdd && onToggleCompare(p)}
          title={inCompare ? 'Remove from comparison' : compareSet.size >= 3 ? 'Max 3 providers' : 'Add to comparison'}
        >
          {inCompare ? '✓ Comparing' : '⊕ Compare'}
        </button>
        <div className="sv-card-btns">
          {p.website
            ? <a href={p.website} target="_blank" rel="noopener noreferrer"
                 onClick={() => trackProviderClick({ placeId: p.placeId, name: p.name, category: p.category, type: 'service_click' })}
                 className="sv-btn primary">🌐 Website</a>
            : <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="sv-btn primary">Maps</a>}
          {phoneHref && <a href={phoneHref} className="sv-btn ghost">📞 Call</a>}
          <button className="sv-btn ghost" disabled={isEnriching} onClick={() => onEnrich(p)}>
            {isEnriching ? '…' : '✨ Details'}
          </button>
          <button className="sv-btn ghost sv-btn-firecrawl" disabled={isScraping} onClick={() => onScrape(p)}>
            {isScraping ? '…' : '📋 Menu / Pricing'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Floating compare bar ───────────────────────────────────
function CompareBar({ compareSet, providers, onClear, onOpen }) {
  if (compareSet.size === 0) return null
  const selected = providers.filter(p => compareSet.has(p.placeId || p.name))
  return (
    <div className="sv-compare-bar">
      <div className="sv-compare-bar-items">
        {selected.map(p => (
          <span key={p.placeId || p.name} className="sv-compare-chip">
            {p.thumbnail
              ? <img src={p.thumbnail} alt="" className="sv-compare-chip-img" />
              : <span className="sv-compare-chip-init">{initialOf(p)}</span>}
            <span>{p.name.split(' ').slice(0, 2).join(' ')}</span>
          </span>
        ))}
        {compareSet.size < 3 && (
          <span className="sv-compare-chip ghost">+ Add {3 - compareSet.size} more</span>
        )}
      </div>
      <div className="sv-compare-bar-actions">
        {compareSet.size >= 2 && (
          <button className="sv-btn primary" onClick={onOpen}>Compare Now →</button>
        )}
        <button className="sv-btn ghost" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}

// ── Side-by-side compare modal ─────────────────────────────
function CompareModal({ compareSet, providers, onClose }) {
  const selected = providers.filter(p => compareSet.has(p.placeId || p.name))
  const rows = [
    { label: 'Rating',     fn: p => p.rating != null ? <><Stars r={p.rating} /> <span className="sv-reviews">({(p.reviewsCount || 0).toLocaleString()})</span></> : '—' },
    { label: 'Price Range',fn: p => p.price || '—' },
    { label: 'Est. Cost',  fn: p => p.priceValue ? `$${p.priceValue}` : '—' },
    { label: 'Distance',   fn: p => distLabel(p) || '—' },
    { label: 'Category',   fn: p => p.category || '—' },
    { label: 'Address',    fn: p => shortAddr(p) || '—' },
    { label: 'Phone',      fn: p => p.phone ? <a href={`tel:${p.phone}`} className="sv-btn ghost" style={{fontSize:12,padding:'4px 10px'}}>{p.phone}</a> : '—' },
    { label: 'Profile',    fn: p => p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="sv-btn primary" style={{fontSize:12,padding:'4px 14px'}}>View →</a> : '—' },
  ]
  return (
    <div className="sv-modal" onClick={onClose}>
      <div className="sv-modal-card sv-cmp-modal" onClick={e => e.stopPropagation()}>
        <button className="sv-modal-close" onClick={onClose}>✕</button>
        <div className="sv-modal-body">
          <h3 style={{ marginBottom: 20 }}>Side-by-Side Comparison</h3>
          <div className="sv-cmp-wrap">
            <table className="sv-cmp-table">
              <thead>
                <tr>
                  <th className="sv-cmp-attr-col">Attribute</th>
                  {selected.map(p => (
                    <th key={p.placeId || p.name}>
                      <div className="sv-cmp-th">
                        {p.thumbnail
                          ? <img src={p.thumbnail} alt="" className="sv-cmp-th-img" />
                          : <div className="sv-avatar" style={{width:40,height:40,fontSize:16}}>{initialOf(p)}</div>}
                        <span className="sv-cmp-th-name">{p.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label}>
                    <td className="sv-cmp-label">{row.label}</td>
                    {selected.map(p => (
                      <td key={p.placeId || p.name} className="sv-cmp-cell">{row.fn(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pre Pay AI widget (backend-powered) ───────────────────
function PrePayWidget({ currentQuery, onCategoryClick }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [prompt, setPrompt]     = useState(null)
  const [dismissed, setDismissed] = useState(new Set())

  // Load spending patterns from backend on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSpendingPatterns()
      .then(r => { if (!cancelled) setData(r) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Also merge localStorage patterns as fallback
  const localRecs = getPrePayRecs()

  if (loading) return (
    <div className="sv-side-card sv-prepay">
      <div className="sv-tag-mini">🤖 AI INSIGHTS</div>
      <div className="sv-prepay-loading">Analyzing your patterns…</div>
    </div>
  )

  const hasBackendData = data?.hasData && (data.topCategories?.length > 0 || data.suggestions?.length > 0)
  const hasLocalData   = localRecs.length > 0
  if (!hasBackendData && !hasLocalData) return null

  const profile = data?.profile
  const suggestions = data?.suggestions || []
  const suggestedDeals = data?.suggestedDeals || []
  const topCategories = data?.topCategories || []

  // Merge backend + local recs for pre-book prompts
  const prebook = [
    ...(topCategories.slice(0, 2).map(tc => ({ category: tc.cat, count: tc.count, source: 'ai' }))),
    ...localRecs.filter(lr => !topCategories.some(tc => tc.cat === lr.category)).slice(0, 1)
  ].filter(r => !dismissed.has(r.category))

  return (
    <div className="sv-side-card sv-prepay">
      <div className="sv-tag-mini">🤖 AI INSIGHTS</div>

      {profile && (
        <div className="sv-prepay-profile">
          <span className="sv-prepay-profile-icon">{profile.icon}</span>
          <div>
            <div className="sv-prepay-profile-label">{profile.label}</div>
            <div className="sv-prepay-profile-desc">{profile.desc}</div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="sv-prepay-suggestions">
          {suggestions.slice(0, 2).map((s, i) => (
            <div key={i} className={`sv-prepay-insight sv-prepay-insight-${s.type}`}>
              <p className="sv-prepay-insight-text">{s.text}</p>
              {s.cta && s.type === 'prepay' && (
                <button className="sv-btn primary" style={{fontSize:12,padding:'5px 12px',marginTop:6}}
                  onClick={() => setPrompt(s.category)}>
                  {s.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {topCategories.length > 0 && (
        <div className="sv-prepay-cats">
          <div className="sv-prepay-cats-label">Your top categories</div>
          <div className="sv-prepay-cats-list">
            {topCategories.slice(0, 4).map(tc => (
              <button key={tc.cat} className="sv-prepay-cat-chip"
                onClick={() => onCategoryClick && onCategoryClick(tc.cat)}>
                {tc.cat.replace(/_/g, ' ')}
                <span className="sv-prepay-cat-count">{tc.count}×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {suggestedDeals.length > 0 && (
        <div className="sv-prepay-deals">
          <div className="sv-prepay-cats-label">Deals matching your habits</div>
          {suggestedDeals.slice(0, 3).map((d, i) => (
            <a key={i} href={d.url || '#'} target="_blank" rel="noopener noreferrer"
               className="sv-prepay-deal-row">
              <div className="sv-prepay-deal-info">
                <span className="sv-prepay-deal-title">{d.title?.slice(0, 42)}{d.title?.length > 42 ? '…' : ''}</span>
                <span className="sv-prepay-deal-store">{d.source || d.brand}</span>
              </div>
              {d.discountPercent && (
                <span className="sv-prepay-deal-badge">{d.discountPercent}% off</span>
              )}
            </a>
          ))}
        </div>
      )}

      {prebook.length > 0 && (
        <div className="sv-prepay-recs">
          <div className="sv-prepay-cats-label">Pre-book suggestions</div>
          {prebook.map(rec => (
            <div key={rec.category} className="sv-prepay-rec">
              <div className="sv-prepay-rec-info">
                <span className="sv-prepay-cat">{rec.category.replace(/_/g, ' ')}</span>
                <span className="sv-prepay-freq">{rec.count}× searched</span>
              </div>
              <div className="sv-prepay-rec-actions">
                <button className="sv-btn primary" style={{fontSize:12,padding:'5px 12px'}}
                  onClick={() => setPrompt(rec.category)}>Pre-book</button>
                <button className="sv-btn ghost" style={{fontSize:12,padding:'5px 8px'}}
                  onClick={() => setDismissed(d => new Set([...d, rec.category]))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {prompt && (
        <div className="sv-modal" onClick={() => setPrompt(null)}>
          <div className="sv-modal-card" style={{maxWidth:440}} onClick={e => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setPrompt(null)}>✕</button>
            <div className="sv-modal-body">
              <div style={{fontSize:36,marginBottom:8}}>💳</div>
              <h3>Pre-Pay for {prompt.replace(/_/g, ' ')}</h3>
              <p style={{color:'var(--muted-foreground)',marginBottom:16,fontSize:14,lineHeight:1.6}}>
                Our AI detected you search for <strong>{prompt.replace(/_/g, ' ')}</strong> frequently.
                Lock in today's rates with a subscription and save up to 20%.
              </p>
              <div className="sv-prepay-options">
                {[
                  { label: 'Monthly',   desc: '1 booking/month, flexible scheduling',  save: '10%' },
                  { label: 'Quarterly', desc: '3 bookings, priority scheduling',        save: '15%' },
                  { label: 'Annual',    desc: '12 bookings, best rate guaranteed',       save: '20%' },
                ].map(opt => (
                  <div key={opt.label} className="sv-prepay-opt">
                    <div className="sv-prepay-opt-head">
                      <span className="sv-prepay-opt-label">{opt.label}</span>
                      <span className="sv-prepay-opt-save">Save {opt.save}</span>
                    </div>
                    <p className="sv-prepay-opt-desc">{opt.desc}</p>
                  </div>
                ))}
              </div>
              <button className="sv-btn primary block" style={{marginTop:16}} onClick={() => setPrompt(null)}>
                Get Started
              </button>
              <p style={{fontSize:12,color:'var(--muted-foreground)',marginTop:10,textAlign:'center'}}>
                Subscription management coming soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Menu matches strip (scraped menu items ≤ budget, under a provider card) ──
function MenuMatchesStrip({ menu, budget, provider }) {
  if (menu.loading) {
    return (
      <div className="sv-menu-strip sv-menu-strip-loading">
        <span className="sv-deals-spinner" /> Reading {provider.name}&rsquo;s menu…
      </div>
    )
  }
  const d = menu.data
  if (!d?.ok || !d.matches?.length) return null
  const site = d.website || null
  let host = null
  try { host = site ? new URL(site).hostname.replace(/^www\./, '').toUpperCase() : null } catch {}
  return (
    <div className="sv-menu-strip">
      <div className="sv-menu-strip-head">
        <span className="sv-menu-strip-title">
          🏷️ MENU MATCHES UNDER ${budget}{host ? <> · <span className="sv-menu-strip-host">{host}</span></> : null}
        </span>
        {site && (
          <a href={site} target="_blank" rel="noopener noreferrer" className="sv-menu-visit">Visit site ↗</a>
        )}
      </div>
      <div className="sv-menu-cards">
        {d.matches.slice(0, 8).map((it, i) => (
          <div key={i} className="sv-menu-card">
            <div className="sv-menu-card-top">
              <span className="sv-menu-card-name">{it.name}</span>
              <span className="sv-menu-card-price">{it.priceDisplay}</span>
            </div>
            {it.section && <div className="sv-menu-card-section">{it.section}</div>}
            {it.description && <div className="sv-menu-card-desc">{it.description}</div>}
          </div>
        ))}
      </div>
      <div className="sv-deals-strip-note">🔎 Prices read live from the business&rsquo;s published menu · confirm before ordering</div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function Services() {
  const [cat, setCat]         = useState(null)
  const [sub, setSub]         = useState(null)
  const [view, setView]       = useState('list')
  const [q, setQ]             = useState('')
  const [budget, setBudget]   = useState('')
  const [minRating, setMinRating] = useState('')
  const [sort, setSort]       = useState('best')
  const [quick, setQuick]     = useState(null)
  const [radiusKm, setRadiusKm] = useState(10)

  const [geo, setGeo]           = useState({ lat: null, lng: null, city: '', source: 'none' })
  const [providers, setProviders] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [enriching, setEnriching] = useState(null)
  const [enriched, setEnriched]   = useState(null)
  const [scraping, setScraping]   = useState(null)
  const [menuModal, setMenuModal] = useState(null)   // full-menu modal (bucketed)
  const [menus, setMenus] = useState({})             // key -> {loading, data} auto strips

  // Live budget deals (real deals ≤ budget found via web search)
  const [deals, setDeals]         = useState([])
  const [dealsLoading, setDealsLoading] = useState(false)
  const [dealsSearched, setDealsSearched] = useState(false)

  const [compareSet, setCompareSet] = useState(new Set())
  const [showCompare, setShowCompare] = useState(false)

  // AI tracking opt-out
  const [trackingEnabled, setTrackingEnabled] = useState(() => {
    try { return localStorage.getItem('pk_tracking_opt_out') !== '1' } catch { return true }
  })

  function toggleTracking() {
    const next = !trackingEnabled
    setTrackingEnabled(next)
    try { localStorage.setItem('pk_tracking_opt_out', next ? '0' : '1') } catch {}
  }

  const debounceRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    resolveUserLocation().then(g => { if (!cancelled) setGeo(g) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const effectiveQuery = useMemo(() => {
    const typed = q.trim()
    if (typed) return typed
    // Most specific wins: subcategory (e.g. "Burgers") → broad category → default.
    // Yelp maps a specific term like "Burgers" / "Oil Change" to the right businesses.
    if (sub) return sub.toLowerCase()
    if (cat) return cat.toLowerCase()
    return 'local services'
  }, [q, cat, sub])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setError('')
      if (trackingEnabled) {
        trackSearch(effectiveQuery)
        trackActivity({ type: 'service_search', query: effectiveQuery, category: sub || cat || undefined })
      }
      try {
        const maxPrice = parseFloat(budget) || (quick === 'budget' ? 50 : undefined)
        const minR = parseFloat(minRating) || (quick === 'top' ? 4.5 : undefined)
        const data = await searchServices({
          query: effectiveQuery,
          lat: geo.lat ?? undefined,
          lng: geo.lng ?? undefined,
          radiusKm,
          maxPrice,
          minRating: minR,
          limit: 30
        })
        if (!data.ok) {
          setError(data.message || data.error || 'Search failed')
          setProviders([])
        } else {
          setProviders(data.providers || [])
        }
      } catch (e) {
        setError(e.message || 'Network error')
        setProviders([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [effectiveQuery, geo.lat, geo.lng, radiusKm, budget, minRating, quick, trackingEnabled])

  const sortedProviders = useMemo(() => {
    const arr = [...providers]
    const dist = p => typeof p.distanceKm === 'number' ? p.distanceKm : Infinity
    const priceN = p => typeof p.priceValue === 'number' ? p.priceValue : Infinity
    if (sort === 'price-asc' || quick === 'budget') arr.sort((a, b) => priceN(a) - priceN(b))
    else if (sort === 'price-desc') arr.sort((a, b) => priceN(b) - priceN(a))
    else if (sort === 'distance' || quick === 'close') arr.sort((a, b) => dist(a) - dist(b))
    // 'best' (default): keep Yelp's best_match relevance order
    return arr
  }, [providers, sort, quick])

  // ── Live budget deals ──────────────────────────────────────
  // When a budget is set, look up REAL current deals ≤ budget for the top
  // providers (web search) and surface them as "deal under $X" ribbons.
  const dealBudget = budget || (quick === 'budget' ? 50 : '')
  useEffect(() => {
    setDeals([])
    setDealsSearched(false)
    if (!dealBudget || providers.length === 0) return
    let cancelled = false
    setDealsLoading(true)
    const top = providers.slice(0, 8).map(p => ({
      name: p.name, city: geo.city || undefined, address: p.address || undefined,
    }))
    findServiceDeals({
      providers: top,
      budget: dealBudget,
      category: sub || cat || effectiveQuery,
      location: geo.city || undefined,
    })
      .then(r => { if (!cancelled) setDeals(r?.deals || []) })
      .catch(() => { if (!cancelled) setDeals([]) })
      .finally(() => { if (!cancelled) { setDealsLoading(false); setDealsSearched(true) } })
    return () => { cancelled = true }
    // Re-run when the result set or budget changes (providers identity changes on new search)
  }, [providers, dealBudget, geo.city])

  // Match a deal to a provider by normalized name.
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const dealFor = useMemo(() => {
    const byName = deals.map(d => ({ key: norm(d.name), deal: d })).filter(x => x.key)
    return (p) => {
      const pk = norm(p.name)
      if (!pk) return null
      const hit = byName.find(x => x.key === pk || x.key.includes(pk) || pk.includes(x.key))
      return hit ? hit.deal : null
    }
  }, [deals])

  function toggleCompare(p) {
    const key = p.placeId || p.name
    setCompareSet(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else if (next.size < 3) next.add(key)
      return next
    })
  }

  async function handleEnrich(prov) {
    setEnriching(prov.placeId || prov.name)
    try {
      const r = await enrichProvider({ placeId: prov.placeId, name: prov.name, address: prov.address })
      setEnriched(r)
    } catch (e) {
      setEnriched({ ok: false, error: e.message })
    } finally {
      setEnriching(null)
    }
  }

  // Yelp "website" is the listing URL, not the business site — don't feed it to
  // the scraper as an official-site hint.
  const realSiteOf = (p) => (p?.website && !/yelp\.com/i.test(p.website)) ? p.website : undefined

  // Open the full scraped menu / price list for one provider (bucket chips + budget highlight)
  async function handleMenuOpen(prov) {
    const key = prov.placeId || prov.name
    setScraping(key)
    setMenuModal({ providerName: prov.name, loading: true, bucket: null })
    try {
      const r = await getProviderMenu({
        provider: { placeId: prov.placeId, name: prov.name, website: realSiteOf(prov), city: geo.city || undefined },
        category: sub || cat || effectiveQuery,
        budget: dealBudget || undefined,
      })
      setMenuModal({ providerName: prov.name, loading: false, data: r, bucket: null })
    } catch (e) {
      setMenuModal({ providerName: prov.name, loading: false, error: e.message, bucket: null })
    } finally {
      setScraping(null)
    }
  }

  // Auto-load scraped menus for the top displayed providers when a budget is set,
  // powering the "MENU MATCHES UNDER $X" strips (server-cached 7 days).
  // Kept small + well-spaced (see the stagger below) so we stay under the
  // Perplexity rate limit — bursts of parallel lookups were returning 429.
  const MENU_STRIP_COUNT = 3
  const menuCacheRef = useRef({})   // cacheKey -> menu data (persists across re-renders)
  // A STABLE signature of the top displayed providers + budget + category, so the
  // effect only re-runs when the actual inputs change — not on every array
  // reference change (which was wiping menus before they finished loading).
  const menuSig = useMemo(() => {
    const cat_ = sub || cat || effectiveQuery
    return JSON.stringify([
      dealBudget, cat_,
      sortedProviders.slice(0, MENU_STRIP_COUNT).map(p => p.placeId || p.name),
    ])
  }, [sortedProviders, dealBudget, sub, cat, effectiveQuery])

  useEffect(() => {
    if (!dealBudget) { setMenus({}); return }
    const top = sortedProviders.slice(0, MENU_STRIP_COUNT)
    if (top.length === 0) return
    const cat_ = sub || cat || effectiveQuery
    let cancelled = false
    const timers = []
    top.forEach((p, i) => {
      const key = p.placeId || p.name
      const cacheKey = `${key}|${cat_}|${dealBudget}`
      const cached = menuCacheRef.current[cacheKey]
      if (cached) { setMenus(m => ({ ...m, [key]: { loading: false, data: cached } })); return }
      setMenus(m => (m[key]?.data ? m : { ...m, [key]: { loading: true } }))
      const t = setTimeout(() => {
        if (cancelled) return
        getProviderMenu({
          provider: { placeId: p.placeId, name: p.name, website: realSiteOf(p), city: geo.city || undefined },
          category: cat_,
          budget: dealBudget,
        })
          .then(r => {
            if (cancelled) return
            menuCacheRef.current[cacheKey] = r
            setMenus(m => ({ ...m, [key]: { loading: false, data: r } }))
          })
          .catch(() => { if (!cancelled) setMenus(m => ({ ...m, [key]: { loading: false } })) })
      }, i * 900)   // space calls ~0.9s apart to avoid tripping the Perplexity rate limit
      timers.push(t)
    })
    return () => { cancelled = true; timers.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuSig])

  function clearAll() {
    setCat(null); setSub(null); setQ(''); setBudget(''); setMinRating(''); setQuick(null); setRadiusKm(10)
  }

  const hasFilters = !!(budget || minRating || cat || sub || q)

  return (
    <div className="sv-page">
      <div className="sv-bg" />

      {/* ── Search engine hero ── */}
      <section className="container sv-hero-v2">
        <div className="sv-util-row">
          <Link to="/vendor" className="sv-util-link">🏪 For Vendors</Link>
          <span className="sv-util-dot">·</span>
          <Link to="/promote" className="sv-util-link">📣 Promote My Listing</Link>
          <span className="sv-util-dot">·</span>
          <Link to="/network" className="sv-util-link">🚀 Join the Network</Link>
          <span className="sv-util-dot">·</span>
          <button
            className={`sv-util-link sv-tracking-toggle ${trackingEnabled ? '' : 'off'}`}
            onClick={toggleTracking}
            title={trackingEnabled ? 'AI search tracking is ON — click to opt out' : 'AI search tracking is OFF — click to enable'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {trackingEnabled ? '🤖 AI Tracking: On' : '🚫 AI Tracking: Off'}
          </button>
        </div>

        <div className="sv-hero-center">
          <h1 className="sv-brand-title">PriceKlick</h1>
          <p className="sv-brand-sub">Find any service. Compare prices. Book smarter.</p>
          <Link to="/smart-compare" className="sv-compare-btn">
            <span className="sv-compare-icon">✨</span>
            <span className="sv-compare-label">Smart Compare Advisor</span>
            <span className="sv-compare-sep">—</span>
            <span className="sv-compare-hint">describe anything, get a full comparison</span>
          </Link>
        </div>

        {/* Main search bar */}
        <div className="sv-engine-bar">
          <div className="sv-search-wrap">
            <span className="sv-search-icon">🔍</span>
            <input
              type="text"
              value={q}
              onChange={e => { setQ(e.target.value); setCat(null); setSub(null) }}
              placeholder="Search any service — plumber, restaurant, doctor, hotel, tutor..."
              className="sv-search-input"
            />
            {q && (
              <button className="sv-search-x" onClick={() => setQ('')} aria-label="Clear search">✕</button>
            )}
          </div>
          <div className="sv-engine-meta">
            {geo.city && <><span>📍 Near <strong>{geo.city}</strong></span><span className="sv-util-dot">·</span></>}
            <span>Within
              <select className="sv-inline-sel" value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="25">25 km</option>
                <option value="50">50 km</option>
                <option value="100">100 km</option>
              </select>
            </span>
          </div>
        </div>

        {/* Category group browser */}
        <CategoryGroupGrid
          selectedCat={cat}
          selectedSub={sub}
          onSelectCat={c => { setCat(c); setSub(null); setQ('') }}
          onSelectSub={s => { setSub(s); setQ('') }}
        />

        {/* Trending row */}
        <div className="sv-trending-row">
          <span className="sv-trending-lbl">🔥 Trending:</span>
          <div className="sv-trending">
            {TRENDING.map(t => (
              <button key={t} className="sv-trend" onClick={() => { setQ(t); setCat(null); setSub(null) }}>{t}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Results section ── */}
      <section className="container sv-section sv-providers">
        <div className="sv-providers-grid">
          <div>
            {/* Results header */}
            <div className="sv-res-head">
              <div className="sv-res-title-row">
                <h2 className="sv-res-title">
                  {loading ? 'Searching…' : sub || q || cat || 'All Services'}
                  {!loading && sub && cat && <span className="sv-res-parent"> in {cat}</span>}
                  {!loading && budget && <span className="sv-res-budget"> · under ${budget}</span>}
                </h2>
                {!loading && (
                  <span className="sv-count">{sortedProviders.length} providers · {radiusKm} km radius</span>
                )}
              </div>

              {/* Filter strip */}
              <div className="sv-filter-bar">
                <div className="sv-filter-cell">
                  <span>$</span>
                  <input type="number" className="sv-filter-input" placeholder="Max budget"
                    value={budget} onChange={e => setBudget(e.target.value)} min="0" />
                </div>
                <div className="sv-filter-cell">
                  <span>★</span>
                  <input type="number" className="sv-filter-input" placeholder="Min rating"
                    value={minRating} onChange={e => setMinRating(e.target.value)}
                    min="1" max="5" step="0.5" style={{maxWidth:90}} />
                </div>
                <div className="sv-filter-view">
                  <button className={`sv-control ${view==='list' ? 'active' : ''}`} onClick={() => setView('list')}>☰ List</button>
                  <button className={`sv-control ${view==='map' ? 'active' : ''}`} onClick={() => setView('map')}>🗺 Map</button>
                </div>
                {hasFilters && (
                  <button className="sv-clear-all" onClick={clearAll}>✕ Clear</button>
                )}
              </div>

              {/* Quick pills */}
              <div className="sv-quick-pills">
                {[
                  { key: 'budget', label: '💰 Under $50' },
                  { key: 'top',    label: '⭐ 4.5+ Rating' },
                  { key: 'close',  label: '📍 Closest First' },
                ].map(f => (
                  <button
                    key={f.key}
                    className={`sv-quick-pill ${quick === f.key ? 'active' : ''}`}
                    onClick={() => setQuick(quick === f.key ? null : f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && <div className="sv-loading-bar"><div className="sv-loading-inner" /></div>}

            {error && (
              <div className="sv-empty" style={{borderColor:'oklch(70% .18 25 / .4)',marginBottom:16}}>
                <div className="sv-empty-icon">⚠️</div>
                <h3>Search failed</h3><p>{error}</p>
              </div>
            )}

            {!error && !loading && sortedProviders.length === 0 ? (
              <div className="sv-empty">
                <div className="sv-empty-icon">🔍</div>
                <h3>No providers found</h3>
                <p>Try a different service, wider radius, or clear filters.</p>
                <button className="sv-btn ghost" onClick={clearAll}>Clear all filters</button>
              </div>
            ) : view === 'map' ? (
              <ServiceMap providers={sortedProviders} userLat={geo.lat} userLng={geo.lng} />
            ) : (
              <>
                {/* Live budget-deals strip */}
                {dealBudget && (dealsLoading || deals.length > 0 || dealsSearched) && (
                  <div className="sv-deals-strip">
                    {dealsLoading ? (
                      <div className="sv-deals-strip-loading">
                        <span className="sv-deals-spinner" /> Finding real deals under ${dealBudget} near you…
                      </div>
                    ) : deals.length === 0 ? (
                      <div className="sv-deals-strip-empty">
                        💸 We checked the web — no published deals under ${dealBudget} found for these businesses right now. Prices shown are still within your budget.
                      </div>
                    ) : (
                      <>
                        <div className="sv-deals-strip-head">
                          💸 {deals.length} deal{deals.length > 1 ? 's' : ''} under <strong>${dealBudget}</strong> near you
                        </div>
                        <div className="sv-deals-strip-list">
                          {deals.slice(0, 6).map((d, i) => (
                            <a key={i} className="sv-deal-pill"
                               href={d.url || '#'} target={d.url ? '_blank' : undefined} rel="noopener noreferrer">
                              {d.price && <span className="sv-deal-pill-price">{d.price}</span>}
                              <span className="sv-deal-pill-title">{d.title || 'Deal'}</span>
                              <span className="sv-deal-pill-store">@ {d.name}</span>
                            </a>
                          ))}
                        </div>
                        <div className="sv-deals-strip-note">🔎 Live web-verified · deals can change — confirm with the business</div>
                      </>
                    )}
                  </div>
                )}

                <div className="sv-cards">
                  {sortedProviders.map(p => {
                    const key = p.placeId || p.name
                    const menu = menus[key]
                    return (
                      <React.Fragment key={key}>
                        <ProviderCard
                          p={p}
                          deal={dealFor(p)}
                          budget={dealBudget}
                          onEnrich={handleEnrich}
                          enriching={enriching}
                          onScrape={handleMenuOpen}
                          scraping={scraping}
                          compareSet={compareSet}
                          onToggleCompare={toggleCompare}
                        />
                        {menu && dealBudget && (
                          <MenuMatchesStrip menu={menu} budget={dealBudget} provider={p} />
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="sv-side">
            <PrePayWidget
              currentQuery={effectiveQuery}
              onCategoryClick={item => { setQ(item); setCat(null); setSub(null) }}
            />

            <div className="sv-side-card sv-quick">
              <div className="sv-tag-mini">QUICK FILTERS</div>
              {[
                { key:'budget', icon:'$', label:'Under $50',    meta:'Budget',   hue:'155' },
                { key:'top',    icon:'★', label:'Top Rated',    meta:'4.5+',     hue:'80'  },
                { key:'close',  icon:'◷', label:'Closest First',meta:'Distance', hue:'200' },
              ].map(f => (
                <button key={f.key} className={`sv-quick-card ${quick===f.key ? 'active' : ''}`}
                  onClick={() => setQuick(quick===f.key ? null : f.key)}>
                  <span className="sv-quick-ic" style={{background:`oklch(80% .15 ${f.hue} / .15)`,color:`oklch(70% .18 ${f.hue})`}}>{f.icon}</span>
                  <span className="sv-quick-body"><strong>{f.label}</strong></span>
                  <span className="sv-quick-meta">{f.meta}</span>
                </button>
              ))}
            </div>

            {/* PriceKlick Preferred Vendors — title only until vendors register */}
            <div className="sv-side-card sv-preferred-vendors">
              <div className="sv-tag-mini">⭐ PRICEKLICK PREFERRED VENDORS</div>
              <p style={{color:'var(--muted-foreground)',fontSize:13,margin:'8px 0 0',lineHeight:1.5}}>
                Preferred vendor listings coming soon. Are you a business?
              </p>
              <Link to="/vendor" className="sv-btn ghost" style={{marginTop:10,display:'inline-flex',fontSize:13}}>
                Apply to be a Preferred Vendor →
              </Link>
            </div>

            <div className="sv-side-card sv-vendors-cta">
              <div className="sv-tag-mini">📣 FOR VENDORS</div>
              <h3>Grow your business</h3>
              <p>Reach thousands of customers searching for your services.</p>
              <Link to="/vendor" className="sv-btn primary block">Get Started — Free</Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ── Floating compare bar ── */}
      <CompareBar
        compareSet={compareSet}
        providers={sortedProviders}
        onClear={() => setCompareSet(new Set())}
        onOpen={() => setShowCompare(true)}
      />

      {/* ── Compare modal ── */}
      {showCompare && (
        <CompareModal
          compareSet={compareSet}
          providers={sortedProviders}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* ── Enrich details modal ── */}
      {enriched && (
        <div className="sv-modal" onClick={() => setEnriched(null)}>
          <div className="sv-modal-card" onClick={e => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setEnriched(null)}>✕</button>
            {!enriched.ok ? (
              <div style={{padding:24}}>
                <h3>Couldn't load details</h3>
                <p style={{color:'var(--muted-foreground)'}}>{enriched.error || 'Unknown error.'}</p>
              </div>
            ) : (
              <div className="sv-modal-body">
                <h3>{enriched.provider?.name}</h3>
                <p className="sv-pref-addr">{enriched.provider?.address}</p>
                <div className="sv-pref-meta" style={{margin:'10px 0'}}>
                  {enriched.provider?.rating != null && <Stars r={enriched.provider.rating} />}
                  {enriched.provider?.reviewsCount != null && (
                    <span className="sv-reviews">({enriched.provider.reviewsCount.toLocaleString()} reviews)</span>
                  )}
                  {enriched.provider?.phone && (
                    <a href={`tel:${enriched.provider.phone}`} className="sv-btn ghost">📞 {enriched.provider.phone}</a>
                  )}
                  {enriched.provider?.website && (
                    <a href={enriched.provider.website} target="_blank" rel="noopener noreferrer" className="sv-btn primary">🌐 Website</a>
                  )}
                </div>
                {enriched.provider?.photos?.length > 0 && (
                  <div className="sv-photos">
                    {enriched.provider.photos.slice(0, 8).map((src, i) => <img key={i} src={src} alt="" />)}
                  </div>
                )}
                {enriched.provider?.openingHours && (
                  <div style={{marginTop:12}}>
                    <strong>Opening Hours</strong>
                    <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,margin:'6px 0 0',color:'var(--muted-foreground)'}}>
                      {enriched.provider.openingHours}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Scraped menu / price-list modal (bucketed) ── */}
      {menuModal && (
        <div className="sv-modal" onClick={() => setMenuModal(null)}>
          <div className="sv-modal-card" onClick={e => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setMenuModal(null)}>✕</button>
            <div className="sv-modal-body">
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:22}}>📋</span>
                <h3 style={{margin:0}}>{menuModal.providerName}</h3>
                {menuModal.data?.website && (
                  <a href={menuModal.data.website} target="_blank" rel="noopener noreferrer"
                     className="sv-btn ghost" style={{marginLeft:'auto',fontSize:12}}>Visit site ↗</a>
                )}
              </div>

              {menuModal.loading ? (
                <div className="sv-menu-strip-loading" style={{padding:'18px 0'}}>
                  <span className="sv-deals-spinner" /> Reading the published menu / price list from the web…
                </div>
              ) : !menuModal.data?.ok || !menuModal.data.items?.length ? (
                <p style={{color:'var(--muted-foreground)'}}>
                  {menuModal.error || 'No published prices found online for this business yet. Try their website or call for pricing.'}
                </p>
              ) : (
                <>
                  {/* Price-bucket chips */}
                  <div className="sv-menu-buckets">
                    <button
                      className={`sv-subchip ${!menuModal.bucket ? 'active' : ''}`}
                      onClick={() => setMenuModal(m => ({ ...m, bucket: null }))}
                    >
                      All ({menuModal.data.items.length})
                    </button>
                    {Object.entries(menuModal.data.bucketCounts || {})
                      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                      .map(([b, n]) => (
                        <button key={b}
                          className={`sv-subchip ${menuModal.bucket === b ? 'active' : ''}`}
                          onClick={() => setMenuModal(m => ({ ...m, bucket: m.bucket === b ? null : b }))}
                        >
                          ${b} ({n})
                        </button>
                      ))}
                  </div>

                  <div className="sv-menu-list">
                    {menuModal.data.items
                      .filter(it => !menuModal.bucket || it.bucket === menuModal.bucket)
                      .map((it, i) => {
                        const inBudget = dealBudget && it.price != null && it.price <= parseFloat(dealBudget)
                        return (
                          <div key={i} className={`sv-menu-row ${inBudget ? 'in-budget' : ''}`}>
                            <div className="sv-menu-row-main">
                              <span className="sv-menu-row-name">
                                {it.name}
                                {inBudget && <span className="sv-menu-row-flag">≤ ${dealBudget}</span>}
                              </span>
                              {it.section && <span className="sv-menu-row-section">{it.section}</span>}
                              {it.description && <div className="sv-menu-row-desc">{it.description}</div>}
                            </div>
                            <span className="sv-menu-row-price">{it.priceDisplay}</span>
                          </div>
                        )
                      })}
                  </div>
                  <div className="sv-deals-strip-note" style={{marginTop:10}}>
                    🔎 Prices read live from the business&rsquo;s published menu · confirm before ordering
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
