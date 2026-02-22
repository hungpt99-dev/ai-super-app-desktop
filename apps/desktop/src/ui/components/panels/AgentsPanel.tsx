/**
 * AgentsPanel.tsx
 *
 * Agent detail panel with three tabs:
 *   - Custom UI  - rich per-template/category widget (hidden for agents with no template)
 *   - Detail     - goal editing, run CTA, latest output, chat, run history
 *   - Settings   - name, description, status, danger zone
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAgentsStore, type IDesktopAgent, type IDesktopAgentRun, type IChatMessage, type IAgentCredential } from '../../store/agents-store.js'
import { findTemplate, type IAgentTemplate } from '../../store/agent-templates.js'
import { CryptoPanel, WritingHelperPanel } from '../modules/index.js'

const MODULE_PANELS: Record<string, React.ComponentType<any>> = {
  'crypto-analysis': CryptoPanel,
  'writing-helper': WritingHelperPanel,
}
import { useAppStore } from '../../store/app-store.js'

// ─── Shared Components ────────────────────────────────────────────────────────

function RunItem({ run }: { run: IDesktopAgentRun }): React.JSX.Element {
  const isError = run.status === 'failed'
  const isSuccess = run.status === 'completed'
  const isCancelled = run.status === 'cancelled'

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 transition-colors hover:bg-[var(--color-surface-3)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${isSuccess ? 'bg-[var(--color-success)]' : isError ? 'bg-[var(--color-danger)]' : isCancelled ? 'bg-[var(--color-text-muted)]' : 'animate-pulse bg-blue-400'}`} />
          <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">
            {run.result || (run.status === 'pending' ? 'Queued...' : 'Executing...')}
          </p>
        </div>
        <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
          {new Date(run.started_at).toLocaleString()} · {run.steps} steps
        </p>
      </div>
      <div className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${isSuccess ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : isError ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : isCancelled ? 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]' : 'bg-blue-400/10 text-blue-400'}`}>
        {run.status}
      </div>
    </div>
  )
}

function CredentialRow({ cred, onRemove }: { cred: IAgentCredential; onRemove: () => void }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{cred.key}</p>
        <p className="truncate text-[10px] text-[var(--color-text-muted)] font-mono">••••••••</p>
      </div>
      <button
        onClick={onRemove}
        className="ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
        title="Remove credential"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function AddCredentialForm({ onAdd }: { onAdd: (c: IAgentCredential) => void }): React.JSX.Element {
  const [key, setKey] = useState('')
  const [val, setVal] = useState('')

  const handleAdd = (): void => {
    if (!key.trim() || !val.trim()) return
    onAdd({ key: key.trim(), value: val.trim(), masked: false })
    setKey(''); setVal('')
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-3">
      <div className="flex gap-2">
        <input
          placeholder="Service Name (e.g. GitHub)"
          value={key}
          onChange={(e) => { setKey(e.target.value) }}
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
        />
        <input
          placeholder="Secret / Token"
          value={val}
          onChange={(e) => { setVal(e.target.value) }}
          type="password"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
        />
      </div>
      <button
        onClick={handleAdd}
        disabled={!key.trim() || !val.trim()}
        className="w-full rounded-lg bg-[var(--color-surface-3)] py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-white disabled:opacity-50"
      >
        + Add Credential
      </button>
    </div>
  )
}

// ─── Live run progress panel ──────────────────────────────────────────────────

/**
 * Shows an animated step-by-step progress panel while an agent run is executing.
 * Subscribes directly to the store so it re-renders on every `patchRuns` call.
 */
function RunProgress({ agentId, runId }: { agentId: string; runId: string }): React.JSX.Element {
  const runs = useAgentsStore((s) => s.runs)
  const run = (runs[agentId] ?? []).find((r) => r.id === runId)
  const planned = run?.plannedSteps ?? ['Running…']
  const logs = run?.logs ?? []

  return (
    <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Live Execution</h3>
        <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
      </div>

      <div className="space-y-3 relative">
        {/* Connector line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-blue-400/10" />

        {planned.map((step, idx) => {
          const isDone = idx < logs.length
          const isCurrent = idx === logs.length
          const isPending = idx > logs.length

          return (
            <div key={idx} className={`flex items-start gap-3 transition-opacity duration-300 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
              <div className={`mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 z-10 flex items-center justify-center transition-colors ${isDone ? 'bg-blue-400 border-blue-400' :
                isCurrent ? 'bg-white border-blue-400 animate-pulse' :
                  'bg-[var(--color-bg)] border-[var(--color-border)]'
                }`}>
                {isDone && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-xs font-medium transition-colors ${isCurrent ? 'text-blue-400' : isDone ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                  {step}
                </p>
                {isCurrent && (
                  <p className="mt-0.5 text-[10px] text-blue-400/70 font-mono animate-pulse">Running step {idx + 1}...</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Run history section (collapsed by default) ───────────────────────────────

function RunHistorySection({ agentRuns, agentId }: { agentRuns: IDesktopAgentRun[]; agentId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button
        onClick={() => { setOpen(!open) }}
        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <span className="text-[8px]">{open ? '▾' : '▸'}</span>
        Agent Run History
        <span className="ml-1 rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5">{String(agentRuns.length)}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {agentRuns.map((run) => <RunItem key={run.id} run={run} />)}
          <button
            onClick={() => { void useAgentsStore.getState().loadRuns(agentId) }}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Refresh
          </button>
        </div>
      )}
    </section>
  )
}
// ─── Custom UI tab ────────────────────────────────────────────────────────────

function CustomTabContent({ agent, latestRun }: { agent: IDesktopAgent; latestRun?: IDesktopAgentRun | undefined }): React.JSX.Element | null {
  if (!agent.templateId) return null
  const Panel = MODULE_PANELS[agent.templateId]
  if (!Panel) return null
  return <Panel agent={agent} latestRun={latestRun} />
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ agent, template, colorClass, onDelete, isRunning, onStop }: {
  agent: IDesktopAgent
  template?: IAgentTemplate | undefined
  colorClass: string
  onDelete: () => void
  isRunning: boolean
  onStop: () => void
}): React.JSX.Element {
  const [name, setName] = useState(agent.name)
  const [desc, setDesc] = useState(agent.description)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // API key override state
  const [apiKey, setApiKey] = useState(agent.apiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [savedKey, setSavedKey] = useState(false)

  // AI provider override state
  const [aiProvider, setAiProvider] = useState(agent.aiProvider ?? '')
  const [savingProv, setSavingProv] = useState(false)
  const [savedProv, setSavedProv] = useState(false)

  // Credentials state
  const [credentials, setCredentials] = useState<IAgentCredential[]>(agent.credentials ?? [])

  // Agent memory state
  const [memoryContext, setMemoryContext] = useState<string | null>(null)
  const [loadingMemory, setLoadingMemory] = useState(false)
  const [clearingMemory, setClearingMemory] = useState(false)
  const [memoryCleaned, setMemoryCleaned] = useState(false)

  const loadMemoryPreview = async (): Promise<void> => {
    setLoadingMemory(true)
    const ctx = await useAgentsStore.getState().buildAgentMemoryContext(agent.id)
    setMemoryContext(ctx || null)
    setLoadingMemory(false)
  }

  const handleClearMemory = async (): Promise<void> => {
    setClearingMemory(true)
    await useAgentsStore.getState().clearAgentMemory(agent.id)
    setMemoryContext(null)
    setClearingMemory(false)
    setMemoryCleaned(true)
    setTimeout(() => { setMemoryCleaned(false) }, 2_000)
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    await useAgentsStore.getState().updateAgent(agent.id, { name: name.trim(), description: desc.trim() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false) }, 2_000)
  }

  const handleSaveKey = async (): Promise<void> => {
    setSavingKey(true)
    const trimmed = apiKey.trim()
    if (trimmed) {
      await useAgentsStore.getState().updateAgent(agent.id, { apiKey: trimmed })
    } else {
      useAgentsStore.getState().clearAgentApiKey(agent.id)
    }
    setSavingKey(false)
    setSavedKey(true)
    setTimeout(() => { setSavedKey(false) }, 2_000)
  }

  const handleSaveProvider = async (): Promise<void> => {
    setSavingProv(true)
    if (aiProvider) {
      await useAgentsStore.getState().updateAgent(agent.id, { aiProvider })
    } else {
      useAgentsStore.getState().clearAgentAiProvider(agent.id)
    }
    setSavingProv(false)
    setSavedProv(true)
    setTimeout(() => { setSavedProv(false) }, 2_000)
  }

  return (
    <div className="space-y-6">
      {/* Active Run — shown only when the agent is currently executing */}
      {isRunning && (
        <section>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-blue-400">Active Run</p>
          <div className="flex items-center justify-between rounded-2xl border border-blue-400/30 bg-blue-400/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Agent is currently running</p>
                <p className="text-xs text-[var(--color-text-muted)]">Stop will cancel execution and mark the run as cancelled.</p>
              </div>
            </div>
            <button
              onClick={onStop}
              className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/20"
            >
              ■ Stop Activity
            </button>
          </div>
        </section>
      )}

      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Identity</p>
        <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">Agent Name</label>
            <input value={name} onChange={(e) => { setName(e.target.value) }} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">Description</label>
            <textarea value={desc} onChange={(e) => { setDesc(e.target.value) }} rows={3} className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]" />
          </div>
          <button onClick={() => { void handleSave() }} disabled={!name.trim() || saving} className="rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </section>

      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">API Key</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Override the global AI key for this agent only.
            Leave blank to use the app-wide key from <span className="font-medium text-[var(--color-text-primary)]">Settings › API Keys</span>.
          </p>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value) }}
              placeholder="sk-… or leave blank to inherit global key"
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 pr-16 font-mono text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => { setShowKey((v) => !v) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { void handleSaveKey() }}
              disabled={savingKey}
              className="rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {savedKey ? '✓ Saved' : savingKey ? 'Saving…' : 'Save Key'}
            </button>
            {apiKey.trim() && (
              <button
                type="button"
                onClick={() => {
                  setApiKey('')
                  useAgentsStore.getState().clearAgentApiKey(agent.id)
                }}
                className="text-xs text-[var(--color-danger)] hover:underline"
              >
                Clear Key
              </button>
            )}
            {agent.apiKey && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Custom key active
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">AI Provider</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Override the AI provider for this agent. Leave on <span className="font-medium text-[var(--color-text-primary)]">Auto</span> to inherit
            the app-wide provider from <span className="font-medium text-[var(--color-text-primary)]">Settings › API Keys</span>.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: '', label: 'Auto', icon: '✦', hint: 'App default' },
              { value: 'openai', label: 'OpenAI', icon: '⬡', hint: 'GPT-4o' },
              { value: 'anthropic', label: 'Anthropic', icon: '◈', hint: 'Claude' },
              { value: 'gemini', label: 'Gemini', icon: '◇', hint: 'Gemini 2.0' },
              { value: 'groq', label: 'Groq', icon: '⚡', hint: 'Llama 3' },
              { value: 'ollama', label: 'Ollama', icon: '🦙', hint: 'Local model' },
            ] as const).map(({ value, label, icon, hint }) => {
              const active = aiProvider === value
              return (
                <button
                  key={value || '__auto'}
                  type="button"
                  onClick={() => { setAiProvider(value) }}
                  className={[
                    'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                  ].join(' ')}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className={`mt-1 text-xs font-semibold ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{label}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{hint}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { void handleSaveProvider() }}
              disabled={savingProv}
              className="rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {savedProv ? '✓ Saved' : savingProv ? 'Saving…' : 'Save Provider'}
            </button>
            {agent.aiProvider && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Custom provider active
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Agent Memory ─────────────────────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Private Memory</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            This agent's private memory — preferences, learned behaviours, and past context — is stored
            <span className="font-medium text-[var(--color-text-primary)]"> locally on your machine</span> and automatically
            injected into every AI call.
          </p>

          {/* Scope pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Private', hint: `agent:${agent.id.slice(0, 8)}…`, color: 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/8' },
              { label: 'Shared', hint: 'workspace:shared', color: 'border-[var(--color-border)] text-[var(--color-text-muted)]' },
              { label: 'Ephemeral', hint: 'task:runId', color: 'border-[var(--color-border)] text-[var(--color-text-muted)]' },
            ].map(({ label, hint, color }) => (
              <div key={label} className={`rounded-lg border px-3 py-1.5 ${color}`}>
                <p className="text-[10px] font-semibold">{label}</p>
                <p className="font-mono text-[9px] opacity-70">{hint}</p>
              </div>
            ))}
          </div>

          {/* Context preview */}
          {memoryContext !== null && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Context Preview</p>
              <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                {memoryContext}
              </p>
            </div>
          )}
          {memoryContext === null && !loadingMemory && (
            <p className="text-xs italic text-[var(--color-text-muted)]">No private memories stored yet for this agent.</p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => { void loadMemoryPreview() }}
              disabled={loadingMemory}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {loadingMemory ? 'Loading…' : 'Preview Memory'}
            </button>
            <button
              onClick={() => { void handleClearMemory() }}
              disabled={clearingMemory}
              className="rounded-xl border border-[var(--color-danger)]/40 px-4 py-2 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
            >
              {memoryCleaned ? '✓ Cleared' : clearingMemory ? 'Clearing…' : 'Clear Memory'}
            </button>
          </div>
        </div>
      </section>

      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Credentials</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Store login credentials, API tokens, or any data the agent needs when interacting with external
            services. Saved <span className="font-medium text-[var(--color-text-primary)]">locally only</span> — never sent to the server.
          </p>

          {credentials.length > 0 && (
            <div className="space-y-2">
              {credentials.map((cred, idx) => (
                <CredentialRow
                  key={idx}
                  cred={cred}
                  onRemove={() => {
                    const next = credentials.filter((_, i) => i !== idx)
                    setCredentials(next)
                    useAgentsStore.getState().updateAgentCredentials(agent.id, next)
                  }}
                />
              ))}
            </div>
          )}

          <AddCredentialForm
            onAdd={(cred) => {
              const next = [...credentials, cred]
              setCredentials(next)
              useAgentsStore.getState().updateAgentCredentials(agent.id, next)
            }}
          />

          {credentials.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCredentials([])
                useAgentsStore.getState().updateAgentCredentials(agent.id, [])
              }}
              className="text-xs text-[var(--color-danger)] hover:underline"
            >
              Clear all credentials
            </button>
          )}
        </div>
      </section>

      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Info</p>
        <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {[
            { label: 'Agent ID', value: agent.id },
            { label: 'Template', value: template?.name ?? 'Custom' },
            { label: 'Sync', value: agent.synced ? 'Cloud' : 'Local only' },
            { label: 'Created', value: new Date(agent.created_at).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
              <p className="text-xs font-medium text-[var(--color-text-primary)] capitalize">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</p>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{agent.status === 'active' ? 'Active' : 'Paused'}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{agent.status === 'active' ? 'Agent will run when triggered.' : 'Agent is paused and will not execute.'}</p>
          </div>
          <button
            onClick={() => { void useAgentsStore.getState().toggleStatus(agent.id) }}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${agent.status === 'active'
              ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
              }`}
          >
            {agent.status === 'active' ? 'Pause Agent' : 'Activate Agent'}
          </button>
        </div>
      </section>

      {template && (
        <section>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Template</p>
          <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <span className="text-3xl">{template.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{template.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{template.description}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${colorClass}`}>{template.name}</span>
          </div>
        </section>
      )}

      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-red-400">Danger Zone</p>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-surface)] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Delete this agent</p>
            <p className="text-xs text-[var(--color-text-muted)]">All run history will be permanently erased.</p>
          </div>
          <button onClick={onDelete} className="rounded-xl border border-[var(--color-danger)]/40 px-4 py-2 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10">
            Delete
          </button>
        </div>
      </section>
    </div>
  )
}

// ─── AgentRunPanel (Main Export) ───────────────────────────────────────────────

type AgentTab = 'custom' | 'settings'

export interface IAgentRunPanelProps {
  onBack: () => void
}

export function AgentRunPanel({ onBack }: IAgentRunPanelProps): React.JSX.Element {
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId)
  const agents = useAgentsStore((s) => s.agents)
  const runs = useAgentsStore((s) => s.runs)
  const runningAgentIds = useAgentsStore((s) => s.runningAgentIds)
  const setView = useAppStore((s) => s.setView)

  const agent = agents.find((b) => b.id === selectedAgentId)
  const agentRuns = selectedAgentId ? (runs[selectedAgentId] ?? []) : []
  const isRunning = selectedAgentId !== null && runningAgentIds.includes(selectedAgentId)
  const hasActive = agentRuns.some((r) => r.status === 'pending' || r.status === 'running')
  const latestRun = agentRuns[0]

  const template = agent?.templateId ? findTemplate(agent.templateId) : undefined
  const colorClass = template?.colorClass ?? 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
  const hasCustom = agent?.templateId !== undefined && agent.templateId in MODULE_PANELS

  const [tab, setTab] = useState<AgentTab>(hasCustom ? 'custom' : 'settings')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Auto-switch away from "custom" if agent has no template
  useEffect(() => {
    if (!hasCustom && tab === 'custom') setTab('settings')
  }, [hasCustom, tab])

  // Polling for active runs
  useEffect(() => {
    if (!selectedAgentId || !hasActive) return
    const timer = setInterval(() => { void useAgentsStore.getState().loadRuns(selectedAgentId) }, 5_000)
    return () => { clearInterval(timer) }
  }, [selectedAgentId, hasActive])

  // If agent no longer exists (e.g. deleted), go back to list
  useEffect(() => {
    if (!agent) setView('agents')
  }, [agent, setView])

  if (!agent) return <div />

  const busy = isRunning || hasActive

  const handleDelete = (): void => {
    void useAgentsStore.getState().deleteAgent(agent.id).then(() => { onBack() })
  }

  const customTabLabel = template ? `${template.icon} ${template.name}` : 'Widget'
  const tabs: { id: AgentTab; label: string }[] = [
    ...(hasCustom ? [{ id: 'custom' as AgentTab, label: customTabLabel }] : []),
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-0 pt-4">
        <div className="flex items-center gap-3 pb-4">
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-xl">
            {template?.icon ?? '🤖'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-[var(--color-text-primary)]">{agent.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${agent.status === 'active' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-yellow-400/15 text-yellow-400'
                }`}>
                {agent.status}
              </span>
              {template && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${colorClass}`}>{template.name}</span>
              )}
              {agent.synced
                ? <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">Cloud</span>
                : <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">Local</span>
              }
              {isRunning && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" /> Running
                </span>
              )}
            </div>
            {agent.description && <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{agent.description}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {agent.status === 'active' && (
              <button
                onClick={() => { useAgentsStore.getState().runAgent(agent.id) }}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-success)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                Run Now
              </button>
            )}

            {isRunning && (
              <button
                onClick={() => { useAgentsStore.getState().stopAgent(agent.id) }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/20"
              >
                Stop
              </button>
            )}

            {agent.status === 'paused' && (
              <button
                onClick={() => { void useAgentsStore.getState().toggleStatus(agent.id) }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-success)]/20"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Activate
              </button>
            )}

            {confirmDelete ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-surface)] px-2 py-1">
                <span className="text-[11px] text-[var(--color-text-secondary)]">Delete?</span>
                <button
                  onClick={handleDelete}
                  className="rounded-lg bg-[var(--color-danger)] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:opacity-80"
                >
                  Delete
                </button>
                <button
                  onClick={() => { setConfirmDelete(false) }}
                  className="rounded-lg px-2 py-1 text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setConfirmDelete(true) }}
                disabled={busy}
                aria-label="Delete agent"
                title="Delete agent"
                className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:pointer-events-none disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id) }}
              className={`rounded-t-lg px-4 py-2 text-xs font-medium transition-colors ${tab === t.id
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live execution progress — shown above tab content on ALL tabs */}
      {isRunning && latestRun?.plannedSteps && (
        <div className="shrink-0 border-b border-blue-400/15 px-6 py-4">
          <RunProgress agentId={agent.id} runId={latestRun.id} />
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
          {tab === 'custom' && hasCustom && (
            <CustomTabContent agent={agent} latestRun={latestRun} />
          )}
          {tab === 'settings' && (
            <SettingsTab
              agent={agent}
              template={template}
              colorClass={colorClass}
              onDelete={handleDelete}
              isRunning={isRunning}
              onStop={() => { useAgentsStore.getState().stopAgent(agent.id) }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Keep the export name consistent with what ChatPanel uses if needed, 
// though ChatPanel likely imports it by name or default. 
// Re-exporting as AgentsPanel for backward compatibility within the app's navigation.
export { AgentRunPanel as AgentsPanel }
