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

        {isAuthenticated ? (
          <div className="auth-nav">
            {user?.role === 'admin' && (
              <NavLink to="/admin" className="admin-link">Admin</NavLink>
            )}
            <span className="user-greeting">
              {user?.firstName || user?.email?.split('@')[0]}
            </span>
            <button className="btn ghost logout" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <div className="auth-nav">
            <Link to="/login" className="nav-login">Login</Link>
            <Link to="/install" className="nav-install">Install Free</Link>
          </div>
        )}
      </div>
    </div>
  )
}
