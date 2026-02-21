/**
 * bot-worker.ts
 *
 * Utility for dispatching work to a Mini-App's Bot Worker and polling for the
 * result.
 *
 * Architecture:
 *   Each Mini-App is backed by a dedicated Bot Worker running on the Desktop
 *   Agent. The Web UI sends a structured JSON input to the bot, the bot
 *   executes the task (calls tools / AI), then posts the result back via
 *   botsApi.updateRun(). The Web polls until the run is complete.
 *
 * Flow:
 *   1. Web calls runBotTask(botId, inputJSON)
 *   2. botsApi.start() creates a run and returns run_id
 *   3. Desktop Agent Bot Worker picks up the run, executes the Mini-App tool
 *   4. Bot Worker posts result via botsApi.updateRun(runId, 'completed', …)
 *   5. runBotTask polls botsApi.getRuns() until the run is completed
 *   6. Parsed result is returned to the Mini-App panel
 *
 * Fallback:
 *   If the Bot Worker is offline or the run times out (BOT_TIMEOUT_MS),
 *   runBotTask throws an Error with code 'BOT_TIMEOUT' or 'BOT_FAILED'.
 *   Each panel catches this and falls back to local computation, showing a
 *   "Local" mode indicator to the user.
 */

import { botsApi, type IBot, type IMiniApp } from '../../lib/api-client.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const BOT_POLL_INTERVAL_MS = 1_500
const BOT_TIMEOUT_MS = 15_000

// ─── Bot dispatch & poll ──────────────────────────────────────────────────────

/**
 * Dispatches a task to a bot worker and polls until the run completes.
 *
 * @param botId  - The ID of the bot to run
 * @param input  - JSON-serialized task input (see per-app contracts below)
 * @returns      - Parsed result `T` from the bot's `run.result` field
 * @throws       - 'BOT_TIMEOUT' if the run doesn't complete within the timeout
 *               - 'BOT_FAILED'  if the run status is 'failed'
 *
 * Input / output contracts:
 *   Crypto Tracker:
 *     input:  `{ type: "get_market_data", symbol: "BTC" }`
 *     output: `IMarketData` (price, change24h, volume, marketCap, …)
 *
 *   Writing Helper:
 *     input:  `{ type: "process_writing", text, action, tone, targetLanguage? }`
 *     output: `{ result: string, tokensUsed: number }`
 *
 *   Generic:
 *     input:  raw instruction string (wrapped in `{ type: "run", instruction }`)
 *     output: `{ output: string }`
 */
export async function runBotTask<T>(botId: string, input: string): Promise<T> {
  const { run_id } = await botsApi.start(botId, input)

  const deadline = Date.now() + BOT_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => { setTimeout(resolve, BOT_POLL_INTERVAL_MS) })

    const runs = await botsApi.getRuns(botId, 20)
    const run = runs.find((r) => r.id === run_id)

    if (run === undefined) continue

    if (run.status === 'completed' && run.result.length > 0) {
      return JSON.parse(run.result) as T
    }

    if (run.status === 'failed') {
      throw new Error(`BOT_FAILED: ${run.result.length > 0 ? run.result : 'unknown error'}`)
    }
  }

  throw new Error('BOT_TIMEOUT')
}

// ─── Bot ↔ App matching ───────────────────────────────────────────────────────

/**
 * Finds the bot worker that powers a given mini app.
 *
 * Matching strategy (in order):
 *   1. Exact normalized name match  (e.g. "Crypto Tracker" ↔ "crypto tracker")
 *   2. Slug match                   (e.g. "crypto-tracker" ↔ "crypto tracker")
 *   3. Substring containment        (bot name ⊆ app name or vice versa)
 */
export function findBotForApp(app: IMiniApp, bots: IBot[]): IBot | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, ' ').trim()
  const appName = norm(app.name)
  const appSlug = norm(app.slug)

  return bots.find((b) => {
    const botName = norm(b.name)
    return (
      botName === appName ||
      botName === appSlug ||
      botName.includes(appSlug) ||
      appSlug.includes(botName) ||
      appName.includes(botName)
    )
  })
}
