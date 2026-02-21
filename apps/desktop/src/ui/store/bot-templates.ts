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
]

/** Tailwind colour classes keyed by category — used on template cards. */
export const TEMPLATE_CATEGORY_COLORS: Record<IBotTemplate['category'], string> = {
  productivity: 'bg-blue-500/10 text-blue-400',
  research:     'bg-purple-500/10 text-purple-400',
  automation:   'bg-orange-500/10 text-orange-400',
  creative:     'bg-pink-500/10 text-pink-400',
  finance:      'bg-emerald-500/10 text-emerald-400',
}
