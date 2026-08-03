import type { CoverProfile } from './coverConfig'

export interface CoverRequest {
  prompt: string
  negativePrompt?: string
  size: string
  referenceImages?: string[]
}

export interface CoverResult {
  imageUrl: string
  revisedPrompt?: string
}

export class CoverError extends Error {
  kind: 'network' | 'http' | 'parse'
  status?: number
  constructor(kind: CoverError['kind'], message: string, status?: number) { super(message); this.name = 'CoverError'; this.kind = kind; this.status = status }
}

export function createCoverClient(profile: CoverProfile, apiKey: string, fetcher: typeof fetch = fetch) {
  if (!apiKey.trim()) throw new Error('An unlocked image API Key is required.')
  return {
    async generate(request: CoverRequest): Promise<CoverResult> {
      if (!request.prompt.trim()) throw new Error('A cover prompt is required.')
      const negativePrompt = request.negativePrompt?.trim()
      const prompt = negativePrompt ? `${request.prompt.trim()}\n\n避免出现：${negativePrompt}` : request.prompt.trim()
      const payload: Record<string, unknown> = { model: profile.model, prompt, size: request.size, n: 1, response_format: 'b64_json' }
      if (request.referenceImages?.length) payload.reference_images = request.referenceImages
      let response: Response
      try {
        response = await fetcher(profile.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
      } catch (error) { throw new CoverError('network', redact(error instanceof Error ? error.message : 'The image provider request failed.', apiKey)) }
      if (!response.ok) { await response.text(); throw new CoverError('http', `Image provider returned HTTP ${response.status}.`, response.status) }
      try {
        const json = await response.json() as Record<string, any>
        const item = json.data?.[0]
        if (typeof item?.url === 'string') return { imageUrl: item.url, ...(typeof item.revised_prompt === 'string' ? { revisedPrompt: item.revised_prompt } : {}) }
        if (typeof item?.b64_json === 'string') return { imageUrl: `data:image/png;base64,${item.b64_json}`, ...(typeof item.revised_prompt === 'string' ? { revisedPrompt: item.revised_prompt } : {}) }
        throw new Error('No image URL or base64 image was returned.')
      } catch (error) { if (error instanceof CoverError) throw error; throw new CoverError('parse', error instanceof Error ? error.message : 'The image provider response was invalid.') }
    },
  }
}

function redact(message: string, secret: string): string { return secret ? message.split(secret).join('[redacted]') : message }
