/**
 * ValidationPanel — displays validation issues for agent/skill definitions.
 * No business logic — reads from definition store.
 */

import type { IValidationResultDTO, IValidationIssue } from '@agenthub/contracts'

interface ValidationPanelProps {
    validation: IValidationResultDTO | null
    title?: string
}

function severityColor(severity: IValidationIssue['severity']): string {
    switch (severity) {
        case 'error': return 'text-[var(--color-danger)] bg-[var(--color-danger)]/20 border-[var(--color-danger)]'
        case 'warning': return 'text-[var(--color-warning)] bg-[var(--color-warning)]/20 border-[var(--color-warning)]'
        case 'info': return 'text-[var(--color-info)] bg-[var(--color-info)]/20 border-[var(--color-info)]'
    }
}

function severityIcon(severity: IValidationIssue['severity']): string {
    switch (severity) {
        case 'error': return '✕'
        case 'warning': return '⚠'
        case 'info': return 'ℹ'
    }
}

export function ValidationPanel({ validation, title = 'Validation' }: ValidationPanelProps) {
    if (!validation) return null

    const errors = validation.issues.filter((i) => i.severity === 'error')
    const warnings = validation.issues.filter((i) => i.severity === 'warning')
    const infos = validation.issues.filter((i) => i.severity === 'info')

    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${validation.valid ? 'bg-[var(--color-success)]/30 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/30 text-[var(--color-danger)]'}`}>
                    {validation.valid ? 'Valid' : `${errors.length} error${errors.length !== 1 ? 's' : ''}`}
                </span>
            </div>

            {validation.issues.length === 0 ? (
                <p className="text-xs text-[var(--color-success)]">All checks passed.</p>
            ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {validation.issues.map((issue, idx) => (
                        <div
                            key={`${issue.code}-${idx}`}
                            className={`flex items-start gap-2 px-3 py-2 rounded border text-xs ${severityColor(issue.severity)}`}
                        >
                            <span className="flex-shrink-0 w-4 text-center font-bold">{severityIcon(issue.severity)}</span>
                            <div className="flex-1 min-w-0">
                                <span className="font-mono text-[10px] opacity-70">{issue.field}</span>
                                <p className="mt-0.5">{issue.message}</p>
                            </div>
                            <span className="flex-shrink-0 font-mono text-[10px] opacity-50">{issue.code}</span>
                        </div>
                    ))}
                </div>
            )}

            {(warnings.length > 0 || infos.length > 0) && validation.valid && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                    {warnings.length > 0 && `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
                    {warnings.length > 0 && infos.length > 0 && ', '}
                    {infos.length > 0 && `${infos.length} info`}
                </p>
            )}
        </div>
    )
}
