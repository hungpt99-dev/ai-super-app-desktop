/**
 * MiniAppPanel.tsx
 *
 * Dispatcher: renders the correct full-UI panel for a given installed mini-app,
 * falling back to a generic instruction panel for unknown slugs.
 */

import React, { useState } from 'react'
import { type IMiniApp } from '../../lib/api-client.js'
import { CryptoPanelWeb } from './CryptoPanelWeb.js'
import { WritingHelperPanelWeb } from './WritingHelperPanelWeb.js'

// ─── Generic fallback panel ───────────────────────────────────────────────────

interface IGenericPanelProps {
  app: IMiniApp
  onBack: () => void
}

function GenericAppPanel({ app, onBack }: IGenericPanelProps): React.JSX.Element {
  const [instruction, setInstruction] = useState('')
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    if (!instruction.trim()) return
    setSent(true)
    setTimeout(() => { setSent(false); setInstruction('') }, 2_500)
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {app.icon_url ? (
          <img src={app.icon_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-base">
            🧩
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{app.name}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">{app.description}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">Send instruction to agent</p>
        <textarea
          value={instruction}
          onChange={(e) => { setInstruction(e.target.value) }}
          placeholder={`Tell ${app.name} what to do…`}
          rows={4}
          className="mb-3 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)]"
        />
        <button
          onClick={handleSend}
          disabled={instruction.trim().length === 0 || sent}
          className="self-end rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sent ? '✓ Sent' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

interface IMiniAppPanelProps {
  app: IMiniApp
  onBack: () => void
}

/**
 * MiniAppPanel — selects the correct rich UI based on `app.slug`.
 * Known slugs: `crypto-tracker`, `writing-helper`.
 * All others fall back to a generic instruction panel.
 */
export function MiniAppPanel({ app, onBack }: IMiniAppPanelProps): React.JSX.Element {
  if (app.slug === 'crypto-tracker') {
    return <CryptoPanelWeb onBack={onBack} />
  }

  if (app.slug === 'writing-helper') {
    return <WritingHelperPanelWeb onBack={onBack} />
  }

  return <GenericAppPanel app={app} onBack={onBack} />
}
