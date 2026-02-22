import type { IAgentPackageSpec, IAgentManifest, IPackageInstaller } from '../index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('PackageInstaller')

export class PackageInstaller implements IPackageInstaller {
    private installedPackages = new Map<string, IAgentPackageSpec>()

    async install(pkg: IAgentPackageSpec): Promise<void> {
        if (!pkg.manifest || !pkg.manifest.name) {
            throw new Error('Invalid package: Missing manifest name')
        }
        log.info(`Installing package ${pkg.manifest.name}@${pkg.manifest.version}`)
        this.installedPackages.set(pkg.manifest.name, pkg)
    }

    async uninstall(name: string): Promise<void> {
        log.info(`Uninstalling package ${name}`)
        this.installedPackages.delete(name)
    }

    async list(): Promise<IAgentManifest[]> {
        return Array.from(this.installedPackages.values()).map(pkg => pkg.manifest)
    }

    async isInstalled(name: string): Promise<boolean> {
        return this.installedPackages.has(name)
    }
}
