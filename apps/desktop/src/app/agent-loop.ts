/**
 * agent-loop.ts
 *
 * Manages the Desktop Agent lifecycle:
 *   1. Register (or restore) this machine as a Device in the backend.
 *   2. Send periodic heartbeats to keep `status = "online"`.
 *   3. Poll the agent run queue with exponential backoff, execute claimed runs,
 *      and report completion or failure.
 *   4. Simulate CPU / memory metrics for the local status display.
 *
 * Call `startAgentLoop()` once the user is authenticated.
 * Call `stopAgentLoop()` on logout or app close.
 */

import { logger } from '@agenthub/shared'
import {
  agentDeviceApi,
  getStoredDeviceId,
  saveDeviceId,
  saveDeviceName,
} from '../bridges/agent-api.js'
import { useAgentStore } from '../ui/store/agent-store.js'
import { tokenStore } from '../bridges/token-store.js'
import { getDesktopBridge } from '../ui/lib/bridge.js'
import { IS_TAURI } from '../bridges/runtime.js'

const log = logger.child('AgentLoop')

// ─── Configuration ─────────────────────────────────────────────────────────────

const AGENT_VERSION = '1.0.0'
const HEARTBEAT_INTERVAL_MS = 30_000
const METRICS_INTERVAL_MS = 10_000

/** Polling backoff: starts at BASE, doubles per empty poll, caps at MAX. */
const POLL_BASE_MS = 5_000
const POLL_MAX_MS = 60_000

// ─── Module-level state ────────────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setTimeout> | null = null
let metricsTimer: ReturnType<typeof setInterval> | null = null
let uptimeStart: number | null = null
let isExecuting = false
/** Consecutive empty polls — drives exponential backoff. */
let emptyPollStreak = 0

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect the host OS.
 * Uses `@tauri-apps/plugin-os` when running inside Tauri for accuracy.
 * Falls back to User-Agent string parsing in browser dev mode.
 */
async function detectPlatform(): Promise<string> {
  if (IS_TAURI) {
    try {
      const { type: osType } = await import('@tauri-apps/plugin-os')
      const t = await osType()
      if (t === 'macos') return 'macOS'
      if (t === 'windows') return 'Windows'
      if (t === 'linux') return 'Linux'
      return t
    } catch {
      // Plugin unavailable — fall through to UA heuristic
    }
  }
  const ua = navigator.userAgent
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Win')) return 'Windows'
  return 'Linux'
}

async function generateAgentName(): Promise<string> {
  const platform = await detectPlatform()
  const arr = new Uint8Array(2)
  crypto.getRandomValues(arr)
  const suffix = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `${platform} Agent ${suffix}`
}

/** Calculates the next poll delay using exponential backoff with full-jitter. */
function nextPollDelay(): number {
  const cap = Math.min(POLL_BASE_MS * Math.pow(2, emptyPollStreak), POLL_MAX_MS)
  // Full-jitter: random in [0, cap] to avoid thundering-herd across agents.
  return Math.floor(Math.random() * cap) + POLL_BASE_MS
}

// ─── Device registration ───────────────────────────────────────────────────────

async function ensureDevice(): Promise<string | null> {
  const existingId = getStoredDeviceId()
  if (existingId !== null) {
    useAgentStore.getState().setDevice(existingId, 'Desktop Agent')
    return existingId
  }
  try {
    const [name, platform] = await Promise.all([generateAgentName(), detectPlatform()])
    const device = await agentDeviceApi.register(name, platform, AGENT_VERSION)
    saveDeviceId(device.id)
    saveDeviceName(device.name)
    useAgentStore.getState().setDevice(device.id, device.name)
    log.info(`Registered as device: ${device.id} ("${device.name}")`)
    return device.id
  } catch (err) {
    log.warn(`Device registration failed: ${String(err)}`)
    return null
  }
}

// ─── Heartbeat + metrics push ──────────────────────────────────────────────────

async function sendHeartbeat(deviceId: string): Promise<void> {
  try {
    await agentDeviceApi.heartbeat(deviceId)
  } catch (err) {
    // Heartbeat failures are non-fatal — the agent continues working.
    log.warn(`Heartbeat failed: ${String(err)}`)
  }

  // Piggyback a metrics report on each heartbeat cycle so the web dashboard
  // always has fresh data without an extra interval.
  const { metrics } = useAgentStore.getState()
  await agentDeviceApi.reportMetrics(deviceId, {
    cpu_percent: metrics.cpuPercent,
    mem_percent: metrics.memPercent,
    uptime_seconds: metrics.uptimeSeconds,
    tasks_done: metrics.tasksCompleted,
  })
}

// ─── Agent run execution ───────────────────────────────────────────────────────────────────

async function executeNextRun(): Promise<void> {
  if (isExecuting) return
  if (useAgentStore.getState().deviceId === null) return

  const bridge = getDesktopBridge()
  let runId: string | null = null

  try {
    const run = await bridge.agents.poll()
    if (!run) {
      // Empty queue — increase backoff.
      emptyPollStreak = Math.min(emptyPollStreak + 1, 6) // cap at 2^6 = 64× base
      return
    }

    // Got a run — reset backoff to base interval.
    emptyPollStreak = 0
    runId = run.run_id
    isExecuting = true
    useAgentStore.getState().setActiveRun(run.run_id, run.goal)
    useAgentStore.getState().setStatus('running')
    log.info(`Executing run ${run.run_id} | agent_type: ${run.agent_type} | goal: "${run.goal}"`)

    await bridge.agents.updateRun(run.run_id, { status: 'running', steps: 0 })

    // Dispatch to the appropriate module tool.
    // The module is responsible for the shape of its own result object.
    let steps = 0
    let output: Record<string, unknown> = {}
    try {
      const raw = await bridge.modules.invokeTool(run.agent_type, 'run', {
        goal: run.goal,
        runId: run.run_id,
      })
      // Coerce unknown module output to a plain object.
      if (raw !== null && typeof raw === 'object') {
        output = raw as Record<string, unknown>
      } else {
        output = { output: String(raw) }
      }
      steps = (typeof output.steps === 'number' ? output.steps : steps) + 1
    } catch (toolErr) {
      // Tool failure is captured as a structured error in the result.
      output = { error: String(toolErr) }
      await bridge.agents.updateRun(run.run_id, {
        status: 'failed',
        steps,
        result: output,
      })
      useAgentStore.getState().incrementCompleted()
      log.warn(`Run ${run.run_id} tool failed: ${String(toolErr)}`)
      return
    }

    await bridge.agents.updateRun(run.run_id, {
      status: 'completed',
      steps,
      result: output,
    })
    useAgentStore.getState().incrementCompleted()
    log.info(`Run ${run.run_id} completed (${String(steps)} steps)`)
  } catch (err) {
    log.warn(`Run execution error: ${String(err)}`)
    if (runId !== null) {
      try {
        await bridge.agents.updateRun(runId, {
          status: 'failed',
          steps: 0,
          result: { error: String(err) },
        })
      } catch { /* reporting failure is best-effort */ }
    }
  } finally {
    isExecuting = false
    useAgentStore.getState().setActiveRun(null)
    useAgentStore.getState().setStatus('idle')
    schedulePoll()
  }
}

// ─── Adaptive poll scheduler ───────────────────────────────────────────────────

/**
 * Schedule the next poll using the current backoff delay.
 * Using `setTimeout` (not `setInterval`) so the delay adapts after each tick.
 */
function schedulePoll(): void {
  if (pollTimer !== null) { clearTimeout(pollTimer); pollTimer = null }
  const delay = nextPollDelay()
  pollTimer = setTimeout(() => {
    pollTimer = null
    void executeNextRun()
  }, delay)
}

// ─── Metrics simulation ────────────────────────────────────────────────────────

function tickMetrics(): void {
  const uptime = uptimeStart !== null ? Math.floor((Date.now() - uptimeStart) / 1000) : 0
  useAgentStore.getState().updateMetrics({
    cpuPercent: 5 + Math.floor(Math.random() * 25),
    memPercent: 40 + Math.floor(Math.random() * 20),
    uptimeSeconds: uptime,
  })
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the Desktop Agent loop.
 * Idempotent — safe to call even if already running.
 * Requires the user to be authenticated (tokenStore must have a token).
 */
export async function startAgentLoop(): Promise<void> {
  if (heartbeatTimer !== null) return
  if (!tokenStore.getToken()) {
    log.warn('Not starting agent loop: no auth token')
    return
  }

  uptimeStart = Date.now()
  emptyPollStreak = 0

  const deviceId = await ensureDevice()
  if (deviceId === null) return

  useAgentStore.getState().setStatus('idle')

  await sendHeartbeat(deviceId)
  heartbeatTimer = setInterval(() => { void sendHeartbeat(deviceId) }, HEARTBEAT_INTERVAL_MS)

  // Kick off the first poll immediately, then let schedulePoll handle cadence.
  void executeNextRun()

  tickMetrics()
  metricsTimer = setInterval(tickMetrics, METRICS_INTERVAL_MS)

  log.info('Agent loop started')
}

/**
 * Stop the Desktop Agent loop (e.g. on logout or app close).
 * Safe to call when already stopped.
 */
export function stopAgentLoop(): void {
  if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  if (pollTimer !== null) { clearTimeout(pollTimer); pollTimer = null }
  if (metricsTimer !== null) { clearInterval(metricsTimer); metricsTimer = null }
  isExecuting = false
  emptyPollStreak = 0
  uptimeStart = null
  useAgentStore.getState().setStatus('offline')
  log.info('Agent loop stopped')
}
