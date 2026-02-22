import { useChatStore } from '../store/chat-store.js'
import { useGroupChatStore } from '../store/chat-group-store.js'

export type { IChatMessage } from '../store/chat-store.js'
export type { IGroupMessage, IPendingPlan } from '../store/chat-group-store.js'

/**
 * useChat — thin selector hook over useChatStore (single-bot chat).
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

/**
 * useGroupChat — thin selector hook over useGroupChatStore (multi-bot workspace).
 */
export function useGroupChat() {
  const messages       = useGroupChatStore((s) => s.messages)
  const thinkingBotIds = useGroupChatStore((s) => s.thinkingBotIds)
  const runningBotIds  = useGroupChatStore((s) => s.runningBotIds)
  const error          = useGroupChatStore((s) => s.error)
  const send           = useGroupChatStore((s) => s.send)
  const confirmPlan    = useGroupChatStore((s) => s.confirmPlan)
  const dismissPlan    = useGroupChatStore((s) => s.dismissPlan)
  const clear          = useGroupChatStore((s) => s.clear)
  const setError       = useGroupChatStore((s) => s.setError)
  return {
    messages,
    thinkingBotIds,
    runningBotIds,
    isAnyBotBusy: thinkingBotIds.size > 0 || runningBotIds.size > 0,
    error,
    send,
    confirmPlan,
    dismissPlan,
    clearMessages: clear,
    setError,
  }
}

