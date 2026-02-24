/**
 * Mock marketplace data source — implements IMarketplaceDataSource from SDK.
 * Uses static mock data for development/testing.
 */

import type { definition } from '@agenthub/sdk'
import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IAgentMarketplaceListingDTO,
    ISkillMarketplaceListingDTO,
} from '@agenthub/contracts'
import {
    MOCK_AGENT_LISTINGS,
    MOCK_SKILL_LISTINGS,
    MOCK_AGENT_DEFINITIONS,
    MOCK_SKILL_DEFINITIONS,
} from './data'

export class MockMarketplaceDataSource implements definition.IMarketplaceDataSource {
    async fetchAgents(): Promise<IAgentMarketplaceListingDTO[]> {
        // Simulate network latency
        await delay(300)
        return [...MOCK_AGENT_LISTINGS]
    }

    async fetchSkills(): Promise<ISkillMarketplaceListingDTO[]> {
        await delay(200)
        return [...MOCK_SKILL_LISTINGS]
    }

    async fetchAgentDefinition(id: string): Promise<IAgentDefinitionDTO | null> {
        await delay(200)
        return MOCK_AGENT_DEFINITIONS.find((a) => a.id === id) ?? null
    }

    async fetchSkillDefinition(id: string): Promise<ISkillDefinitionDTO | null> {
        await delay(150)
        return MOCK_SKILL_DEFINITIONS.find((s) => s.id === id) ?? null
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
