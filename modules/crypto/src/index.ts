import { defineModule, Permission } from '@ai-super-app/sdk'
import { getMarketData } from './tools.js'
import type { IMarketDataInput } from './tools.js'

/**
 * Crypto Analysis Module.
 *
 * Provides AI-powered crypto market analysis via the get_market_data tool.
 * The AI Orchestrator can call this tool automatically when users ask
 * about crypto prices — the user never needs to open this module manually.
 */
export default defineModule({
  manifest: {
    name: 'crypto',
    version: '1.0.0',
    minCoreVersion: '1.0.0',
    maxCoreVersion: '2.x',
    permissions: [
      Permission.AiGenerate,
      Permission.StorageRead,
      Permission.StorageWrite,
      Permission.UiDashboard,
      Permission.UiNotify,
    ],
    description: 'Live crypto market analysis powered by AI',
    author: 'AI SuperApp Team',
  },

  tools: [
    {
      name: 'get_market_data',
      description: 'Fetch latest crypto market data for a given symbol (BTC, ETH, SOL, BNB)',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Crypto symbol, e.g. BTC' },
        },
        required: ['symbol'],
      },
      run: (input, ctx) => getMarketData(input as IMarketDataInput, ctx),
    },
  ],

  async onActivate(ctx) {
    ctx.ui.showDashboard()
    ctx.ui.notify({
      title: 'Crypto Analysis',
      body: 'Crypto module is ready. Ask about any market!',
      level: 'success',
    })
  },

  async onDeactivate(_ctx) {
    // Cleanup: no persistent resources to release for this module
  },
})
