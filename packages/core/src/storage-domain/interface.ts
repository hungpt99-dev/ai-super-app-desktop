/**
 * StorageAdapter — the interface core uses for persistence.
 *
 * Convention: Interface = `XxxAdapter`, Implementation = `XxxSqliteAdapter`.
 * See: docs/codebase.md Naming Convention & Storage Rule
 */

export interface StorageAdapter {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    has(key: string): Promise<boolean>
    keys(prefix?: string): Promise<string[]>
    clear(): Promise<void>
}
