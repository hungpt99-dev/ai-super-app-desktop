/**
 * ImportTemplateModal.tsx
 *
 * Import an agent template from a JSON file or URL.
 * Validates the `.agenthub.json` schema before adding to the registry.
 *
 * Replaces SideloadAgentModal (which loaded raw .js files — dev-only).
 */

import React, { useState, useCallback } from 'react'
import {
    useTemplateRegistry,
    validateTemplateFile,
    type IAgentTemplateFile,
} from '../../store/template-registry.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IImportTemplateModalProps {
    onClose: () => void
}

type ImportMode = 'file' | 'url'

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportTemplateModal({ onClose }: IImportTemplateModalProps): React.JSX.Element {
    const importTemplate = useTemplateRegistry((s) => s.importTemplate)

    const [mode, setMode] = useState<ImportMode>('file')
    const [url, setUrl] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    // ── File import ──────────────────────────────────────────────────────────────

    const processFile = useCallback(async (file: File) => {
        setStatus('loading')
        setMessage('')

        try {
            const text = await file.text()
            let parsed: unknown
            try {
                parsed = JSON.parse(text)
            } catch {
                setStatus('error')
                setMessage('Invalid JSON file. Please check the file format.')
                return
            }

            const validation = validateTemplateFile(parsed)
            if (!validation.valid) {
                setStatus('error')
                setMessage(validation.errors.join('\n'))
                return
            }

            const result = importTemplate(parsed as IAgentTemplateFile)
            if (!result.valid) {
                setStatus('error')
                setMessage(result.errors.join('\n'))
                return
            }

            setStatus('success')
            setMessage(`Template imported successfully! ID: ${result.templateId ?? 'unknown'}`)
        } catch (err) {
            setStatus('error')
            setMessage(err instanceof Error ? err.message : String(err))
        }
    }, [importTemplate])

    const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) void processFile(file)
    }, [processFile])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) void processFile(file)
    }, [processFile])

    // ── URL import ───────────────────────────────────────────────────────────────

    const handleUrlImport = useCallback(async () => {
        if (!url.trim()) return
        setStatus('loading')
        setMessage('')

        try {
            const res = await fetch(url.trim())
            if (!res.ok) {
                setStatus('error')
                setMessage(`Failed to fetch: ${String(res.status)} ${res.statusText}`)
                return
            }

            let parsed: unknown
            try {
                parsed = await res.json()
            } catch {
                setStatus('error')
                setMessage('Response is not valid JSON.')
                return
            }

            const validation = validateTemplateFile(parsed)
            if (!validation.valid) {
                setStatus('error')
                setMessage(validation.errors.join('\n'))
                return
            }

            const result = importTemplate(parsed as IAgentTemplateFile, url.trim())
            if (!result.valid) {
                setStatus('error')
                setMessage(result.errors.join('\n'))
                return
            }

            setStatus('success')
            setMessage(`Template imported from URL! ID: ${result.templateId ?? 'unknown'}`)
        } catch (err) {
            setStatus('error')
            setMessage(err instanceof Error ? err.message : String(err))
        }
    }, [url, importTemplate])

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                onClick={(e) => { e.stopPropagation() }}
                style={{
                    background: 'var(--color-bg-secondary, #1e1e2e)',
                    border: '1px solid var(--color-border, #333)',
                    borderRadius: 16,
                    padding: 28,
                    width: 520,
                    maxWidth: '90vw',
                    color: 'var(--color-text, #e0e0e0)',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Import Agent Template</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted, #888)', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>

                {/* Mode Switch */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {(['file', 'url'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setStatus('idle'); setMessage('') }}
                            style={{
                                flex: 1,
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: mode === m ? '2px solid var(--color-accent, #7c3aed)' : '1px solid var(--color-border, #444)',
                                background: mode === m ? 'var(--color-accent-bg, rgba(124,58,237,0.15))' : 'transparent',
                                color: mode === m ? 'var(--color-accent, #7c3aed)' : 'var(--color-text-muted, #888)',
                                cursor: 'pointer',
                                fontWeight: mode === m ? 600 : 400,
                                fontSize: 14,
                                transition: 'all 0.15s',
                            }}
                        >
                            {m === 'file' ? '📄 Upload File' : '🔗 Import from URL'}
                        </button>
                    ))}
                </div>

                {/* File Mode */}
                {mode === 'file' && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => { setDragOver(false) }}
                        onDrop={handleDrop}
                        style={{
                            border: `2px dashed ${dragOver ? 'var(--color-accent, #7c3aed)' : 'var(--color-border, #444)'}`,
                            borderRadius: 12,
                            padding: 32,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s',
                            background: dragOver ? 'var(--color-accent-bg, rgba(124,58,237,0.05))' : 'transparent',
                        }}
                        onClick={() => { document.getElementById('template-file-input')?.click() }}
                    >
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                        <div style={{ fontSize: 14, color: 'var(--color-text-muted, #888)', marginBottom: 4 }}>
                            Drag & drop a <code>.agenthub.json</code> file here
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted, #666)' }}>
                            or click to browse
                        </div>
                        <input
                            id="template-file-input"
                            type="file"
                            accept=".json,.agenthub.json"
                            onChange={handleFilePick}
                            style={{ display: 'none' }}
                        />
                    </div>
                )}

                {/* URL Mode */}
                {mode === 'url' && (
                    <div>
                        <label style={{ fontSize: 12, color: 'var(--color-text-muted, #888)', marginBottom: 6, display: 'block' }}>
                            Template URL
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => { setUrl(e.target.value) }}
                                placeholder="https://example.com/my-agent.agenthub.json"
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    border: '1px solid var(--color-border, #444)',
                                    background: 'var(--color-bg-tertiary, #181825)',
                                    color: 'var(--color-text, #e0e0e0)',
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={() => { void handleUrlImport() }}
                                disabled={!url.trim() || status === 'loading'}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'var(--color-accent, #7c3aed)',
                                    color: '#fff',
                                    fontWeight: 600,
                                    cursor: url.trim() && status !== 'loading' ? 'pointer' : 'not-allowed',
                                    opacity: url.trim() && status !== 'loading' ? 1 : 0.5,
                                    fontSize: 14,
                                }}
                            >
                                {status === 'loading' ? '…' : 'Import'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Message */}
                {message && (
                    <div
                        style={{
                            marginTop: 16,
                            padding: '10px 14px',
                            borderRadius: 8,
                            fontSize: 13,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            background: status === 'success'
                                ? 'rgba(34,197,94,0.1)'
                                : status === 'error'
                                    ? 'rgba(239,68,68,0.1)'
                                    : 'transparent',
                            color: status === 'success'
                                ? '#22c55e'
                                : status === 'error'
                                    ? '#ef4444'
                                    : 'var(--color-text-muted, #888)',
                            border: `1px solid ${status === 'success' ? 'rgba(34,197,94,0.3)' : status === 'error' ? 'rgba(239,68,68,0.3)' : 'transparent'
                                }`,
                        }}
                    >
                        {message}
                    </div>
                )}

                {/* Footer hint */}
                <div style={{ marginTop: 20, fontSize: 11, color: 'var(--color-text-muted, #555)', lineHeight: 1.6 }}>
                    Agent templates must follow the <code>.agenthub.json</code> schema.
                    Templates are read-only blueprints — you can create multiple agent instances from one template.
                </div>
            </div>
        </div>
    )
}
