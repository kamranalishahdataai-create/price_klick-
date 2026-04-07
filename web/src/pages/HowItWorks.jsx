import React from 'react'
import HeroCTA from '../components/HeroCTA.jsx'
import Section from '../components/Section.jsx'
import Steps from '../components/Steps.jsx'

export default function HowItWorks(){
  return (
    <div>
      <HeroCTA title="How PriceKlick Works" subtitle="Three simple steps to start saving on every purchase"/>
      <Section>
        <Steps/>
      </Section>
    </div>
  )
}