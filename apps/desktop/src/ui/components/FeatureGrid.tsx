import React, { useState } from 'react'
import { useModules } from '../hooks/use-modules.js'

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
  },
  {
    id: 'study',
    icon: '📚',
    label: 'Study Assistant',
    description: 'Generate flashcards, summaries, quizzes and explanations instantly.',
    badge: 'Education',
  },
  {
    id: 'automation',
    icon: '⚙️',
    label: 'Automation',
    description: 'Build AI workflows that run automatically on a schedule or trigger.',
    badge: 'Power',
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

/**
 * FeatureGrid — presents available capabilities as discoverable cards.
 * Language: "Add feature" not "install plugin" (UX philosophy §5.3).
 */
export function FeatureGrid({ onOpenModule }: IFeatureGridProps): React.JSX.Element {
  const { modules } = useModules()
  const activeIds = new Set(modules.map((m) => m.id))
  const [search, setSearch] = useState('')

  const filtered = BUILT_IN_FEATURES.filter(
    (f) =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Features</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Add features to expand what your AI can do for you.
        </p>
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>

        {/* Responsive grid: 1 col → 2 col → 3 col */}
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

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No features match your search.</p>
          </div>
        )}
      </div>
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
            onClick={() => onOpen(id)}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-900/50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Open
          </button>
        ) : (
          <button
            onClick={() => onOpen(id)}
            className="rounded-full bg-[var(--color-accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
          >
            + Add feature
          </button>
        )}
      </div>
    </div>
  )
}
