/**
 * Security Package — signature, key management, and integrity verification.
 *
 * Core may depend on security interfaces ONLY via platform injection.
 *
 * See: docs/technical-design.md §10 SECURITY ARCHITECTURE
 * See: docs/technical-design.md §12.2 Signature Verification
 */

export * from './signature/index.js'
export * from './key-management/index.js'
export * from './verification/index.js'
