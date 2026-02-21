import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.js'
import './styles/globals.css'

async function bootstrap(): Promise<void> {
  // Demo mode: dynamically import the interceptor so it is tree-shaken out of
  // production builds when VITE_DEMO_MODE is not 'true'.
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    const { installDemoInterceptor } = await import('./lib/demo/index.js')
    installDemoInterceptor()
  }

  const root = document.getElementById('root')
  if (!root) throw new Error('Root element #root not found in document')
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()
