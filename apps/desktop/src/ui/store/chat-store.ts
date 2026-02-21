import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge.js'
import { getDefaultKeyId, listAPIKeys } from '../../sdk/api-key-store.js'
import { useAppStore } from './app-store.js'
import { addLog } from './log-store.js'

function notifyError(title: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  useAppStore.getState().pushNotification({ level: 'error', title, body: msg })
}

/** Resolve the app-level default BYOK key, if one has been configured. */
async function resolveDefaultApiOptions(): Promise<{ apiKey?: string; provider?: string; model?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const defaultId: string | null = await getDefaultKeyId()
    if (!defaultId) return {}
    const keys = await listAPIKeys()
    const entry = keys.find((k) => k.id === defaultId && k.isActive)
    if (!entry) return {}
    const options: { apiKey?: string; provider?: string; model?: string } = { apiKey: entry.rawKey, provider: entry.provider }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    if (entry.model) options.model = entry.model
    return options
  } catch {
    return {}
  }
}

export interface IChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  /** True while the assistant response is still streaming in */
  isStreaming?: boolean
}

interface IChatState {
  messages: IChatMessage[]
  isLoading: boolean
  error: string | null
  send: (text: string) => Promise<void>
  clear: () => void
  setError: (e: string | null) => void
}

let counter = 0
const nextId = () => `msg-${String(++counter)}-${String(Date.now())}`

/**
 * useChatStore — Zustand store for chat state.
 *
 * Wires streaming: registers bridge.chat.onStream before calling send,
 * accumulates chunks into the assistant placeholder message, and marks
 * isStreaming = false when the response completes.
 */
export const useChatStore = create<IChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  send: async (text: string) => {
    if (!text.trim() || get().isLoading) return

    const userMsg: IChatMessage = {
      id: nextId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    const assistantId = nextId()

    // Add user message + empty assistant placeholder in one update to avoid flicker
    set((s) => ({
      messages: [
        ...s.messages,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
      ],
      isLoading: true,
      error: null,
    }))

    let accumulated = ''

    try {
      const bridge = getDesktopBridge()

      const aiOptions = await resolveDefaultApiOptions()

      addLog({
        level: 'info',
        source: 'chat',
        message: `Sending message${aiOptions.provider ? ` via ${aiOptions.provider}${aiOptions.model ? `/${aiOptions.model}` : ''}` : ''}`,
        detail: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      })

      // Register streaming handler BEFORE calling send
      const unsubscribe = bridge.chat.onStream((chunk) => {
        accumulated += chunk
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m,
          ),
        }))
      })

      const response = await bridge.chat.send(text, aiOptions)
      unsubscribe()

      // Use streamed content if available, fall back to response payload
      const finalContent = accumulated || response.output

      addLog({
        level: 'info',
        source: 'ai',
        message: `Response received (${String(finalContent.length)} chars)`,
        detail: finalContent.length > 300 ? `${finalContent.slice(0, 300)}…` : finalContent,
      })

      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: finalContent, isStreaming: false } : m,
        ),
        isLoading: false,
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      addLog({ level: 'error', source: 'chat', message: 'Chat request failed', detail: msg })
      notifyError('Chat request failed', err)
      // Remove the empty placeholder and surface the error
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== assistantId),
        isLoading: false,
        error: msg,
      }))
    }
  },

  clear: () => { set({ messages: [], error: null }) },

  setError: (error) => { set({ error }) },
}))
