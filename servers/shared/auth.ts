import type { Request } from 'express'
import type { Env } from './types.js'

/**
 * 从环境变量获取配置
 */
export function getEnv(): Env {
  return {
    AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
    AI_BASE_URL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    AI_API_KEY: process.env.AI_API_KEY || '',
    AI_MODEL_ID: process.env.AI_MODEL_ID || 'gpt-4o-mini',
    ACCESS_PASSWORD: process.env.ACCESS_PASSWORD,
  }
}

/**
 * 验证访问密码
 * @returns { valid: boolean, exempt: boolean }
 * - valid: 请求是否有效（密码正确或无需密码）
 * - exempt: 是否免除配额消耗
 */
export function validateAccessPassword(req: Request, env: Env): { valid: boolean; exempt: boolean } {
  const password = req.headers['x-access-password'] as string | undefined
  const configuredPassword = env.ACCESS_PASSWORD

  // 后端未配置密码，所有请求都有效但不免除配额
  if (!configuredPassword) {
    return { valid: true, exempt: false }
  }

  // 请求携带密码
  if (password) {
    if (password === configuredPassword) {
      return { valid: true, exempt: true }
    }
    // 密码错误
    return { valid: false, exempt: false }
  }

  // 未携带密码，有效但不免除配额
  return { valid: true, exempt: false }
}

