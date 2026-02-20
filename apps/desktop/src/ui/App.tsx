import React, { useEffect } from 'react'
import { ChatWindow } from './components/ChatWindow.js'
import { FeatureGrid } from './components/FeatureGrid.js'
import { ModuleStore } from './components/ModuleStore.js'
import { Sidebar } from './components/Sidebar.js'
import { ToastContainer } from './components/Toast.js'
import { SettingsPanel } from './components/SettingsPanel.js'
import { CryptoPanel } from './components/modules/CryptoPanel.js'
import { WritingHelperPanel } from './components/modules/WritingHelperPanel.js'
import { APIKeysPanel } from './components/APIKeysPanel.js'
import { useAppStore } from './store/app-store.js'
import { getDesktopBridge } from './lib/bridge.js'
import { initModuleManager } from '../core/module-bootstrap.js'
import { initTokenStore } from '../sdk/token-store.js'

const bridge = getDesktopBridge()

/**
 * App — Root layout component.
 * Contains ONLY layout + view routing. No business logic.
 */
export function App(): React.JSX.Element {
  const { activeView, setView, pushNotification } = useAppStore()

  // Initialise token store (warms the Tauri credential cache) and the
  // module manager (registers + activates all built-in modules) once on mount.
  useEffect(() => {
    void (async () => {
      await initTokenStore()
      await initModuleManager()
    })()
  }, [])

  // Wire the notification bridge: module notifyRenderer → bridge event → store
  useEffect(() => {
    const unsubscribe = bridge.notifications.onPush((notification) => {
      pushNotification(notification)
    })
    return unsubscribe
  }, [pushNotification])

  const handleOpenModule = (moduleId: string): void => {
    if (moduleId === 'crypto' || moduleId === 'writing-helper') {
      setView(moduleId as 'crypto' | 'writing-helper')
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--color-bg)]">
      <Sidebar activeView={activeView} onNavigate={setView} />

      <main className="flex h-full flex-1 flex-col overflow-hidden">
        {activeView === 'chat' && <ChatWindow />}
        {activeView === 'features' && <FeatureGrid onOpenModule={handleOpenModule} />}
        {activeView === 'store' && <ModuleStore />}
        {activeView === 'settings' && <SettingsPanel onBack={() => setView('chat')} />}
        {activeView === 'api-keys' && <APIKeysPanel onBack={() => setView('chat')} />}
        {activeView === 'crypto' && <CryptoPanel onBack={() => setView('features')} />}
        {activeView === 'writing-helper' && <WritingHelperPanel onBack={() => setView('features')} />}
      </main>

      {/* Global toast overlay — rendered outside main so it floats above all panels */}
      <ToastContainer />
    </div>
  )
}
