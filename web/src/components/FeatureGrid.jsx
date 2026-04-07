import React from 'react'
import './FeatureGrid.css'
const data=[
  {t:'Lightning Fast',d:'Scans and applies coupons in under 3 seconds at checkout'},
  {t:'Privacy First',d:'No tracking, no data collection. Your privacy is our priority'},
  {t:'Smart Detection',d:'Works on thousands of stores automatically'},
  {t:'Deal Alerts',d:'Get notified when prices drop or coupons appear'}
]
export default function FeatureGrid(){
  return (
    <div className="feature-grid">
      {data.map((x,i)=>(
        <div key={i} className={`feature-card animate-fade-in-up animate-delay-${i + 1}`}>
          <h3>{x.t}</h3>
          <div className="muted">{x.d}</div>
        </div>
      ))}
    </div>
  )
}