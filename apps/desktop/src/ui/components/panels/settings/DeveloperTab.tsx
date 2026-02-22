import React, { useState } from 'react'
import { useDevSettingsStore, type LogLevel } from '../../../store/dev/dev-settings-store.js'
import { Card, SectionTitle, SettingRow, Toggle } from './settings-shared.js'

export function DeveloperTab(): React.JSX.Element {
  const dev = useDevSettingsStore()
  const [confirmDisableSandbox, setConfirmDisableSandbox] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleDisableSandboxToggle = (v: boolean): void => {
    if (!v) {
      dev.setSetting('disableSandbox', false)
      setConfirmDisableSandbox(false)
      return
    }
    setConfirmDisableSandbox(true)
  }

  const handleCopySnapshot = (): void => {
    try {
      const appSettings: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith('agenthub')) appSettings[k] = localStorage.getItem(k) ?? ''
      }
      const snapshot = {
        timestamp: new Date().toISOString(),
        devSettings: {
          enabled: dev.enabled,
          gatewayUrlOverride: dev.gatewayUrlOverride,
          logLevel: dev.logLevel,
          verboseRequests: dev.verboseRequests,
          showSandboxErrors: dev.showSandboxErrors,
          disableSandbox: dev.disableSandbox,
          mockAiResponses: dev.mockAiResponses,
          experimentalFeatures: dev.experimentalFeatures,
          showPerformanceMetrics: dev.showPerformanceMetrics,
        },
        appSettings,
        userAgent: navigator.userAgent,
      }
      void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 2_000)
    } catch { /* clipboard unavailable */ }
  }

  const handleReset = (): void => {
    if (!confirmReset) { setConfirmReset(true); return }
    dev.reset()
    setConfirmReset(false)
  }

  return (
    <div className="space-y-5">
      {/* Master toggle */}
      <Card>
        <SettingRow
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          }
          label="Developer mode"
          description="Unlock advanced configuration, override endpoints, and debug tooling"
          control={<Toggle checked={dev.enabled} onChange={dev.setEnabled} />}
          border={!dev.enabled}
        />
        {dev.enabled && (
          <div className="flex items-start gap-2.5 border-t border-amber-800/30 bg-amber-900/10 px-4 py-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-400">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-[11px] leading-relaxed text-amber-400">
              Developer mode is active. Some settings below can break functionality or expose security risks.
              Do not share debug snapshots publicly as they may contain sensitive local information.
            </p>
          </div>
        )}
      </Card>

      {dev.enabled && (
        <>
          {/* ── Connection ──────────────────────────────────────────────────── */}
          <div>
            <SectionTitle>Connection</SectionTitle>
            <Card>
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">Gateway URL override</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                    Redirect API traffic to a custom endpoint. Leave empty to use the compiled-in default.
                    Example: <span className="font-mono text-[var(--color-text-secondary)]">http://localhost:3000</span>
                  </p>
                  <input
                    type="url"
                    value={dev.gatewayUrlOverride}
                    onChange={(e) => { dev.setSetting('gatewayUrlOverride', e.target.value) }}
                    placeholder="https://api.agenthub.com"
                    spellCheck={false}
                    className="mt-2.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-[11px] text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                  />
                  {dev.gatewayUrlOverride.trim() && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="text-[10px] text-amber-400">Custom gateway active — compiled-in endpoint bypassed</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* ── Logging ──────────────────────────────────────────────────── */}
          <div>
            <SectionTitle>Logging</SectionTitle>
            <Card>
              <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">Minimum log level</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">Filter which entries appear in the Logs panel</p>
                </div>
                <select
                  value={dev.logLevel}
                  onChange={(e) => { dev.setSetting('logLevel', e.target.value as LogLevel) }}
                  className="shrink-0 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                }
                label="Verbose request logging"
                description="Log full request and response bodies for every outbound HTTP call"
                control={<Toggle checked={dev.verboseRequests} onChange={(v) => { dev.setSetting('verboseRequests', v) }} />}
                border={false}
              />
            </Card>
          </div>

          {/* ── Sandbox ──────────────────────────────────────────────────── */}
          <div>
            <SectionTitle>Sandbox</SectionTitle>
            <Card>
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                }
                label="Surface sandbox errors"
                description="Show module sandbox exceptions in the chat UI instead of silently swallowing them"
                control={<Toggle checked={dev.showSandboxErrors} onChange={(v) => { dev.setSetting('showSandboxErrors', v) }} />}
              />
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                }
                label="Disable permission sandbox"
                description="Bypass the permission engine for all module tool calls. For local module development only."
                control={<Toggle checked={dev.disableSandbox} onChange={handleDisableSandboxToggle} />}
                danger
                border={false}
              />
              {confirmDisableSandbox && (
                <div className="flex items-center gap-2 border-t border-red-900/30 bg-red-950/20 px-4 py-2.5">
                  <p className="flex-1 text-[10px] leading-relaxed text-red-400">
                    ⚠ This removes all safety guardrails. Only use in a fully local dev environment with trusted modules.
                  </p>
                  <button
                    onClick={() => { setConfirmDisableSandbox(false) }}
                    className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { dev.setSetting('disableSandbox', true); setConfirmDisableSandbox(false) }}
                    className="shrink-0 rounded-lg border border-red-800 bg-red-900/40 px-2.5 py-1 text-[10px] font-medium text-red-300 hover:bg-red-900/60"
                  >
                    Disable sandbox
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* ── AI & LLMs ────────────────────────────────────────────────── */}
          <div>
            <SectionTitle>AI &amp; Language Models</SectionTitle>
            <Card>
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                    <rect x="9" y="9" width="6" height="6"/>
                    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
                    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
                    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
                    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
                  </svg>
                }
                label="Mock AI responses"
                description="Return instant synthetic stub responses without calling any AI provider. Ideal for UI-only testing and layout work."
                control={<Toggle checked={dev.mockAiResponses} onChange={(v) => { dev.setSetting('mockAiResponses', v) }} />}
                border={false}
              />
            </Card>
          </div>

          {/* ── Experimental ────────────────────────────────────────────── */}
          <div>
            <SectionTitle>Experimental</SectionTitle>
            <Card>
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/>
                  </svg>
                }
                label="Experimental features"
                description="Enable features still in development. May be unstable or change without notice."
                control={<Toggle checked={dev.experimentalFeatures} onChange={(v) => { dev.setSetting('experimentalFeatures', v) }} />}
              />
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                }
                label="Performance metrics overlay"
                description="Show a floating FPS counter and memory usage widget in the corner of the app"
                control={<Toggle checked={dev.showPerformanceMetrics} onChange={(v) => { dev.setSetting('showPerformanceMetrics', v) }} />}
                border={false}
              />
            </Card>
          </div>

          {/* ── Developer Tools ─────────────────────────────────────────── */}
          <div>
            <SectionTitle>Developer tools</SectionTitle>
            <Card>
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                }
                label="Copy debug snapshot"
                description="Copy a JSON object with current dev settings and app storage keys to your clipboard"
                control={
                  <button
                    onClick={handleCopySnapshot}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-primary)]"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                }
              />
              <SettingRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                }
                label="Reset developer settings"
                description="Restore all developer settings to their default values"
                control={
                  <button
                    onClick={handleReset}
                    onBlur={() => { setConfirmReset(false) }}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      confirmReset
                        ? 'border-red-800/60 text-red-400'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-red-800/40 hover:text-red-400'
                    }`}
                  >
                    {confirmReset ? '⚠ Confirm?' : 'Reset'}
                  </button>
                }
                danger={confirmReset}
                border={false}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
