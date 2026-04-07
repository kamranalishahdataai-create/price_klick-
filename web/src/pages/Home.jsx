import { Link } from 'react-router-dom'
import React from 'react'
import HeroCTA from '../components/HeroCTA.jsx'
import Section from '../components/Section.jsx'
import MiniWidget from '../components/MiniWidget.jsx'
import BrowserBadges from '../components/BrowserBadges.jsx'
import FeatureGrid from '../components/FeatureGrid.jsx'

export default function Home(){
  return (
    <div>
      <HeroCTA title="Save Money Automatically" subtitle="Our smart browser extension finds and applies the best coupon codes instantly at checkout."/>
      <Section className="animate-fade-in-up animate-delay-1">
        <MiniWidget/>
      </Section>
      <Section title="Available for all major browsers" className="animate-fade-in-up animate-delay-2">
        <BrowserBadges/>
      </Section>
      <Section title="Why Choose PriceKlick?" sub="Advanced features designed to maximize your savings with minimal effort" alt className="animate-fade-in-up animate-delay-3">
        <FeatureGrid/>
      </Section>
    </div>
  )
}