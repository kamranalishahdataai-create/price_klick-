import React from 'react'
import './Steps.css'
const steps=[
  {n:'01',t:'Install in Seconds',d:'Add our lightweight extension to your browser with one click.'},
  {n:'02',t:'Shop Normally',d:'Browse and shop on your favorite sites as usual.'},
  {n:'03',t:'Save Automatically',d:'We test and apply the best coupon codes at checkout.'}
]
export default function Steps(){
  return (
    <div className="steps-grid">
      {steps.map(s=>(
        <div key={s.n} className="step-card">
          <div className="step-number">{s.n}</div>
          <h3>{s.t}</h3>
          <div className="muted">{s.d}</div>
        </div>
      ))}
    </div>
  )
}