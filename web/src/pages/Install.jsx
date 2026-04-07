import React from 'react'
import HeroCTA from '../components/HeroCTA.jsx'
import Section from '../components/Section.jsx'
import BrowserBadges from '../components/BrowserBadges.jsx'

export default function Install(){
  return (
    <div>
      <HeroCTA title="Ready to Start Saving?" subtitle="Join thousands of smart shoppers who save hundreds every year"/>
      <Section>
        <BrowserBadges/>
      </Section>
    </div>
  )
}