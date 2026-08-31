// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Logiciel propriétaire. Voir LICENSE. Mention à ne pas retirer.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import App from '@/App'
import './index.css'
import config from '@/app.config'

// Applique le thème enregistré (clair/sombre)
const theme = localStorage.getItem('theme') || 'light'
document.documentElement.setAttribute('data-theme', theme)
if (config.organisation?.accent) document.documentElement.style.setProperty('--accent', config.organisation.accent)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
