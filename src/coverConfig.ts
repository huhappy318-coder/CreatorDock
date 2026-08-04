import { decryptSecret, encryptSecret, type EncryptedSecret } from './aiCrypto'

export const COVER_CONFIG_SCHEMA_VERSION = 1 as const
export const COVER_CONFIG_STORAGE_KEY = 'creatordock.cover.v1'

export type CoverProviderKind = 'openai-images' | 'dashscope-image' | 'volcengine-seedream' | 'custom'

export interface CoverProviderOption {
  id: CoverProviderKind
  label: string
  endpoint: string
  hint: string
}

export interface CoverProfile {
  id: string
  name: string
  provider: CoverProviderKind
  endpoint: string
  model: string
  encryptedApiKey?: EncryptedSecret
  enabled: boolean
}

export interface CoverProfileInput {
  name: string
  provider: CoverProviderKind
  endpoint?: string
  model: string
  apiKey: string
  enabled?: boolean
}

export interface CoverConfig {
  schemaVersion: typeof COVER_CONFIG_SCHEMA_VERSION
  profiles: CoverProfile[]
  defaultProfileId?: string
}

export interface CoverStorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const COVER_PROVIDER_OPTIONS: readonly CoverProviderOption[] = [
  { id: 'openai-images', label: 'OpenAI Images 兼容', endpoint: 'https://api.openai.com/v1/images/generations', hint: '需要支持 /images/generations 的接口' },
  { id: 'dashscope-image', label: '通义万相 / DashScope', endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-to-image/image-synthesis', hint: '不同版本可能需要按厂商文档调整请求地址' },
  { id: 'volcengine-seedream', label: '火山方舟 / Seedream', endpoint: 'https://ark.cn-beijing.volces.com/api/v3/images/generations', hint: '请以账号控制台的模型接口地址为准' },
  { id: 'custom', label: '生图 / 自定义接口', endpoint: '', hint: '仅发送 OpenAI Images 兼容格式；请填入你自己的 HTTPS 地址' },
]

const PROVIDERS = new Set<CoverProviderKind>(COVER_PROVIDER_OPTIONS.map((option) => option.id))
const createId = (): string => `cover-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

export function createDefaultCoverConfig(): CoverConfig {
  return { schemaVersion: 1, profiles: [] }
}

export async function addCoverProfile(config: CoverConfig, input: CoverProfileInput, passphrase: string): Promise<CoverConfig> {
  const profile = await buildCoverProfile(input, passphrase)
  if (config.profiles.some((item) => item.id === profile.id)) throw new Error('Cover profile identifiers must be unique.')
  return { ...config, profiles: [...config.profiles, profile], defaultProfileId: config.defaultProfileId ?? profile.id }
}

export async function updateCoverProfile(config: CoverConfig, id: string, input: Partial<CoverProfileInput>, passphrase: string): Promise<CoverConfig> {
  const current = config.profiles.find((item) => item.id === id)
  if (!current) throw new Error('The selected cover profile does not exist.')
  const next = input.apiKey?.trim()
    ? await buildCoverProfile({ ...toInput(current), ...input, apiKey: input.apiKey }, passphrase, id)
    : { ...current, ...normalizeInput({ ...toInput(current), ...input, apiKey: '' }) }
  return { ...config, profiles: config.profiles.map((item) => item.id === id ? next : item) }
}

export function deleteCoverProfile(config: CoverConfig, id: string): CoverConfig {
  const profiles = config.profiles.filter((item) => item.id !== id)
  return { ...config, profiles, defaultProfileId: config.defaultProfileId === id ? profiles[0]?.id : config.defaultProfileId }
}

export function saveCoverConfig(storage: CoverStorageAdapter, config: CoverConfig): void {
  storage.setItem(COVER_CONFIG_STORAGE_KEY, JSON.stringify(parseCoverConfig(config)))
}

export function loadCoverConfig(storage: CoverStorageAdapter): { config: CoverConfig, recovered: boolean } {
  const raw = storage.getItem(COVER_CONFIG_STORAGE_KEY)
  if (!raw) return { config: createDefaultCoverConfig(), recovered: false }
  try { return { config: parseCoverConfig(JSON.parse(raw)), recovered: false } } catch { return { config: createDefaultCoverConfig(), recovered: true } }
}

export async function unlockCoverApiKey(profile: CoverProfile, passphrase: string): Promise<string> {
  if (!profile.encryptedApiKey) throw new Error('This cover profile has no saved API key.')
  return decryptSecret(profile.encryptedApiKey, passphrase)
}

function normalizeInput(input: CoverProfileInput): Omit<CoverProfile, 'id' | 'encryptedApiKey'> {
  if (!input.name.trim()) throw new Error('Cover profile name is required.')
  if (!input.model.trim()) throw new Error('Cover model name is required.')
  if (!PROVIDERS.has(input.provider)) throw new Error('Cover provider type is invalid.')
  const endpoint = (input.endpoint?.trim() || COVER_PROVIDER_OPTIONS.find((option) => option.id === input.provider)?.endpoint || '').replace(/\/+$/, '')
  if (!isHttpUrl(endpoint) || new URL(endpoint).protocol !== 'https:') throw new Error('Cover endpoint must use HTTPS.')
  return { name: input.name.trim(), provider: input.provider, endpoint, model: input.model.trim(), enabled: input.enabled ?? true }
}

async function buildCoverProfile(input: CoverProfileInput, passphrase: string, id = createId()): Promise<CoverProfile> {
  const normalized = normalizeInput(input)
  if (!input.apiKey.trim()) throw new Error('Image API Key is required.')
  return { ...normalized, id, encryptedApiKey: await encryptSecret(input.apiKey, passphrase) }
}

function toInput(profile: CoverProfile): CoverProfileInput {
  return { name: profile.name, provider: profile.provider, endpoint: profile.endpoint, model: profile.model, apiKey: '', enabled: profile.enabled }
}

function parseCoverConfig(value: unknown): CoverConfig {
  if (!value || typeof value !== 'object') throw new Error('Cover configuration must be an object.')
  const object = value as Record<string, unknown>
  if (object.schemaVersion !== 1 || !Array.isArray(object.profiles)) throw new Error('Cover configuration is invalid.')
  const profiles = object.profiles.map(parseCoverProfile)
  if (new Set(profiles.map((profile) => profile.id)).size !== profiles.length) throw new Error('Cover profile identifiers must be unique.')
  return { schemaVersion: 1, profiles, ...(typeof object.defaultProfileId === 'string' ? { defaultProfileId: object.defaultProfileId } : {}) }
}

function parseCoverProfile(value: unknown): CoverProfile {
  if (!value || typeof value !== 'object') throw new Error('Cover profile is invalid.')
  const profile = value as Record<string, unknown>
  if (typeof profile.id !== 'string' || typeof profile.name !== 'string' || typeof profile.provider !== 'string' || typeof profile.endpoint !== 'string' || typeof profile.model !== 'string') throw new Error('Cover profile fields are invalid.')
  if (!PROVIDERS.has(profile.provider as CoverProviderKind) || !profile.id.trim() || !profile.name.trim() || !profile.model.trim() || !isHttpUrl(profile.endpoint) || new URL(profile.endpoint).protocol !== 'https:') throw new Error('Cover profile URL or required fields are invalid.')
  return { id: profile.id, name: profile.name.trim(), provider: profile.provider as CoverProviderKind, endpoint: profile.endpoint.replace(/\/+$/, ''), model: profile.model.trim(), ...(isEncryptedSecret(profile.encryptedApiKey) ? { encryptedApiKey: profile.encryptedApiKey } : {}), enabled: profile.enabled !== false }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
  } catch { return false }
}
function isEncryptedSecret(value: unknown): value is EncryptedSecret { return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).version === 1 && (value as Record<string, unknown>).algorithm === 'AES-GCM' && typeof (value as Record<string, unknown>).ciphertext === 'string' && typeof (value as Record<string, unknown>).salt === 'string' && typeof (value as Record<string, unknown>).iv === 'string') }
