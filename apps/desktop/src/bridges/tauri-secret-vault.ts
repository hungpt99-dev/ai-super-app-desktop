import { invoke } from '@tauri-apps/api/core'

/**
 * TauriSecretVault
 * 
 * Implements secure storage for API keys using Tauri's persistent store.
 * Matches: docs/technical-design.md §10.2 Secret Vault
 */
export class TauriSecretVault {
    private static readonly STORE_KEY = 'agenthub:api-keys'

    /**
     * Retrieves the first active key for a provider.
     * This is used by the AgentRuntime to inject keys at execution time.
     */
    async getActiveKey(provider: string): Promise<string | null> {
        try {
            const raw = await invoke<string | null>('store_get', { key: TauriSecretVault.STORE_KEY })
            if (!raw) return null

            const keys = JSON.parse(raw) as any[]
            const match = keys.find(k => k.provider === provider && k.isActive)
            return match?.rawKey ?? null
        } catch (err) {
            console.error('SecretVault: Failed to retrieve key', err)
            return null
        }
    }
}
