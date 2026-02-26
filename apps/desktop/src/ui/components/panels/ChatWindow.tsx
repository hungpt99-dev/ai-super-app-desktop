import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useChat, type IChatMessage } from '../../hooks/use-chat.js'

/** ChatWindow — chat-first interface, the core UX surface. */
export function ChatWindow(): React.JSX.Element {
  const { messages, isLoading, error, sendMessage, clearMessages, setError } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages are added
  // Use messages.length as dependency to only scroll on actual new messages, not content updates
  const prevMessagesLength = useRef(messages.length)
  useEffect(() => {
    // Only scroll if a new message was added (not when content updates)
    if (messages.length > prevMessagesLength.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessagesLength.current = messages.length
  }, [messages.length])

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      await sendMessage(text)
    },
    [isLoading, sendMessage],
  )

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    submit(input)
  }, [input, isLoading, submit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!input.trim() || isLoading) return
      submit(input)
    }
  }, [input, isLoading, submit])

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-dim)]">
            <span className="text-xs text-[var(--color-accent)]">✦</span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-[var(--color-text-primary)]">AI Assistant</p>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
              {isLoading ? 'Thinking…' : 'Ready'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => { clearMessages() }}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-secondary)]"
              title="Clear conversation (⌘K)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              Clear
            </button>
          )}
          <div className="flex h-2 w-2 rounded-full bg-[var(--color-success)]" title="Connected" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col flex-1 px-6 py-6 overflow-x-hidden overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onSuggest={submit} />
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mb-2 flex items-center gap-2.5 rounded-xl border border-red-800 bg-red-950/30 px-4 py-2.5 text-xs text-red-400">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="flex-1">{error}</span>
          <button onClick={() => { setError(null) }} className="transition-colors hover:text-red-300" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-end gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 transition-colors focus-within:border-[var(--color-accent)]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${String(Math.min(e.target.scrollHeight, 120))}px`
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-95 disabled:opacity-40"
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[var(--color-text-muted)]">
            AI can make mistakes. Verify important information.
          </p>
        </form>
      </div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Analyze Bitcoin price trend',
  'Improve my email draft',
  'Summarize this article for me',
  'Help me plan my budget',
]

function EmptyState({ onSuggest }: { onSuggest: (text: string) => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent-dim)]">
        <span className="text-3xl text-[var(--color-accent)]">✦</span>
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        How can I help you today?
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-[var(--color-text-secondary)]">
        Ask me anything — I'll automatically use the right tools for you.
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-6">
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

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: IChatMessage }): React.JSX.Element {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }

  return (
    <div className={`group flex items-end gap-2.5 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isUser ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-accent)]',
        ].join(' ')}
      >
        {isUser ? 'U' : '✦'}
      </div>

      {/* Bubble + actions */}
      <div className="relative max-w-[72%]">
        <div
          className={[
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-br-md bg-[var(--color-accent)] text-white'
              : 'rounded-bl-md bg-[var(--color-surface)] text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          {message.content}
          {message.isStreaming && (
            <span className="cursor-blink ml-0.5 inline-block text-[var(--color-accent)]">▌</span>
          )}
          <p className={['mt-1 text-[10px]', isUser ? 'text-right text-white/60' : 'text-[var(--color-text-muted)]'].join(' ')}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Copy on hover — assistant only */}
        {!isUser && !message.isStreaming && message.content && (
          <button
            onClick={() => void handleCopy()}
            className="absolute -bottom-5 left-0 hidden items-center gap-1 text-[10px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)] group-hover:flex"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}
