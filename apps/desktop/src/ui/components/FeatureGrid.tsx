import React, { useEffect, useState } from 'react'
import { useModules } from '../hooks/use-modules.js'
import { useBotStore, type IDesktopBot } from '../store/bot-store.js'
import { useAuthStore } from '../store/auth-store.js'
import { BOT_TEMPLATES, TEMPLATE_CATEGORY_COLORS } from '../store/bot-templates.js'

const BUILT_IN_FEATURES = [
  {
    id: 'crypto',
    icon: '📈',
    label: 'Crypto Analysis',
    description: 'Real-time market analysis, price alerts, and AI-powered insights for crypto.',
    badge: 'Finance',
  },
  {
    id: 'writing-helper',
    icon: '✍️',
    label: 'Writing Helper',
    description: 'Improve, summarize, expand, translate, or fix grammar in any text.',
    badge: 'Productivity',
  },
  {
    id: 'finance',
    icon: '💰',
    label: 'Personal Finance',
    description: 'Track budgets, savings goals, and get AI advice on your spending.',
    badge: 'Finance',
    comingSoon: true,
  },
  {
    id: 'study',
    icon: '📚',
    label: 'Study Assistant',
    description: 'Generate flashcards, summaries, quizzes and explanations instantly.',
    badge: 'Education',
    comingSoon: true,
  },
  {
    id: 'automation',
    icon: '⚙️',
    label: 'Automation',
    description: 'Build AI workflows that run automatically on a schedule or trigger.',
    badge: 'Power',
    comingSoon: true,
  },
  {
    id: 'image',
    icon: '🎨',
    label: 'Image Generator',
    description: 'Generate and edit images using natural language prompts.',
    badge: 'Creative',
    comingSoon: true,
  },
]

interface IFeatureGridProps {
  onOpenModule: (moduleId: string) => void
}

// ─── Create Bot Modal ─────────────────────────────────────────────────────────

function CreateBotModal({
  onClose,
  onSignIn,
}: {
  onClose: () => void
  onSignIn: () => void
}): React.JSX.Element {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()
  const bots = useBotStore((s) => s.bots)

  // When a template is chosen, pre-fill name and goal.
  const handlePickTemplate = (templateId: string): void => {
    const t = BOT_TEMPLATES.find((t) => t.id === templateId)
    if (!t) return
    const instanceCount = bots.filter((b) => b.templateId === templateId).length
    setSelectedTemplateId(templateId)
    setName(instanceCount === 0 ? t.name : `${t.name} #${String(instanceCount + 1)}`)
    setDescription(t.description)
    setGoal(t.defaultGoal)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || !goal.trim()) return
    setLoading(true)
    setError(null)
    try {
      await useBotStore.getState().createBot({
        name: name.trim(),
        description: description.trim(),
        goal: goal.trim(),
        ...(selectedTemplateId !== null ? { templateId: selectedTemplateId } : {}),
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">New Bot</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]">✕</button>
        </div>

        {!user && (
          <div className="mb-4 rounded-xl bg-blue-500/10 px-4 py-3 text-xs text-blue-300">
            No sign-in needed — this bot is saved locally.{' '}
            <button onClick={onSignIn} className="underline">Sign in</button>
            {' '}to sync it across devices.
          </div>
        )}

        {/* Template picker */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Start from a template <span className="text-[var(--color-text-muted)]">(optional)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BOT_TEMPLATES.map((t) => {
              const isSelected = selectedTemplateId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { handlePickTemplate(t.id) }}
                  className={[
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-primary)]',
                  ].join(' ')}
                >
                  <span>{t.icon}</span>
                  <span className="truncate">{t.name}</span>
                </button>
              )
            })}
          </div>
          {selectedTemplateId && (
            <div className="mt-1.5 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TEMPLATE_CATEGORY_COLORS[BOT_TEMPLATES.find((t) => t.id === selectedTemplateId)?.category ?? 'productivity']}`}>
                {BOT_TEMPLATES.find((t) => t.id === selectedTemplateId)?.category}
              </span>
              <button
                type="button"
                onClick={() => { setSelectedTemplateId(null); setName(''); setDescription(''); setGoal('') }}
                className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Clear template
              </button>
            </div>
          )}
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Name *</span>
            <input
              autoFocus value={name} onChange={(e) => { setName(e.target.value) }}
              placeholder="Daily digest"
              required
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Description</span>
            <input
              value={description} onChange={(e) => { setDescription(e.target.value) }}
              placeholder="Short description (optional)"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Goal *</span>
            <textarea
              value={goal} onChange={(e) => { setGoal(e.target.value) }}
              placeholder="Open the browser, summarise today's headlines, send a Slack message."
              required rows={4}
              className="resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              Cancel
            </button>
            <button
              type="submit" disabled={loading || !name.trim() || !goal.trim()}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * FeatureGrid — presents built-in capabilities and user-created bots as
 * discoverable feature cards.  Language: "Add feature" / "New Bot".
 */
export function FeatureGrid({ onOpenModule }: IFeatureGridProps): React.JSX.Element {
  const { modules } = useModules()
  const bots = useBotStore((s) => s.bots)
  const activeIds = new Set(modules.map((m) => m.id))
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // Load user bots on mount.
  useEffect(() => { void useBotStore.getState().loadBots() }, [])

  const filtered = BUILT_IN_FEATURES.filter(
    (f) =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase()),
  )

  const filteredBots = bots.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase()) ||
      b.goal.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Features</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Add features to expand what your AI can do for you.
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true) }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            🤖 New Bot
          </button>
        </div>
      </div>

      {/* Search + grid */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search features…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>

        {/* Built-in features */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((feature) => (
            <FeatureCard
              key={feature.id}
              id={feature.id}
              icon={feature.icon}
              label={feature.label}
              description={feature.description}
              badge={feature.badge}
              isActive={activeIds.has(feature.id)}
              comingSoon={feature.comingSoon ?? false}
              onOpen={onOpenModule}
            />
          ))}
        </div>

        {/* User-created bots */}
        {filteredBots.length > 0 && (
          <div className="mt-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              My Bots
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredBots.map((bot) => (
                <BotFeatureCard key={bot.id} bot={bot} onOpen={onOpenModule} />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && filteredBots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No features match your search.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBotModal
          onClose={() => { setShowCreate(false) }}
          onSignIn={() => { setShowCreate(false) }}
        />
      )}
    </div>
  )
}

interface IFeatureCardProps {
  id: string
  icon: string
  label: string
  description: string
  badge: string
  isActive: boolean
  comingSoon: boolean
  onOpen: (moduleId: string) => void
}

function FeatureCard({
  id, icon, label, description, badge, isActive, comingSoon, onOpen,
}: IFeatureCardProps): React.JSX.Element {
  return (
    <div
      className={[
        'group flex flex-col rounded-2xl border bg-[var(--color-surface)] p-5 transition-all',
        comingSoon
          ? 'border-[var(--color-border)] opacity-60'
          : isActive
            ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent-dim)]'
            : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-[0_0_0_1px_var(--color-accent-dim)]',
      ].join(' ')}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
          {icon}
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
          {badge}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{label}</h3>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {description}
      </p>

      <div>
        {comingSoon ? (
          <span className="inline-block rounded-full bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]">
            Coming soon
          </span>
        ) : isActive ? (
          <button
            onClick={() => { onOpen(id) }}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-900/50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Open
          </button>
        ) : (
          <button
            onClick={() => { onOpen(id) }}
            className="rounded-full bg-[var(--color-accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
          >
            + Add feature
          </button>
        )}
      </div>
    </div>
  )
}
// ─── User-bot feature card ────────────────────────────────────────────────────

interface IBotFeatureCardProps {
  bot: IDesktopBot
  onOpen: (botId: string) => void
}

function BotFeatureCard({ bot, onOpen }: IBotFeatureCardProps): React.JSX.Element {
  const isRunning = useBotStore((s) => s.runningBotId === bot.id)

  return (
    <div
      className="group flex flex-col rounded-2xl border border-[var(--color-border)]
                 bg-[var(--color-surface)] p-5 transition-all
                 hover:border-[var(--color-accent)] hover:shadow-[0_0_0_1px_var(--color-accent-dim)]"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
          🤖
        </div>
        <div className="flex items-center gap-1.5">
          {isRunning && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />}
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
            Bot
          </span>
          {bot.synced && (
            <span className="text-[10px] text-[var(--color-text-muted)]" title="Synced to cloud">☁</span>
          )}
        </div>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{bot.name}</h3>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {bot.description || bot.goal.slice(0, 100) + (bot.goal.length > 100 ? '…' : '')}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => { onOpen(bot.id) }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
        >
          ▶ Open
        </button>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            bot.status === 'active'
              ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
              : 'bg-yellow-400/15 text-yellow-400'
          }`}
        >
          {bot.status}
        </span>
      </div>
    </div>
  )
}