import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge.js'
import { getDefaultKeyId, listAPIKeys } from '../../bridges/api-key-store.js'
import { useAppStore } from './app-store.js'
import { addLog } from './log-store.js'

function notifyError(title: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  useAppStore.getState().pushNotification({ level: 'error', title, body: msg })
}

/** Resolve the app-level default BYOK key, if one has been configured. */
async function resolveDefaultApiOptions(): Promise<{ apiKey?: string; provider?: string; model?: string }> {
  try {
    const defaultId: string | null = await getDefaultKeyId()
    addLog({
      level: 'info',
      source: 'chat',
      message: `resolveDefaultApiOptions: defaultId=${defaultId}`,
      detail: '',
    })
    if (!defaultId) return {}
    const keys = await listAPIKeys()
    addLog({
      level: 'info',
      source: 'chat',
      message: `resolveDefaultApiOptions: keys count=${keys.length}`,
      detail: '',
    })
    const entry = keys.find((k) => k.id === defaultId && k.isActive)
    if (!entry) return {}
    const options: { apiKey?: string; provider?: string; model?: string } = { apiKey: entry.rawKey, provider: entry.provider }
    if (entry.model) options.model = entry.model
    return options
  } catch (err) {
    addLog({
      level: 'error',
      source: 'chat',
      message: `resolveDefaultApiOptions error: ${String(err)}`,
      detail: err instanceof Error ? err.stack : '',
    })
    return {}
  }
}

export interface IChatMessage {
  id: string
  workspaceId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  /** True while the assistant response is still streaming in */
  isStreaming?: boolean
}

/** Per-workspace chat state */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface IWorkspaceChatState {
  messages: IChatMessage[]
  isLoading: boolean
  error: string | null
}

interface IChatState {
  /** Messages keyed by workspace/tab ID - THIS IS THE CRITICAL FIX for workspace isolation */
  messagesByWorkspace: Record<string, IChatMessage[]>
  /** Loading state per workspace */
  loadingByWorkspace: Record<string, boolean>
  /** Error state per workspace */
  errorByWorkspace: Record<string, string | null>
  /** Send a message to a specific workspace */
  send: (text: string, workspaceId: string) => Promise<void>
  /** Clear messages for a specific workspace */
  clear: (workspaceId: string) => void
  /** Set error for a specific workspace */
  setError: (error: string | null, workspaceId: string) => void
  /** Get messages for a specific workspace (selector helper) */
  getWorkspaceMessages: (workspaceId: string) => IChatMessage[]
}

let counter = 0
const nextId = () => `msg-${String(++counter)}-${String(Date.now())}`

/**
 * useChatStore — Zustand store for chat state.
 * 
 * CRITICAL FIX: Now maintains per-workspace message isolation.
 * State is keyed by workspaceId to prevent cross-workspace contamination.
 * 
 * Structure:
 * {
 *   messagesByWorkspace: {
 *     'workspace-1': [message1, message2],
 *     'workspace-2': [message3, message4]
 *   },
 *   loadingByWorkspace: { 'workspace-1': false, ... },
 *   errorByWorkspace: { 'workspace-1': null, ... }
 * }
 */
export const useChatStore = create<IChatState>((set, get) => ({
  messagesByWorkspace: {},
  loadingByWorkspace: {},
  errorByWorkspace: {},

  send: async (text: string, workspaceId: string) => {
    if (!text.trim() || get().loadingByWorkspace[workspaceId]) return

    const userMsg: IChatMessage = {
      id: nextId(),
      workspaceId,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    const assistantId = nextId()

    // Initialize workspace state if not exists
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _currentMessages = get().messagesByWorkspace[workspaceId] ?? []
    
    set((s) => ({
      messagesByWorkspace: {
        ...s.messagesByWorkspace,
        [workspaceId]: [...(s.messagesByWorkspace[workspaceId] ?? []), userMsg, { 
          id: assistantId, 
          workspaceId,
          role: 'assistant', 
          content: '', 
          timestamp: new Date(), 
          isStreaming: true 
        }]
      },
      loadingByWorkspace: {
        ...s.loadingByWorkspace,
        [workspaceId]: true
      },
      errorByWorkspace: {
        ...s.errorByWorkspace,
        [workspaceId]: null
      }
    }))

    let accumulated = ''

    try {
      // DIAGNOSTIC: Log environment details for debugging
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
      addLog({
        level: 'info',
        source: 'chat',
        message: `Environment check: isTauri=${String(isTauri)}`,
        detail: '',
      })

      const bridge = getDesktopBridge()

      const aiOptions = await resolveDefaultApiOptions()
      
      // DIAGNOSTIC: Log API configuration
      addLog({
        level: 'info',
        source: 'chat',
        message: `API config: hasKey=${aiOptions.apiKey ? 'yes' : 'no'}, provider=${aiOptions.provider || 'none'}`,
        detail: '',
      })

      addLog({
        level: 'info',
        source: 'chat',
        message: `Sending message${aiOptions.provider ? ` via ${aiOptions.provider}${aiOptions.model ? `/${aiOptions.model}` : ''}` : ''}`,
        detail: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      })

      const unsubscribe = bridge.chat.onStream((chunk) => {
        accumulated += chunk
        set((s) => ({
          messagesByWorkspace: {
            ...s.messagesByWorkspace,
            [workspaceId]: (s.messagesByWorkspace[workspaceId] ?? []).map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          }
        }))
      })

      const response = await bridge.chat.send(text, aiOptions)
      unsubscribe()

      const finalContent = accumulated || response.output

      addLog({
        level: 'info',
        source: 'ai',
        message: `Response received (${String(finalContent.length)} chars)`,
        detail: finalContent.length > 300 ? `${finalContent.slice(0, 300)}…` : finalContent,
      })

      set((s) => ({
        messagesByWorkspace: {
          ...s.messagesByWorkspace,
          [workspaceId]: (s.messagesByWorkspace[workspaceId] ?? []).map((m) =>
            m.id === assistantId ? { ...m, content: finalContent, isStreaming: false } : m
          )
        },
        loadingByWorkspace: {
          ...s.loadingByWorkspace,
          [workspaceId]: false
        }
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      // Enhanced error logging for debugging
      const errorDetail = err instanceof Error ? `message=${err.message}, stack=${err.stack || 'no stack'}` : String(err)
      addLog({ level: 'error', source: 'chat', message: 'Chat request failed', detail: errorDetail })
      notifyError('Chat request failed', err)
      set((s) => ({
        messagesByWorkspace: {
          ...s.messagesByWorkspace,
          [workspaceId]: (s.messagesByWorkspace[workspaceId] ?? []).filter((m) => m.id !== assistantId)
        },
        loadingByWorkspace: {
          ...s.loadingByWorkspace,
          [workspaceId]: false
        },
        errorByWorkspace: {
          ...s.errorByWorkspace,
          [workspaceId]: msg
        }
      }))
    }
  },

  clear: (workspaceId: string) => { 
    set((s) => ({
      messagesByWorkspace: {
        ...s.messagesByWorkspace,
        [workspaceId]: []
      },
      errorByWorkspace: {
        ...s.errorByWorkspace,
        [workspaceId]: null
      }
    }))
  },

  setError: (error: string | null, workspaceId: string) => { 
    set((s) => ({
      errorByWorkspace: {
        ...s.errorByWorkspace,
        [workspaceId]: error
      }
    }))
  },

  getWorkspaceMessages: (workspaceId: string) => {
    return get().messagesByWorkspace[workspaceId] ?? []
  }
}))

// Legacy export - do not use directly, use useChat() hook instead
// Kept for backward compatibility with any code that might import it directly
export const useChat = useChatStore
