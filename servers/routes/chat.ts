import type { Request, Response } from 'express'
import { getEnv, validateAccessPassword } from '../shared/auth.js'
import { callOpenAI, callAnthropic } from '../shared/ai-providers.js'
import { streamOpenAI } from '../shared/stream-openai.js'
import { streamAnthropic } from '../shared/stream-anthropic.js'
import type { Env, LLMConfig, ChatRequest } from '../shared/types.js'

/**
 * 根据 LLM 配置创建有效的环境变量对象
 */
function createEffectiveEnv(env: Env, llmConfig?: LLMConfig): Env {
  if (!llmConfig || !llmConfig.apiKey) {
    return env
  }
  console.log('llmConfig', llmConfig)
  return {
    AI_PROVIDER: llmConfig.provider || env.AI_PROVIDER,
    AI_BASE_URL: llmConfig.baseUrl || env.AI_BASE_URL,
    AI_API_KEY: llmConfig.apiKey,
    AI_MODEL_ID: llmConfig.modelId || env.AI_MODEL_ID,
  }
}

export async function chatHandler(req: Request, res: Response): Promise<void> {
  try {
    const env = getEnv()
    const { valid, exempt } = validateAccessPassword(req, env)
    
    if (!valid) {
      res.status(401).json({ error: '访问密码错误' })
      return
    }

    const body: ChatRequest = req.body
    const { messages, stream = false, llmConfig } = body

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid request: messages required' })
      return
    }

    // 使用自定义 LLM 配置时也免除配额
    const hasCustomLLM = !!(llmConfig && llmConfig.apiKey)
    const effectiveExempt = exempt || hasCustomLLM
    const effectiveEnv = createEffectiveEnv(env, llmConfig)
    const provider = effectiveEnv.AI_PROVIDER || 'openai'

    res.setHeader('X-Quota-Exempt', effectiveExempt ? 'true' : 'false')

    if (stream) {
      // 流式响应
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      switch (provider) {
        case 'anthropic':
          await streamAnthropic(messages, effectiveEnv, res)
          break
        case 'openai':
        default:
          await streamOpenAI(messages, effectiveEnv, res)
          break
      }
    } else {
      // 非流式响应
      let response: string

      switch (provider) {
        case 'anthropic':
          response = await callAnthropic(messages, effectiveEnv)
          break
        case 'openai':
        default:
          response = await callOpenAI(messages, effectiveEnv)
          break
      }

      res.json({ content: response })
    }
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: errorMessage })
  }
}

