import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import UserProvider from './context/UserContext';
import App from './App.jsx'
import './styles/global.css'
import './styles/animations.css'
import { ToastProvider } from "./components/ToastProvider";

createRoot(document.getElementById('root')).render(
  <BrowserRouter><UserProvider>
   <ToastProvider>
      <App />
    </ToastProvider>
  </UserProvider></BrowserRouter>
)