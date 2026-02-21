import { create } from 'zustand'
import { Permission } from '@ai-super-app/sdk'
import { logger } from '@ai-super-app/shared'

const log = logger.child('PermissionStore')

// ── High-risk permissions that require explicit user approval ────────────────

/** Permissions that always trigger a user-facing confirmation dialog. */
export const HIGH_RISK_PERMISSIONS = new Set<Permission>([
  Permission.ComputerShell,
  Permission.ComputerFiles,
])

// ── Human-readable permission metadata ──────────────────────────────────────

export interface IPermissionMeta {
  readonly label: string
  readonly description: string
  readonly risk: 'standard' | 'high'
}

export const PERMISSION_META: Record<Permission, IPermissionMeta> = {
  [Permission.AiGenerate]:         { label: 'AI Generation',      description: 'Generate text using your AI model',                       risk: 'standard' },
  [Permission.AiStream]:           { label: 'AI Streaming',        description: 'Stream AI responses in real time',                        risk: 'standard' },
  [Permission.StorageLocal]:       { label: 'Local Storage',       description: 'Store data locally on your device',                       risk: 'standard' },
  [Permission.StorageRead]:        { label: 'Storage Read',        description: 'Read data stored by this module',                         risk: 'standard' },
  [Permission.StorageWrite]:       { label: 'Storage Write',       description: 'Write and delete data stored by this module',             risk: 'standard' },
  [Permission.UiNotify]:           { label: 'Notifications',       description: 'Show desktop notifications',                              risk: 'standard' },
  [Permission.UiDashboard]:        { label: 'Dashboard UI',        description: 'Access and display the in-app dashboard',                 risk: 'standard' },
  [Permission.EventsPublish]:      { label: 'Event Publishing',    description: 'Publish events to other modules',                         risk: 'standard' },
  [Permission.EventsSubscribe]:    { label: 'Event Subscription',  description: 'Listen to events from other modules',                     risk: 'standard' },
  [Permission.ComputerScreenshot]: { label: 'Screen Capture',      description: 'Take screenshots of your screen',                         risk: 'standard' },
  [Permission.ComputerInput]:      { label: 'Mouse & Keyboard',    description: 'Control your mouse and keyboard input',                   risk: 'standard' },
  [Permission.ComputerClipboard]:  { label: 'Clipboard',           description: 'Read and write your system clipboard',                    risk: 'standard' },
  [Permission.ComputerShell]:      { label: 'Shell Commands',      description: 'Run arbitrary shell commands on your machine',            risk: 'high'     },
  [Permission.ComputerFiles]:      { label: 'File System Access',  description: 'Read and write files anywhere on your machine',          risk: 'high'     },
  [Permission.MemoryRead]:         { label: 'Memory Read',         description: 'Read your local AI memory store',                        risk: 'standard' },
  [Permission.MemoryWrite]:        { label: 'Memory Write',        description: 'Write to and delete from your local AI memory store',    risk: 'standard' },
}

// ── localStorage persistence ─────────────────────────────────────────────────

const STORAGE_KEY = 'ai-superapp-permission-grants'

function loadStoredGrants(): Record<string, Permission[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Permission[]>) : {}
  } catch {
    return {}
  }
}

function saveStoredGrants(grants: Record<string, Permission[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grants))
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}

const BLOCKED_KEY = 'ai-superapp-blocked-permissions'

function loadBlockedPermissions(): Set<Permission> {
  try {
    const raw = localStorage.getItem(BLOCKED_KEY)
    return raw ? new Set(JSON.parse(raw) as Permission[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveBlockedPermissions(blocked: Set<Permission>): void {
  try {
    localStorage.setItem(BLOCKED_KEY, JSON.stringify([...blocked]))
  } catch {
    // Ignore storage errors
  }
}

// ── Pending request type ─────────────────────────────────────────────────────

export interface IPendingPermissionRequest {
  readonly id: string
  readonly moduleId: string
  readonly moduleName: string
  readonly permissions: Permission[]
  resolve(granted: boolean): void
}

// ── Store ────────────────────────────────────────────────────────────────────

interface IPermissionStore {
  /** Currently pending permission request shown to the user. At most one at a time. */
  pending: IPendingPermissionRequest | null

  /** User-approved grants persisted to localStorage, keyed by moduleId. */
  storedGrants: Record<string, Permission[]>

  /**
   * Request permissions for a module before activation.
   *
   * - Auto-approves silently when no HIGH RISK permissions are requested.
   * - Auto-approves when the user has already approved the same (or broader) set.
   * - Shows the confirmation dialog for any HIGH RISK permissions not yet approved.
   *
   * Returns `true` if all permissions are approved, `false` if the user denies.
   */
  requestPermissions: (
    moduleId: string,
    moduleName: string,
    permissions: Permission[],
  ) => Promise<boolean>

  /** Approve the current pending dialog request. */
  approve: () => void

  /** Deny the current pending dialog request. */
  deny: () => void

  /**
   * Clear the stored permission approval for a module.
   * The module keeps its current in-memory grants until the app restarts,
   * at which point the user will be prompted again.
   */
  revokeStored: (moduleId: string) => void

  /** Globally blocked permissions — any module requesting these is auto-denied. */
  blockedPermissions: ReadonlySet<Permission>

  /**
   * Toggle a global permission block on/off.
   * When a permission is blocked no module can ever be granted it.
   */
  toggleBlock: (permission: Permission) => void

  /** Remove a single permission from a module's stored grants. */
  revokePermission: (moduleId: string, permission: Permission) => void

  /** Revoke all stored permission grants across all modules. */
  revokeAll: () => void
}

let requestCounter = 0

export const usePermissionStore = create<IPermissionStore>((set, get) => ({
  pending: null,
  storedGrants: loadStoredGrants(),
  blockedPermissions: loadBlockedPermissions(),

  requestPermissions: async (moduleId, moduleName, permissions) => {
    const hasHighRisk = permissions.some((p) => HIGH_RISK_PERMISSIONS.has(p))

    // Auto-deny if any requested permission is globally blocked.
    if (permissions.some((p) => get().blockedPermissions.has(p))) {
      log.warn('Permission request auto-denied — contains globally blocked permission', { moduleId })
      return false
    }

    if (!hasHighRisk) {
      // Auto-approve non-high-risk modules silently.
      set((s) => {
        const updated = { ...s.storedGrants, [moduleId]: permissions }
        saveStoredGrants(updated)
        return { storedGrants: updated }
      })
      log.debug('Auto-approved non-high-risk permissions', { moduleId })
      return true
    }

    // Check if the user already approved this exact set (or a superset).
    const stored = get().storedGrants[moduleId]
    if (stored) {
      const allApproved = permissions.every((p) => stored.includes(p))
      if (allApproved) {
        log.debug('Permissions already approved — skipping dialog', { moduleId })
        return true
      }
    }

    // Show the dialog and wait for user decision.
    return new Promise<boolean>((resolve) => {
      requestCounter += 1
      const id = `perm-req-${String(requestCounter)}`
      set({
        pending: { id, moduleId, moduleName, permissions, resolve },
      })
      log.info('Permission dialog shown', { moduleId, id })
    })
  },

  approve: () => {
    const { pending } = get()
    if (!pending) return

    set((s) => {
      const updated = { ...s.storedGrants, [pending.moduleId]: pending.permissions }
      saveStoredGrants(updated)
      return { storedGrants: updated, pending: null }
    })

    pending.resolve(true)
    log.info('Permissions approved by user', { moduleId: pending.moduleId })
  },

  deny: () => {
    const { pending } = get()
    if (!pending) return

    set({ pending: null })
    pending.resolve(false)
    log.warn('Permissions denied by user', { moduleId: pending.moduleId })
  },

  revokeStored: (moduleId) => {
    set((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [moduleId]: _removed, ...rest } = s.storedGrants
      saveStoredGrants(rest)
      return { storedGrants: rest }
    })
    log.info('Stored permissions cleared — will prompt on next activation', { moduleId })
  },

  toggleBlock: (permission) => {
    set((s) => {
      const updated = new Set(s.blockedPermissions)
      if (updated.has(permission)) {
        updated.delete(permission)
      } else {
        updated.add(permission)
      }
      saveBlockedPermissions(updated)
      return { blockedPermissions: updated }
    })
    log.info('Permission global block toggled', { permission })
  },

  revokePermission: (moduleId, permission) => {
    set((s) => {
      const current = s.storedGrants[moduleId]
      if (!current) return s
      const remaining = current.filter((p) => p !== permission)
      if (remaining.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [moduleId]: _removed, ...rest } = s.storedGrants
        saveStoredGrants(rest)
        return { storedGrants: rest }
      }
      const updated = { ...s.storedGrants, [moduleId]: remaining }
      saveStoredGrants(updated)
      return { storedGrants: updated }
    })
    log.info('Single permission revoked from module', { moduleId, permission })
  },

  revokeAll: () => {
    saveStoredGrants({})
    set({ storedGrants: {} })
    log.info('All stored permission grants revoked')
  },
}))
