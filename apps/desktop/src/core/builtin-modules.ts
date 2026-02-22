import { Permission } from '@agenthub/sdk'
import type { IModuleDefinition, IModuleContext, IToolInput, IHttpAPI, ITool } from '@agenthub/sdk'

/**
 * Built-in module definitions — first-party modules bundled with the app.
 *
 * Registered via ModuleManager.registerBuiltin() which bypasses IAppPackage
 * signature verification (not needed for first-party bundles).
 *
 * Each entry also carries `agentTemplate` metadata so the UI can derive the
 * full agent-template list directly from this registry — no separate
 * hardcoded list required.
 *
 * Tool implementations:
 *   - crypto/get_market_data       → CoinGecko v3 free API via ctx.http
 *   - writing-helper/process_writing → Cloud Gateway AI via ctx.ai
 */

// ─── Agent-template metadata (co-located with each module) ─────────────────────

/** UI metadata attached to every built-in module entry. */
export interface IBuiltinAgentTemplate {
  /** Human-readable template name shown in the Bots tab "Create" modal. */
  name: string
  /** One-line description shown on the template card. */
  description: string
  /** Emoji icon. */
  icon: string
  /** Tailwind colour class group used by the template card. */
  colorClass: string
  /**
   * Labels for the 5 sequential execution steps shown in the live run panel.
   * Must always be exactly 5 entries.
   */
  execSteps: readonly [string, string, string, string, string]
}

// ─── CoinGecko types ──────────────────────────────────────────────────────────

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
}

interface ICoinGeckoMarket {
  current_price: number
  price_change_percentage_24h: number
  total_volume: number
  market_cap: number
  high_24h: number
  low_24h: number
}

// ─── Writing action prompts ───────────────────────────────────────────────────

const WRITING_PROMPTS: Record<string, (input: IToolInput) => string> = {
  improve: (i) =>
    `Improve the following text with a ${(i.tone as string | undefined) ?? 'professional'} tone. Return only the improved text, no preamble:\n\n${i.text as string}`,
  summarize: (i) =>
    `Summarize the following text concisely. Return only the summary:\n\n${i.text as string}`,
  expand: (i) =>
    `Expand the following text with more depth and detail, using a ${(i.tone as string | undefined) ?? 'professional'} tone. Return only the expanded text:\n\n${i.text as string}`,
  translate: (i) =>
    `Translate the following text to ${(i.targetLanguage as string | undefined) ?? 'English'}. Return only the translation:\n\n${i.text as string}`,
  'fix-grammar': (i) =>
    `Fix any grammar and spelling mistakes in the following text. Keep the original meaning and style. Return only the corrected text:\n\n${i.text as string}`,
}

// ─── Module + template registry ──────────────────────────────────────────────

export interface IBuiltinModuleEntry {
  readonly id: string
  readonly definition: IModuleDefinition
  /** UI metadata used to generate a agent-template card in the Bots tab. */
  readonly agentTemplate: IBuiltinAgentTemplate
}

// ─── Tool implementations (typed explicitly to satisfy strict linting) ────────

const cryptoGetMarketDataTool: ITool = {
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
  run: async (input: IToolInput, ctx: IModuleContext): Promise<unknown> => {
    const symbol  = ((input.symbol as string | undefined) ?? 'BTC').toUpperCase()
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

    const http: IHttpAPI = ctx.http
    const res = await http.get<ICoinGeckoMarket[]>(url, {
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`CoinGecko API error ${String(res.status)}: ${res.text}`)
    }

    const coin = res.data[0]
    if (!coin) throw new Error(`No data returned for symbol ${symbol}`)

    return {
      symbol,
      price:     coin.current_price,
      change24h: Math.round(coin.price_change_percentage_24h * 100) / 100,
      volume:    coin.total_volume,
      marketCap: coin.market_cap,
      high24h:   coin.high_24h,
      low24h:    coin.low_24h,
      fetchedAt: new Date().toISOString(),
    }
  },
}

const writingProcessTool: ITool = {
  name: 'process_writing',
  description:
    'Process text with AI. Actions: improve, summarize, expand, translate, fix-grammar.',
  inputSchema: {
    type: 'object',
    properties: {
      text:   { type: 'string', description: 'Text to process' },
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
  run: async (input: IToolInput, ctx: IModuleContext): Promise<unknown> => {
    const action      = input.action as string
    const buildPrompt = WRITING_PROMPTS[action]
    if (!buildPrompt) throw new Error(`Unknown writing action: ${action}`)
    const response = await ctx.ai.generate({ capability: 'writing', input: buildPrompt(input) })
    return { result: response.output, tokensUsed: response.tokensUsed }
  },
}

export const BUILTIN_MODULES: readonly IBuiltinModuleEntry[] = [
  // ── Crypto Analysis ──────────────────────────────────────────────────────
  {
    id: 'crypto',
    agentTemplate: {
      name: 'Crypto Analysis',
      description: 'Real-time BTC, ETH, SOL & BNB market data with AI-powered insights.',
      icon: '🪙',
      colorClass: 'bg-emerald-500/10 text-emerald-400',
      execSteps: [
        'Connecting to CoinGecko market feed…',
        'Fetching multi-asset price data…',
        'Running technical analysis…',
        'Generating AI market outlook…',
        'Saving analysis to history…',
      ],
    },
    definition: {
      manifest: {
        name: 'crypto',
        version: '1.0.0',
        minCoreVersion: '1.0.0',
        maxCoreVersion: '2.x',
        permissions: [
          Permission.AiGenerate,
          Permission.NetworkFetch,
          Permission.StorageRead,
          Permission.StorageWrite,
          Permission.UiDashboard,
          Permission.UiNotify,
        ] as Permission[],
        description: 'Live crypto market analysis powered by CoinGecko + AI',
        author: 'AgentHub Team',
        icon: '🪙',
        category: 'finance',
        tags: ['crypto', 'bitcoin', 'market-data'],
      },
      tools: [cryptoGetMarketDataTool],
      onActivate(ctx: IModuleContext) {
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
    agentTemplate: {
      name: 'Writing Helper',
      description: 'Improve, summarize, expand, translate, or fix grammar in any text with AI.',
      icon: '✍️',
      colorClass: 'bg-pink-500/10 text-pink-400',
      execSteps: [
        'Parsing input text…',
        'Detecting language & tone…',
        'Applying AI transformation…',
        'Reviewing result quality…',
        'Saving output…',
      ],
    },
    definition: {
      manifest: {
        name: 'writing-helper',
        version: '1.0.0',
        minCoreVersion: '1.0.0',
        maxCoreVersion: '2.x',
        permissions: [Permission.AiGenerate, Permission.UiNotify] as Permission[],
        description: 'AI-powered writing assistant — improve, summarize, translate and more',
        author: 'AgentHub Team',
        icon: '✍️',
        category: 'productivity',
        tags: ['writing', 'grammar', 'translate', 'summarize'],
      },
      tools: [writingProcessTool],
      onActivate(ctx: IModuleContext) {
        ctx.ui.notify({
          title: 'Writing Helper',
          body: 'AI writing assistant is ready.',
          level: 'info',
        })
      },
    },
  },
]
