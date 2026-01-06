import type { PayloadMessage, ChatRequest } from '@/types'
import { quotaService } from './quotaService'

// API endpoint - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * 获取请求头（包含访问密码和 LLM 配置）
 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // 优先使用访问密码
  const password = quotaService.getAccessPassword()
  if (password) {
    headers['X-Access-Password'] = password
  }
  // 如果没有访问密码，检查是否有自定义 LLM 配置
  const llmConfig = quotaService.getLLMConfig()
  if (llmConfig && llmConfig.apiKey) {
    headers['X-Custom-LLM'] = 'true'
  }
  return headers
}

/**
 * 检查配额并在需要时消耗
 */
function checkAndConsumeQuota(response: Response): void {
  const quotaExempt = response.headers.get('X-Quota-Exempt')
  // 只有当不免除配额时才消耗
  if (quotaExempt !== 'true') {
    quotaService.consumeQuota()
  }
}

/**
 * 检查是否有足够配额（有密码或自定义 LLM 配置时跳过检查）
 */
function ensureQuotaAvailable(): void {
  // 优先检查访问密码，其次检查 LLM 配置
  if (quotaService.hasAccessPassword() || quotaService.hasLLMConfig()) {
    return
  }
  if (!quotaService.hasQuotaRemaining()) {
    throw new Error('今日配额已用完，请明天再试或设置访问密码/自定义 LLM 配置')
  }
}

/**
 * 构建请求体（包含 LLM 配置，如果有的话）
 */
function buildRequestBody(messages: PayloadMessage[], stream = false): object {
  const body: Record<string, unknown> = { messages, stream }

  // 如果没有访问密码但有自定义 LLM 配置，则添加到请求体
  if (!quotaService.hasAccessPassword() && quotaService.hasLLMConfig()) {
    const llmConfig = quotaService.getLLMConfig()
    if (llmConfig) {
      body.llmConfig = llmConfig
    }
  }

  return body
}

interface ParseUrlResponse {
  success: boolean
  data?: {
    title: string
    content: string
    excerpt: string
    siteName: string
    url: string
  }
  error?: string
}

/**
 * Parse SSE data line and extract content
 */
function parseSSELine(line: string): string | null {
  let data = line

  // Handle SSE format (data: prefix)
  if (line.startsWith('data: ')) {
    data = line.slice(6)
  }

  if (data === '[DONE]') return null
  if (!data.trim()) return null

  try {
    const parsed = JSON.parse(data)
    
    // Handle OpenAI format: { choices: [{ delta: { content: "..." } }] }
    if (parsed.choices?.[0]?.delta?.content !== undefined) {
      return parsed.choices[0].delta.content
    }
    
    // Handle simple format from our backend: { content: "..." }
    if (parsed.content !== undefined) {
      return parsed.content
    }
    
    // Handle text field
    if (parsed.text !== undefined) {
      return parsed.text
    }
    
    // Handle Anthropic format: { type: "content_block_delta", delta: { text: "..." } }
    if (parsed.type === 'content_block_delta' && parsed.delta?.text !== undefined) {
      return parsed.delta.text
    }
    
    // 如果解析成功但没有找到内容字段，返回 null
    return null
  } catch {
    // Not JSON, return raw data if it has content
    if (data.trim()) {
      return data
    }
  }
  return null
}

// 当前活跃的 AbortController
let currentAbortController: AbortController | null = null

/**
 * AI Service for communicating with the backend
 */
export const aiService = {
  /**
   * 中止当前正在进行的请求
   */
  abort(): void {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
  },

  /**
   * Send chat messages to AI and get response (non-streaming)
   */
  async chat(messages: PayloadMessage[]): Promise<string> {
    ensureQuotaAvailable()

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(buildRequestBody(messages, false)),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI request failed: ${error}`)
    }

    checkAndConsumeQuota(response)

    const data = await response.json()
    return data.content || data.message || ''
  },

  /**
   * Stream chat response with SSE support
   * @param messages - The messages to send
   * @param onChunk - Callback for each content chunk
   * @param onComplete - Optional callback when streaming completes
   * @returns The full accumulated content
   */
  async streamChat(
    messages: PayloadMessage[],
    onChunk: (chunk: string, accumulated: string) => void,
    onComplete?: (content: string) => void
  ): Promise<string> {
    ensureQuotaAvailable()

    // 创建新的 AbortController
    currentAbortController = new AbortController()
    const { signal } = currentAbortController

    console.log('[streamChat] Sending request to:', `${API_BASE_URL}/chat`)
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(buildRequestBody(messages, true)),
      signal,
    })

    console.log('[streamChat] Response status:', response.status, response.statusText)
    console.log('[streamChat] Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const error = await response.text()
      console.error('[streamChat] Request failed:', error)
      throw new Error(`AI request failed: ${error}`)
    }

    // 流式请求成功后检查并消耗配额
    checkAndConsumeQuota(response)

    const reader = response.body?.getReader()
    if (!reader) {
      console.error('[streamChat] No response body reader available')
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''
    let rawResponse = '' // 保存原始响应用于调试

    let chunkCount = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[streamChat] Stream done, total chunks received:', chunkCount)
          break
        }

        chunkCount++
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        rawResponse += chunk
        
        if (chunkCount <= 3) {
          console.log(`[streamChat] Chunk ${chunkCount}:`, chunk.substring(0, 200))
        }

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue

          const content = parseSSELine(trimmedLine)
          if (content) {
            fullContent += content
            onChunk(content, fullContent)
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const content = parseSSELine(buffer.trim())
        if (content) {
          fullContent += content
          onChunk(content, fullContent)
        }
      }

      // 如果流式响应为空，尝试解析原始响应作为非流式 JSON
      if (!fullContent && rawResponse.trim()) {
        console.warn('[streamChat] Stream response empty, attempting to parse as JSON:', rawResponse.substring(0, 500))
        try {
          const jsonResponse = JSON.parse(rawResponse)
          // 尝试各种可能的响应格式
          const extractedContent = 
            jsonResponse.content ||
            jsonResponse.message ||
            jsonResponse.choices?.[0]?.message?.content ||
            jsonResponse.choices?.[0]?.text ||
            (typeof jsonResponse === 'string' ? jsonResponse : null)
          
          if (extractedContent) {
            fullContent = extractedContent
            onChunk(fullContent, fullContent)
          }
        } catch {
          console.error('[streamChat] Failed to parse raw response as JSON, rawResponse:', rawResponse)
        }
      }
    } finally {
      reader.releaseLock()
      currentAbortController = null
    }

    // 如果流式响应完全为空（0 chunks），尝试使用非流式请求作为回退
    if (!fullContent && chunkCount === 0) {
      console.warn('[streamChat] Stream returned 0 chunks, falling back to non-streaming request')
      try {
        const fallbackContent = await this.chat(messages)
        if (fallbackContent) {
          onChunk(fallbackContent, fallbackContent)
          onComplete?.(fallbackContent)
          return fallbackContent
        }
      } catch (fallbackError) {
        console.error('[streamChat] Fallback non-streaming request also failed:', fallbackError)
      }
    }

    // 如果仍然为空，打印调试信息
    if (!fullContent) {
      console.error('[streamChat] Stream chat returned empty content. Raw response:', rawResponse.substring(0, 1000))
    }

    onComplete?.(fullContent)
    return fullContent
  },

  /**
   * Parse URL content and convert to markdown
   */
  async parseUrl(url: string): Promise<ParseUrlResponse> {
    const response = await fetch(`${API_BASE_URL}/parse-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data: ParseUrlResponse = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || '解析URL失败')
    }

    return data
  },
}
