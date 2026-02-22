import React, { useRef, useState } from 'react'
import { getDesktopBridge } from '../../lib/bridge.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type WritingAction = 'improve' | 'summarize' | 'expand' | 'translate' | 'fix-grammar'
type Tone = 'professional' | 'casual' | 'persuasive' | 'academic'

interface IWritingResult {
  result: string
  tokensUsed: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIONS: { id: WritingAction; label: string; icon: string; description: string }[] = [
  { id: 'improve',      label: 'Improve',      icon: '✨', description: 'Enhance clarity and style' },
  { id: 'summarize',    label: 'Summarize',    icon: '📝', description: 'Condense to key points' },
  { id: 'expand',       label: 'Expand',       icon: '📖', description: 'Add more depth & detail' },
  { id: 'translate',    label: 'Translate',    icon: '🌐', description: 'Convert to another language' },
  { id: 'fix-grammar',  label: 'Fix Grammar',  icon: '✅', description: 'Correct grammar & spelling' },
]

const TONES: { id: Tone; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual',       label: 'Casual' },
  { id: 'persuasive',   label: 'Persuasive' },
  { id: 'academic',     label: 'Academic' },
]

const TARGET_LANGUAGES = ['Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Portuguese', 'Vietnamese']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner(): React.JSX.Element {
  return (
    <svg className="animate-spin text-white" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface IWritingHelperPanelProps {
  /** Back-navigation handler — required in standalone mode, unused in embedded mode. */
  onBack?: () => void
  /** When true, hides the panel header so it can live inside another layout (e.g. AgentsPanel). */
  embedded?: boolean
}

/**
 * WritingHelperPanel — text transformation UI.
 *
 * Calls modules.invokeTool('writing-helper', 'process_writing', { text, action, tone, targetLanguage })
 */
export function WritingHelperPanel({ onBack, embedded = false }: IWritingHelperPanelProps): React.JSX.Element {
  const [inputText, setInputText] = useState('')
  const [selectedAction, setSelectedAction] = useState<WritingAction>('improve')
  const [selectedTone, setSelectedTone] = useState<Tone>('professional')
  const [targetLanguage, setTargetLanguage] = useState('Spanish')
  const [result, setResult] = useState<IWritingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleProcess = async () => {
    if (!inputText.trim()) {
      textareaRef.current?.focus()
      return
    }
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const bridge = getDesktopBridge()
      const toolInput: Record<string, unknown> = {
        text: inputText.trim(),
        action: selectedAction,
        tone: selectedTone,
      }
      if (selectedAction === 'translate') {
        toolInput.targetLanguage = targetLanguage
      }
      const res = (await bridge.modules.invokeTool(
        'writing-helper',
        'process_writing',
        toolInput,
      )) as IWritingResult
      setResult(res)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (result?.result) {
      await navigator.clipboard.writeText(result.result)
    }
  }

  const handleUseOutput = () => {
    if (result?.result) {
      setInputText(result.result)
      setResult(null)
    }
  }

  const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className={embedded ? 'flex flex-col' : 'flex h-full flex-col bg-[var(--color-bg)]'}>
      {/* Header — only shown in standalone mode */}
      {!embedded && (
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
        <div className="text-xl">✍️</div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Writing Helper</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Improve, summarize, translate and more</p>
        </div>
      </div>
      )}

      <div className={embedded ? 'flex min-h-[400px] overflow-hidden' : 'flex h-0 flex-1 overflow-hidden'}>
        {/* Left column — input + controls */}
        <div className="flex w-1/2 flex-col border-r border-[var(--color-border)] p-5">
          {/* Action selector */}
          <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">Action</p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => { setSelectedAction(a.id) }}
                className={[
                  'flex flex-col rounded-xl border p-3 text-left transition-all',
                  a.id === selectedAction
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]',
                ].join(' ')}
              >
                <span className="mb-0.5 text-base">{a.icon}</span>
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            ))}
          </div>

          {/* Tone selector */}
          <div className="mb-4 flex items-center gap-2">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Tone:</p>
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTone(t.id) }}
                className={[
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  t.id === selectedTone
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Target language (only visible for translate) */}
          {selectedAction === 'translate' && (
            <div className="mb-4 flex items-center gap-3">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">Translate to:</p>
              <select
                value={targetLanguage}
                onChange={(e) => { setTargetLanguage(e.target.value) }}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              >
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {/* Text input */}
          <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">Your text</p>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => { setInputText(e.target.value) }}
            placeholder="Paste or type your text here…"
            className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)]"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">{wordCount} words</span>
            <button
              onClick={() => void handleProcess()}
              disabled={isLoading || !inputText.trim()}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Spinner />}
              {isLoading ? 'Processing…' : `${ACTIONS.find((a) => a.id === selectedAction)?.icon ?? ''} ${ACTIONS.find((a) => a.id === selectedAction)?.label ?? ''}`}
            </button>
          </div>
        </div>

        {/* Right column — output */}
        <div className="flex w-1/2 flex-col p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Result</p>
            {result && (
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCopy()}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy
                </button>
                <button
                  onClick={handleUseOutput}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
                >
                  Use as input →
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {result ? (
            <div className="animate-fade-in flex-1 overflow-y-auto rounded-xl border border-[var(--color-accent-dim)] bg-[var(--color-surface)] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
                {result.result}
              </p>
              <p className="mt-4 text-xs text-[var(--color-text-muted)]">
                {result.tokensUsed} tokens used
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
                <svg className="animate-spin text-[var(--color-accent)]" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="text-sm">Processing your text…</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-3xl opacity-30">✍️</span>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Your transformed text will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
