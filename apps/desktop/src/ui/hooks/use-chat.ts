import { useChatStore } from '../store/chat-store.js'

export type { IChatMessage } from '../store/chat-store.js'

/**
 * useChat — thin selector hook over useChatStore.
 * Provides a stable public API so components are decoupled from the store shape.
 */
export function useChat() {
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const error = useChatStore((s) => s.error)
  const send = useChatStore((s) => s.send)
  const clear = useChatStore((s) => s.clear)
  const setError = useChatStore((s) => s.setError)
  return {
    messages,
    isLoading,
    error,
    sendMessage: send,
    clearMessages: clear,
    setError,
  }
}
