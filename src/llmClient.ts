import { buildSystemPrompt, type SystemPromptInput } from './stylePrompt'
import type { ModelProfile, ProviderKind } from './aiConfig'

export interface LLMRequest extends SystemPromptInput { signal?: AbortSignal }
export interface LLMErrorShape { kind: 'network' | 'http' | 'parse' | 'unsupported'; status?: number; message: string }
export class LLMError extends Error implements LLMErrorShape {
  kind: LLMErrorShape['kind']
  status?: number
  constructor(shape: LLMErrorShape) { super(shape.message); this.name = 'LLMError'; this.kind = shape.kind; this.status = shape.status }
}

export interface LLMClient {
  generateText(request: LLMRequest): Promise<string>
  streamText(request: LLMRequest): AsyncIterable<string>
  testConnection(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: LLMError }>
}

type Fetcher = typeof fetch

export function createLLMClient(profile: ModelProfile, apiKey: string, fetcher: Fetcher = fetch): LLMClient {
  if (!apiKey.trim()) throw new Error('An unlocked API Key is required.')
  const requestJson = async (request: LLMRequest, stream: boolean): Promise<{ response: Response; cleanup: () => void }> => {
    const system = buildSystemPrompt({ ...request, styleEnabled: request.styleEnabled !== false })
    const payload = buildPayload(profile, system, request.task, stream)
    const { url, init } = buildRequest(profile, apiKey, payload, stream)
    const controller = new AbortController()
    const abort = () => controller.abort(request.signal?.reason)
    const timer = setTimeout(() => controller.abort(new DOMException('Request timed out after 120 seconds.', 'TimeoutError')), 120_000)
    const cleanup = () => { clearTimeout(timer); request.signal?.removeEventListener('abort', abort) }
    if (request.signal?.aborted) abort()
    else request.signal?.addEventListener('abort', abort, { once: true })
    init.signal = controller.signal
    try { return { response: await fetcher(url, init), cleanup } }
    catch (error) {
      cleanup()
      throw new LLMError({ kind: 'network', message: redactSecret(error instanceof Error || error instanceof DOMException ? error.message : 'The provider request failed.', apiKey) })
    }
  }
  return {
    async generateText(request) {
      const { response, cleanup } = await requestJson(request, false)
      try { return parseResponse(profile.provider, await readResponse(response), response.status) }
      finally { cleanup() }
    },
    async *streamText(request) {
      const { response, cleanup } = await requestJson(request, true)
      try {
        if (!response.ok) throw await toHttpError(response)
        if (!response.body) throw new LLMError({ kind: 'parse', message: 'The provider returned no streaming body.' })
        yield* parseSse(response.body, profile.provider)
      } finally { cleanup() }
    },
    async testConnection() { const started = performance.now(); try { await this.generateText({ task: 'Reply with OK only.', humanization: { enabled: false, rules: '', forbiddenWords: [], requiredHabits: [] }, styleEnabled: false }); return { ok: true, latencyMs: Math.round(performance.now() - started) } } catch (error) { return { ok: false, error: error instanceof LLMError ? error : new LLMError({ kind: 'network', message: 'Connection test failed.' }) } } },
  }
}

function buildPayload(profile: ModelProfile, system: string, task: string, stream: boolean): Record<string, unknown> {
  if (profile.provider === 'gemini') return { contents: [{ role: 'user', parts: [{ text: `${system}\n\n${task}` }] }], generationConfig: { ...(profile.temperature === undefined ? {} : { temperature: profile.temperature }), ...(profile.maxTokens === undefined ? {} : { maxOutputTokens: profile.maxTokens }) } }
  if (profile.provider === 'anthropic') return { model: profile.model, max_tokens: profile.maxTokens ?? 4096, ...(profile.temperature === undefined ? {} : { temperature: profile.temperature }), system, messages: [{ role: 'user', content: task }], stream }
  return { model: profile.model, messages: [{ role: 'system', content: system }, { role: 'user', content: task }], ...(profile.temperature === undefined ? {} : { temperature: profile.temperature }), ...(profile.maxTokens === undefined ? {} : { max_tokens: profile.maxTokens }), stream }
}

function buildRequest(profile: ModelProfile, apiKey: string, payload: Record<string, unknown>, stream: boolean): { url: string, init: RequestInit } {
  const base = profile.baseUrl.replace(/\/+$/, '')
  if (profile.provider === 'gemini') { const action = stream ? 'streamGenerateContent' : 'generateContent'; const query = stream ? 'alt=sse&' : ''; const versionedBase = base.endsWith('/v1beta') ? base : `${base}/v1beta`; return { url: `${versionedBase}/models/${encodeURIComponent(profile.model)}:${action}?${query}key=${encodeURIComponent(apiKey)}`, init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } } }
  const endpoint = profile.provider === 'anthropic' ? `${base}${base.endsWith('/v1') ? '' : '/v1'}/messages` : `${base}/chat/completions`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (profile.provider === 'anthropic') Object.assign(headers, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' })
  else headers.Authorization = `Bearer ${apiKey}`
  return { url: endpoint, init: { method: 'POST', headers, body: JSON.stringify(payload) } }
}

async function readResponse(response: Response): Promise<string> { const text = await response.text(); if (!response.ok) throw new LLMError({ kind: 'http', status: response.status, message: `Provider returned HTTP ${response.status}.` }); return text }
async function toHttpError(response: Response): Promise<LLMError> { await response.text(); return new LLMError({ kind: 'http', status: response.status, message: `Provider returned HTTP ${response.status}.` }) }
function redactSecret(message: string, secret: string): string { return secret ? message.split(secret).join('[redacted]') : message }
function responseText(provider: ProviderKind, json: Record<string, any>, streaming: boolean): string {
  if (json.error || json.type === 'error') throw new LLMError({ kind: 'parse', message: 'Provider reported a generation error. Check your model, quota and request settings.' })
  const text = provider === 'gemini'
    ? json.candidates?.[0]?.content?.parts?.map((part: any) => typeof part.text === 'string' ? part.text : '').join('')
    : provider === 'anthropic'
      ? streaming ? json.delta?.text : json.content?.map((item: any) => typeof item.text === 'string' ? item.text : '').join('')
      : streaming ? json.choices?.[0]?.delta?.content : json.choices?.[0]?.message?.content
  return typeof text === 'string' ? text : ''
}

function parseResponse(provider: ProviderKind, text: string, status: number): string {
  try {
    const output = responseText(provider, JSON.parse(text), false)
    if (!output.trim()) throw new LLMError({ kind: 'parse', status, message: 'Provider returned no generated text. Check the model and request settings.' })
    return output
  } catch (error) {
    if (error instanceof LLMError) throw error
    throw new LLMError({ kind: 'parse', status, message: 'Provider returned invalid JSON.' })
  }
}

async function* parseSse(body: ReadableStream<Uint8Array>, provider: ProviderKind): AsyncIterable<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let hasText = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const lines = buffer.split(/\r?\n/)
      buffer = done ? '' : lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        if (data === '[DONE]') {
          if (!hasText) throw new LLMError({ kind: 'parse', message: 'Provider returned no generated text.' })
          return
        }
        try {
          const chunk = responseText(provider, JSON.parse(data), true)
          if (chunk) { hasText ||= Boolean(chunk.trim()); yield chunk }
        } catch (error) {
          if (error instanceof LLMError) throw error
          throw new LLMError({ kind: 'parse', message: 'Provider returned an invalid streaming event.' })
        }
      }
      if (done) break
    }
    if (!hasText) throw new LLMError({ kind: 'parse', message: 'Provider returned no generated text.' })
  } finally {
    try { await reader.cancel() } finally { reader.releaseLock() }
  }
}
