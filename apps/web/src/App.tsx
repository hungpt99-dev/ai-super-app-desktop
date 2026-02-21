/**
 * App.tsx — root layout with React Router.
 * Sidebar + route outlet. Redirects to /login when not authenticated.
 */

import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { BotListPage } from './pages/BotListPage.js'
import { BotDetailPage } from './pages/BotDetailPage.js'
import { LoginPage } from './pages/LoginPage.js'
import { RegisterPage } from './pages/RegisterPage.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { DevicesPage } from './pages/DevicesPage.js'
import { MarketplacePage } from './pages/MarketplacePage.js'
import { MarketplaceDetailPage } from './pages/MarketplaceDetailPage.js'
import { WorkspacesPage } from './pages/WorkspacesPage.js'
import { WorkspaceDetailPage } from './pages/WorkspaceDetailPage.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { SubscriptionPage } from './pages/SubscriptionPage.js'
import { MachineDetailPage } from './pages/MachineDetailPage.js'
import { WebToastContainer } from './components/Toast.js'
import { WebNotificationCenter } from './components/NotificationCenter.js'
import { useNotificationStore } from './store/notification-store.js'
import { isAuthenticated, clearSession } from './lib/api-client.js'
import { useAuthStore } from './store/auth-store.js'

function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/devices', icon: '💻', label: 'Devices' },
  { to: '/marketplace', icon: '📦', label: 'Marketplace' },
  { to: '/workspaces', icon: '🗂️', label: 'Workspaces' },
  { to: '/bots', icon: '🤖', label: 'Bots' },
]

function Layout(): React.JSX.Element {
  const navigate = useNavigate()
  const { user, fetchMe, logout } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  const handleLogout = (): void => {
    void logout().finally(() => {
      clearSession()
      navigate('/login')
    })
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--color-bg)]">
      {/* Sidebar */}
      <nav
        className="flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--color-border)]
                   bg-[var(--color-surface)] py-4"
      >
        <div className="flex items-center justify-between px-4 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            AI SuperApp
          </p>
          {/* Bell button */}
          <button
            onClick={() => { setNotifOpen((v) => !v) }}
            aria-label={`Notifications${unreadCount > 0 ? ` (${String(unreadCount)} unread)` : ''}`}
            className="relative flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex-1 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]'
                }`
              }
            >
              {icon} {label}
            </NavLink>
          ))}
        </div>

        <div className="px-2 pt-2 border-t border-[var(--color-border)] mt-2 space-y-0.5">
          <NavLink
            to="/subscription"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]'
              }`
            }
          >
            ⭐ Subscription
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]'
              }`
            }
          >
            ⚙️ Settings
          </NavLink>

          {user && (
            <div className="px-3 py-2">
              <p className="truncate text-xs text-[var(--color-text-muted)]">{user.email}</p>
              <p className="text-xs text-[var(--color-text-muted)] capitalize">{user.plan} plan</p>
            </div>
          )}

          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm
                       text-[var(--color-text-secondary)] transition-colors
                       hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
            onClick={handleLogout}
          >
            ↩ Sign out
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="flex h-full flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/devices/:deviceId" element={<MachineDetailPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/:appId" element={<MarketplaceDetailPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="/bots" element={<BotListPage />} />
          <Route path="/bots/:botId" element={<BotDetailPage />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      {/* Notification center panel */}
      <WebNotificationCenter
        isOpen={notifOpen}
        onClose={() => { setNotifOpen(false) }}
        anchorLeft={220}
      />

      {/* Live toast overlay */}
      <WebToastContainer />
    </div>
  )
}

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
