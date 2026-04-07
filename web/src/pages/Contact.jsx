import React, { useState } from 'react'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const mailtoLink = `mailto:support@priceklick.com?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(`From: ${form.name} (${form.email})\n\n${form.message}`)}`
    window.location.href = mailtoLink
    setSubmitted(true)
  }

  return (
    <section style={{ minHeight: '80vh', padding: '80px 20px 60px', maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>Contact Us</h1>
      <p style={{ color: '#6a6880', textAlign: 'center', marginBottom: 40 }}>
        Have a question, feedback, or need support? We'd love to hear from you.
      </p>

      {submitted ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#f0fdf4', borderRadius: 16, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#16a34a', marginBottom: 8 }}>Message Sent!</h2>
          <p style={{ color: '#6a6880' }}>We'll get back to you within 24 hours.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text" required value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                style={inputStyle} placeholder="Your name"
              />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                style={inputStyle} placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Subject</label>
            <input
              type="text" required value={form.subject}
              onChange={e => setForm({...form, subject: e.target.value})}
              style={inputStyle} placeholder="How can we help?"
            />
          </div>
          <div>
            <label style={labelStyle}>Message *</label>
            <textarea
              required value={form.message} rows={5}
              onChange={e => setForm({...form, message: e.target.value})}
              style={{...inputStyle, resize: 'vertical'}} placeholder="Tell us more..."
            />
          </div>
          <button type="submit" style={btnStyle}>Send Message</button>
        </form>
      )}

      <div style={{ marginTop: 48, textAlign: 'center', color: '#6a6880', fontSize: 14 }}>
        <p style={{ marginBottom: 8 }}><strong>Email:</strong> support@priceklick.com</p>
        <p><strong>Website:</strong> <a href="https://priceklick.com" style={{ color: '#6D4AFF' }}>priceklick.com</a></p>
      </div>
    </section>
  )
}

const labelStyle = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }
const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e0f0',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s'
}
const btnStyle = {
  padding: '12px 32px', borderRadius: 10, border: 'none', background: '#6D4AFF',
  color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8
}
