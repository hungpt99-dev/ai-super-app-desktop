/**
 * CreateAgentModal.tsx
 *
 * 2-step wizard for creating a new agent instance.
 *   Step 1 — Pick an agent type (or "Custom").
 *   Step 2 — Set name + description (pre-filled from the selected type).
 */

import React, { useEffect, useState } from 'react'
import { useAgentsStore } from '../../store/agents-store.js'
import { useAuthStore } from '../../store/auth-store.js'
import { type IAgentTemplate } from '../../store/template-registry.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const CUSTOM_TYPE_ID = '__custom__'

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateStep = 'pick-type' | 'configure'

export interface ICreateAgentModalProps {
  /** Pre-select this template and jump straight to step 2. */
  initialTemplateId?: string
  /** All available templates (built-in + installed from store). */
  allTemplates: IAgentTemplate[]
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/** 2-step wizard: pick an agent type → configure name and description. */
export function CreateAgentModal({ initialTemplateId, allTemplates, onClose }: ICreateAgentModalProps): React.JSX.Element {
  const startAtConfigure = initialTemplateId !== undefined
  const [step, setStep] = useState<CreateStep>(startAtConfigure ? 'configure' : 'pick-type')
  const [typeId, setTypeId] = useState<string>(initialTemplateId ?? '')
  const [name, setName] = useState('')
  const [description, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()
  const agents = useAgentsStore((s) => s.agents)

  /** Pre-fill fields from a template. */
  const applyType = (id: string): void => {
    if (id === CUSTOM_TYPE_ID || id === '') {
      setName(''); setDesc('')
      return
    }
    const t = allTemplates.find((x) => x.id === id)
    if (!t) return
    const count = agents.filter((b) => b.templateId === id).length
    setName(count === 0 ? t.name : `${t.name} #${String(count + 1)}`)
    setDesc(t.description)
  }

  // Pre-fill when opened with an initial template (run once on mount).
  useEffect(() => {
    if (initialTemplateId !== undefined) applyType(initialTemplateId)
  }, []) // run once on mount — applyType is stable

  const handlePickType = (id: string): void => {
    setTypeId(id)
    applyType(id)
    setStep('configure')
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await useAgentsStore.getState().createAgent({
        name: name.trim(),
        description: description.trim(),
        ...(typeId !== '' && typeId !== CUSTOM_TYPE_ID ? { templateId: typeId } : {}),
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const selectedTemplate = allTemplates.find((t) => t.id === typeId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
          {step === 'configure' && !startAtConfigure && (
            <button
              type="button"
              onClick={() => { setStep('pick-type') }}
              className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {step === 'pick-type' ? 'Choose an agent type' : 'Configure your agent'}
            </h2>
            {step === 'configure' && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {selectedTemplate
                  ? `${selectedTemplate.icon} ${selectedTemplate.name} type`
                  : 'Custom agent — no template'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            ✕
          </button>
        </div>

        {/* Step 1 — Pick type */}
        {step === 'pick-type' && (
          <div className="p-6">
            {!user && (
              <div className="mb-4 rounded-xl bg-blue-500/10 px-4 py-3 text-xs text-blue-300">
                No sign-in needed — agents are saved locally on this device.
              </div>
            )}
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Select a type. You can create as many agents of the same type as you need.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {allTemplates.map((t) => {
                const count = agents.filter((b) => b.templateId === t.id).length
                const colorClass = t.colorClass
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { handlePickType(t.id) }}
                    className="flex flex-col items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-left transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)] hover:shadow-[0_0_0_1px_var(--color-accent-dim)]"
                  >
                    <div className="flex w-full items-start justify-between gap-1">
                      <span className="text-2xl">{t.icon}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
                        {t.name}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                        {t.description}
                      </p>
                    </div>
                    {count > 0 && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {String(count)} agent{count !== 1 ? 's' : ''} created
                      </p>
                    )}
                  </button>
                )
              })}

              {/* Custom option */}
              <button
                type="button"
                onClick={() => { handlePickType(CUSTOM_TYPE_ID) }}
                className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-left transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)]"
              >
                <span className="text-2xl">✏️</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Custom</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                    Start from scratch with your own setup.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Configure */}
        {step === 'configure' && (
          <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4 p-6">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Agent name *</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value) }}
                placeholder="e.g. Morning digest"
                required
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Description</span>
              <input
                value={description}
                onChange={(e) => { setDesc(e.target.value) }}
                placeholder="Optional short description"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Agent'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
