/**
 * bot-templates.ts
 *
 * Built-in bot templates — predefined bot types that a user can instantiate
 * as many times as needed with different names and configurations.
 * A single template (e.g. "Daily Digest") can power dozens of distinct bots.
 */

/** A reusable bot type definition. */
export interface IBotTemplate {
  /** Unique template identifier — stored as `templateId` on each `IDesktopBot`. */
  id: string
  name: string
  description: string
  icon: string
  category: 'productivity' | 'research' | 'automation' | 'creative' | 'finance'
}

export const BOT_TEMPLATES: IBotTemplate[] = [
  {
    id: 'daily-digest',
    name: 'Daily Digest',
    description: 'Summarise news and updates from any source every morning.',
    icon: '📰',
    category: 'productivity',
  },
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    description: 'Deep-dive into any topic and produce a structured report.',
    icon: '🔍',
    category: 'research',
  },
  {
    id: 'price-alert',
    name: 'Price Alert',
    description: 'Monitor crypto or stock prices and notify you on movements.',
    icon: '📈',
    category: 'finance',
  },
  {
    id: 'social-scheduler',
    name: 'Social Scheduler',
    description: 'Draft engaging social media posts using AI and queue them.',
    icon: '📣',
    category: 'creative',
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Review recent git commits and surface concrete improvements.',
    icon: '👨‍💻',
    category: 'automation',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Summarise meetings and extract action items automatically.',
    icon: '📝',
    category: 'productivity',
  },
  {
    id: 'crypto-analysis',
    name: 'Crypto Analysis',
    description: 'Real-time market data, price alerts, and AI-powered insights for BTC, ETH, SOL and BNB.',
    icon: '🪙',
    category: 'finance',
  },
  {
    id: 'writing-helper',
    name: 'Writing Helper',
    description: 'Improve, summarize, expand, translate, or fix grammar in any text with AI.',
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
    icon: '🔎',
    category: 'productivity',
  },
  {
    id: 'email-drip',
    name: 'Email Drip Campaign',
    description: 'Draft multi-step email sequences for marketing or onboarding.',
    icon: '📨',
    category: 'automation',
  },
  {
    id: 'stock-screener',
    name: 'Stock Screener',
    description: 'Scan stocks by financial criteria and produce a ranked watchlist.',
    icon: '📉',
    category: 'finance',
  },
  {
    id: 'competitor-tracker',
    name: 'Competitor Tracker',
    description: 'Monitor competitor websites and surface notable changes.',
    icon: '👁️',
    category: 'research',
  },
  {
    id: 'social-listener',
    name: 'Social Listener',
    description: 'Track brand mentions and sentiment across social platforms.',
    icon: '📡',
    category: 'research',
  },
  {
    id: 'release-notes-writer',
    name: 'Release Notes Writer',
    description: 'Auto-generate polished release notes from git commits.',
    icon: '📋',
    category: 'automation',
  },
  {
    id: 'ad-copywriter',
    name: 'Ad Copywriter',
    description: 'Generate high-converting ad copy for multiple channels.',
    icon: '📢',
    category: 'creative',
  },
  {
    id: 'bug-triage',
    name: 'Bug Triage',
    description: 'Analyse incoming bug reports and assign severity + owner.',
    icon: '🐛',
    category: 'automation',
  },
]
