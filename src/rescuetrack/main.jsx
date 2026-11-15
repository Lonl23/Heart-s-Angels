// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import '../index.css'
import './rescuetrack.css'
import config from '@/app.config'

const theme = localStorage.getItem('theme') || 'light'
document.documentElement.setAttribute('data-theme', theme)
if (config.organisation?.accent) document.documentElement.style.setProperty('--accent', config.organisation.accent)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/rescuetrack">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
