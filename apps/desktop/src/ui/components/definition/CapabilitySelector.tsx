/**
 * CapabilitySelector — select capabilities with dependency awareness.
 * Shows prerequisites, forbidden combinations, and danger indicators.
 * No business logic — uses BUILTIN_CAPABILITIES from SDK.
 */

import { useState } from 'react'
import { definition } from '@agenthub/sdk'

const { BUILTIN_CAPABILITIES } = definition

interface CapabilitySelectorProps {
    selected: readonly string[]
    onChange: (capabilities: string[]) => void
}

export function CapabilitySelector({ selected, onChange }: CapabilitySelectorProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const selectedSet = new Set(selected)

    const filtered = BUILTIN_CAPABILITIES.filter(
        (cap) =>
            cap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cap.description.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    // Group by scope
    const groupedByScope = filtered.reduce<Record<string, typeof BUILTIN_CAPABILITIES[number][]>>(
        (acc, cap) => {
            const scope = cap.scope
            if (!acc[scope]) acc[scope] = []
            acc[scope]!.push(cap)
            return acc
        },
        {},
    )

    function toggleCapability(name: string) {
        const cap = BUILTIN_CAPABILITIES.find((c) => c.name === name)
        if (!cap) return

        if (selectedSet.has(name)) {
            // Removing — also remove dependents
            const newSet = new Set(selected)
            newSet.delete(name)
            // Remove any capability that requires this one
            for (const other of BUILTIN_CAPABILITIES) {
                if (other.requires?.includes(name) && newSet.has(other.name)) {
                    newSet.delete(other.name)
                }
            }
            onChange([...newSet])
        } else {
            // Adding — also add prerequisites
            const newSet = new Set(selected)
            newSet.add(name)
            if (cap.requires) {
                for (const req of cap.requires) {
                    newSet.add(req)
                }
            }
            // Remove forbidden
            if (cap.forbiddenWith) {
                for (const forbidden of cap.forbiddenWith) {
                    newSet.delete(forbidden)
                }
            }
            onChange([...newSet])
        }
    }

    function isForbidden(name: string): boolean {
        const cap = BUILTIN_CAPABILITIES.find((c) => c.name === name)
        if (!cap?.forbiddenWith) return false
        return cap.forbiddenWith.some((f) => selectedSet.has(f))
    }

    function getMissingPrerequisites(name: string): string[] {
        const cap = BUILTIN_CAPABILITIES.find((c) => c.name === name)
        if (!cap?.requires) return []
        return cap.requires.filter((r) => !selectedSet.has(r))
    }

    return (
        <div className="space-y-3">
            <input
                type="text"
                placeholder="Search capabilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {Object.entries(groupedByScope).map(([scope, caps]) => (
                    <div key={scope}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                            {scope.replace('_', ' ')}
                        </h4>
                        <div className="space-y-1">
                            {caps.map((cap) => {
                                const isSelected = selectedSet.has(cap.name)
                                const forbidden = isForbidden(cap.name)
                                const missingPrereqs = getMissingPrerequisites(cap.name)

                                return (
                                    <button
                                        key={cap.name}
                                        type="button"
                                        onClick={() => !forbidden && toggleCapability(cap.name)}
                                        disabled={forbidden}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                                            isSelected
                                                ? 'bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/50'
                                                : forbidden
                                                ? 'bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 opacity-50 cursor-not-allowed'
                                                : 'bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] ${
                                            isSelected ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' : 'border-[var(--color-border)]'
                                        }`}>
                                            {isSelected && '✓'}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-[var(--color-text-primary)]">{cap.name}</span>
                                                {cap.dangerousPermission && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-danger)]/30 text-[var(--color-danger)]">HIGH RISK</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">{cap.description}</p>

                                            {forbidden && (
                                                <p className="text-[10px] text-[var(--color-danger)] mt-1">
                                                    Forbidden with: {cap.forbiddenWith?.filter((f) => selectedSet.has(f)).join(', ')}
                                                </p>
                                            )}
                                            {!isSelected && missingPrereqs.length > 0 && (
                                                <p className="text-[10px] text-[var(--color-warning)] mt-1">
                                                    Requires: {missingPrereqs.join(', ')} (will be auto-added)
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-xs text-[var(--color-text-secondary)]">
                {selected.length} capability{selected.length !== 1 ? 'ies' : 'y'} selected
            </div>
        </div>
    )
}
