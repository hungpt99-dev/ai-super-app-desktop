import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.js'
import './styles/globals.css'
import { IS_DEMO } from './lib/api-client.js'
import { setToken, setRefreshToken } from './lib/api-client.js'

// In demo mode, seed a fake session so RequireAuth passes immediately.
if (IS_DEMO) {
  setToken('demo-token')
  setRefreshToken('demo-refresh')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
