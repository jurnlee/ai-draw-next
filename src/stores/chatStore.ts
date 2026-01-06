import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, Attachment } from '@/types'
import { chatHistoryService } from '@/services/chatHistoryService'

interface ChatState {
  // UI messages for display
  messages: ChatMessage[]
  // Current project ID (for history persistence)
  currentProjectId: string | null
  // Initial prompt from Quick Start (Path A)
  initialPrompt: string | null
  // Initial attachments from Quick Start (Path A)
  initialAttachments: Attachment[] | null
  // Streaming state
  isStreaming: boolean

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, data: Partial<ChatMessage>) => void
  clearMessages: () => void
  setInitialPrompt: (prompt: string | null, attachments?: Attachment[] | null) => void
  clearInitialPrompt: () => void
  setStreaming: (streaming: boolean) => void
  // 加载项目的聊天历史
  loadHistory: (projectId: string) => void
  // 保存当前聊天历史
  saveHistory: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentProjectId: null,
  initialPrompt: null,
  initialAttachments: null,
  isStreaming: false,

  addMessage: (message) => {
    const id = uuidv4()
    const newMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date(),
    }
    set((state) => ({
      messages: [...state.messages, newMessage],
    }))
    return id
  },

  updateMessage: (id, data) => {
    set((state) => {
      const newMessages = state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...data } : msg
      )
      
      // 当消息状态变为 complete 或 error 时，自动保存历史
      const updatedMsg = newMessages.find(m => m.id === id)
      if (updatedMsg && (data.status === 'complete' || data.status === 'error')) {
        const projectId = state.currentProjectId
        if (projectId) {
          // 延迟保存，确保状态已更新
          setTimeout(() => {
            chatHistoryService.saveHistory(projectId, get().messages)
          }, 0)
        }
      }
      
      return { messages: newMessages }
    })
  },

  clearMessages: () => {
    const { currentProjectId } = get()
    if (currentProjectId) {
      chatHistoryService.clearHistory(currentProjectId)
    }
    set({ messages: [] })
  },

  setInitialPrompt: (prompt, attachments) => set({ initialPrompt: prompt, initialAttachments: attachments ?? null }),

  clearInitialPrompt: () => set({ initialPrompt: null, initialAttachments: null }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  loadHistory: (projectId: string) => {
    const history = chatHistoryService.getHistory(projectId)
    set({ 
      messages: history,
      currentProjectId: projectId,
    })
  },

  saveHistory: () => {
    const { currentProjectId, messages } = get()
    if (currentProjectId) {
      chatHistoryService.saveHistory(currentProjectId, messages)
    }
  },
}))
