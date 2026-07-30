import { decryptSecret, encryptSecret, type EncryptedSecret } from './aiCrypto'
import { DEFAULT_HUMANIZATION_RULES, type HumanizationRules, type StyleSample, type WritingStylePreset } from './stylePrompt'

export const AI_CONFIG_SCHEMA_VERSION = 1 as const
export const AI_CONFIG_STORAGE_KEY = 'creatordock.ai.v1'

export type ProviderKind = 'openai-compatible' | 'dashscope' | 'gemini' | 'anthropic'

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

const PROVIDER_DEFAULTS: Record<ProviderKind, string> = {
  'openai-compatible': 'https://api.openai.com/v1',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  gemini: 'https://generativelanguage.googleapis.com',
  anthropic: 'https://api.anthropic.com',
}

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
  if (!['openai-compatible', 'dashscope', 'gemini', 'anthropic'].includes(input.provider)) throw new Error('Provider type is invalid.')
  const baseUrl = (input.baseUrl?.trim() || PROVIDER_DEFAULTS[input.provider]).replace(/\/+$/, '')
  if (!isHttpUrl(baseUrl)) throw new Error('Base URL must use HTTP(S).')
  if (input.temperature !== undefined && (input.temperature < 0 || input.temperature > 2)) throw new Error('Temperature must be between 0 and 2.')
  if (input.maxTokens !== undefined && (!Number.isInteger(input.maxTokens) || input.maxTokens < 1)) throw new Error('Max Tokens must be a positive integer.')
  return { name: input.name.trim(), provider: input.provider, baseUrl, model: input.model.trim(), ...(input.temperature === undefined ? {} : { temperature: input.temperature }), ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }), streaming: Boolean(input.streaming), imageGeneration: Boolean(input.imageGeneration), enabled: input.enabled ?? true }
}

function toModelInput(model: ModelProfile): ModelProfileInput { return { name: model.name, provider: model.provider, baseUrl: model.baseUrl, model: model.model, apiKey: '', temperature: model.temperature, maxTokens: model.maxTokens, streaming: model.streaming, imageGeneration: model.imageGeneration, enabled: model.enabled } }
function isHttpUrl(value: string): boolean { try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' } catch { return false } }

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
  if (!['openai-compatible', 'dashscope', 'gemini', 'anthropic'].includes(model.provider)) throw new Error('Provider type is invalid.')
  if (!model.id.trim() || !model.name.trim() || !model.model.trim() || !isHttpUrl(model.baseUrl)) throw new Error('Model profile URL or required fields are invalid.')
  if (typeof model.temperature === 'number' && (model.temperature < 0 || model.temperature > 2)) throw new Error('Temperature must be between 0 and 2.')
  if (typeof model.maxTokens === 'number' && (!Number.isInteger(model.maxTokens) || model.maxTokens < 1)) throw new Error('Max Tokens must be a positive integer.')
  return { id: model.id, name: model.name, provider: model.provider as ProviderKind, baseUrl: model.baseUrl.replace(/\/+$/, ''), model: model.model, ...(isEncryptedSecret(model.encryptedApiKey) ? { encryptedApiKey: model.encryptedApiKey } : {}), ...(typeof model.temperature === 'number' ? { temperature: model.temperature } : {}), ...(typeof model.maxTokens === 'number' ? { maxTokens: model.maxTokens } : {}), streaming: Boolean(model.streaming), imageGeneration: Boolean(model.imageGeneration), enabled: model.enabled !== false }
}
function parseStyle(value: unknown): WritingStylePreset { if (!value || typeof value !== 'object') throw new Error('Writing style preset is invalid.'); const style = value as Record<string, unknown>; if (typeof style.id !== 'string' || typeof style.name !== 'string' || typeof style.description !== 'string' || !Array.isArray(style.samples)) throw new Error('Writing style fields are invalid.'); const samples = style.samples.map((sample) => { if (!sample || typeof sample !== 'object' || typeof (sample as Record<string, unknown>).id !== 'string' || typeof (sample as Record<string, unknown>).name !== 'string' || typeof (sample as Record<string, unknown>).content !== 'string') throw new Error('Writing style sample is invalid.'); return sample as StyleSample }); return { id: style.id, name: style.name, description: style.description, samples, isDefault: Boolean(style.isDefault) } }
function parseHumanization(value: unknown): HumanizationRules { if (!value || typeof value !== 'object') return { ...DEFAULT_HUMANIZATION_RULES, forbiddenWords: [], requiredHabits: [] }; const rules = value as Record<string, unknown>; return { enabled: rules.enabled !== false, rules: typeof rules.rules === 'string' ? rules.rules : DEFAULT_HUMANIZATION_RULES.rules, forbiddenWords: Array.isArray(rules.forbiddenWords) ? rules.forbiddenWords.filter((item): item is string => typeof item === 'string') : [], requiredHabits: Array.isArray(rules.requiredHabits) ? rules.requiredHabits.filter((item): item is string => typeof item === 'string') : [] } }
function isEncryptedSecret(value: unknown): value is EncryptedSecret { return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).version === 1 && (value as Record<string, unknown>).algorithm === 'AES-GCM' && typeof (value as Record<string, unknown>).ciphertext === 'string' && typeof (value as Record<string, unknown>).salt === 'string' && typeof (value as Record<string, unknown>).iv === 'string') }
function assertConfig(config: AiConfig): void { parseAiConfig(config) }
