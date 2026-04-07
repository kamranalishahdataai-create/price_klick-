import React from 'react'
import HeroCTA from '../components/HeroCTA.jsx'
import Section from '../components/Section.jsx'
import FeatureGrid from '../components/FeatureGrid.jsx'
import BrowserBadges from '../components/BrowserBadges.jsx'

export default function Features(){
  return (
    <div>
      <HeroCTA title="Powerful Features" subtitle="Everything you need to save more with less effort"/>
      <Section>
        <FeatureGrid/>
      </Section>
      <Section title="Works Everywhere">
        <BrowserBadges/>
      </Section>
    </div>
  )
}