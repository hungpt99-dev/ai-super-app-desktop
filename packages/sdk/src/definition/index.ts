/**
 * Definition module — agent/skill definition builders, validators, and services.
 *
 * No runtime logic. Pure definition + validation + import/export.
 */

// Builders
export { AgentDefinitionBuilder, defineAgentDefinition } from './agent-definition-builder.js'
export { SkillDefinitionBuilder, defineSkillDefinition } from './skill-definition-builder.js'

// Validation
export { validateAgentDefinition, validateSkillDefinition } from './definition-validator.js'

// Capability enforcement
export {
    enforceCapabilities,
    validateSkillAttachment,
    BUILTIN_CAPABILITIES,
} from './capability-enforcer.js'
export type {
    ICapabilityEnforcementResult,
    ICapabilityEscalation,
} from './capability-enforcer.js'

// Import/Export
export {
    exportAgentToJSON,
    exportSkillToJSON,
    importAgentFromJSON,
    importSkillFromJSON,
    diffAgentDefinitions,
    diffSkillDefinitions,
} from './import-export-service.js'
export type {
    IExportEnvelope,
    IImportResult,
    IDiffEntry,
} from './import-export-service.js'

// Marketplace
export { MarketplaceClient } from './marketplace-client.js'
export type {
    IDefinitionStorage,
    IMarketplaceDataSource,
} from './marketplace-client.js'
