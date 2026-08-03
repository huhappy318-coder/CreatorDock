import type { ProviderKind } from './aiConfig'

export interface DiscoveredModel {
  id: string
  label: string
  contextWindow?: number
  maxOutputTokens?: number
}

export interface ModelDiscoveryRequest {
  provider: ProviderKind
  baseUrl: string
  apiKey: string
}

type Fetcher = typeof fetch

/**
 * Reads the model list from the provider selected by the user. The request is
 * intentionally made from the app to the provider URL; no CreatorDock server
 * or shared model registry receives the API key.
 */
export async function discoverModels(request: ModelDiscoveryRequest, fetcher: Fetcher = fetch): Promise<DiscoveredModel[]> {
  if (!request.apiKey.trim()) throw new Error('API Key is required before refreshing models.')
  const baseUrl = normalizeBaseUrl(request.baseUrl)
  const isGemini = request.provider === 'gemini'
  const isAnthropic = request.provider === 'anthropic'
  const url = isGemini
    ? `${baseUrl.endsWith('/v1beta') ? baseUrl : `${baseUrl}/v1beta`}/models?key=${encodeURIComponent(request.apiKey)}`
    : `${baseUrl}${isAnthropic && !baseUrl.endsWith('/v1') ? '/v1' : ''}/models`
  const headers: Record<string, string> = { accept: 'application/json' }
  if (isAnthropic) {
    headers['x-api-key'] = request.apiKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  } else if (!isGemini) headers.Authorization = `Bearer ${request.apiKey}`

  let response: Response
  try {
    response = await fetcher(url, { method: 'GET', headers })
  } catch {
    throw new Error('无法连接模型服务；请检查接口地址、网络和跨域设置。')
  }
  if (!response.ok) throw new Error(`模型服务返回 HTTP ${response.status}，无法读取型号列表。`)
  let body: unknown
  try { body = await response.json() } catch { throw new Error('模型服务返回的型号列表不是有效 JSON。') }
  const models = isGemini ? parseGeminiModels(body) : parseOpenAiStyleModels(body)
  if (models.length === 0) throw new Error('接口没有返回可用的文本模型；可以使用“自定义型号”。')
  return models
}

function normalizeBaseUrl(value: string): string {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('接口地址必须使用 HTTP(S)。') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('接口地址必须使用 HTTP(S)。')
  if (url.username || url.password) throw new Error('接口地址不能包含账号或密码。')
  return value.replace(/\/+$/, '')
}

function parseOpenAiStyleModels(value: unknown): DiscoveredModel[] {
  if (!value || typeof value !== 'object') return []
  const object = value as Record<string, unknown>
  const list: unknown[] = Array.isArray(object.data) ? object.data : Array.isArray(object.models) ? object.models : []
  return uniqueModels(list.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const model = item as Record<string, unknown>
    if (typeof model.id !== 'string' || !model.id.trim()) return []
    return [{
      id: model.id,
      label: typeof model.display_name === 'string' && model.display_name.trim() ? model.display_name : model.id,
      ...(typeof model.context_window === 'number' ? { contextWindow: model.context_window } : {}),
      ...(typeof model.max_output_tokens === 'number' ? { maxOutputTokens: model.max_output_tokens } : {}),
    }]
  }))
}

function parseGeminiModels(value: unknown): DiscoveredModel[] {
  if (!value || typeof value !== 'object') return []
  const rawModels = (value as Record<string, unknown>).models
  const list: unknown[] = Array.isArray(rawModels) ? rawModels : []
  return uniqueModels(list.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const model = item as Record<string, unknown>
    const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : []
    if (methods.length > 0 && !methods.includes('generateContent')) return []
    const rawId = typeof model.baseModelId === 'string' ? model.baseModelId : typeof model.name === 'string' ? model.name.replace(/^models\//, '') : ''
    if (!rawId.trim()) return []
    return [{
      id: rawId,
      label: typeof model.displayName === 'string' && model.displayName.trim() ? model.displayName : rawId,
      ...(typeof model.inputTokenLimit === 'number' ? { contextWindow: model.inputTokenLimit } : {}),
      ...(typeof model.outputTokenLimit === 'number' ? { maxOutputTokens: model.outputTokenLimit } : {}),
    }]
  }))
}

function uniqueModels(models: DiscoveredModel[]): DiscoveredModel[] {
  const seen = new Set<string>()
  return models.filter((model) => {
    if (seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}
