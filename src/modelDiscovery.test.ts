import { describe, expect, it } from 'vitest'
import { discoverModels } from './modelDiscovery'

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('provider model discovery', () => {
  it('parses OpenAI-compatible model lists and sends the key only to the provider', async () => {
    let requestedUrl = ''
    let requestedHeaders: HeadersInit | undefined
    const models = await discoverModels({ provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'secret-key' }, async (input, init) => {
      requestedUrl = String(input)
      requestedHeaders = init?.headers
      return response({ data: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] })
    })

    expect(requestedUrl).toBe('https://api.deepseek.com/v1/models')
    expect(requestedHeaders).toMatchObject({ Authorization: 'Bearer secret-key' })
    expect(models.map((model) => model.id)).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro'])
  })

  it('uses Gemini models.list and filters models without generateContent', async () => {
    let requestedUrl = ''
    const models = await discoverModels({ provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'gemini-key' }, async (input) => {
      requestedUrl = String(input)
      return response({ models: [
        { name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', baseModelId: 'gemini-3.6-flash', supportedGenerationMethods: ['generateContent'], outputTokenLimit: 8192 },
        { name: 'models/text-embedding-005', displayName: 'Embedding', baseModelId: 'text-embedding-005', supportedGenerationMethods: ['embedContent'] },
      ] })
    })

    expect(requestedUrl).toBe('https://generativelanguage.googleapis.com/v1beta/models?key=gemini-key')
    expect(models).toEqual([{ id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', maxOutputTokens: 8192 }])
  })

  it('rejects unsafe endpoints and does not expose keys in errors', async () => {
    await expect(discoverModels({ provider: 'deepseek', baseUrl: 'javascript:alert(1)', apiKey: 'secret-key' }, async () => response({}))).rejects.toThrow('HTTP(S)')
    await expect(discoverModels({ provider: 'deepseek', baseUrl: 'https://user:pass@api.example.com/v1', apiKey: 'secret-key' }, async () => response({}))).rejects.toThrow('不能包含账号或密码')
    await expect(discoverModels({ provider: 'deepseek', baseUrl: 'https://api.example.com/v1', apiKey: 'secret-key' }, async () => response({}, 401))).rejects.toThrow(/HTTP 401/)
  })
})
