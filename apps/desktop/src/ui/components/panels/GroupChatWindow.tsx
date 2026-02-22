/**
 * GroupChatWindow.tsx
 *
 * The group-chat surface where the user can assign tasks to agents and
 * communicate with all of them in a single shared thread.
 *
 * Features:
 *  • Agent-routing: messages are routed to the most relevant active agent.
 *  • Plan cards: action-intent messages trigger a plan proposal that the
 *    user must confirm before the agent executes.
 *  • Step animation: each plan step animates as done while the agent executes.
 *  • Status follow-ups: the task-owner agent answers questions like "is it done?"
 *  • Streaming: conversational replies stream token-by-token.
 *  • Active-agent roster: header shows which agents are currently in the workspace.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGroupChatStore, type IGroupMessage, type IPendingPlan, type GroupChatMode } from '../../store/chat-group-store.js'
import { useAgentsStore } from '../../store/agents-store.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(ts: number): string {
  const ms = Date.now() - ts
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${String(Math.floor(ms / 60_000))}m ago`
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

interface IPlanCardProps {
  plan: IPendingPlan
  onConfirm: () => void
  onDismiss: () => void
}

function PlanCard({ plan, onConfirm, onDismiss }: IPlanCardProps): React.JSX.Element {
  const isRunning = plan.status === 'confirmed'
  const isDone = plan.status === 'done'
  const isDismissed = plan.status === 'dismissed'

  return (
    <div className={[
      'mt-2 rounded-xl border p-4 text-sm transition-all',
      isDismissed
        ? 'border-[var(--color-border)] opacity-50'
        : isDone
          ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5'
          : isRunning
            ? 'border-blue-500/30 bg-blue-500/5'
            : 'border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)]',
    ].join(' ')}>

      {/* Title */}
      <p className="mb-3 font-semibold text-[var(--color-text-primary)]">
        {isDone ? '✅' : isRunning ? '⚙️' : isDismissed ? '✕' : '📋'}&nbsp;
        <span className="line-clamp-2">{plan.title}</span>
      </p>

      {/* Steps */}
      <ol className="mb-4 space-y-1.5">
        {plan.steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={[
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
              step.done
                ? 'bg-[var(--color-success)] text-white'
                : isRunning && !step.done
                  ? 'animate-pulse border border-blue-400 text-blue-400'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)]',
            ].join(' ')}>
              {step.done ? '✓' : String(i + 1)}
            </span>
            <span className={step.done
              ? 'text-[var(--color-text-secondary)] line-through'
              : 'text-[var(--color-text-primary)]'
            }>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {/* Result */}
      {isDone && plan.result && (
        <div className="mb-3 rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-secondary)]">
          <p className="mb-1 font-semibold text-[var(--color-success)]">Result preview</p>
          <p className="line-clamp-4 whitespace-pre-wrap">{plan.result.slice(0, 400)}{plan.result.length > 400 ? '…' : ''}</p>
        </div>
      )}

      {/* CTA buttons */}
      {plan.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] active:scale-95"
          >
            ✓ Yes, run it
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
          >
            Skip
          </button>
        </div>
      )}

      {isRunning && (
        <p className="flex items-center gap-1.5 text-xs text-blue-400">
          <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-blue-400" />
          Running…
        </p>
      )}

      {isDismissed && (
        <p className="text-xs text-[var(--color-text-muted)]">Plan dismissed.</p>
      )}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface IBubbleProps {
  msg: IGroupMessage
  onConfirm: (planId: string) => void
  onDismiss: (planId: string) => void
}

function MessageBubble({ msg, onConfirm, onDismiss }: IBubbleProps): React.JSX.Element {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 1800)
  }

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[11px] text-[var(--color-text-muted)]">
          {msg.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`group flex animate-fade-in items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isUser
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-surface-2)] text-[var(--color-accent)]',
        ].join(' ')}
        title={isUser ? 'You' : (msg.agentName ?? 'Agent')}
      >
        {isUser ? 'U' : (msg.agentAvatar ?? '🤖')}
      </div>

      {/* Bubble */}
      <div className={`relative flex max-w-[72%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Agent name label */}
        {!isUser && msg.agentName && (
          <p className="mb-0.5 pl-1 text-[10px] font-semibold text-[var(--color-accent)]">
            {msg.agentName}
          </p>
        )}

        <div
          className={[
            'relative rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-br-md bg-[var(--color-accent)] text-white'
              : 'rounded-bl-md bg-[var(--color-surface)] text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          {/* Copy button */}
          {!isUser && !msg.isStreaming && msg.content && (
            <button
              onClick={() => void handleCopy()}
              className="absolute right-2 top-2 hidden h-6 items-center gap-1 rounded-lg bg-[var(--color-surface-2)]/80 px-2 text-[10px] text-[var(--color-text-muted)] backdrop-blur-sm transition-all hover:text-[var(--color-accent)] group-hover:flex"
              title="Copy message"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}

          {/* Main content */}
          <span className="whitespace-pre-wrap">
            {msg.content.split(/(@\w+)/).map((part, i) =>
              part.startsWith('@') ? (
                <span key={i} className="font-bold text-[var(--color-accent)] brightness-125">{part}</span>
              ) : (
                part
              )
            )}
          </span>
          {msg.isStreaming && (
            <span className="cursor-blink ml-0.5 inline-block text-[var(--color-accent)]">▌</span>
          )}

          {/* Plan card */}
          {msg.plan && (
            <PlanCard
              plan={msg.plan}
              onConfirm={() => { onConfirm(msg.plan!.id) }}
              onDismiss={() => { onDismiss(msg.plan!.id) }}
            />
          )}

          {/* Timestamp */}
          <p className={['mt-1 text-[10px]', isUser ? 'text-right text-white/60' : 'text-[var(--color-text-muted)]'].join(' ')}>
            {relTime(msg.ts)}
          </p>
        </div>

      </div>
    </div>
  )
}

// ─── Agent roster pill ──────────────────────────────────────────────────────────

interface IAgentPillProps { name: string; avatar: string; active: boolean }
function AgentPill({ name, avatar, active }: IAgentPillProps): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px]"
      title={name}
    >
      <span className={[
        'h-1.5 w-1.5 rounded-full',
        active ? 'animate-pulse bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]',
      ].join(' ')} />
      <span className="font-medium text-[var(--color-text-secondary)]">{avatar}</span>
      <span className="max-w-[72px] truncate text-[var(--color-text-muted)]">{name}</span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Generate documentation for the entire repository',
  'Review all open PRs for bugs',
  'Analyse the current BTC price trend',
  'Summarise the latest news headlines',
]

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent-dim)]">
        <span className="text-3xl text-[var(--color-accent)]">🤝</span>
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Your agent workspace
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-[var(--color-text-secondary)]">
        Assign tasks to your agents or ask them anything. The right agent will take ownership automatically.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { onSuggest(s) }}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Thinking indicator ────────────────────────────────────────────────────────

function ThinkingIndicator({ agentName, avatar }: { agentName: string; avatar: string }): React.JSX.Element {
  return (
    <div className="flex animate-fade-in items-end gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-accent)]">
        {avatar}
      </div>
      <div className="flex flex-col items-start">
        <p className="mb-0.5 pl-1 text-[10px] font-semibold text-[var(--color-accent)]">{agentName}</p>
        <div className="rounded-2xl rounded-bl-md bg-[var(--color-surface)] px-4 py-3">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)]"
                style={{ animationDelay: `${String(i * 160)}ms` }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

/** GroupChatWindow — multi-agent group workspace chat. */
export function GroupChatWindow(): React.JSX.Element {
  const messages = useGroupChatStore((s) => s.messages)
  const thinkingAgentIds = useGroupChatStore((s) => s.thinkingAgentIds)
  const runningAgentIds = useGroupChatStore((s) => s.runningAgentIds)
  const error = useGroupChatStore((s) => s.error)
  const send = useGroupChatStore((s) => s.send)
  const confirmPlan = useGroupChatStore((s) => s.confirmPlan)
  const dismissPlan = useGroupChatStore((s) => s.dismissPlan)
  const clear = useGroupChatStore((s) => s.clear)
  const setError = useGroupChatStore((s) => s.setError)
  const mode = useGroupChatStore((s) => s.mode)
  const setMode = useGroupChatStore((s) => s.setMode)

  const agents = useAgentsStore((s) => s.agents)

  const [input, setInput] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeAgents = useMemo(
    () => agents.filter((a) => a.status === 'active').slice(0, 8),
    [agents],
  )

  const isAnyAgentBusy = thinkingAgentIds.size > 0 || runningAgentIds.size > 0

  // Scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingAgentIds.size])

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || isAnyAgentBusy) return
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      await send(text)
    },
    [isAnyAgentBusy, send],
  )

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await submit(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showMentions) {
        // Handle mention selection if needed, or just submit
        setShowMentions(false)
      }
      void submit(input)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val = e.target.value
    setInput(val)

    // Simple mention detection
    const lastWord = val.split(/\s/).pop() ?? ''
    if (lastWord.startsWith('@')) {
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }

    e.target.style.height = 'auto'
    e.target.style.height = `${String(Math.min(e.target.scrollHeight, 120))}px`
  }

  const insertMention = (name: string): void => {
    const words = input.split(/\s/)
    words.pop()
    const newVal = [...words, `@${name} `].join(' ')
    setInput(newVal)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  // Build thinking indicators.
  const thinkingEntries = useMemo(() => {
    return [...thinkingAgentIds]
      .map((id) => agents.find((a) => a.id === id))
      .filter(Boolean)
      .map((a) => ({ id: a!.id, name: a!.name, avatar: a!.name.charAt(0).toUpperCase() }))
  }, [thinkingAgentIds, agents])

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-dim)]">
              <span className="text-xs text-[var(--color-accent)]">🤝</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-[var(--color-text-primary)]">
                Agent Workspace
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                {isAnyAgentBusy
                  ? `${runningAgentIds.size > 0 ? `${String(runningAgentIds.size)} running` : ''}${thinkingAgentIds.size > 0 && runningAgentIds.size > 0 ? ' · ' : ''}${thinkingAgentIds.size > 0 ? `${String(thinkingAgentIds.size)} thinking` : ''}…`
                  : activeAgents.length > 0
                    ? `${String(activeAgents.length)} agent${activeAgents.length !== 1 ? 's' : ''} active`
                    : 'No active agents — create one in the Agents tab'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => { clear() }}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-secondary)]"
                title="Clear conversation"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Agent roster */}
        {activeAgents.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeAgents.map((a) => (
              <AgentPill
                key={a.id}
                name={a.name}
                avatar={a.name.charAt(0).toUpperCase()}
                active={runningAgentIds.has(a.id) || thinkingAgentIds.has(a.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
        {messages.length === 0 && thinkingEntries.length === 0 ? (
          <EmptyState onSuggest={(s) => void submit(s)} />
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onConfirm={(id) => { void confirmPlan(id) }}
                onDismiss={(id) => { dismissPlan(id) }}
              />
            ))}

            {/* Thinking indicators */}
            {thinkingEntries.map((e) => (
              <ThinkingIndicator key={e.id} agentName={e.name} avatar={e.avatar} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mb-4 flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={() => { setError(null) }} className="opacity-60 transition-opacity hover:opacity-100" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5">
        <form onSubmit={(e) => { void handleSubmit(e) }} className="relative">

          {/* Mention Suggestions Popup */}
          {showMentions && activeAgents.length > 0 && (
            <div className="absolute bottom-full left-0 mb-3 w-64 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-in fade-in slide-in-from-bottom-2">
              <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Mention Agent
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {activeAgents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { insertMention(a.name) }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--color-accent)] hover:text-white"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] font-bold group-hover:bg-white/20">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="font-semibold">{a.name}</p>
                      <p className="opacity-70 text-[10px] truncate">{a.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode Selector */}
          <div className="mb-3 flex items-center gap-2">
            {([
              { id: 'ask', label: 'Ask AI', icon: '❓', color: 'text-blue-400' },
              { id: 'task', label: 'Assign Task', icon: '🎯', color: 'text-[var(--color-success)]' },
              { id: 'research', label: 'Research', icon: '🔍', color: 'text-purple-400' },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id) }}
                className={[
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all active:scale-95',
                  mode === m.id
                    ? `border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-[0_0_12px_rgba(var(--color-accent-rgb),0.1)]`
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-secondary)]',
                ].join(' ')}
              >
                <span className={mode === m.id ? '' : 'grayscale opacity-60'}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          <div className="group relative flex items-end gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5 pl-4 transition-all focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_20px_rgba(var(--color-accent-rgb),0.05)]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                activeAgents.length === 0
                  ? 'Create an agent to get started…'
                  : isAnyAgentBusy
                    ? 'Working…'
                    : mode === 'task'
                      ? 'What should they do?'
                      : mode === 'research'
                        ? 'What should they investigate?'
                        : 'Ask your agents anything…'
              }
              disabled={isAnyAgentBusy && thinkingAgentIds.size > 0}
              className="flex-1 resize-none bg-transparent py-2.5 text-sm leading-relaxed text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={(isAnyAgentBusy && thinkingAgentIds.size > 0) || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white shadow-lg transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--color-accent)]/20 active:scale-95 disabled:opacity-40 disabled:shadow-none"
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
