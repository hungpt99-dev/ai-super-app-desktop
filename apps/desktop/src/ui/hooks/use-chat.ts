import { useChatStore } from '../store/chat-store.js'
import { useGroupChatStore } from '../store/chat-group-store.js'
import { useWorkspaceTabsStore } from '../store/workspace-tabs-store.js'

export type { IChatMessage } from '../store/chat-store.js'
export type { IGroupMessage, IPendingPlan } from '../store/chat-group-store.js'

/**
 * useChat — workspace-aware chat hook.
 * 
 * CRITICAL: This hook properly isolates chat state by workspace.
 * It automatically filters messages to only show those for the current workspace.
 * 
 * @param workspaceId - Optional explicit workspace ID. If not provided, uses current tab.
 */
export function useChat(workspaceId?: string) {
  const currentTabId = useWorkspaceTabsStore((s) => s.currentTabId)
  const actualWorkspaceId = workspaceId ?? currentTabId ?? ''
  
  const messagesByWorkspace = useChatStore((s) => s.messagesByWorkspace)
  const loadingByWorkspace = useChatStore((s) => s.loadingByWorkspace)
  const errorByWorkspace = useChatStore((s) => s.errorByWorkspace)
  const send = useChatStore((s) => s.send)
  const clear = useChatStore((s) => s.clear)
  const setError = useChatStore((s) => s.setError)
  
  // Get messages for the specified workspace (or current tab)
  const messages = actualWorkspaceId ? (messagesByWorkspace[actualWorkspaceId] ?? []) : []
  const isLoading = actualWorkspaceId ? (loadingByWorkspace[actualWorkspaceId] ?? false) : false
  const error = actualWorkspaceId ? (errorByWorkspace[actualWorkspaceId] ?? null) : null
  
  // Wrapped send that uses the workspace ID
  const sendMessage = (text: string) => {
    if (!actualWorkspaceId) return Promise.resolve()
    return send(text, actualWorkspaceId)
  }
  
  // Wrapped clear that uses the workspace ID
  const clearMessages = () => {
    if (!actualWorkspaceId) return
    clear(actualWorkspaceId)
  }

  // Wrapped setError that uses the workspace ID  
  const setChatError = (error: string | null) => {
    if (!actualWorkspaceId) return
    setError(error, actualWorkspaceId)
  }
  
  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    setError: setChatError,
  }
}

/**
 * useGroupChat — thin selector hook over useGroupChatStore (multi-agent workspace).
 * Note: Group chat is NOT workspace-isolated in the same way - it uses a shared
 * conversation that routes across all agents.
 */
export function useGroupChat() {
  const messages = useGroupChatStore((s) => s.messages)
  const thinkingAgentIds = useGroupChatStore((s) => s.thinkingAgentIds)
  const runningAgentIds = useGroupChatStore((s) => s.runningAgentIds)
  const error = useGroupChatStore((s) => s.error)
  const send = useGroupChatStore((s) => s.send)
  const confirmPlan = useGroupChatStore((s) => s.confirmPlan)
  const dismissPlan = useGroupChatStore((s) => s.dismissPlan)
  const clear = useGroupChatStore((s) => s.clear)
  const setError = useGroupChatStore((s) => s.setError)
  return {
    messages,
    thinkingAgentIds,
    runningAgentIds,
    isAnyAgentBusy: thinkingAgentIds.size > 0 || runningAgentIds.size > 0,
    error,
    send,
    confirmPlan,
    dismissPlan,
    clearMessages: clear,
    setError,
  }
}
