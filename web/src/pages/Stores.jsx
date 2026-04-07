import React from 'react'
import Section from '../components/Section.jsx'
import HeroCTA from '../components/HeroCTA.jsx'
import './Stores.css'

const stores=['Amazon','eBay','Walmart','Target','BestBuy','AliExpress','Etsy','Nike','Adidas','Shein','H&M','Zara']

export default function Stores(){
  return (
    <div>
      <HeroCTA title="Thousands of Supported Stores" subtitle="Shop your favorites. We auto‑apply coupons wherever we can."/>
      <Section>
        <div className="stores-grid">
          {stores.map(s=>(<div key={s} className="store-card"><strong>{s}</strong><div className="muted small">Coupons available</div></div>))}
        </div>
      </Section>
    </div>
  )
}