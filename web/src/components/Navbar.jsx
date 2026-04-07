import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar(){
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="nav">
      <div className="container navbar">
        <Link to="/" className="brand">
          <span className="brand-badge">✦</span>
          <span>PriceKlick</span>
        </Link>

        <div className="search">
          <span>🔎</span>
          <input placeholder="Search products..." />
        </div>

        <div className="nav-links">
          <NavLink to="/features">Features</NavLink>
          {isAuthenticated ? (
            <NavLink to="/user-dashboard">Dashboard</NavLink>
          ) : (
            <NavLink to="/dashboard">Dashboard</NavLink>
          )}
          <NavLink to="/how-it-works">How It Works</NavLink>
          <NavLink to="/stores">Stores</NavLink>
          <NavLink to="/install">Install</NavLink>
          {isAuthenticated && user?.role === 'admin' && (
            <NavLink to="/admin" className="admin-link">🛡️ Admin</NavLink>
          )}
        </div>

        {isAuthenticated ? (
          <div className="auth-nav">
            <span className="user-greeting">
              {user?.firstName || user?.email?.split('@')[0]}
            </span>
            <button className="btn ghost" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <div className="auth-nav">
            <Link to="/login" className="btn ghost">Login</Link>
            <Link to="/register" className="btn primary">Sign Up</Link>
          </div>
        )}
      </div>
    </div>
  )
}
