import React, { useEffect, useState } from 'react'
import {
  GroupChatWindow,
  FeatureGrid,
  Sidebar,
  ToastContainer,
  SettingsPanel,
  AgentRunPanel,
  DashboardPanel,
  ActivityPanel,
  LogsPanel,
  APIKeysPanel,
  PermissionRequestDialog,
  NotificationCenter,
  AuthScreen,
  StorePanel,
} from './components/index.js'
import { useAuthStore } from './store/auth-store.js'
import { useAppStore } from './store/app-store.js'
import { DevMetricsOverlay } from './components/dev/index.js'
import { useDevSettingsStore } from './store/dev/dev-settings-store.js'
import { startAgentLoop, stopAgentLoop } from '../core/agent-loop.js'
import { usePermissionStore } from './store/permission-store.js'
import { useAgentsStore } from './store/agents-store.js'
import { getDesktopBridge } from './lib/bridge.js'
import { initModuleManager } from '../core/module-bootstrap.js'
import { initTokenStore } from '../sdk/token-store.js'

const bridge = getDesktopBridge()

/**
 * App — Root layout component.
 * Contains ONLY layout + view routing. No business logic.
 */
export function App(): React.JSX.Element {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setView)
  const pushNotification = useAppStore((s) => s.pushNotification)
  const unreadCount = useAppStore((s) => s.unreadCount)
  const requestPermissions = usePermissionStore((s) => s.requestPermissions)
  const { user } = useAuthStore()
  const showPerfMetrics = useDevSettingsStore((s) => s.enabled && s.showPerformanceMetrics)
  const [notifOpen, setNotifOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  // ── OAuth callback detection ────────────────────────────────────────────────
  // When the OAuth popup window mounts (after the backend redirects back), it
  // finds tokens in the URL, emits a Tauri 'oauth-callback' event, and closes
  // itself.  The main window never navigates away; the effect below is the
  // relay handler that runs in the POPUP window only.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const at = params.get('access_token')
    const rt = params.get('refresh_token')
    if (!at || !rt) return

    // Erase tokens from address bar immediately.
    window.history.replaceState({}, '', '/')

    void (async () => {
      // Tauri popup: emit event → main window listener (in loginWithOAuth) picks it up.
      try {
        const { emit } = await import('@tauri-apps/api/event')
        await emit('oauth-callback', { access_token: at, refresh_token: rt })
        window.close()
        return
      } catch { /* Not running in a Tauri popup context — fall through. */ }

      // Browser popup opened via window.open (e.g. during development).
      if (window.opener !== null) {
        const opener = window.opener as Window
        opener.postMessage(
          { type: 'oauth-callback', access_token: at, refresh_token: rt },
          window.location.origin,
        )
        window.close()
        return
      }

      // Fallback: webview navigated directly (no popup). Handle inline.
      void useAuthStore.getState().handleOAuthCallback(at, rt)
    })()
  }, [])

  // Auto-close auth modal once login succeeds
  useEffect(() => {
    if (user) {
      setAuthOpen(false)
    }
  }, [user])

  // Start/stop the agent worker loop based on auth state
  useEffect(() => {
    if (user) {
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
  }, [])

  // Wire the notification bridge: module notifyRenderer → bridge event → store
  useEffect(() => {
    const unsubscribe = bridge.notifications.onPush((notification) => {
      pushNotification(notification)
    })
    return unsubscribe
  }, [pushNotification])

  const handleOpenModule = (moduleId: string): void => {
    // User-created bot — select it and open the run panel.
    const { agents } = useAgentsStore.getState()
    if (agents.some((b) => b.id === moduleId)) {
      useAgentsStore.getState().selectAgent(moduleId)
      setView('agent-run')
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
        {activeView === 'dashboard' && <DashboardPanel onNavigate={setView} />}
        {activeView === 'chat' && <GroupChatWindow />}
        {activeView === 'agents' && <FeatureGrid onOpenModule={handleOpenModule} />}
        {activeView === 'store' && <StorePanel />}
        {activeView === 'activity' && <ActivityPanel onNavigate={setView} />}
        {activeView === 'logs' && <LogsPanel />}
        {activeView === 'settings' && <SettingsPanel onBack={() => { setView('chat') }} />}
        {activeView === 'api-keys' && <APIKeysPanel onBack={() => { setView('chat') }} />}
        {activeView === 'agent-run' && <AgentRunPanel onBack={() => { setView('agents') }} />}
      </main>

      {/* Global toast overlay — rendered outside main so it floats above all panels */}
      <ToastContainer />

      {/* Global permission request dialog — floats above everything */}
      <PermissionRequestDialog />

      {/* Developer performance metrics overlay */}
      {showPerfMetrics && <DevMetricsOverlay />}
    </div>
  )
}
