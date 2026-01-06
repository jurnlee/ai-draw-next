import type { EngineType } from '@/types'
import { mermaidSystemPrompt, drawioSystemPrompt, excalidrawSystemPrompt } from './prompts'
import { promptService } from '@/services/promptService'

/**
 * Default system prompts for different engines
 */
export const DEFAULT_SYSTEM_PROMPTS: Record<EngineType, string> = {
  mermaid: mermaidSystemPrompt,
  excalidraw: excalidrawSystemPrompt,
  drawio: drawioSystemPrompt,
}

/**
 * Get system prompt for an engine (custom if set, otherwise default)
 */
export function getSystemPrompt(engineType: EngineType): string {
  const customPrompt = promptService.getPrompt(engineType)
  if (customPrompt.trim()) {
    return customPrompt
  }
  return DEFAULT_SYSTEM_PROMPTS[engineType]
}

/**
 * System prompts for different engines (for backward compatibility)
 * @deprecated Use getSystemPrompt() instead
 */
export const SYSTEM_PROMPTS: Record<EngineType, string> = DEFAULT_SYSTEM_PROMPTS

/**
 * Build user prompt for initial generation
 * @param userInput - User's description
 * @param useTwoPhase - Whether to use two-phase generation (for drawio/excalidraw) or single-phase (for mermaid)
 * @param phase - Phase of two-phase generation ('elements' or 'links'), ignored if useTwoPhase is false
 * @param elementsOutput - Output from elements phase, required for 'links' phase
 */
export function buildInitialPrompt(
  userInput: string,
  useTwoPhase: boolean,
  phase?: 'elements' | 'links',
  elementsOutput?: string
): string {
  // Single-phase generation (for mermaid)
  if (!useTwoPhase) {
    return `用户需求：
"""
${userInput}
"""

根据以上需求，生成完整的图表代码。`
  }

  // Two-phase generation (for drawio/excalidraw)
  if (phase === 'elements') {
    return `用户需求：
"""
${userInput}
"""

根据以上需求，识别并列出所有必要的图表节点和组件。
仅输出包含节点/形状的数据结构，暂不创建任何连接或连线。`
  }

  return `原始需求：
"""
${userInput}
"""

已生成的元素：
"""
${elementsOutput}
"""

根据这些元素，建立它们之间的逻辑连接、箭头和层级关系。
输出最终完整的图表代码。`
}

/**
 * Build user prompt for secondary editing
 */
export function buildEditPrompt(
  currentCode: string,
  userInput: string
): string {
  return `当前图表内容：
"""
${currentCode}
"""

用户修改请求："""${userInput}"""

根据用户修改请求进行修改，同时尽量保持原有结构不变。输出完整的修改后的图表代码。`
}

/**
 * Extract code from AI response
 * Handles markdown code blocks and plain text
 */
export function extractCode(response: string, engineType: EngineType): string {
  let code = response.trim()

  // Remove markdown code blocks if present
  const codeBlockPatterns = [
    /```mermaid\n?([\s\S]*?)```/i,
    /```json\n?([\s\S]*?)```/i,
    /```xml\n?([\s\S]*?)```/i,
    /```\n?([\s\S]*?)```/,
  ]

  for (const pattern of codeBlockPatterns) {
    const match = code.match(pattern)
    if (match) {
      code = match[1].trim()
      break
    }
  }

  // 针对不同引擎类型进行特殊处理
  if (engineType === 'excalidraw') {
    code = extractExcalidrawJson(code)
  } else if (engineType === 'drawio') {
    code = extractDrawioXml(code)
  }

  return code
}

/**
 * 提取 Excalidraw JSON 数组
 * 处理 AI 可能返回的各种格式
 */
function extractExcalidrawJson(code: string): string {
  // 如果已经是有效的 JSON，直接返回
  try {
    JSON.parse(code)
    return code
  } catch {
    // 继续尝试修复
  }

  // 尝试提取 JSON 数组（从第一个 [ 到最后一个 ]）
  const firstBracket = code.indexOf('[')
  const lastBracket = code.lastIndexOf(']')
  
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    let jsonStr = code.slice(firstBracket, lastBracket + 1)
    
    // 尝试修复常见的 JSON 问题
    jsonStr = fixCommonJsonIssues(jsonStr)
    
    // 验证修复后的 JSON
    try {
      JSON.parse(jsonStr)
      return jsonStr
    } catch {
      // 修复失败，返回原始提取的内容
      return jsonStr
    }
  }

  // 尝试提取 JSON 对象（从第一个 { 到最后一个 }）
  const firstBrace = code.indexOf('{')
  const lastBrace = code.lastIndexOf('}')
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    let jsonStr = code.slice(firstBrace, lastBrace + 1)
    jsonStr = fixCommonJsonIssues(jsonStr)
    
    try {
      JSON.parse(jsonStr)
      return jsonStr
    } catch {
      return jsonStr
    }
  }

  return code
}

/**
 * 提取 Draw.io XML
 * 确保获取完整的 mxGraphModel
 */
function extractDrawioXml(code: string): string {
  // 尝试提取 mxGraphModel 标签
  const mxGraphStart = code.indexOf('<mxGraphModel')
  const mxGraphEnd = code.lastIndexOf('</mxGraphModel>')
  
  if (mxGraphStart !== -1 && mxGraphEnd !== -1) {
    return code.slice(mxGraphStart, mxGraphEnd + '</mxGraphModel>'.length)
  }

  return code
}

/**
 * 修复常见的 JSON 格式问题
 */
function fixCommonJsonIssues(json: string): string {
  let fixed = json

  // 移除末尾多余的逗号（在 ] 或 } 之前）
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
  
  // 移除数组末尾多余的逗号
  fixed = fixed.replace(/,(\s*\])/g, '$1')
  
  // 移除对象末尾多余的逗号
  fixed = fixed.replace(/,(\s*\})/g, '$1')

  // 修复可能的单引号问题（将单引号替换为双引号，但要小心字符串内容）
  // 这个比较复杂，只处理属性名的单引号
  fixed = fixed.replace(/'([^']+)'(\s*:)/g, '"$1"$2')

  return fixed
}
