/**
 * Signature verification — validates package signatures.
 *
 * Moved from marketplace/validator into dedicated security package.
 * See: docs/technical-design.md §12.2 Signature Verification
 */

import { logger } from '@agenthub/shared'

const log = logger.child('SignatureVerifier')

// ─── Signature Verifier Interface ───────────────────────────────────────────

export interface ISignatureVerifier {
    /** Verify the developer signature against the package content. */
    verify(content: Uint8Array | string, signature: string, publicKey?: string): Promise<boolean>
}

// ─── Default Signature Verifier ─────────────────────────────────────────────

/**
 * Basic signature verifier.
 * In production, this would use asymmetric key verification (e.g. Ed25519).
 * Current MVP: checks that signature is non-empty.
 */
export class DefaultSignatureVerifier implements ISignatureVerifier {
    async verify(content: Uint8Array | string, signature: string, _publicKey?: string): Promise<boolean> {
        log.info('Verifying signature', { signaturePresent: !!signature })
        // MVP: signature presence check
        return !!signature && signature.length > 0
    }
}
