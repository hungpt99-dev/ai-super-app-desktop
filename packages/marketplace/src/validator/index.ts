import type { IAgentPackageSpec, IPackageValidationResult, IPackageValidator } from '../index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('PackageValidator')

export class PackageValidator implements IPackageValidator {
    async validate(pkg: IAgentPackageSpec): Promise<IPackageValidationResult> {
        const errors: string[] = []
        const warnings: string[] = []

        if (!pkg.manifest) errors.push('Missing manifest')
        else {
            if (!pkg.manifest.name) errors.push('Manifest missing name')
            if (!pkg.manifest.version) errors.push('Manifest missing version')
            if (!pkg.manifest.engineVersion) errors.push('Manifest missing engineVersion')
        }

        const valid = errors.length === 0
        return { valid, errors, warnings }
    }

    async verifySignature(pkg: IAgentPackageSpec): Promise<boolean> {
        // Mock signature verification for MVP
        log.info(`Verifying signature for ${pkg.manifest?.name}`)
        return !!pkg.manifest?.signature
    }

    checkCompatibility(pkg: IAgentPackageSpec, engineVersion: string): boolean {
        // Trivial exact match or 'latest' for MVP
        if (!pkg.manifest) return false
        return pkg.manifest.engineVersion === engineVersion || pkg.manifest.engineVersion === 'latest'
    }
}
