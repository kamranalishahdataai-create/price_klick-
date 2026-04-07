import Dashboard from './pages/Dashboard';
import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Loader from './components/Loader.jsx'
import Home from './pages/Home.jsx'
import Features from './pages/Features.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import Stores from './pages/Stores.jsx'
import Install from './pages/Install.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import UserDashboard from './pages/UserDashboard.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import AuthProvider from './context/AuthContext.jsx'

export default function App(){
  const [showContent, setShowContent] = useState(false)

  const handleLoaderComplete = () => {
    setShowContent(true)
  }

  return (
    <AuthProvider>
      <div className="page-transition">
        <Loader onComplete={handleLoaderComplete} />
        {showContent && (
          <>
            <Navbar/>
            <Routes>
              <Route path="/" element={<Home/>}/>
              <Route path="/features" element={<Features/>}/>
              <Route path="/how-it-works" element={<HowItWorks/>}/>
              <Route path="/stores" element={<Stores/>}/>
              <Route path="/install" element={<Install/>}/>
              <Route path="/dashboard" element={<Dashboard/>} />
              <Route path="/user-dashboard" element={<UserDashboard/>} />
              <Route path="/admin" element={<AdminPanel/>} />
              <Route path="/login" element={<Login/>} />
              <Route path="/register" element={<Register/>} />
            </Routes>
            <Footer/>
          </>
        )}
      </div>
    </AuthProvider>
  )
}