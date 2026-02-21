/**
 * demo-data.ts
 *
 * Fixture data for demo mode. All types mirror the real API interfaces so the
 * rest of the app consumes them without any modification.
 *
 * DEMO ONLY — never imported in production bundles.
 */

import type {
  IUser,
  IAuthResponse,
  IDevice,
  IBot,
  IBotRun,
  IMarketplaceBot,
  IDeviceMetrics,
  IPlatformStats,
  IAppReview,
} from '../api-client.js'

// ── Auth ──────────────────────────────────────────────────────────────────────

export const DEMO_TOKEN = 'demo-access-token-not-a-real-jwt'
export const DEMO_REFRESH_TOKEN = 'demo-refresh-token-not-a-real-jwt'

export const DEMO_USER: IUser = {
  id: 'demo-user-1',
  email: 'demo@aisuperapp.com',
  name: 'Demo User',
  plan: 'pro',
  created_at: '2025-01-01T00:00:00Z',
}

export const DEMO_AUTH_RESPONSE: IAuthResponse = {
  access_token: DEMO_TOKEN,
  refresh_token: DEMO_REFRESH_TOKEN,
  expires_in: 86_400,
  user: DEMO_USER,
}

// ── Devices ───────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString()

export const DEMO_DEVICES: IDevice[] = [
  {
    id: 'demo-device-1',
    name: 'MacBook Pro M3 (Demo)',
    version: '1.3.0',
    platform: 'darwin',
    status: 'online',
    last_seen_at: NOW,
    registered_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'demo-device-2',
    name: 'Home Server (Demo)',
    version: '1.2.1',
    platform: 'linux',
    status: 'online',
    last_seen_at: NOW,
    registered_at: '2025-02-01T08:00:00Z',
  },
  {
    id: 'demo-device-3',
    name: 'Old Laptop (Demo)',
    version: '1.0.0',
    platform: 'win32',
    status: 'offline',
    last_seen_at: '2025-02-10T15:30:00Z',
    registered_at: '2024-12-01T12:00:00Z',
  },
]

export const DEMO_DEVICE_METRICS: Record<string, IDeviceMetrics> = {
  'demo-device-1': {
    device_id: 'demo-device-1',
    cpu_percent: 18,
    mem_percent: 47,
    uptime_seconds: 86_400 * 3,
    tasks_done: 142,
    updated_at: NOW,
  },
  'demo-device-2': {
    device_id: 'demo-device-2',
    cpu_percent: 5,
    mem_percent: 32,
    uptime_seconds: 86_400 * 12,
    tasks_done: 308,
    updated_at: NOW,
  },
}

// ── Worker Bots (Automation System) ──────────────────────────────────────────

export const DEMO_BOTS: IBot[] = [
  {
    id: 'demo-bot-1',
    name: 'Crypto Tracker',
    description: 'Monitors crypto prices and alerts on significant movements.',
    goal: 'Track BTC, ETH and top 10 altcoin market data in real time.',
    status: 'active',
    created_at: '2025-01-20T10:00:00Z',
    updated_at: '2025-02-15T09:00:00Z',
  },
  {
    id: 'demo-bot-2',
    name: 'Writing Helper',
    description: 'AI-powered writing assistant for editing, rewriting and translation.',
    goal: 'Improve and transform text content on demand.',
    status: 'active',
    created_at: '2025-01-25T11:00:00Z',
    updated_at: '2025-02-18T14:00:00Z',
  },
  {
    id: 'demo-bot-3',
    name: 'SEO Analyzer',
    description: 'Analyzes web content for SEO opportunities and keyword density.',
    goal: 'Generate actionable SEO improvement reports.',
    status: 'paused',
    created_at: '2025-02-01T09:00:00Z',
    updated_at: '2025-02-20T10:00:00Z',
  },
]

// ── Marketplace Bots ──────────────────────────────────────────────────────────

export const DEMO_MARKETPLACE_BOTS: IMarketplaceBot[] = [
  {
    id: 'mp-bot-1',
    slug: 'crypto-tracker',
    name: 'Crypto Tracker',
    description: 'Real-time cryptocurrency price tracking with AI-powered market analysis and portfolio alerts.',
    category: 'Finance',
    developer: 'AI SuperApp Team',
    developer_id: 'team-1',
    version: '2.1.0',
    icon_url: '',
    rating: 4.8,
    install_count: 12_400,
    is_free: true,
    price_usd: null,
    permissions: ['network'],
    changelog: '• Real-time price feeds via CoinGecko\n• AI market sentiment analysis\n• Portfolio tracking & alerts',
    installed: true,
  },
  {
    id: 'mp-bot-2',
    slug: 'writing-helper',
    name: 'Writing Helper',
    description: 'AI writing assistant that improves clarity, adjusts tone, rewrites and translates text.',
    category: 'Productivity',
    developer: 'AI SuperApp Team',
    developer_id: 'team-1',
    version: '1.5.0',
    icon_url: '',
    rating: 4.6,
    install_count: 8_750,
    is_free: true,
    price_usd: null,
    permissions: ['clipboard'],
    changelog: '• Tone adjustment (formal / casual / persuasive)\n• Grammar & style fix\n• Multi-language translation',
    installed: true,
  },
  {
    id: 'mp-bot-3',
    slug: 'seo-analyzer',
    name: 'SEO Analyzer',
    description: 'Analyzes your web content and gives keyword density, meta tag, and backlink recommendations.',
    category: 'Marketing',
    developer: 'DevStudio Labs',
    developer_id: 'dev-2',
    version: '1.2.3',
    icon_url: '',
    rating: 4.3,
    install_count: 3_200,
    is_free: false,
    price_usd: 4.99,
    permissions: ['network'],
    changelog: '• Keyword density analysis\n• Meta tag suggestions\n• Competitor gap analysis (beta)',
    installed: false,
  },
  {
    id: 'mp-bot-4',
    slug: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews code diffs, flags bugs, security issues and suggests improvements using AI.',
    category: 'Developer',
    developer: 'CodeCraft AI',
    developer_id: 'dev-3',
    version: '0.9.1',
    icon_url: '',
    rating: 4.1,
    install_count: 1_850,
    is_free: false,
    price_usd: 9.99,
    permissions: ['filesystem:read'],
    changelog: '• Multi-language support (TS, Python, Go, Rust)\n• Security vulnerability detection\n• Auto-fix suggestions',
    installed: false,
  },
  {
    id: 'mp-bot-5',
    slug: 'data-extractor',
    name: 'Data Extractor',
    description: 'Extracts structured data from any website or document and exports as CSV/JSON.',
    category: 'Data',
    developer: 'DataFlow Inc',
    developer_id: 'dev-4',
    version: '1.0.0',
    icon_url: '',
    rating: 4.5,
    install_count: 2_100,
    is_free: false,
    price_usd: 7.99,
    permissions: ['network', 'filesystem:write'],
    changelog: '• Scheduled extraction\n• CSV / JSON export\n• Anti-bot evasion layer',
    installed: false,
  },
  {
    id: 'mp-bot-6',
    slug: 'email-composer',
    name: 'Email Composer',
    description: 'Drafts professional emails from bullet points. Supports follow-up threads and tone control.',
    category: 'Productivity',
    developer: 'InboxAI',
    developer_id: 'dev-5',
    version: '1.1.0',
    icon_url: '',
    rating: 4.4,
    install_count: 4_600,
    is_free: false,
    price_usd: 2.99,
    permissions: ['clipboard'],
    changelog: '• Follow-up thread context\n• Tone presets\n• Subject line optimizer',
    installed: false,
  },
]

// ── Bot Runs ──────────────────────────────────────────────────────────────────

/** Returns an ISO timestamp N minutes in the past. */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export const DEMO_BOT_RUNS: Record<string, IBotRun[]> = {
  'demo-bot-1': [
    {
      id: 'run-1',
      bot_id: 'demo-bot-1',
      status: 'completed',
      steps: 4,
      result: '{"btc":67420,"eth":3521,"sol":182,"change":"BTC +2.3% ETH +0.8%"}',
      started_at: ago(5),
      ended_at: ago(4),
    },
    {
      id: 'run-2',
      bot_id: 'demo-bot-1',
      status: 'completed',
      steps: 4,
      result: '{"btc":65800,"eth":3490,"sol":175,"change":"BTC -1.1% ETH -0.9%"}',
      started_at: ago(75),
      ended_at: ago(74),
    },
    {
      id: 'run-3',
      bot_id: 'demo-bot-1',
      status: 'failed',
      steps: 1,
      result: 'Network timeout fetching price feed from CoinGecko',
      started_at: ago(180),
      ended_at: ago(180),
    },
  ],
  'demo-bot-2': [
    {
      id: 'run-4',
      bot_id: 'demo-bot-2',
      status: 'completed',
      steps: 3,
      result: '{"output":"Rewritten text ready. Improved clarity and tone for professional audience.","tokensUsed":312}',
      started_at: ago(30),
      ended_at: ago(29),
    },
    {
      id: 'run-5',
      bot_id: 'demo-bot-2',
      status: 'running',
      steps: 1,
      result: '',
      started_at: ago(1),
    },
  ],
  'demo-bot-3': [
    {
      id: 'run-6',
      bot_id: 'demo-bot-3',
      status: 'completed',
      steps: 7,
      result: '{"score":72,"suggestions":["Add more internal links","Improve meta description","Increase target keyword density to 1.8%"]}',
      started_at: ago(240),
      ended_at: ago(238),
    },
  ],
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export const DEMO_STATS: IPlatformStats = {
  total_devices: 3,
  online_devices: 2,
  total_installs: 2,
  total_bots: 3,
  total_bot_runs: 450,
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export const DEMO_REVIEWS: IAppReview[] = [
  {
    id: 'rev-1',
    app_id: 'mp-bot-1',
    user_id: 'u1',
    user_name: 'Alex Chen',
    rating: 5,
    body: 'Best crypto tracking bot I have used. The AI market analysis is spot on!',
    created_at: '2025-02-10T10:00:00Z',
    updated_at: '2025-02-10T10:00:00Z',
  },
  {
    id: 'rev-2',
    app_id: 'mp-bot-1',
    user_id: 'u2',
    user_name: 'Sarah K.',
    rating: 5,
    body: 'Real-time alerts saved me from a bad trade. Highly recommend.',
    created_at: '2025-02-12T14:00:00Z',
    updated_at: '2025-02-12T14:00:00Z',
  },
  {
    id: 'rev-3',
    app_id: 'mp-bot-1',
    user_id: 'u3',
    user_name: 'Marcus L.',
    rating: 4,
    body: 'Solid bot. Would love more altcoin support.',
    created_at: '2025-02-14T09:00:00Z',
    updated_at: '2025-02-14T09:00:00Z',
  },
  {
    id: 'rev-4',
    app_id: 'mp-bot-2',
    user_id: 'u4',
    user_name: 'Priya M.',
    rating: 5,
    body: 'Writing Helper transformed my emails from walls of text to clean, professional messages.',
    created_at: '2025-02-08T11:00:00Z',
    updated_at: '2025-02-08T11:00:00Z',
  },
  {
    id: 'rev-5',
    app_id: 'mp-bot-2',
    user_id: 'u5',
    user_name: 'Jake R.',
    rating: 4,
    body: 'Translation quality is excellent. Tone control could have more presets.',
    created_at: '2025-02-16T16:00:00Z',
    updated_at: '2025-02-16T16:00:00Z',
  },
]
