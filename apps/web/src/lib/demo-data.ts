/**
 * demo-data.ts
 *
 * Static fake data and a request interceptor for VITE_DEMO_MODE=true.
 * Allows the full web dashboard to be explored without a live backend.
 *
 * All data is seeded locally — no network calls are made in demo mode.
 */

import type {
  IUser,
  IDevice,
  IMiniApp,
  IWorkspace,
  IWorkspaceRun,
  IBot,
  IBotRun,
  IPlatformStats,
  IDeviceMetrics,
  IAppReview,
} from './api-client.js'

// ── User ──────────────────────────────────────────────────────────────────────

export const DEMO_USER: IUser = {
  id: 'demo-user-01',
  email: 'demo@ai-superapp.dev',
  name: 'Alex Chen',
  plan: 'pro',
  created_at: '2026-01-01T00:00:00Z',
}

// ── Devices ───────────────────────────────────────────────────────────────────

export const DEMO_DEVICES: IDevice[] = [
  {
    id: 'dev-1',
    name: 'MacBook Pro 16"',
    version: '1.0.0',
    platform: 'macOS',
    status: 'online',
    last_seen_at: new Date().toISOString(),
    registered_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'dev-2',
    name: 'Office iMac',
    version: '1.0.0',
    platform: 'macOS',
    status: 'online',
    last_seen_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    registered_at: '2026-01-20T09:00:00Z',
  },
  {
    id: 'dev-3',
    name: 'Linux Dev Server',
    version: '0.9.8',
    platform: 'Linux',
    status: 'offline',
    last_seen_at: '2026-02-18T22:31:00Z',
    registered_at: '2026-01-10T08:00:00Z',
  },
]

export const DEMO_DEVICE_METRICS: Record<string, IDeviceMetrics> = {
  'dev-1': {
    device_id: 'dev-1',
    cpu_percent: 23,
    mem_percent: 58,
    uptime_seconds: 86_400 * 3,
    tasks_done: 142,
    updated_at: new Date().toISOString(),
  },
  'dev-2': {
    device_id: 'dev-2',
    cpu_percent: 8,
    mem_percent: 41,
    uptime_seconds: 86_400,
    tasks_done: 67,
    updated_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export const DEMO_APPS: IMiniApp[] = [
  {
    id: 'app-crypto',
    slug: 'crypto-tracker',
    name: 'Crypto Tracker',
    description: 'Real-time cryptocurrency prices, portfolio tracking, and market alerts powered by AI analysis.',
    category: 'productivity',
    developer: 'AI SuperApp Team',
    version: '2.1.0',
    icon_url: '',
    rating: 4.8,
    install_count: 12_400,
    is_free: true,
    price_usd: null,
    permissions: ['network', 'notifications'],
    changelog: 'Added portfolio summary and 24h price alerts.',
    installed: true,
  },
  {
    id: 'app-writing',
    slug: 'writing-helper',
    name: 'Writing Helper',
    description: 'AI-powered writing assistant that improves tone, grammar, and style. Supports 20+ languages.',
    category: 'writing',
    developer: 'AI SuperApp Team',
    version: '1.4.2',
    icon_url: '',
    rating: 4.9,
    install_count: 28_700,
    is_free: true,
    price_usd: null,
    permissions: ['ai', 'clipboard'],
    changelog: 'Added multilingual support and custom tone presets.',
    installed: true,
  },
  {
    id: 'app-code-review',
    slug: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Automated code review with AI-powered suggestions for bugs, performance, and best practices.',
    category: 'development',
    developer: 'DevTools Lab',
    version: '3.0.1',
    icon_url: '',
    rating: 4.7,
    install_count: 9_800,
    is_free: false,
    price_usd: 9.99,
    permissions: ['filesystem', 'ai'],
    changelog: 'Support for Go, Rust, and Python 3.12.',
    installed: false,
  },
  {
    id: 'app-scheduler',
    slug: 'smart-scheduler',
    name: 'Smart Scheduler',
    description: 'AI agent that manages your calendar, schedules meetings, and sends reminders automatically.',
    category: 'automation',
    developer: 'AutoFlow Inc.',
    version: '1.1.0',
    icon_url: '',
    rating: 4.5,
    install_count: 5_300,
    is_free: false,
    price_usd: 4.99,
    permissions: ['notifications', 'ai', 'network'],
    changelog: 'Google Calendar and Outlook integration.',
    installed: true,
  },
  {
    id: 'app-summarizer',
    slug: 'doc-summarizer',
    name: 'Doc Summarizer',
    description: 'Instantly summarize PDFs, articles, and documents. Extract key insights in seconds.',
    category: 'productivity',
    developer: 'ReadAI',
    version: '2.0.0',
    icon_url: '',
    rating: 4.6,
    install_count: 18_200,
    is_free: true,
    price_usd: null,
    permissions: ['filesystem', 'ai'],
    changelog: 'PDF table extraction and multi-doc comparison.',
    installed: false,
  },
  {
    id: 'app-sql-gen',
    slug: 'sql-generator',
    name: 'SQL Generator',
    description: 'Turn plain English into optimized SQL queries. Supports PostgreSQL, MySQL, SQLite.',
    category: 'development',
    developer: 'DataCraft',
    version: '1.2.3',
    icon_url: '',
    rating: 4.4,
    install_count: 7_100,
    is_free: false,
    price_usd: 6.99,
    permissions: ['ai'],
    changelog: 'Added query explanation and index recommendations.',
    installed: false,
  },
  {
    id: 'app-email-writer',
    slug: 'email-writer',
    name: 'Email Writer',
    description: 'Draft professional emails in seconds. AI tailors tone to recipient and context.',
    category: 'writing',
    developer: 'InboxAI',
    version: '1.0.5',
    icon_url: '',
    rating: 4.7,
    install_count: 22_000,
    is_free: true,
    price_usd: null,
    permissions: ['ai', 'clipboard'],
    changelog: 'Follow-up email templates and reply suggestions.',
    installed: false,
  },
  {
    id: 'app-pipeline',
    slug: 'data-pipeline',
    name: 'Data Pipeline',
    description: 'Build and automate data transformation pipelines with a visual no-code editor.',
    category: 'automation',
    developer: 'PipeFlow',
    version: '0.8.0',
    icon_url: '',
    rating: 4.2,
    install_count: 3_400,
    is_free: false,
    price_usd: 14.99,
    permissions: ['filesystem', 'network', 'ai'],
    changelog: 'Beta: CSV, JSON, and REST connector nodes.',
    installed: false,
  },
]

// ── Workspaces ────────────────────────────────────────────────────────────────

export const DEMO_WORKSPACES: IWorkspace[] = [
  {
    id: 'ws-1',
    name: 'Q1 Marketing Copy',
    app_id: 'app-writing',
    app_name: 'Writing Helper',
    app_slug: 'writing-helper',
    created_at: '2026-02-01T09:00:00Z',
    updated_at: '2026-02-20T14:22:00Z',
  },
  {
    id: 'ws-2',
    name: 'Portfolio Dashboard',
    app_id: 'app-crypto',
    app_name: 'Crypto Tracker',
    app_slug: 'crypto-tracker',
    created_at: '2026-01-18T11:00:00Z',
    updated_at: '2026-02-21T08:05:00Z',
  },
  {
    id: 'ws-3',
    name: 'Backend PR Reviews',
    app_id: 'app-code-review',
    app_name: 'Code Reviewer',
    app_slug: 'code-reviewer',
    created_at: '2026-02-10T13:00:00Z',
    updated_at: '2026-02-19T16:45:00Z',
  },
]

export const DEMO_WORKSPACE_RUNS: Record<string, IWorkspaceRun[]> = {
  'ws-1': [
    {
      id: 'run-ws1-1',
      workspace_id: 'ws-1',
      input: 'Write a punchy product launch email for our new AI scheduling feature.',
      output: 'Subject: Your meetings just got smarter ✨\n\nHi [Name],\n\nWe\'re thrilled to announce Smart Scheduler — the AI agent that takes the pain out of calendar management...',
      status: 'completed',
      tokens_used: 840,
      model: 'gpt-4o',
      created_at: '2026-02-20T14:22:00Z',
    },
    {
      id: 'run-ws1-2',
      workspace_id: 'ws-1',
      input: 'Rewrite in a more casual tone for the developer audience.',
      output: 'Subject: Stop context-switching to manage your calendar 🗓️\n\nHey dev folks,\n\nWe built something you\'ll actually want to use...',
      status: 'completed',
      tokens_used: 620,
      model: 'gpt-4o',
      created_at: '2026-02-20T14:35:00Z',
    },
  ],
  'ws-2': [
    {
      id: 'run-ws2-1',
      workspace_id: 'ws-2',
      input: 'Show me BTC and ETH 24h performance.',
      output: 'BTC: $68,420 (+3.2% / 24h) | Volume: $32.1B\nETH: $3,840 (+1.8% / 24h) | Volume: $14.7B\n\nMarket sentiment: Bullish. BTC dominance at 54.2%.',
      status: 'completed',
      tokens_used: 310,
      model: 'claude-3-5-sonnet',
      created_at: '2026-02-21T08:05:00Z',
    },
  ],
  'ws-3': [
    {
      id: 'run-ws3-1',
      workspace_id: 'ws-3',
      input: 'Review this Go function for performance issues...',
      output: '## Code Review\n\n**Issues found: 2**\n\n1. `O(n²)` loop in `processItems()` — consider using a map for O(1) lookups\n2. Missing context cancellation in HTTP client — can cause goroutine leaks\n\n**Suggestions:**\n- Use `sync.Map` for concurrent access\n- Add `defer cancel()` after `context.WithTimeout`',
      status: 'completed',
      tokens_used: 1_240,
      model: 'claude-3-5-sonnet',
      created_at: '2026-02-19T16:45:00Z',
    },
  ],
}

// ── Bots ──────────────────────────────────────────────────────────────────────

export const DEMO_BOTS: IBot[] = [
  {
    id: 'bot-1',
    name: 'Daily Briefing',
    description: 'Fetches market data, news headlines, and calendar summary every morning at 8 AM.',
    goal: 'Deliver a concise daily briefing with market snapshot, top 5 tech headlines, and today\'s schedule.',
    status: 'active',
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-02-21T08:00:00Z',
  },
  {
    id: 'bot-2',
    name: 'PR Review Bot',
    description: 'Automatically reviews new GitHub pull requests and posts AI-generated feedback.',
    goal: 'Review code quality, catch potential bugs, suggest improvements, and label PRs by complexity.',
    status: 'active',
    created_at: '2026-02-01T12:00:00Z',
    updated_at: '2026-02-20T15:30:00Z',
  },
  {
    id: 'bot-3',
    name: 'Invoice Processor',
    description: 'Reads invoice PDFs from a watched folder, extracts data, and updates the accounting sheet.',
    goal: 'Extract vendor, amount, date, and line items from invoices and append to Google Sheets.',
    status: 'paused',
    created_at: '2026-01-28T09:00:00Z',
    updated_at: '2026-02-15T11:00:00Z',
  },
  {
    id: 'bot-4',
    name: 'Social Monitor',
    description: 'Monitors Twitter/X and Reddit for brand mentions and sentiment analysis.',
    goal: 'Track brand mentions, classify sentiment, and send a weekly digest report.',
    status: 'active',
    created_at: '2026-02-10T14:00:00Z',
    updated_at: '2026-02-21T06:00:00Z',
  },
]

export const DEMO_BOT_RUNS: Record<string, IBotRun[]> = {
  'bot-1': [
    { id: 'run-b1-1', bot_id: 'bot-1', status: 'completed', steps: 4, result: 'Briefing delivered. BTC +3.2%, ETH +1.8%. 3 meetings today.', started_at: '2026-02-21T08:00:00Z', ended_at: '2026-02-21T08:00:42Z' },
    { id: 'run-b1-2', bot_id: 'bot-1', status: 'completed', steps: 4, result: 'Briefing delivered. Markets flat. 1 meeting today.', started_at: '2026-02-20T08:00:00Z', ended_at: '2026-02-20T08:00:38Z' },
    { id: 'run-b1-3', bot_id: 'bot-1', status: 'completed', steps: 3, result: 'Briefing delivered.', started_at: '2026-02-19T08:00:00Z', ended_at: '2026-02-19T08:00:35Z' },
  ],
  'bot-2': [
    { id: 'run-b2-1', bot_id: 'bot-2', status: 'completed', steps: 6, result: 'Reviewed PR #142: 2 issues flagged, labeled "needs-revision".', started_at: '2026-02-20T15:28:00Z', ended_at: '2026-02-20T15:29:10Z' },
    { id: 'run-b2-2', bot_id: 'bot-2', status: 'completed', steps: 5, result: 'Reviewed PR #141: LGTM, labeled "ready-to-merge".', started_at: '2026-02-20T11:10:00Z', ended_at: '2026-02-20T11:10:55Z' },
    { id: 'run-b2-3', bot_id: 'bot-2', status: 'running', steps: 3, result: '', started_at: new Date(Date.now() - 30_000).toISOString() },
  ],
  'bot-3': [
    { id: 'run-b3-1', bot_id: 'bot-3', status: 'completed', steps: 8, result: 'Processed 3 invoices. Total: $12,450. Sheet updated.', started_at: '2026-02-15T09:00:00Z', ended_at: '2026-02-15T09:01:22Z' },
  ],
  'bot-4': [
    { id: 'run-b4-1', bot_id: 'bot-4', status: 'completed', steps: 12, result: '47 mentions. Sentiment: 72% positive, 18% neutral, 10% negative.', started_at: '2026-02-21T06:00:00Z', ended_at: '2026-02-21T06:01:05Z' },
    { id: 'run-b4-2', bot_id: 'bot-4', status: 'completed', steps: 11, result: '31 mentions. Sentiment: 68% positive.', started_at: '2026-02-20T06:00:00Z', ended_at: '2026-02-20T06:00:58Z' },
  ],
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export const DEMO_STATS: IPlatformStats = {
  total_devices: 3,
  online_devices: 2,
  total_installs: 4,
  total_bots: 4,
  total_bot_runs: 11,
  total_workspaces: 3,
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export const DEMO_REVIEWS: Record<string, IAppReview[]> = {
  'app-writing': [
    { id: 'rev-1', app_id: 'app-writing', user_id: 'u-1', user_name: 'Sarah K.', rating: 5, body: 'Absolutely love this — cut my writing time in half. The tone adjustment is spot on.', created_at: '2026-02-10T10:00:00Z', updated_at: '2026-02-10T10:00:00Z' },
    { id: 'rev-2', app_id: 'app-writing', user_id: 'u-2', user_name: 'Marcus T.', rating: 5, body: 'Best writing tool I\'ve used. The multilingual support is a game changer for our team.', created_at: '2026-02-08T14:00:00Z', updated_at: '2026-02-08T14:00:00Z' },
    { id: 'rev-3', app_id: 'app-writing', user_id: 'u-3', user_name: 'Priya M.', rating: 4, body: 'Great tool! Would love a dark mode for the editor panel.', created_at: '2026-02-05T09:00:00Z', updated_at: '2026-02-05T09:00:00Z' },
  ],
  'app-crypto': [
    { id: 'rev-4', app_id: 'app-crypto', user_id: 'u-4', user_name: 'Jake L.', rating: 5, body: 'Portfolio tracking is super clean. Price alerts actually work reliably.', created_at: '2026-02-12T11:00:00Z', updated_at: '2026-02-12T11:00:00Z' },
    { id: 'rev-5', app_id: 'app-crypto', user_id: 'u-5', user_name: 'Nina R.', rating: 4, body: 'Would love more coins supported but otherwise excellent.', created_at: '2026-02-07T16:00:00Z', updated_at: '2026-02-07T16:00:00Z' },
  ],
}

// ── Request interceptor ───────────────────────────────────────────────────────

let _botRunCounter = 100

/**
 * Intercepts all API requests in demo mode.
 * Returns fake data matching the path/method pattern.
 * Throws for write operations to simulate success without persistence.
 */
export function handleDemoRequest<T>(method: string, path: string, _body?: unknown): T {
  const GET = method === 'GET'
  const POST = method === 'POST'
  const PATCH = method === 'PATCH'
  const PUT = method === 'PUT'
  const DELETE = method === 'DELETE'

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (GET && path === '/v1/auth/me') return DEMO_USER as T

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (GET && path === '/v1/stats') return DEMO_STATS as T

  // ── Devices ───────────────────────────────────────────────────────────────
  if (GET && path === '/v1/devices') return DEMO_DEVICES as T
  if (POST && path === '/v1/devices') {
    const b = _body as { name: string; platform: string; version: string }
    return { id: `dev-demo-${Date.now()}`, name: b.name, version: b.version, platform: b.platform, status: 'online', last_seen_at: new Date().toISOString(), registered_at: new Date().toISOString() } as T
  }
  if (PATCH && /^\/v1\/devices\/[^/]+$/.test(path)) {
    const id = path.split('/')[3]
    const device = DEMO_DEVICES.find((d) => d.id === id) ?? DEMO_DEVICES[0]
    return { ...device, name: (_body as { name: string }).name } as T
  }
  if (DELETE && /^\/v1\/devices\/[^/]+$/.test(path)) return undefined as T
  if (POST && /^\/v1\/devices\/[^/]+\/heartbeat$/.test(path)) return undefined as T
  if (GET && /^\/v1\/devices\/[^/]+\/metrics$/.test(path)) {
    const id = path.split('/')[3]
    return (DEMO_DEVICE_METRICS[id] ?? null) as T
  }

  // ── Marketplace ───────────────────────────────────────────────────────────
  if (GET && path.startsWith('/v1/marketplace/installed')) return DEMO_APPS.filter((a) => a.installed) as T
  if (GET && path.startsWith('/v1/marketplace?') || (GET && path === '/v1/marketplace')) {
    const qs = path.includes('?') ? new URLSearchParams(path.split('?')[1]) : new URLSearchParams()
    const q = (qs.get('q') ?? '').toLowerCase()
    const cat = qs.get('category') ?? ''
    return DEMO_APPS.filter((a) =>
      (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) &&
      (!cat || cat === 'all' || a.category === cat),
    ) as T
  }
  if (GET && /^\/v1\/marketplace\/[^/]+\/reviews/.test(path)) {
    const appId = path.split('/')[3]
    return (DEMO_REVIEWS[appId] ?? []) as T
  }
  if (GET && /^\/v1\/marketplace\/[^/]+$/.test(path)) {
    const slug = path.split('/')[3]
    return (DEMO_APPS.find((a) => a.id === slug || a.slug === slug) ?? DEMO_APPS[0]) as T
  }
  if (POST && /^\/v1\/marketplace\/[^/]+\/install$/.test(path)) return undefined as T
  if (DELETE && /^\/v1\/marketplace\/[^/]+\/install$/.test(path)) return undefined as T
  if (POST && /^\/v1\/marketplace\/[^/]+\/reviews$/.test(path)) {
    const b = _body as { rating: number; body: string }
    return { id: `rev-demo-${Date.now()}`, app_id: path.split('/')[3], user_id: DEMO_USER.id, user_name: DEMO_USER.name, rating: b.rating, body: b.body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as T
  }
  if (DELETE && /^\/v1\/marketplace\/[^/]+\/reviews$/.test(path)) return undefined as T

  // ── Workspaces ────────────────────────────────────────────────────────────
  if (GET && path === '/v1/workspaces') return DEMO_WORKSPACES as T
  if (POST && path === '/v1/workspaces') {
    const b = _body as { name: string; app_id?: string }
    const app = DEMO_APPS.find((a) => a.id === b.app_id)
    return { id: `ws-demo-${Date.now()}`, name: b.name, app_id: b.app_id ?? '', app_name: app?.name ?? '', app_slug: app?.slug ?? '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as T
  }
  if (GET && /^\/v1\/workspaces\/[^/]+\/runs/.test(path)) {
    const wsId = path.split('/')[3]
    return (DEMO_WORKSPACE_RUNS[wsId] ?? []) as T
  }
  if (POST && /^\/v1\/workspaces\/[^/]+\/runs$/.test(path)) {
    const b = _body as { input: string; output: string; tokens_used: number; model: string; status: string }
    return { id: `run-demo-${Date.now()}`, workspace_id: path.split('/')[3], input: b.input, output: b.output, status: b.status, tokens_used: b.tokens_used, model: b.model, created_at: new Date().toISOString() } as T
  }
  if (GET && /^\/v1\/workspaces\/[^/]+\/runs\/[^/]+$/.test(path)) {
    const [,,,wsId,,runId] = path.split('/')
    return ((DEMO_WORKSPACE_RUNS[wsId] ?? []).find((r) => r.id === runId) ?? DEMO_WORKSPACE_RUNS['ws-1'][0]) as T
  }
  if (GET && /^\/v1\/workspaces\/[^/]+$/.test(path)) {
    const wsId = path.split('/')[3]
    return (DEMO_WORKSPACES.find((w) => w.id === wsId) ?? DEMO_WORKSPACES[0]) as T
  }
  if (PATCH && /^\/v1\/workspaces\/[^/]+$/.test(path)) {
    const wsId = path.split('/')[3]
    const ws = DEMO_WORKSPACES.find((w) => w.id === wsId) ?? DEMO_WORKSPACES[0]
    return { ...ws, name: (_body as { name: string }).name } as T
  }
  if (DELETE && /^\/v1\/workspaces\/[^/]+$/.test(path)) return undefined as T

  // ── Bots ──────────────────────────────────────────────────────────────────
  if (GET && path === '/v1/bots') return DEMO_BOTS as T
  if (POST && path === '/v1/bots') {
    const b = _body as { name: string; description: string; goal: string }
    return { id: `bot-demo-${Date.now()}`, name: b.name, description: b.description, goal: b.goal, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as T
  }
  if (GET && /^\/v1\/bots\/[^/]+\/runs/.test(path)) {
    const botId = path.split('/')[3]
    return (DEMO_BOT_RUNS[botId] ?? []) as T
  }
  if (POST && /^\/v1\/bots\/[^/]+\/runs$/.test(path)) {
    const runId = `run-demo-${++_botRunCounter}`
    return { run_id: runId, status: 'pending' } as T
  }
  if (GET && /^\/v1\/bots\/[^/]+$/.test(path)) {
    const botId = path.split('/')[3]
    return (DEMO_BOTS.find((b) => b.id === botId) ?? DEMO_BOTS[0]) as T
  }
  if (PUT && /^\/v1\/bots\/[^/]+$/.test(path)) {
    const botId = path.split('/')[3]
    const bot = DEMO_BOTS.find((b) => b.id === botId) ?? DEMO_BOTS[0]
    return { ...bot, ...(_body as Partial<IBot>), updated_at: new Date().toISOString() } as T
  }
  if (DELETE && /^\/v1\/bots\/[^/]+$/.test(path)) return undefined as T
  if (PATCH && /^\/v1\/bots\/runs\/[^/]+$/.test(path)) return undefined as T

  // ── Auth mutations (no-ops in demo) ───────────────────────────────────────
  if (POST && (path === '/v1/auth/logout' || path === '/v1/auth/logout-all')) return undefined as T
  if (POST && path === '/v1/auth/change-password') return undefined as T
  if (DELETE && path === '/v1/auth/account') return undefined as T

  // Fallback — should not be reached in a well-covered demo
  console.warn('[demo] Unhandled request:', method, path)
  return undefined as T
}
