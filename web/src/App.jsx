import Dashboard from './pages/Dashboard';
import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Loader from './components/Loader.jsx'
import Home from './pages/Home.jsx'
import KlickLanding from './pages/KlickLanding.jsx'
import JoinKlickLanding from './pages/JoinKlickLanding.jsx'
import Demo from './pages/Demo.jsx'
import Features from './pages/Features.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import Stores from './pages/Stores.jsx'
import Install from './pages/Install.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import UserDashboard from './pages/UserDashboard.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import Contact from './pages/Contact.jsx'
import Privacy from './pages/Privacy.jsx'
import Lens from './pages/Lens.jsx'
import Services from './pages/Services.jsx'
import SmartCompare from './pages/SmartCompare.jsx'
import Vendor from './pages/Vendor.jsx'
import Promote from './pages/Promote.jsx'
import Network from './pages/Network.jsx'
import VendorLogin from './pages/VendorLogin.jsx'
import PrePay from './pages/PrePay.jsx'
import AuthProvider, { useAuth } from './context/AuthContext.jsx'

// The site root adapts to who's viewing:
//  - Signed-out visitors (search / marketing) get the "Join the Klick" landing.
//  - Signed-in members see the full previous website (old Home + all sections).
function RootLanding(){
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return isAuthenticated ? <Home/> : <JoinKlickLanding/>
}

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
              <Route path="/" element={<RootLanding/>}/>
              <Route path="/landing" element={<JoinKlickLanding/>}/>
              <Route path="/just-klick" element={<KlickLanding/>}/>
              <Route path="/demo" element={<Demo/>}/>
              <Route path="/home" element={<Home/>}/>
              <Route path="/features" element={<Features/>}/>
              <Route path="/how-it-works" element={<HowItWorks/>}/>
              <Route path="/stores" element={<Stores/>}/>
              <Route path="/install" element={<Install/>}/>
              <Route path="/dashboard" element={<Dashboard/>} />
              <Route path="/user-dashboard" element={<UserDashboard/>} />
              <Route path="/admin" element={<AdminPanel/>} />
              <Route path="/login" element={<Login/>} />
              <Route path="/register" element={<Register/>} />
              <Route path="/contact" element={<Contact/>} />
              <Route path="/privacy" element={<Privacy/>} />
              <Route path="/lens" element={<Lens/>} />
              <Route path="/services" element={<Services/>} />
              <Route path="/smart-compare" element={<SmartCompare/>} />
              <Route path="/compare" element={<SmartCompare/>} />
              <Route path="/vendor" element={<Vendor/>} />
              <Route path="/vendors" element={<Vendor/>} />
              <Route path="/promote" element={<Promote/>} />
              <Route path="/network" element={<Network/>} />
              <Route path="/vendor-login" element={<VendorLogin/>} />
              <Route path="/prepay" element={<PrePay/>} />
            </Routes>
            <Footer/>
          </>
        )}
      </div>
    </AuthProvider>
  )
}