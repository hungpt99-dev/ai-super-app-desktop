import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import './styles/globals.css'

// Apply persisted appearance preferences before first render so there is no flash.
try {
  const fs = localStorage.getItem('agenthub-font-size')
  if (fs) document.documentElement.setAttribute('data-font-size', fs)
  if (localStorage.getItem('agenthub-compact') === 'true')
    document.documentElement.setAttribute('data-compact', 'true')
  if (localStorage.getItem('agenthub-reduced-motion') === 'true')
    document.documentElement.setAttribute('data-reduced-motion', 'true')
} catch { /* ignore — localStorage unavailable */ }

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
