import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import './VendorLogin.css'

export default function VendorLogin() {
  const { login, error, clearError } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    clearError()
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(formData)
      navigate('/dashboard')
    } catch {
      // handled by AuthContext
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="vlogin-page">
      <div className="vlogin-bg" aria-hidden />
      <div className="vlogin-wrap">
        <div className="vlogin-head">
          <div className="vlogin-icon" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </div>
          <h1 className="vlogin-title">Vendor Login</h1>
          <p className="vlogin-sub">Access your vendor dashboard</p>
        </div>

        <div className="vlogin-card">
          <form onSubmit={handleSubmit} className="vlogin-form">
            {error && <div className="vlogin-error">{error}</div>}

            <div className="vlogin-group">
              <label htmlFor="vl-email">Email</label>
              <div className="vlogin-input">
                <span className="vlogin-input-icon" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="vl-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="vendor@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="vlogin-group">
              <label htmlFor="vl-pw">Password</label>
              <div className="vlogin-input">
                <span className="vlogin-input-icon" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="vl-pw"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" className="vlogin-btn" disabled={loading}>
              {loading ? 'Signing in…' : <>Sign In <span aria-hidden>→</span></>}
            </button>
          </form>

          <div className="vlogin-foot">
            Don't have a vendor account?{' '}
            <Link to="/register?role=vendor" className="vlogin-link">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
