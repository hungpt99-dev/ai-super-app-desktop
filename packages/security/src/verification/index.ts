/**
 * Integrity verification — hash checking for packages and files.
 *
 * See: docs/technical-design.md §12.2 Signature Verification
 */

// ─── Integrity Verifier Interface ───────────────────────────────────────────

export interface IIntegrityVerifier {
    /** Compute a hash digest for the given content. */
    hash(content: Uint8Array | string, algorithm?: string): Promise<string>
    /** Verify that content matches an expected hash. */
    verify(content: Uint8Array | string, expectedHash: string, algorithm?: string): Promise<boolean>
}

// ─── Default Integrity Verifier (SHA-256) ────────────────────────────────────

export class Sha256IntegrityVerifier implements IIntegrityVerifier {
    async hash(content: Uint8Array | string, _algorithm?: string): Promise<string> {
        const data = typeof content === 'string'
            ? new TextEncoder().encode(content)
            : new Uint8Array(content)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }

    async verify(content: Uint8Array | string, expectedHash: string, algorithm?: string): Promise<boolean> {
        const actualHash = await this.hash(content, algorithm)
        return actualHash === expectedHash
    }
}
