/**
 * 聊天历史存储服务
 * 按项目 ID 存储聊天记录，每个项目保留最近 10 条
 */

import type { ChatMessage } from '@/types'

const STORAGE_KEY_PREFIX = 'ai-draw-chat-history-'
const MAX_MESSAGES_PER_PROJECT = 10

/**
 * 序列化消息用于存储
 * 移除不需要持久化的字段（如 attachments 中的大数据）
 */
function serializeMessage(msg: ChatMessage): ChatMessage {
  return {
    ...msg,
    // 移除图片附件的 dataUrl 以节省存储空间
    attachments: msg.attachments?.map(att => {
      if (att.type === 'image') {
        return { ...att, dataUrl: '[已移除]' }
      }
      return att
    }),
  }
}

/**
 * 反序列化消息
 * 将日期字符串转换回 Date 对象
 */
function deserializeMessage(msg: ChatMessage): ChatMessage {
  return {
    ...msg,
    timestamp: new Date(msg.timestamp),
  }
}

export const chatHistoryService = {
  /**
   * 获取指定项目的聊天历史
   */
  getHistory(projectId: string): ChatMessage[] {
    const key = STORAGE_KEY_PREFIX + projectId
    const stored = localStorage.getItem(key)
    if (!stored) return []

    try {
      const messages: ChatMessage[] = JSON.parse(stored)
      return messages.map(deserializeMessage)
    } catch {
      return []
    }
  },

  /**
   * 保存聊天历史（只保留最近 10 条）
   */
  saveHistory(projectId: string, messages: ChatMessage[]): void {
    const key = STORAGE_KEY_PREFIX + projectId
    
    // 只保存已完成的消息（不保存 streaming 状态的）
    const completedMessages = messages.filter(
      msg => msg.status === 'complete' || msg.status === 'error'
    )
    
    // 只保留最近 MAX_MESSAGES_PER_PROJECT 条
    const recentMessages = completedMessages.slice(-MAX_MESSAGES_PER_PROJECT)
    
    // 序列化并保存
    const serialized = recentMessages.map(serializeMessage)
    localStorage.setItem(key, JSON.stringify(serialized))
  },

  /**
   * 清除指定项目的聊天历史
   */
  clearHistory(projectId: string): void {
    const key = STORAGE_KEY_PREFIX + projectId
    localStorage.removeItem(key)
  },

  /**
   * 清除所有项目的聊天历史
   */
  clearAllHistory(): void {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  },
}

