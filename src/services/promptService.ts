/**
 * 系统提示词管理服务
 * 管理 drawio、excalidraw、mermaid 的自定义系统提示词
 */

import type { EngineType } from '@/types'

const PROMPT_STORAGE_KEY = 'ai-draw-custom-prompts'

export interface CustomPrompts {
  drawio: string
  excalidraw: string
  mermaid: string
}

/**
 * 获取所有自定义提示词
 */
function getStoredPrompts(): CustomPrompts {
  const stored = localStorage.getItem(PROMPT_STORAGE_KEY)
  if (!stored) {
    return { drawio: '', excalidraw: '', mermaid: '' }
  }
  try {
    return JSON.parse(stored)
  } catch {
    return { drawio: '', excalidraw: '', mermaid: '' }
  }
}

/**
 * 保存所有自定义提示词
 */
function savePrompts(prompts: CustomPrompts): void {
  localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(prompts))
}

export const promptService = {
  /**
   * 获取所有自定义提示词
   */
  getAllPrompts(): CustomPrompts {
    return getStoredPrompts()
  },

  /**
   * 获取指定引擎的自定义提示词
   */
  getPrompt(engineType: EngineType): string {
    const prompts = getStoredPrompts()
    return prompts[engineType] || ''
  },

  /**
   * 设置指定引擎的自定义提示词
   */
  setPrompt(engineType: EngineType, prompt: string): void {
    const prompts = getStoredPrompts()
    prompts[engineType] = prompt
    savePrompts(prompts)
  },

  /**
   * 设置所有自定义提示词
   */
  setAllPrompts(prompts: CustomPrompts): void {
    savePrompts(prompts)
  },

  /**
   * 清除指定引擎的自定义提示词
   */
  clearPrompt(engineType: EngineType): void {
    const prompts = getStoredPrompts()
    prompts[engineType] = ''
    savePrompts(prompts)
  },

  /**
   * 清除所有自定义提示词
   */
  clearAllPrompts(): void {
    localStorage.removeItem(PROMPT_STORAGE_KEY)
  },

  /**
   * 检查是否有自定义提示词
   */
  hasCustomPrompt(engineType: EngineType): boolean {
    return !!this.getPrompt(engineType).trim()
  },
}

