/**
 * computer-agent.ts
 *
 * An agentic automation loop that uses the AI backend to accomplish goals on
 * the host computer — exactly like a human operator would.
 *
 * ## How it works
 * 1. Take a screenshot of the current screen state.
 * 2. Send the goal + screenshot data URI + action history to the AI.
 * 3. Parse the structured `IComputerAction` the AI returns.
 * 4. Execute the action via the computer-use SDK.
 * 5. Repeat until the AI emits `{ "type": "done" }` or `maxSteps` is reached.
 *
 * ## Developer integration
 * ```typescript
 * // Inside a module's onActivate:
 * const agent = ctx.computer.createAgent('Open Safari and navigate to github.com')
 * const result = await agent.run(step => {
 *   ctx.ui.notify({ title: 'Agent step', body: JSON.stringify(step.action) })
 * })
 * ```
 */

import type {
  IComputerAction,
  IComputerAgentOptions,
  IComputerAgentRunner,
  IComputerAPI,
  IAgentStep,
  IAgentResult,
  IAiClient,
  IMouseClickOptions,
  IScrollOptions,
} from '@ai-super-app/sdk'
import { logger } from '@ai-super-app/shared'

const log = logger.child('ComputerAgent')

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_MAX_STEPS = 20
const DEFAULT_STEP_DELAY_MS = 600
const DEFAULT_AI_CAPABILITY = 'computer-agent'

/**
 * System prompt template sent to the AI on every step.
 * The AI must respond with a single valid JSON `IComputerAction` object.
 */
function buildStepPrompt(
  goal: string,
  screenshotDataUri: string,
  history: IAgentStep[],
): string {
  const historyText =
    history.length === 0
      ? 'No actions taken yet.'
      : history
          .map((s, i) => `Step ${String(i + 1)}: ${JSON.stringify(s.action)}`)
          .join('\n')

  return `You are a computer-use AI agent. Your goal is:
"${goal}"

Current screen screenshot (base64 PNG data URI):
${screenshotDataUri}

Actions taken so far:
${historyText}

Decide the single best next action to make progress toward the goal.
Respond with ONLY a JSON object matching one of these types (no markdown, no explanation):

{ "type": "mouse_move",        "x": <number>, "y": <number> }
{ "type": "mouse_click",       "x": <number>, "y": <number>, "button": "left"|"right"|"middle" }
{ "type": "mouse_double_click","x": <number>, "y": <number> }
{ "type": "mouse_scroll",      "x": <number>, "y": <number>, "deltaX": <number>, "deltaY": <number> }
{ "type": "mouse_drag",        "startX": <number>, "startY": <number>, "endX": <number>, "endY": <number> }
{ "type": "key_type",          "text": "<string>" }
{ "type": "key_press",         "key": "<string>" }
{ "type": "hotkey",            "keys": ["<string>", ...] }
{ "type": "clipboard_set",     "text": "<string>" }
{ "type": "launch_app",        "appName": "<string>" }
{ "type": "run_shell",         "command": "<string>" }
{ "type": "screenshot" }
{ "type": "wait",              "ms": <number> }
{ "type": "done",              "result": "<summary of what was accomplished>" }

If the goal is already complete, respond with { "type": "done", "result": "..." }.`
}

// ── Action parser ──────────────────────────────────────────────────────────────

function parseAction(raw: string): IComputerAction {
  // Strip potential markdown code fences
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    if (typeof parsed.type !== 'string') {
      return { type: 'done', result: 'AI returned unrecognised action (no type)' }
    }
    return parsed as unknown as IComputerAction
  } catch {
    log.warn('Could not parse AI action — treating as done', { raw })
    return { type: 'done', result: `Parse error — raw: ${raw.slice(0, 120)}` }
  }
}

// ── Action executor ────────────────────────────────────────────────────────────

async function executeAction(
  action: IComputerAction,
  computer: IComputerAPI,
): Promise<void> {
  switch (action.type) {
    case 'mouse_move':
      return computer.mouseMove(action.x, action.y)

    case 'mouse_click': {
      const opts: IMouseClickOptions = {}
      if (action.x !== undefined) opts.x = action.x
      if (action.y !== undefined) opts.y = action.y
      if (action.button !== undefined) opts.button = action.button
      return computer.mouseClick(opts)
    }

    case 'mouse_double_click': {
      const opts: { x?: number; y?: number } = {}
      if (action.x !== undefined) opts.x = action.x
      if (action.y !== undefined) opts.y = action.y
      return computer.mouseDoubleClick(opts)
    }

    case 'mouse_scroll': {
      const opts: IScrollOptions = {}
      if (action.x !== undefined) opts.x = action.x
      if (action.y !== undefined) opts.y = action.y
      if (action.deltaX !== undefined) opts.deltaX = action.deltaX
      if (action.deltaY !== undefined) opts.deltaY = action.deltaY
      return computer.mouseScroll(opts)
    }

    case 'mouse_drag':
      return computer.mouseDrag(action.startX, action.startY, action.endX, action.endY)

    case 'key_type':
      return computer.keyType(action.text)

    case 'key_press':
      return computer.keyPress(action.key)

    case 'hotkey':
      return computer.hotkey(action.keys)

    case 'clipboard_set':
      return computer.clipboardSet(action.text)

    case 'launch_app':
      return computer.launchApp(action.appName)

    case 'run_shell': {
      const result = await computer.runShell(action.command)
      if (result.exitCode !== 0) {
        log.warn('Shell command non-zero exit', { command: action.command, exitCode: result.exitCode })
      }
      return
    }

    case 'screenshot':
      // Just take a screenshot — the result feeds into the next step automatically.
      await computer.screenshot()
      return

    case 'wait':
      await sleep(Math.min(action.ms, 10_000)) // cap at 10 s for safety
      return

    case 'done':
      return // handled by caller
  }
}

// ── ComputerAgent ──────────────────────────────────────────────────────────────

/**
 * ComputerAgent — agentic loop that drives the host OS to accomplish a goal.
 *
 * Create via `ctx.computer.createAgent(goal)` inside a module.
 * The agent requires `computer.screenshot`, `computer.input`, and any other
 * `computer.*` permissions needed for the actions it plans to take.
 */
export class ComputerAgent implements IComputerAgentRunner {
  private cancelled = false

  constructor(
    private readonly goal: string,
    private readonly ai: IAiClient,
    private readonly computer: IComputerAPI,
    private readonly options: IComputerAgentOptions = {},
  ) {}

  /** Cancel the agent after the current step completes. */
  cancel(): void {
    this.cancelled = true
    log.info('ComputerAgent cancelled', { goal: this.goal })
  }

  /**
   * Run the agent loop until done or max steps reached.
   *
   * @param onStep - Optional callback invoked after each action, useful for
   *                 progress reporting or UI updates.
   */
  async run(onStep?: (step: IAgentStep) => void): Promise<IAgentResult> {
    const maxSteps = this.options.maxSteps ?? DEFAULT_MAX_STEPS
    const stepDelayMs = this.options.stepDelayMs ?? DEFAULT_STEP_DELAY_MS
    const capability = this.options.aiCapability ?? DEFAULT_AI_CAPABILITY

    const history: IAgentStep[] = []
    this.cancelled = false

    log.info('ComputerAgent started', { goal: this.goal, maxSteps })

    for (let i = 0; i < maxSteps; i++) {
      // cancelled can be set to true by cancel() between iterations
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.cancelled) {
        log.info('ComputerAgent stopped by cancel()', { steps: i })
        return { success: false, steps: history, result: 'cancelled' }
      }

      // 1. Screenshot the current state
      let screenshotDataUri: string
      try {
        const shot = await this.computer.screenshot()
        screenshotDataUri = shot.dataUri
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        log.error('Screenshot failed', { step: i, error: msg })
        return { success: false, steps: history, result: `screenshot failed: ${msg}` }
      }

      // 2. Ask the AI what to do next
      let rawDecision: string
      try {
        const resp = await this.ai.generate({
          capability,
          input: buildStepPrompt(this.goal, screenshotDataUri, history),
        })
        rawDecision = resp.output
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        log.error('AI decision failed', { step: i, error: msg })
        return { success: false, steps: history, result: `AI error: ${msg}` }
      }

      // 3. Parse the action
      const action = parseAction(rawDecision)
      const step: IAgentStep = {
        index: i,
        screenshotDataUri,
        action,
        timestamp: Date.now(),
      }
      history.push(step)
      onStep?.(step)

      log.debug('Agent step', { step: i, action })

      // 4. Done?
      if (action.type === 'done') {
        log.info('ComputerAgent done', { steps: i + 1, result: action.result })
        return { success: true, steps: history, result: action.result ?? 'done' }
      }

      // 5. Execute
      try {
        await executeAction(action, this.computer)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        log.warn('Action execution failed — continuing', { step: i, action, error: msg })
        // Non-fatal: let the AI adapt on the next step.
      }

      // 6. Delay before next step
      await sleep(stepDelayMs)
    }

    log.warn('ComputerAgent reached max steps', { goal: this.goal, maxSteps })
    return {
      success: false,
      steps: history,
      result: `max steps (${String(maxSteps)}) reached without completing the goal`,
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
