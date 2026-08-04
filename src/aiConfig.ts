import { decryptSecret, encryptSecret, type EncryptedSecret } from './aiCrypto'
import { DEFAULT_HUMANIZATION_RULES, type HumanizationRules, type StyleSample, type WritingStylePreset } from './stylePrompt'

export const AI_CONFIG_SCHEMA_VERSION = 1 as const
export const AI_CONFIG_STORAGE_KEY = 'creatordock.ai.v1'

export type ProviderKind =
  | 'openai-compatible'
  | 'dashscope'
  | 'deepseek'
  | 'zhipu'
  | 'moonshot'
  | 'minimax'
  | 'doubao'
  | 'baichuan'
  | 'hunyuan'
  | 'siliconflow'
  | 'gemini'
  | 'anthropic'

export interface ProviderOption {
  id: ProviderKind
  label: string
  region: 'global' | 'china'
  defaultBaseUrl: string
}

/**
 * A curated model choice for the simple setup flow.  The technical fields are
 * intentionally kept in code so users only choose a model and provide their
 * own API key.
 */
export interface ModelPreset {
  id: string
  label: string
  provider: ProviderKind
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  streaming: boolean
  imageGeneration: boolean
}

export interface ModelProfile {
  id: string
  name: string
  provider: ProviderKind
  baseUrl: string
  model: string
  encryptedApiKey?: EncryptedSecret
  temperature?: number
  maxTokens?: number
  streaming: boolean
  imageGeneration: boolean
  enabled: boolean
}

export interface ModelProfileInput {
  name: string
  provider: ProviderKind
  baseUrl?: string
  model: string
  apiKey: string
  temperature?: number
  maxTokens?: number
  streaming: boolean
  imageGeneration: boolean
  enabled?: boolean
}

export interface AiConfig {
  schemaVersion: typeof AI_CONFIG_SCHEMA_VERSION
  models: ModelProfile[]
  styles: WritingStylePreset[]
  humanization: HumanizationRules
  defaultModelId?: string
  defaultStyleId?: string
  keyCheck?: EncryptedSecret
}

export interface AiStorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const PROVIDER_OPTIONS: readonly ProviderOption[] = [
  { id: 'openai-compatible', label: 'OpenAI 兼容', region: 'global', defaultBaseUrl: 'https://api.openai.com/v1' },
  { id: 'deepseek', label: 'DeepSeek', region: 'china', defaultBaseUrl: 'https://api.deepseek.com/v1' },
  { id: 'dashscope', label: '通义千问 / DashScope', region: 'china', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', label: '智谱 GLM', region: 'china', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'moonshot', label: '月之暗面 / Kimi', region: 'china', defaultBaseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'minimax', label: 'MiniMax', region: 'china', defaultBaseUrl: 'https://api.minimaxi.com/v1' },
  { id: 'doubao', label: '豆包 / 火山方舟', region: 'china', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { id: 'baichuan', label: '百川智能', region: 'china', defaultBaseUrl: 'https://api.baichuan-ai.com/v1' },
  { id: 'hunyuan', label: '腾讯混元', region: 'china', defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1' },
  { id: 'siliconflow', label: '硅基流动', region: 'china', defaultBaseUrl: 'https://api.siliconflow.cn/v1' },
  { id: 'gemini', label: 'Google Gemini', region: 'global', defaultBaseUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'anthropic', label: 'Anthropic Claude', region: 'global', defaultBaseUrl: 'https://api.anthropic.com' },
]

export const MODEL_PRESETS: readonly ModelPreset[] = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（快速）', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（推理）', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'qwen3.7-plus', label: '通义千问 3.7 Plus', provider: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-plus', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'qwen3.7-max', label: '通义千问 3.7 Max', provider: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-max', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'qwen3.6-flash', label: '通义千问 3.6 Flash（快速）', provider: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.6-flash', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'glm-5.2', label: '智谱 GLM 5.2', provider: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.2', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.5', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'minimax-m2.7', label: 'MiniMax M2.7', provider: 'minimax', baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M2.7', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'openai-gpt-5.2', label: 'OpenAI GPT-5.2', provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.2', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'openai-gpt-5-mini', label: 'OpenAI GPT-5 mini（快速）', provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'gemini-3.6-flash', label: 'Google Gemini 3.6 Flash', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.6-flash', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'gemini-3.5-flash', label: 'Google Gemini 3.5 Flash', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.5-flash', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'gemini-3.5-flash-lite', label: 'Google Gemini 3.5 Flash-Lite（快速）', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.5-flash-lite', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-0', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
  { id: 'claude-opus-4', label: 'Claude Opus 4', provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-opus-4-0', temperature: 0.7, maxTokens: 8192, streaming: true, imageGeneration: false },
]

export function findModelPreset(model: Pick<ModelProfile, 'provider' | 'model'>): ModelPreset | undefined {
  return MODEL_PRESETS.find((preset) => preset.provider === model.provider && preset.model === model.model)
}

export function modelInputFromPreset(preset: ModelPreset, apiKey = ''): ModelProfileInput {
  return {
    name: preset.label,
    provider: preset.provider,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    streaming: preset.streaming,
    imageGeneration: preset.imageGeneration,
    enabled: true,
  }
}

const PROVIDER_DEFAULTS = Object.fromEntries(PROVIDER_OPTIONS.map((option) => [option.id, option.defaultBaseUrl])) as Record<ProviderKind, string>
const SUPPORTED_PROVIDERS = new Set<ProviderKind>(PROVIDER_OPTIONS.map((option) => option.id))

const createId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

export function createDefaultAiConfig(): AiConfig {
  return { schemaVersion: 1, models: [], styles: [], humanization: { ...DEFAULT_HUMANIZATION_RULES, forbiddenWords: [], requiredHabits: [] } }
}

export async function addModelProfile(config: AiConfig, input: ModelProfileInput, passphrase: string): Promise<AiConfig> {
  const model = await buildModelProfile(input, passphrase)
  if (config.models.some((candidate) => candidate.id === model.id)) throw new Error('Model profile identifiers must be unique.')
  const keyCheck = config.keyCheck ?? await encryptSecret('CreatorDock local key check', passphrase)
  return { ...config, models: [...config.models, model], keyCheck, defaultModelId: config.defaultModelId ?? model.id }
}

export async function updateModelProfile(config: AiConfig, id: string, input: Partial<ModelProfileInput>, passphrase: string): Promise<AiConfig> {
  const current = config.models.find((model) => model.id === id)
  if (!current) throw new Error(`Model profile "${id}" does not exist.`)
  const next = input.apiKey?.trim()
    ? await buildModelProfile({ ...toModelInput(current), ...input, apiKey: input.apiKey }, passphrase, id)
    : { ...current, ...normalizeModelInput({ ...toModelInput(current), ...input, apiKey: '' }) }
  return { ...config, models: config.models.map((model) => model.id === id ? next : model) }
}

export function deleteModelProfile(config: AiConfig, id: string): AiConfig {
  const models = config.models.filter((model) => model.id !== id)
  return { ...config, models, defaultModelId: config.defaultModelId === id ? models[0]?.id : config.defaultModelId }
}

export function setDefaultModel(config: AiConfig, id: string): AiConfig {
  if (!config.models.some((model) => model.id === id)) throw new Error('The selected model profile does not exist.')
  return { ...config, defaultModelId: id }
}

export async function unlockModelApiKey(model: ModelProfile, passphrase: string): Promise<string> {
  if (!model.encryptedApiKey) throw new Error('This model profile has no saved API key.')
  return decryptSecret(model.encryptedApiKey, passphrase)
}

export function addStylePreset(config: AiConfig, input: Omit<WritingStylePreset, 'id' | 'isDefault'> & { isDefault?: boolean }): AiConfig {
  const style: WritingStylePreset = { ...input, id: createId('style'), isDefault: input.isDefault ?? config.styles.length === 0 }
  const styles = style.isDefault ? config.styles.map((item) => ({ ...item, isDefault: false })) : config.styles
  return { ...config, styles: [...styles, style], defaultStyleId: style.isDefault ? style.id : config.defaultStyleId }
}

export function updateStylePreset(config: AiConfig, id: string, changes: Partial<Omit<WritingStylePreset, 'id'>>): AiConfig {
  if (!config.styles.some((style) => style.id === id)) throw new Error('The selected style preset does not exist.')
  const wantsDefault = changes.isDefault === true
  const styles = config.styles.map((style) => style.id === id ? { ...style, ...changes, isDefault: wantsDefault || style.isDefault && changes.isDefault !== false } : wantsDefault ? { ...style, isDefault: false } : style)
  return { ...config, styles, defaultStyleId: styles.find((style) => style.isDefault)?.id }
}

export function deleteStylePreset(config: AiConfig, id: string): AiConfig {
  const styles = config.styles.filter((style) => style.id !== id)
  if (!styles.some((style) => style.isDefault) && styles[0]) styles[0] = { ...styles[0], isDefault: true }
  return { ...config, styles, defaultStyleId: styles.find((style) => style.isDefault)?.id }
}

export function updateHumanizationRules(config: AiConfig, changes: Partial<HumanizationRules>): AiConfig {
  return { ...config, humanization: { ...config.humanization, ...changes, forbiddenWords: changes.forbiddenWords ?? config.humanization.forbiddenWords, requiredHabits: changes.requiredHabits ?? config.humanization.requiredHabits } }
}

export function saveAiConfig(storage: AiStorageAdapter, config: AiConfig): void {
  assertConfig(config)
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config))
}

export function loadAiConfig(storage: AiStorageAdapter): { config: AiConfig, recovered: boolean } {
  const raw = storage.getItem(AI_CONFIG_STORAGE_KEY)
  if (!raw) return { config: createDefaultAiConfig(), recovered: false }
  try { return { config: parseAiConfig(JSON.parse(raw)), recovered: false } } catch { return { config: createDefaultAiConfig(), recovered: true } }
}

export function exportAiConfig(config: AiConfig): string {
  assertConfig(config)
  const safe = {
    schemaVersion: 1,
    models: config.models.map(({ encryptedApiKey, ...model }) => ({ ...model, hasApiKey: Boolean(encryptedApiKey) })),
    styles: config.styles,
    humanization: config.humanization,
    defaultModelId: config.defaultModelId,
    defaultStyleId: config.defaultStyleId,
  }
  return JSON.stringify(safe)
}

export function importAiConfig(json: string, current: AiConfig): { config: AiConfig, error?: string } {
  try {
    const value = JSON.parse(json) as Record<string, unknown>
    if (value.schemaVersion !== 1) throw new Error('Unsupported AI configuration schema version.')
    const imported = parseAiConfig({ ...value, models: Array.isArray(value.models) ? value.models.map((model) => ({ ...(model as object), encryptedApiKey: undefined })) : value.models })
    return { config: imported }
  } catch (error) { return { config: current, error: error instanceof Error ? error.message : 'AI configuration is invalid.' } }
}

async function buildModelProfile(input: ModelProfileInput, passphrase: string, id = createId('model')): Promise<ModelProfile> {
  const normalized = normalizeModelInput(input)
  if (!input.apiKey.trim()) throw new Error('API Key is required.')
  return { ...normalized, id, encryptedApiKey: await encryptSecret(input.apiKey, passphrase) }
}

function normalizeModelInput(input: ModelProfileInput): Omit<ModelProfile, 'id' | 'encryptedApiKey'> {
  if (!input.name.trim()) throw new Error('Model name is required.')
  if (!input.model.trim()) throw new Error('Default model name is required.')
  if (!SUPPORTED_PROVIDERS.has(input.provider)) throw new Error('Provider type is invalid.')
  const baseUrl = (input.baseUrl?.trim() || PROVIDER_DEFAULTS[input.provider]).replace(/\/+$/, '')
  if (!isHttpUrl(baseUrl)) throw new Error('Base URL must use HTTP(S).')
  if (input.temperature !== undefined && (input.temperature < 0 || input.temperature > 2)) throw new Error('Temperature must be between 0 and 2.')
  if (input.maxTokens !== undefined && (!Number.isInteger(input.maxTokens) || input.maxTokens < 1)) throw new Error('Max Tokens must be a positive integer.')
  return { name: input.name.trim(), provider: input.provider, baseUrl, model: input.model.trim(), ...(input.temperature === undefined ? {} : { temperature: input.temperature }), ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }), streaming: Boolean(input.streaming), imageGeneration: Boolean(input.imageGeneration), enabled: input.enabled ?? true }
}

function toModelInput(model: ModelProfile): ModelProfileInput { return { name: model.name, provider: model.provider, baseUrl: model.baseUrl, model: model.model, apiKey: '', temperature: model.temperature, maxTokens: model.maxTokens, streaming: model.streaming, imageGeneration: model.imageGeneration, enabled: model.enabled } }
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
  } catch { return false }
}

function parseAiConfig(value: unknown): AiConfig {
  if (!value || typeof value !== 'object') throw new Error('AI configuration must be an object.')
  const object = value as Record<string, unknown>
  if (object.schemaVersion !== 1 || !Array.isArray(object.models) || !Array.isArray(object.styles)) throw new Error('AI configuration is invalid.')
  const models = object.models.map((model) => parseModel(model))
  if (new Set(models.map((model) => model.id)).size !== models.length) throw new Error('Model profile identifiers must be unique.')
  const styles = object.styles.map((style) => parseStyle(style))
  return { schemaVersion: 1, models, styles, humanization: parseHumanization(object.humanization), ...(typeof object.defaultModelId === 'string' ? { defaultModelId: object.defaultModelId } : {}), ...(typeof object.defaultStyleId === 'string' ? { defaultStyleId: object.defaultStyleId } : {}), ...(isEncryptedSecret(object.keyCheck) ? { keyCheck: object.keyCheck } : {}) }
}

function parseModel(value: unknown): ModelProfile {
  if (!value || typeof value !== 'object') throw new Error('Model profile is invalid.')
  const model = value as Record<string, unknown>
  if (typeof model.id !== 'string' || typeof model.name !== 'string' || typeof model.provider !== 'string' || typeof model.baseUrl !== 'string' || typeof model.model !== 'string') throw new Error('Model profile fields are invalid.')
  if (!SUPPORTED_PROVIDERS.has(model.provider as ProviderKind)) throw new Error('Provider type is invalid.')
  if (!model.id.trim() || !model.name.trim() || !model.model.trim() || !isHttpUrl(model.baseUrl)) throw new Error('Model profile URL or required fields are invalid.')
  if (typeof model.temperature === 'number' && (model.temperature < 0 || model.temperature > 2)) throw new Error('Temperature must be between 0 and 2.')
  if (typeof model.maxTokens === 'number' && (!Number.isInteger(model.maxTokens) || model.maxTokens < 1)) throw new Error('Max Tokens must be a positive integer.')
  const legacyPreset = model.name.trim() === '1' || model.model === 'deepseek-v4' || model.baseUrl.includes('platform.deepseek.com')
    ? MODEL_PRESETS.find((preset) => preset.provider === model.provider)
    : undefined
  return { id: model.id, name: legacyPreset?.label ?? model.name, provider: model.provider as ProviderKind, baseUrl: (legacyPreset?.baseUrl ?? model.baseUrl).replace(/\/+$/, ''), model: legacyPreset?.model ?? model.model, ...(isEncryptedSecret(model.encryptedApiKey) ? { encryptedApiKey: model.encryptedApiKey } : {}), ...(typeof model.temperature === 'number' ? { temperature: model.temperature } : legacyPreset ? { temperature: legacyPreset.temperature } : {}), ...(typeof model.maxTokens === 'number' ? { maxTokens: model.maxTokens } : legacyPreset ? { maxTokens: legacyPreset.maxTokens } : {}), streaming: legacyPreset?.streaming ?? Boolean(model.streaming), imageGeneration: legacyPreset?.imageGeneration ?? Boolean(model.imageGeneration), enabled: model.enabled !== false }
}
function parseStyle(value: unknown): WritingStylePreset { if (!value || typeof value !== 'object') throw new Error('Writing style preset is invalid.'); const style = value as Record<string, unknown>; if (typeof style.id !== 'string' || typeof style.name !== 'string' || typeof style.description !== 'string' || !Array.isArray(style.samples)) throw new Error('Writing style fields are invalid.'); const samples = style.samples.map((sample) => { if (!sample || typeof sample !== 'object' || typeof (sample as Record<string, unknown>).id !== 'string' || typeof (sample as Record<string, unknown>).name !== 'string' || typeof (sample as Record<string, unknown>).content !== 'string') throw new Error('Writing style sample is invalid.'); return sample as StyleSample }); return { id: style.id, name: style.name, description: style.description, samples, isDefault: Boolean(style.isDefault) } }
function parseHumanization(value: unknown): HumanizationRules { if (!value || typeof value !== 'object') return { ...DEFAULT_HUMANIZATION_RULES, forbiddenWords: [], requiredHabits: [] }; const rules = value as Record<string, unknown>; return { enabled: rules.enabled !== false, rules: typeof rules.rules === 'string' ? rules.rules : DEFAULT_HUMANIZATION_RULES.rules, forbiddenWords: Array.isArray(rules.forbiddenWords) ? rules.forbiddenWords.filter((item): item is string => typeof item === 'string') : [], requiredHabits: Array.isArray(rules.requiredHabits) ? rules.requiredHabits.filter((item): item is string => typeof item === 'string') : [] } }
function isEncryptedSecret(value: unknown): value is EncryptedSecret { return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).version === 1 && (value as Record<string, unknown>).algorithm === 'AES-GCM' && typeof (value as Record<string, unknown>).ciphertext === 'string' && typeof (value as Record<string, unknown>).salt === 'string' && typeof (value as Record<string, unknown>).iv === 'string') }
function assertConfig(config: AiConfig): void { parseAiConfig(config) }
