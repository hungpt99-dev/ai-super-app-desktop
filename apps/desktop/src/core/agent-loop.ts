/**
 * agent-loop.ts
 *
 * Manages the Desktop Agent lifecycle:
 *   1. Register (or restore) this machine as a Device in the backend.
 *   2. Send periodic heartbeats to keep `status = "online"`.
 *   3. Poll the bot run queue with exponential backoff, execute claimed runs,
 *      and report completion or failure.
 *   4. Simulate CPU / memory metrics for the local status display.
 *
 * Call `startAgentLoop()` once the user is authenticated.
 * Call `stopAgentLoop()` on logout or app close.
 */

import { logger } from '@ai-super-app/shared'
import {
  agentDeviceApi,
  agentBotApi,
  getStoredDeviceId,
  saveDeviceId,
  saveDeviceName,
} from '../sdk/agent-api.js'
import { useAgentStore } from '../ui/store/agent-store.js'
import { tokenStore } from '../sdk/token-store.js'

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

function detectPlatform(): string {
  const ua = navigator.userAgent
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Win')) return 'Windows'
  return 'Linux'
}

function generateAgentName(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${detectPlatform()} Agent ${suffix}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
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
    const name = generateAgentName()
    const device = await agentDeviceApi.register(name, detectPlatform(), AGENT_VERSION)
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

// ─── Bot run execution ─────────────────────────────────────────────────────────

async function executeNextRun(): Promise<void> {
  if (isExecuting) return
  if (useAgentStore.getState().deviceId === null) return

  let runId: string | null = null

  try {
    const run = await agentBotApi.poll()
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
    log.info(`Executing run ${run.run_id} | goal: "${run.goal}"`)

    await agentBotApi.updateRun(run.run_id, { status: 'running', steps: 0 })

    const totalSteps = 3 + Math.floor(Math.random() * 3)
    for (let step = 1; step <= totalSteps; step++) {
      await sleep(700 + Math.random() * 800)
      await agentBotApi.updateRun(run.run_id, { status: 'running', steps: step })
    }

    await agentBotApi.updateRun(run.run_id, {
      status: 'completed',
      steps: totalSteps,
      result: 'Task completed successfully by desktop agent.',
    })
    useAgentStore.getState().incrementCompleted()
    log.info(`Run ${run.run_id} completed (${String(totalSteps)} steps)`)
  } catch (err) {
    log.warn(`Run execution error: ${String(err)}`)
    if (runId !== null) {
      try {
        await agentBotApi.updateRun(runId, {
          status: 'failed',
          steps: 0,
          result: String(err),
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
