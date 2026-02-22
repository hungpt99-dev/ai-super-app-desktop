/**
 * LogsPanel.tsx — real-time structured log viewer for the desktop app.
 *
 * Displays entries from the in-memory log store (log-store.ts) with filtering,
 * search, level badges, source badges, auto-scroll, and copy support.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLogStore, type ILogEntry, type LogLevel, type LogSource } from '../../store/log-store.js'

// ── Config ────────────────────────────────────────────────────────────────────

const LEVEL_META: Record<LogLevel, { label: string; bg: string; text: string }> = {
  debug: { label: 'DEBUG', bg: 'bg-[var(--color-surface-2)]', text: 'text-[var(--color-text-muted)]' },
  info: { label: 'INFO', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  warn: { label: 'WARN', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  error: { label: 'ERROR', bg: 'bg-red-500/10', text: 'text-red-400' },
}

const SOURCE_META: Record<LogSource, { label: string; color: string }> = {
  system: { label: 'system', color: 'text-[var(--color-text-muted)]' },
  chat: { label: 'chat', color: 'text-purple-400' },
  ai: { label: 'ai', color: 'text-[var(--color-accent)]' },
  agent: { label: 'agent', color: 'text-cyan-400' },
  auth: { label: 'auth', color: 'text-orange-400' },
  'group-chat': { label: 'group-chat', color: 'text-yellow-400' },
  router: { label: 'router', color: 'text-sky-400' },
}

const ALL_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const ALL_SOURCES: LogSource[] = ['system', 'chat', 'ai', 'agent', 'auth', 'group-chat', 'router']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
}

function entryToText(e: ILogEntry): string {
  return `[${fmtTime(e.ts)}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}${e.detail ? `\n${e.detail}` : ''}`
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ entry, style }: { entry: ILogEntry; style?: React.CSSProperties }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const lvl = LEVEL_META[entry.level]
  const src = SOURCE_META[entry.source]

  const handleCopy = (): void => {
    void copyText(entryToText(entry)).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 1_500)
    })
  }

  return (
    <div style={style} className="group border-b border-[var(--color-border)]/40 last:border-0">
      <div
        className="flex items-start gap-2 px-4 py-1.5 hover:bg-[var(--color-surface-2)]/50 cursor-pointer"
        onClick={() => { if (entry.detail) setExpanded((v) => !v) }}
      >
        {/* Timestamp */}
        <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5 select-none">
          {fmtTime(entry.ts)}
        </span>

        {/* Level badge */}
        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${lvl.bg} ${lvl.text}`}>
          {lvl.label}
        </span>

        {/* Source badge */}
        <span className={`shrink-0 text-[11px] font-medium ${src.color}`}>
          [{src.label}]
        </span>

        {/* Message */}
        <span className="flex-1 text-xs text-[var(--color-text-primary)] break-all leading-snug">
          {entry.message}
        </span>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {entry.detail && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {expanded ? '▲' : '▼'}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy() }}
            title="Copy"
            className="rounded px-1 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
          >
            {copied ? '✓' : '⧉'}
          </button>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && entry.detail && (
        <pre className="mx-4 mb-2 overflow-x-auto rounded bg-[var(--color-surface-2)] px-3 py-2 text-[11px] leading-snug text-[var(--color-text-secondary)] whitespace-pre-wrap break-all">
          {entry.detail}
        </pre>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function LogsPanel(): React.JSX.Element {
  const entries = useLogStore((s) => s.entries)
  const clear = useLogStore((s) => s.clear)

  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<LogSource | 'all'>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [copiedAll, setCopiedAll] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter entries
  const filtered = useMemo(() => {
    const lc = search.toLowerCase()
    return entries.filter((e) => {
      if (levelFilter !== 'all' && e.level !== levelFilter) return false
      if (sourceFilter !== 'all' && e.source !== sourceFilter) return false
      if (lc && !e.message.toLowerCase().includes(lc) && !(e.detail?.toLowerCase().includes(lc) ?? false)) return false
      return true
    })
  }, [entries, levelFilter, sourceFilter, search])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filtered.length, autoScroll])

  // Detect manual scroll up → disable auto-scroll
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (!atBottom) setAutoScroll(false)
    else setAutoScroll(true)
  }, [])

  const handleCopyAll = (): void => {
    const text = filtered.map(entryToText).join('\n')
    void copyText(text).then(() => {
      setCopiedAll(true)
      setTimeout(() => { setCopiedAll(false) }, 1_500)
    })
  }

  // Level counts for badges
  const errorCount = useMemo(() => entries.filter((e) => e.level === 'error').length, [entries])
  const warnCount = useMemo(() => entries.filter((e) => e.level === 'warn').length, [entries])

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Logs</h1>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {String(entries.length)} entries
              {errorCount > 0 && (
                <span className="ml-1.5 text-red-400">{String(errorCount)} error{errorCount !== 1 ? 's' : ''}</span>
              )}
              {warnCount > 0 && (
                <span className="ml-1.5 text-yellow-400">{String(warnCount)} warning{warnCount !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => { setAutoScroll((v) => !v) }}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${autoScroll
                ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7 13 12 18 17 13" />
              <polyline points="7 6 12 11 17 6" />
            </svg>
            Live
          </button>

          {/* Copy all */}
          <button
            onClick={handleCopyAll}
            disabled={filtered.length === 0}
            title="Copy all visible logs"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            {copiedAll ? '✓ Copied' : '⧉ Copy'}
          </button>

          {/* Clear */}
          <button
            onClick={clear}
            disabled={entries.length === 0}
            title="Clear all logs"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto border-t border-[var(--color-border)]/50 px-5 py-2 scrollbar-none">

          {/* Level filter */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => { setLevelFilter('all') }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${levelFilter === 'all'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
            >
              All
            </button>
            {ALL_LEVELS.map((lvl) => {
              const meta = LEVEL_META[lvl]
              return (
                <button
                  key={lvl}
                  onClick={() => { setLevelFilter(levelFilter === lvl ? 'all' : lvl) }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${levelFilter === lvl ? `${meta.bg} ${meta.text} ring-1 ring-current` : `bg-[var(--color-surface-2)] ${meta.text} hover:${meta.bg}`
                    }`}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>

          <div className="mx-1 h-4 w-px shrink-0 bg-[var(--color-border)]" />

          {/* Source filter */}
          <div className="flex shrink-0 items-center gap-1">
            {ALL_SOURCES.map((src) => {
              const meta = SOURCE_META[src]
              return (
                <button
                  key={src}
                  onClick={() => { setSourceFilter(sourceFilter === src ? 'all' : src) }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${sourceFilter === src
                      ? `bg-[var(--color-surface)] ring-1 ring-current ${meta.color}`
                      : `bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]`
                    }`}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>

          <div className="mx-1 h-4 w-px shrink-0 bg-[var(--color-border)]" />

          {/* Search */}
          <input
            type="text"
            placeholder="Search logs…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            className="h-6 min-w-[160px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </div>

      {/* ── Entry list ─────────────────────────────────────────────────────── */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
              📋
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {entries.length === 0 ? 'No logs yet' : 'No entries match the filter'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {entries.length === 0
                ? 'Logs appear here as you use the app.'
                : 'Try adjusting the level or source filter.'}
            </p>
          </div>
        ) : (
          <>
            {filtered.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
            <div ref={bottomRef} className="h-4" />
          </>
        )}
      </div>

      {/* ── Footer stat ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-1.5">
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Showing {String(filtered.length)} of {String(entries.length)} entries
          {entries.length >= 2_000 && (
            <span className="ml-1 text-yellow-400">· buffer full (2 000 max)</span>
          )}
        </p>
      </div>
    </div>
  )
}
