import { useChatStore } from '../store/chat-store.js'

export type { IChatMessage } from '../store/chat-store.js'

/**
 * useChat — thin selector hook over useChatStore.
 * Provides a stable public API so components are decoupled from the store shape.
 */
export function useChat() {
  const { messages, isLoading, error, send, clear, setError } = useChatStore()
  return {
    messages,
    isLoading,
    error,
    sendMessage: send,
    clearMessages: clear,
    setError,
  }
}
