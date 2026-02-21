import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge.js'

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

      // Register streaming handler BEFORE calling send
      const unsubscribe = bridge.chat.onStream((chunk) => {
        accumulated += chunk
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m,
          ),
        }))
      })

      const response = await bridge.chat.send(text)
      unsubscribe()

      // Use streamed content if available, fall back to response payload
      const finalContent = accumulated || response.output

      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: finalContent, isStreaming: false } : m,
        ),
        isLoading: false,
      }))
    } catch (err) {
      // Remove the empty placeholder and surface the error
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== assistantId),
        isLoading: false,
        error: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      }))
    }
  },

  clear: () => { set({ messages: [], error: null }) },

  setError: (error) => { set({ error }) },
}))
