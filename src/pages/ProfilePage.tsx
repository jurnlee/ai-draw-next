import { useState, useEffect } from 'react'
import { AppSidebar, AppHeader } from '@/components/layout'
import { Button, Input } from '@/components/ui'
import { quotaService, type LLMConfig } from '@/services/quotaService'
import { promptService, type CustomPrompts } from '@/services/promptService'
import { DEFAULT_SYSTEM_PROMPTS } from '@/lib/promptBuilder'
import { useToast } from '@/hooks/useToast'
import { Settings, Eye, EyeOff, MessageCircle, Cpu, FileText, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

type TabType = 'settings' | 'llm' | 'prompts'

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabType>('settings')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [quotaUsed, setQuotaUsed] = useState(0)
  const [quotaTotal, setQuotaTotal] = useState(10)
  const { success, error: showError } = useToast()

  // LLM 配置状态
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'openai',
    baseUrl: '',
    apiKey: '',
    modelId: '',
  })
  const [showApiKey, setShowApiKey] = useState(false)

  // 自定义提示词状态
  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>({
    drawio: '',
    excalidraw: '',
    mermaid: '',
  })

  useEffect(() => {
    // 加载配额信息
    setQuotaUsed(quotaService.getUsedCount())
    setQuotaTotal(quotaService.getDailyQuota())
    // 加载已保存的密码
    setPassword(quotaService.getAccessPassword())
    // 加载已保存的 LLM 配置
    const savedConfig = quotaService.getLLMConfig()
    if (savedConfig) {
      setLlmConfig(savedConfig)
    }
    // 加载已保存的自定义提示词
    setCustomPrompts(promptService.getAllPrompts())
  }, [])

  const handleSavePassword = () => {
    if (!password.trim()) {
      showError('请输入访问密码')
      return
    }
    quotaService.setAccessPassword(password.trim())
    success('访问密码已保存')
  }

  const handleResetPassword = () => {
    quotaService.clearAccessPassword()
    setPassword('')
    success('访问密码已清除')
  }

  const handleSaveLLMConfig = () => {
    if (!llmConfig.apiKey.trim()) {
      showError('请输入 API Key')
      return
    }
    if (!llmConfig.baseUrl.trim()) {
      showError('请输入 API Base URL')
      return
    }
    quotaService.setLLMConfig(llmConfig)
    success('LLM 配置已保存')
  }

  const handleResetLLMConfig = () => {
    quotaService.clearLLMConfig()
    setLlmConfig({
      provider: 'openai',
      baseUrl: '',
      apiKey: '',
      modelId: '',
    })
    success('LLM 配置已清除')
  }

  const handleSavePrompts = () => {
    promptService.setAllPrompts(customPrompts)
    success('系统提示词已保存')
  }

  const handleResetPrompts = () => {
    promptService.clearAllPrompts()
    setCustomPrompts({
      drawio: '',
      excalidraw: '',
      mermaid: '',
    })
    success('系统提示词已重置为默认值')
  }

  const quotaPercentage = Math.min(100, (quotaUsed / quotaTotal) * 100)
  const hasPassword = quotaService.hasAccessPassword()
  const hasLLMConfig = quotaService.hasLLMConfig()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex flex-1 flex-col">
        <AppHeader />
        <div className="flex flex-1 items-start justify-center px-8 pt-12">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-surface shadow-sm">
            <div className="flex min-h-[500px]">
              {/* 左侧 Tab */}
              <div className="w-48 border-r border-border p-4">
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'settings'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>基础设置</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('llm')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'llm'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <Cpu className="h-4 w-4" />
                    <span>LLM 配置</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('prompts')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeTab === 'prompts'
                        ? 'bg-primary text-surface'
                        : 'text-muted hover:bg-background hover:text-primary'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>提示词管理</span>
                  </button>
                </nav>
              </div>

              {/* 右侧内容区 */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'settings' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">基础设置</h2>

                    {/* 每日配额 */}
                    <QuotaSection
                      quotaUsed={quotaUsed}
                      quotaTotal={quotaTotal}
                      quotaPercentage={quotaPercentage}
                      hasPassword={hasPassword}
                      hasLLMConfig={hasLLMConfig}
                    />

                    {/* 分隔线 */}
                    <div className="my-6 border-t border-border" />

                    {/* 访问密码 */}
                    <PasswordSection
                      password={password}
                      setPassword={setPassword}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                      onSave={handleSavePassword}
                      onReset={handleResetPassword}
                    />
                  </>
                )}

                {activeTab === 'llm' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">自定义 LLM 配置</h2>

                    {/* LLM 配置 */}
                    <LLMConfigSection
                      config={llmConfig}
                      setConfig={setLlmConfig}
                      showApiKey={showApiKey}
                      setShowApiKey={setShowApiKey}
                      onSave={handleSaveLLMConfig}
                      onReset={handleResetLLMConfig}
                    />
                  </>
                )}

                {activeTab === 'prompts' && (
                  <>
                    <h2 className="mb-6 text-lg font-medium text-primary">系统提示词管理</h2>

                    {/* 系统提示词管理 */}
                    <SystemPromptSection
                      prompts={customPrompts}
                      setPrompts={setCustomPrompts}
                      onSave={handleSavePrompts}
                      onReset={handleResetPrompts}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

interface QuotaSectionProps {
  quotaUsed: number
  quotaTotal: number
  quotaPercentage: number
  hasPassword: boolean
  hasLLMConfig: boolean
}

function QuotaSection({ quotaUsed, quotaTotal, quotaPercentage, hasPassword, hasLLMConfig }: QuotaSectionProps) {
  const isUnlimited = hasPassword || hasLLMConfig
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-primary">每日配额</h3>
      <div className="space-y-3">
        {/* 进度条 */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${quotaPercentage}%` }}
          />
        </div>
        {/* 配额信息 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            已使用 <span className="font-medium text-primary">{quotaUsed}</span> / {quotaTotal} 次
          </span>
          {isUnlimited && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
              无限制
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface PasswordSectionProps {
  password: string
  setPassword: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
  onSave: () => void
  onReset: () => void
}

function PasswordSection({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  onSave,
  onReset,
}: PasswordSectionProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-primary">访问密码</h3>
      <div className="space-y-3">
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入访问密码"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted">
          输入正确的访问密码后，可无限制使用 AI 功能，不消耗每日配额。
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave}>
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={onReset}>
            重置
          </Button>
        </div>
      </div>
    </div>
  )
}

interface LLMConfigSectionProps {
  config: LLMConfig
  setConfig: (config: LLMConfig) => void
  showApiKey: boolean
  setShowApiKey: (value: boolean) => void
  onSave: () => void
  onReset: () => void
}

function LLMConfigSection({
  config,
  setConfig,
  showApiKey,
  setShowApiKey,
  onSave,
  onReset,
}: LLMConfigSectionProps) {
  return (
    <div>
      <div className="space-y-3">
        {/* Provider 选择 */}
        <div>
          <label className="mb-1 block text-xs text-muted">API类型</label>
          <select
            value={config.provider}
            onChange={(e) => setConfig({ ...config, provider: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        {/* Base URL */}
        <div>
          <label className="mb-1 block text-xs text-muted"> API地址</label>
          <Input
            type="text"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://xxxxxxx/v1"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="mb-1 block text-xs text-muted">API Key</label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Model ID */}
        <div>
          <label className="mb-1 block text-xs text-muted">模型 ID</label>
          <Input
            type="text"
            value={config.modelId}
            onChange={(e) => setConfig({ ...config, modelId: e.target.value })}
            placeholder=""
          />
        </div>

        <p className="text-xs text-muted">
          配置自己的 LLM API 后，可无限制使用 AI 功能，不消耗每日配额。
          <br />
          <span className="text-yellow-600 dark:text-yellow-400">
            注意：如果同时设置了访问密码，将优先使用访问密码。
          </span>
        </p>

        <div className="flex gap-2">
          <Button size="sm" onClick={onSave}>
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={onReset}>
            重置
          </Button>
        </div>
      </div>
    </div>
  )
}

interface SystemPromptSectionProps {
  prompts: CustomPrompts
  setPrompts: (prompts: CustomPrompts) => void
  onSave: () => void
  onReset: () => void
}

interface PromptTextareaProps {
  label: string
  engineType: 'drawio' | 'excalidraw' | 'mermaid'
  value: string
  onChange: (value: string) => void
  defaultPrompt: string
  icon: React.ReactNode
  gradient: string
}

function PromptTextarea({
  label,
  engineType,
  value,
  onChange,
  defaultPrompt,
  icon,
  gradient,
}: PromptTextareaProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasCustomValue = value.trim() !== ''

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
        hasCustomValue
          ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent'
          : 'border-border bg-surface hover:border-border/80'
      }`}
    >
      {/* 装饰性渐变背景 */}
      <div
        className={`absolute inset-0 opacity-[0.03] ${gradient}`}
        style={{ pointerEvents: 'none' }}
      />

      {/* 头部 */}
      <div className="relative flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${gradient} text-white shadow-sm`}
          >
            {icon}
          </div>
          <div>
            <h4 className="text-sm font-medium text-primary">{label}</h4>
            <p className="text-xs text-muted">
              {hasCustomValue ? '已自定义' : '使用默认提示词'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasCustomValue && (
            <button
              onClick={() => onChange('')}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-background hover:text-primary"
              title="恢复默认"
            >
              <RotateCcw className="h-3 w-3" />
              <span>恢复默认</span>
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-background hover:text-primary"
          >
            {isExpanded ? '收起' : '展开'}
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="relative p-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`留空则使用默认提示词...\n\n默认提示词预览:\n${defaultPrompt.slice(0, 200)}...`}
          className={`w-full resize-none rounded-lg border border-border/50 bg-background/50 px-3 py-2.5 text-sm text-primary placeholder:text-muted/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all duration-300 ${
            isExpanded ? 'h-80' : 'h-32'
          }`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        />

        {/* 字符计数 */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>
            {hasCustomValue
              ? `自定义: ${value.length} 字符`
              : `默认: ${defaultPrompt.length} 字符`}
          </span>
          {hasCustomValue && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              已启用自定义
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function SystemPromptSection({
  prompts,
  setPrompts,
  onSave,
  onReset,
}: SystemPromptSectionProps) {
  const promptConfigs = [
    {
      engineType: 'drawio' as const,
      label: 'Draw.io',
      icon: <FileText className="h-4 w-4" />,
      gradient: 'bg-gradient-to-br from-orange-500 to-amber-500',
    },
    {
      engineType: 'excalidraw' as const,
      label: 'Excalidraw',
      icon: <FileText className="h-4 w-4" />,
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-500',
    },
    {
      engineType: 'mermaid' as const,
      label: 'Mermaid',
      icon: <FileText className="h-4 w-4" />,
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    },
  ]

  const hasAnyCustom = prompts.drawio.trim() || prompts.excalidraw.trim() || prompts.mermaid.trim()

  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        自定义各绘图引擎的系统提示词。留空则使用内置的默认提示词。
      </p>

      <div className="space-y-4">
        {promptConfigs.map((config) => (
          <PromptTextarea
            key={config.engineType}
            engineType={config.engineType}
            label={config.label}
            icon={config.icon}
            gradient={config.gradient}
            value={prompts[config.engineType]}
            onChange={(value) =>
              setPrompts({ ...prompts, [config.engineType]: value })
            }
            defaultPrompt={DEFAULT_SYSTEM_PROMPTS[config.engineType]}
          />
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={onSave}>
          保存全部
        </Button>
        {hasAnyCustom && (
          <Button size="sm" variant="outline" onClick={onReset}>
            全部重置
          </Button>
        )}
      </div>
    </div>
  )
}
