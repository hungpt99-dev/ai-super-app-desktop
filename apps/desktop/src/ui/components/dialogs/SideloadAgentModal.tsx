/**
 * SideloadAgentModal.tsx
 *
 * Dev-mode dialog: install a compiled agent module (.js) directly from disk.
 * The file must export `defineModule(...)` as its default export.
 */

import React, { useState } from 'react'
import { useDevSideloadStore } from '../../store/dev/dev-sideload-store.js'

// ─── Component ────────────────────────────────────────────────────────────────

interface ISideloadAgentModalProps {
  onClose: () => void
}

/** Sideload a real agent package (.js compiled module) in dev mode. */
export function SideloadAgentModal({ onClose }: ISideloadAgentModalProps): React.JSX.Element {
  const { loadFile, modules, removeModule } = useDevSideloadStore()
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File): Promise<void> => {
    if (!file.name.endsWith('.js') && !file.name.endsWith('.mjs')) {
      setResult({ ok: false, message: 'Only .js or .mjs files are accepted. Compile your agent module first.' })
      return
    }
    setLoading(true)
    setResult(null)
    const r = await loadFile(file)
    setLoading(false)
    if (r.ok) {
      setResult({ ok: true, message: `✓ "${r.module.name}" v${r.module.version} installed — it now appears in All Agent Types.` })
    } else {
      setResult({ ok: false, message: r.error })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-900/30 text-lg">📦</div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Sideload Agent Package</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Dev mode — install a compiled agent module directly from disk</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]">✕</button>
        </div>

        <div className="flex flex-col gap-5 p-6">

          {/* Concept explainer */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3.5">
            <p className="mb-1 text-[11px] font-semibold text-[var(--color-text-primary)]">How agent packages work</p>
            <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              An agent is a <span className="text-[var(--color-text-secondary)]">mini-app</span> — a self-contained JS module with tools, AI interactions and storage.
              Build one using the SDK, compile it to a single <code className="rounded bg-[var(--color-surface)] px-1 text-[10px] text-amber-300">.js</code> file, then drop it here.
              It runs in the same sandbox as built-in agents with full permission enforcement.
            </p>
            <div className="mt-2.5 rounded-lg bg-[var(--color-surface)] px-3 py-2 font-mono text-[10px] text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-muted)]">// my-agent/src/index.ts</span>{' '}<br />
              <span className="text-purple-400">export default </span>
              <span className="text-[var(--color-accent)]">defineModule</span>
              {'({'}<br />
              {'  '}<span className="text-[var(--color-text-secondary)]">manifest: </span>
              {'{ name: '}<span className="text-emerald-400">'my-agent'</span>{', version: '}<span className="text-emerald-400">'1.0.0'</span>{', ... },'}<br />
              {'  '}<span className="text-[var(--color-text-secondary)]">permissions:</span>{' [Permission.AiGenerate],'}<br />
              {'  '}<span className="text-[var(--color-text-secondary)]">tools:</span>{' [myTool],'}<br />
              {'  '}<span className="text-purple-400">async </span>
              <span className="text-[var(--color-accent)]">onActivate</span>{'(ctx) { ... }'}<br />
              {'})'}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => { setDragging(false) }}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) void handleFile(file)
            }}
            onClick={() => { fileRef.current?.click() }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 text-center transition-colors ${loading
                ? 'border-[var(--color-border)] opacity-60'
                : dragging
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-surface-2)]'
              }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".js,.mjs"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
            {loading ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                <p className="text-xs text-[var(--color-text-muted)]">Loading module…</p>
              </>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-muted)]">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {dragging ? 'Drop to install' : 'Drop .js file or click to browse'}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">Compiled agent module — single .js or .mjs file</p>
              </>
            )}
          </div>

          {/* Feedback */}
          {result !== null && (
            <div className={`rounded-lg border px-3 py-2.5 ${result.ok
                ? 'border-emerald-800/40 bg-emerald-950/30'
                : 'border-red-800/40 bg-red-950/30'
              }`}>
              <p className={`text-xs ${result.ok ? 'text-emerald-400' : 'font-medium text-red-400'}`}>
                {result.ok ? '' : '⚠ Error: '}{result.message}
              </p>
            </div>
          )}

          {/* Loaded modules list */}
          {modules.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Sideloaded this session</p>
              <div className="space-y-1.5">
                {modules.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                    <span className="text-base">{m.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{m.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">v{m.version} · {m.author}</p>
                    </div>
                    {m.codeLoaded ? (
                      <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-400">● Live</span>
                    ) : (
                      <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-400" title="Re-drop the file to make tools runnable">⚠ Needs reload</span>
                    )}
                    <button
                      onClick={() => { void removeModule(m.id) }}
                      className="shrink-0 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:border-red-700 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
