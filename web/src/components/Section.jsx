import React from 'react'
import './Section.css'
export default function Section({title,children,sub,alt,className}){
  const sectionClass = alt ? 'section subhero' : 'section';
  const combinedClass = className ? `${sectionClass} ${className}` : sectionClass;
  
  return (
    <div className={combinedClass}>
      <div className="container">
        <div className="section-title">
          {title&&<h2 style={{margin:'0 0 6px'}}>{title}</h2>}
          {sub&&<div className="muted">{sub}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}