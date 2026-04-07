import React from 'react'
import './BrowserBadges.css'

// default icons shipped with the app (put files in /src/assets)
import chromeImg from '../assets/chrom.jpeg'
import firefoxImg from '../assets/firefox.jpeg'
import safariImg from '../assets/safari.jpeg'
import edgeImg from '../assets/edge.png'   // use .png if your file is edge.png

const defaultIconByName = {
  Chrome: chromeImg,
  Firefox: firefoxImg,
  Safari: safariImg,
  Edge: edgeImg
}

const BrowserIcon = ({ name, image }) => {
  if (image && image !== 'melvin') {
    return <img src={image} alt={name} className="icon-img" />
  }
  const src = defaultIconByName[name]
  if (src) return <img src={src} alt={name} className="icon-img" />
  return <span>🟣</span>
}

const items = [
  { name: 'Chrome',  stat: '45M+', image: 'melvin' },
  { name: 'Firefox', stat: '12M+', image: 'melvin' },
  { name: 'Safari',  stat: '8M+',  image: 'melvin' },
  { name: 'Edge',    stat: '5M+',  image: 'melvin' }
]

export default function BrowserBadges() {
  return (
    <div className="badges">
      {items.map((x, index) => (
        <div key={x.name} className={`badge animate-fade-in-up animate-delay-${index + 1}`}>
          <div className="badge-content">
            <BrowserIcon name={x.name} image={x.image} />
            <div>
              <div className="badge-name">{x.name}</div>
              <div className="muted small">{x.stat}</div>
            </div>
          </div>
          <span className="tag">Secure</span>
        </div>
      ))}
    </div>
  )
}
