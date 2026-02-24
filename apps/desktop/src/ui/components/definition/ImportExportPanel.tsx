/**
 * ImportExportPanel — handles importing from JSON and exporting to JSON.
 * Uses Tauri file dialog for file operations.
 */

import { useState, useRef } from 'react'
import { useDefinitionStore } from '../../store/definition-store'
import { ValidationPanel } from './ValidationPanel'

interface ImportExportPanelProps {
    mode: 'agent' | 'skill'
}

export function ImportExportPanel({ mode }: ImportExportPanelProps) {
    const {
        exportJson,
        importPreview,
        importValidation,
        draftAgent,
        draftSkill,
        exportAgent,
        exportSkill,
        importAgentJson,
        importSkillJson,
        confirmImportAgent,
        confirmImportSkill,
        clearImport,
        clearExport,
    } = useDefinitionStore()

    const [importText, setImportText] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    function handleExport() {
        if (mode === 'agent' && draftAgent) {
            exportAgent(draftAgent)
        } else if (mode === 'skill' && draftSkill) {
            exportSkill(draftSkill)
        }
    }

    function handleImport() {
        if (!importText.trim()) return
        if (mode === 'agent') {
            importAgentJson(importText)
        } else {
            importSkillJson(importText)
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            const text = reader.result as string
            setImportText(text)
            if (mode === 'agent') {
                importAgentJson(text)
            } else {
                importSkillJson(text)
            }
        }
        reader.readAsText(file)
    }

    function handleConfirmImport() {
        if (mode === 'agent') {
            confirmImportAgent()
        } else {
            confirmImportSkill()
        }
        setImportText('')
    }

    async function handleDownloadExport() {
        if (!exportJson) return
        try {
            // Try Tauri file dialog first
            const { save } = await import('@tauri-apps/plugin-dialog')
            const { writeTextFile } = await import('@tauri-apps/plugin-fs')
            const path = await save({
                defaultPath: `${mode}-definition.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }],
            })
            if (path) {
                await writeTextFile(path, exportJson)
            }
        } catch {
            // Fallback: browser download
            const blob = new Blob([exportJson], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${mode}-definition.json`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    async function handleOpenFileDialog() {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog')
            const { readTextFile } = await import('@tauri-apps/plugin-fs')
            const selected = await open({
                multiple: false,
                filters: [{ name: 'JSON', extensions: ['json'] }],
            })
            if (selected) {
                const text = await readTextFile(selected as string)
                setImportText(text)
                if (mode === 'agent') {
                    importAgentJson(text)
                } else {
                    importSkillJson(text)
                }
            }
        } catch {
            // Fallback: trigger file input
            fileInputRef.current?.click()
        }
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Import / Export {mode === 'agent' ? 'Agent' : 'Skill'}
            </h3>

            {/* Export */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={mode === 'agent' ? !draftAgent : !draftSkill}
                        className="px-4 py-2 text-xs bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-30"
                    >
                        Export to JSON
                    </button>
                    {exportJson && (
                        <button
                            type="button"
                            onClick={handleDownloadExport}
                            className="px-4 py-2 text-xs bg-[var(--color-success)] text-white rounded-lg hover:opacity-90"
                        >
                            Download File
                        </button>
                    )}
                    {exportJson && (
                        <button
                            type="button"
                            onClick={clearExport}
                            className="px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {exportJson && (
                    <pre className="px-4 py-3 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg overflow-auto max-h-48">
                        {exportJson}
                    </pre>
                )}
            </div>

            {/* Import */}
            <div className="space-y-2 pt-4 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleOpenFileDialog}
                        className="px-4 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg hover:border-[var(--color-accent)]"
                    >
                        Open File...
                    </button>
                    <span className="text-xs text-[var(--color-text-secondary)]">or paste JSON below</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>

                <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={6}
                    placeholder={`Paste ${mode} definition JSON here...`}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={!importText.trim()}
                        className="px-4 py-2 text-xs bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-30"
                    >
                        Validate Import
                    </button>
                    {importPreview && importValidation?.valid && (
                        <button
                            type="button"
                            onClick={handleConfirmImport}
                            className="px-4 py-2 text-xs bg-[var(--color-success)] text-white rounded-lg hover:opacity-90"
                        >
                            Confirm & Install
                        </button>
                    )}
                    {importPreview && (
                        <button
                            type="button"
                            onClick={() => { clearImport(); setImportText('') }}
                            className="px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {/* Import preview */}
                {importPreview && (
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-2">Import Preview</h4>
                        <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
                            <p><strong>Name:</strong> {'name' in importPreview ? importPreview.name : ''}</p>
                            <p><strong>Version:</strong> {'version' in importPreview ? importPreview.version : ''}</p>
                            <p><strong>Description:</strong> {'description' in importPreview ? importPreview.description : ''}</p>
                        </div>
                    </div>
                )}

                <ValidationPanel validation={importValidation} title="Import Validation" />
            </div>
        </div>
    )
}
