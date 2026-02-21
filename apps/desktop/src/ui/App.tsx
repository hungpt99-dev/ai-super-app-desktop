import React, { useEffect, useState } from 'react'
import { ChatWindow } from './components/ChatWindow.js'
import { FeatureGrid } from './components/FeatureGrid.js'
import { ModuleStore } from './components/ModuleStore.js'
import { Sidebar } from './components/Sidebar.js'
import { ToastContainer } from './components/Toast.js'
import { SettingsPanel } from './components/SettingsPanel.js'
import { CryptoPanel } from './components/modules/CryptoPanel.js'
import { WritingHelperPanel } from './components/modules/WritingHelperPanel.js'
import { APIKeysPanel } from './components/APIKeysPanel.js'
import { PermissionRequestDialog } from './components/PermissionRequestDialog.js'
import { NotificationCenter } from './components/NotificationCenter.js'
import { AuthScreen } from './components/AuthScreen.js'
import { useAuthStore } from './store/auth-store.js'
import { useAppStore } from './store/app-store.js'
import { startAgentLoop, stopAgentLoop } from '../core/agent-loop.js'
import { usePermissionStore } from './store/permission-store.js'
import { getDesktopBridge } from './lib/bridge.js'
import { initModuleManager } from '../core/module-bootstrap.js'
import { initTokenStore } from '../sdk/token-store.js'

const bridge = getDesktopBridge()

/**
 * App — Root layout component.
 * Contains ONLY layout + view routing. No business logic.
 */
export function App(): React.JSX.Element {
  const { activeView, setView, pushNotification, unreadCount } = useAppStore()
  const { requestPermissions } = usePermissionStore()
  const { user } = useAuthStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  // Auto-close auth modal once login succeeds
  useEffect(() => {
    if (user !== null && user !== undefined) {
      setAuthOpen(false)
    }
  }, [user])

  // Start/stop the agent worker loop based on auth state
  useEffect(() => {
    if (user !== null && user !== undefined) {
      void startAgentLoop()
    } else {
      stopAgentLoop()
    }
  }, [user])

  // Initialise token store and module manager on mount.
  useEffect(() => {
    void (async () => {
      await initTokenStore()
      await initModuleManager((moduleId, permissions) =>
        requestPermissions(moduleId, moduleId, permissions),
      )
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <Sidebar
        activeView={activeView}
        onNavigate={setView}
        unreadCount={unreadCount}
        onNotifications={() => { setNotifOpen((v) => !v) }}
        onSignIn={() => { setAuthOpen(true) }}
      />

      {authOpen ? (
        <div className="absolute inset-0 z-50">
          <AuthScreen onClose={() => { setAuthOpen(false) }} />
        </div>
      ) : null}

      <NotificationCenter isOpen={notifOpen} onClose={() => { setNotifOpen(false) }} />

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

      {/* Global permission request dialog — floats above everything */}
      <PermissionRequestDialog />
    </div>
  )
}
