import React from 'react'
import { Link } from 'react-router-dom'
import './HeroCTA.css'

export default function HeroCTA({title,subtitle}){
  return (
    <div className="hero">
      <div className="container hero-wrap">
        <div className="kicker animate-fade-in-up">Smart Savings</div>
        <h1 className="animate-fade-in-up animate-delay-1">{title}</h1>
        <p className="animate-fade-in-up animate-delay-2">{subtitle}</p>
        <div className="cta animate-fade-in-up animate-delay-3">
          <Link to="/install" className="btn primary">Add to Chrome - Free</Link>
          <Link to="/how-it-works" className="btn ghost">View Demo</Link>
        </div>
        <div className="pills animate-fade-in-up animate-delay-4">
          <div className="pill">⭐ 4.9/5 rating</div>
          <div className="pill">🙂 50,000+ happy users</div>
          <div className="pill">💯 100% Free</div>
        </div>
      </div>
    </div>
  )
}