import { Permission } from '@ai-super-app/sdk'
import type { IModuleDefinition, IModuleContext, IToolInput } from '@ai-super-app/sdk'

/**
 * Built-in module definitions loaded at Electron startup.
 *
 * These are registered via ModuleManager.registerBuiltin() which bypasses
 * the IAppPackage signature verification path (not needed for first-party modules).
 *
 * Tool implementations use real external APIs:
 *   - crypto/get_market_data  → CoinGecko v3 free API (no key required)
 *   - writing-helper/process_writing → Cloud Gateway → OpenAI/Anthropic
 */

// ─── CoinGecko helpers ────────────────────────────────────────────────────────

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
}

interface CoinGeckoMarket {
  symbol: string
  current_price: number
  price_change_percentage_24h: number
  total_volume: number
  market_cap: number
  high_24h: number
  low_24h: number
}

async function fetchCoinGeckoMarket(symbol: string): Promise<CoinGeckoMarket> {
  const geckoId = COINGECKO_IDS[symbol]
  if (!geckoId) {
    throw new Error(
      `Unsupported symbol: ${symbol}. Supported: ${Object.keys(COINGECKO_IDS).join(', ')}`,
    )
  }

  const url =
    `${COINGECKO_BASE}/coins/markets` +
    `?vs_currency=usd` +
    `&ids=${geckoId}` +
    `&order=market_cap_desc` +
    `&per_page=1` +
    `&sparkline=false` +
    `&price_change_percentage=24h`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`CoinGecko API error ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as CoinGeckoMarket[]
  const coin = data[0]
  if (!coin) throw new Error(`No data returned for symbol ${symbol}`)
  return coin
}

// ─── Writing prompts ──────────────────────────────────────────────────────────

const WRITING_PROMPTS: Record<string, (input: IToolInput) => string> = {
  improve: (i) =>
    `Improve the following text with a ${(i['tone'] as string | undefined) ?? 'professional'} tone. Return only the improved text, no preamble:\n\n${i['text'] as string}`,
  summarize: (i) =>
    `Summarize the following text concisely. Return only the summary:\n\n${i['text'] as string}`,
  expand: (i) =>
    `Expand the following text with more depth and detail, using a ${(i['tone'] as string | undefined) ?? 'professional'} tone. Return only the expanded text:\n\n${i['text'] as string}`,
  translate: (i) =>
    `Translate the following text to ${(i['targetLanguage'] as string | undefined) ?? 'English'}. Return only the translation:\n\n${i['text'] as string}`,
  'fix-grammar': (i) =>
    `Fix any grammar and spelling mistakes in the following text. Keep the original meaning and style. Return only the corrected text:\n\n${i['text'] as string}`,
}

// ─── Module definitions ───────────────────────────────────────────────────────

export const BUILTIN_MODULES: ReadonlyArray<{
  readonly id: string
  readonly definition: IModuleDefinition
}> = [
  // ── Crypto Analysis ──────────────────────────────────────────────────────
  {
    id: 'crypto',
    definition: {
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
        description: 'Live crypto market analysis powered by CoinGecko + AI',
        author: 'AI SuperApp Team',
        icon: '📈',
        category: 'finance',
        tags: ['crypto', 'bitcoin', 'market-data'],
      },
      tools: [
        {
          name: 'get_market_data',
          description:
            'Fetch live crypto market data from CoinGecko. Supported symbols: BTC, ETH, SOL, BNB.',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Crypto ticker symbol, e.g. BTC' },
            },
            required: ['symbol'],
          },
          run: async (input: IToolInput, _ctx: IModuleContext) => {
            const symbol = ((input['symbol'] as string | undefined) ?? 'BTC').toUpperCase()
            const coin = await fetchCoinGeckoMarket(symbol)
            return {
              symbol,
              price: coin.current_price,
              change24h: Math.round(coin.price_change_percentage_24h * 100) / 100,
              volume: coin.total_volume,
              marketCap: coin.market_cap,
              high24h: coin.high_24h,
              low24h: coin.low_24h,
              fetchedAt: new Date().toISOString(),
            }
          },
        },
      ],
      async onActivate(ctx: IModuleContext) {
        ctx.ui.showDashboard()
        ctx.ui.notify({
          title: 'Crypto Analysis',
          body: 'Live market data connected via CoinGecko.',
          level: 'success',
        })
      },
    },
  },

  // ── Writing Helper ───────────────────────────────────────────────────────
  {
    id: 'writing-helper',
    definition: {
      manifest: {
        name: 'writing-helper',
        version: '1.0.0',
        minCoreVersion: '1.0.0',
        maxCoreVersion: '2.x',
        permissions: [Permission.AiGenerate, Permission.UiNotify],
        description: 'AI-powered writing assistant — improve, summarize, translate and more',
        author: 'AI SuperApp Team',
        icon: '✍️',
        category: 'productivity',
        tags: ['writing', 'grammar', 'translate', 'summarize'],
      },
      tools: [
        {
          name: 'process_writing',
          description:
            'Process text with AI. Actions: improve, summarize, expand, translate, fix-grammar.',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Text to process' },
              action: {
                type: 'string',
                enum: ['improve', 'summarize', 'expand', 'translate', 'fix-grammar'],
              },
              tone: {
                type: 'string',
                enum: ['professional', 'casual', 'persuasive', 'academic'],
              },
              targetLanguage: { type: 'string', description: 'Target language for translation' },
            },
            required: ['text', 'action'],
          },
          run: async (input: IToolInput, ctx: IModuleContext) => {
            const action = input['action'] as string
            const buildPrompt = WRITING_PROMPTS[action]
            if (!buildPrompt) throw new Error(`Unknown writing action: ${action}`)

            const prompt = buildPrompt(input)
            const response = await ctx.ai.generate({ capability: 'writing', input: prompt })
            return {
              result: response.output,
              tokensUsed: response.tokensUsed,
            }
          },
        },
      ],
      async onActivate(ctx: IModuleContext) {
        ctx.ui.notify({
          title: 'Writing Helper',
          body: 'AI writing assistant is ready.',
          level: 'info',
        })
      },
    },
  },
]
