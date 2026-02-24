/**
 * IFileStoragePort — portable filesystem-like storage contract.
 *
 * Implemented by:
 *   - LocalFileStorageAdapter  (Node / node:fs)       — infrastructure/node
 *   - TauriFileStorageAdapter  (WebView / plugin-store) — desktop bridges
 *
 * Consumers (SemanticVersioningAdapter, IPC handlers, etc.) depend on this
 * interface so they never import node:fs transitively.
 */

export interface IFileStoragePort {
    ensureDir(subdir: string): Promise<string>
    writeJson<T>(subdir: string, filename: string, data: T): Promise<void>
    readJson<T>(subdir: string, filename: string): Promise<T | null>
    deleteFile(subdir: string, filename: string): Promise<void>
    listFiles(subdir: string): Promise<string[]>
    readAllJson<T>(subdir: string): Promise<T[]>
    copyToVersionDir(subdir: string, filename: string, version: string): Promise<void>
}
