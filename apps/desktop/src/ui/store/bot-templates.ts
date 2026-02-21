/**
 * bot-templates.ts
 *
 * Built-in bot templates — predefined bot types that a user can instantiate
 * as many times as needed with different names, goals, and configurations.
 * A single template (e.g. "Daily Digest") can power dozens of distinct bots.
 */

/** A reusable bot type definition. */
export interface IBotTemplate {
  /** Unique template identifier — stored as `templateId` on each `IDesktopBot`. */
  id: string
  name: string
  description: string
  /** Suggested goal pre-filled in the create modal (user can edit freely). */
  defaultGoal: string
  icon: string
  category: 'productivity' | 'research' | 'automation' | 'creative' | 'finance'
}

export const BOT_TEMPLATES: IBotTemplate[] = [
  {
    id: 'daily-digest',
    name: 'Daily Digest',
    description: 'Summarise news and updates from any source every morning.',
    defaultGoal:
      "Search the web for today's top headlines, summarise them into concise bullet points, and save the output.",
    icon: '📰',
    category: 'productivity',
  },
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    description: 'Deep-dive into any topic and produce a structured report.',
    defaultGoal:
      'Research the specified topic, gather key facts from multiple sources, and produce a structured markdown report.',
    icon: '🔍',
    category: 'research',
  },
  {
    id: 'price-alert',
    name: 'Price Alert',
    description: 'Monitor crypto or stock prices and notify you on movements.',
    defaultGoal:
      'Check the current price of BTC, compare it to 24 hours ago, and generate a summary report if it moved more than 5%.',
    icon: '📈',
    category: 'finance',
  },
  {
    id: 'social-scheduler',
    name: 'Social Scheduler',
    description: 'Draft engaging social media posts using AI and queue them.',
    defaultGoal:
      'Generate 3 engaging Twitter/X posts about AI trends and save them as ready-to-publish drafts.',
    icon: '📣',
    category: 'creative',
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Review recent git commits and surface concrete improvements.',
    defaultGoal:
      'Review the latest git commit diff in the current repo, identify potential bugs, and suggest concrete improvements.',
    icon: '👨‍💻',
    category: 'automation',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Summarise meetings and extract action items automatically.',
    defaultGoal:
      'Summarise the provided meeting transcript, extract clear action items with owners and due dates.',
    icon: '📝',
    category: 'productivity',
  },
  {
    id: 'crypto-analysis',
    name: 'Crypto Analysis',
    description: 'Real-time market data, price alerts, and AI-powered insights for BTC, ETH, SOL and BNB.',
    defaultGoal:
      'Monitor BTC, ETH, SOL and BNB market data, detect significant price movements, and generate an AI-powered market outlook.',
    icon: '🪙',
    category: 'finance',
  },
  {
    id: 'writing-helper',
    name: 'Writing Helper',
    description: 'Improve, summarize, expand, translate, or fix grammar in any text with AI.',
    defaultGoal:
      'Process the provided text and return an improved version based on the selected action — improve clarity, summarize, expand, translate, or fix grammar.',
    icon: '✍️',
    category: 'creative',
  },
]

/** Tailwind colour classes keyed by category — used on template cards. */
export const TEMPLATE_CATEGORY_COLORS: Record<IBotTemplate['category'], string> = {
  productivity: 'bg-blue-500/10 text-blue-400',
  research:     'bg-purple-500/10 text-purple-400',
  automation:   'bg-orange-500/10 text-orange-400',
  creative:     'bg-pink-500/10 text-pink-400',
  finance:      'bg-emerald-500/10 text-emerald-400',
}

/**
 * Downloadable bot types available in the Store.
 * These are not shown by default — the user must install them from the Store tab.
 * Installed types appear alongside BOT_TEMPLATES in the Bots tab.
 */
export const BOT_TYPE_CATALOG: IBotTemplate[] = [
  {
    id: 'seo-analyzer',
    name: 'SEO Analyzer',
    description: 'Audit any URL for SEO issues and generate improvement recommendations.',
    defaultGoal:
      'Crawl the given URL, analyse its SEO metadata, headings, and content structure, then produce a scored SEO audit with actionable recommendations.',
    icon: '🔎',
    category: 'productivity',
  },
  {
    id: 'email-drip',
    name: 'Email Drip Campaign',
    description: 'Draft multi-step email sequences for marketing or onboarding.',
    defaultGoal:
      'Write a 5-email drip sequence for a SaaS product onboarding campaign. Each email needs a subject line, body, and a clear CTA.',
    icon: '📨',
    category: 'automation',
  },
  {
    id: 'stock-screener',
    name: 'Stock Screener',
    description: 'Scan stocks by financial criteria and produce a ranked watchlist.',
    defaultGoal:
      'Screen S&P 500 stocks with P/E < 20, revenue growth > 10 %, and positive free cash flow. Rank the top 10 by earnings quality.',
    icon: '📉',
    category: 'finance',
  },
  {
    id: 'competitor-tracker',
    name: 'Competitor Tracker',
    description: 'Monitor competitor websites and surface notable changes.',
    defaultGoal:
      'Visit the competitor websites listed in the config, summarise any new blog posts, pricing changes, or product announcements from the past 7 days.',
    icon: '👁️',
    category: 'research',
  },
  {
    id: 'social-listener',
    name: 'Social Listener',
    description: 'Track brand mentions and sentiment across social platforms.',
    defaultGoal:
      'Search Twitter/X and Reddit for mentions of the brand name in the last 24 hours. Summarise sentiment, key topics, and notable threads.',
    icon: '📡',
    category: 'research',
  },
  {
    id: 'release-notes-writer',
    name: 'Release Notes Writer',
    description: 'Auto-generate polished release notes from git commits.',
    defaultGoal:
      'Parse the git log since the last tag, group commits by type (feat, fix, chore), and produce user-friendly release notes in markdown.',
    icon: '📋',
    category: 'automation',
  },
  {
    id: 'ad-copywriter',
    name: 'Ad Copywriter',
    description: 'Generate high-converting ad copy for multiple channels.',
    defaultGoal:
      'Write 5 Google Ads headlines, 3 Facebook ad variations, and 2 LinkedIn ad copies for the given product description. Focus on benefits and CTAs.',
    icon: '📢',
    category: 'creative',
  },
  {
    id: 'bug-triage',
    name: 'Bug Triage',
    description: 'Analyse incoming bug reports and assign severity + owner.',
    defaultGoal:
      'Review open GitHub issues without labels, classify each by severity (critical/high/medium/low), suggest an owner based on changed files, and output a triage report.',
    icon: '🐛',
    category: 'automation',
  },
]
