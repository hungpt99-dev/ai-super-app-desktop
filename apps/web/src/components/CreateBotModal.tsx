/**
 * CreateBotModal.tsx — modal for creating a new bot.
 */

import React, { useState } from 'react'
import type { ICreateBotInput } from '../lib/api-client.js'

interface Props {
  onSubmit: (input: ICreateBotInput) => Promise<void>
  onClose: () => void
}

export function CreateBotModal({ onSubmit, onClose }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), goal: goal.trim() })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)]
                      bg-[var(--color-surface)] p-6 shadow-2xl animate-fade-in">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">New Bot</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Name *</label>
            <input
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
              placeholder="Daily scraper"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Description</label>
            <input
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
              placeholder="What this bot does (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Goal *</label>
            <textarea
              className="min-h-[100px] resize-y rounded-lg border border-[var(--color-border)]
                         bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)]
                         outline-none focus:border-[var(--color-accent)]"
              placeholder="Open Chrome, go to example.com, scrape the headline and paste it into Notes."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm
                         text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium
                         text-white transition-colors hover:bg-[var(--color-accent-hover)]
                         disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
