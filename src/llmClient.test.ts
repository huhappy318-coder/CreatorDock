import { describe, expect, it, vi } from 'vitest'
import { createLLMClient, type LLMRequest } from './llmClient'
import { DEFAULT_HUMANIZATION_RULES } from './stylePrompt'

const request: LLMRequest = {
  task: '写一句介绍',
  style: { id: 's', name: '口语', description: '短句', samples: [], isDefault: true },
  humanization: DEFAULT_HUMANIZATION_RULES,
}

describe('unified LLM client', () => {
  it('sends OpenAI-compatible requests with the assembled system prompt and bearer key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '好的' } }] }), { status: 200 }))
    const client = createLLMClient({ id: 'm', name: 'OpenAI', provider: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'gpt-test', streaming: false, imageGeneration: false, enabled: true }, 'sk-test', fetcher)
    await expect(client.generateText(request)).resolves.toBe('好的')
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.example.test/v1/chat/completions')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect(JSON.parse(String(init?.body)).messages[0].role).toBe('system')
  })

  it('supports streaming OpenAI-compatible SSE chunks', async () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    const client = createLLMClient({ id: 'm', name: 'Stream', provider: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'gpt-test', streaming: true, imageGeneration: false, enabled: true }, 'sk-test', fetcher)
    const chunks: string[] = []
    for await (const chunk of client.streamText(request)) chunks.push(chunk)
    expect(chunks.join('')).toBe('你好世界')
  })

  it('normalizes HTTP failures without exposing the API key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('provider failed', { status: 401, statusText: 'Unauthorized' }))
    const client = createLLMClient({ id: 'm', name: 'Fail', provider: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'gpt-test', streaming: false, imageGeneration: false, enabled: true }, 'sk-secret', fetcher)
    await expect(client.generateText(request)).rejects.toMatchObject({ kind: 'http', status: 401 })
    await expect(client.generateText(request)).rejects.not.toThrow('sk-secret')
  })

  it('uses provider-native request envelopes for Gemini and Anthropic', async () => {
    const geminiFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini' }] } }] }), { status: 200 }))
    const gemini = createLLMClient({ id: 'g', name: 'Gemini', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-test', streaming: false, imageGeneration: false, enabled: true }, 'AIza-test', geminiFetch)
    await expect(gemini.generateText(request)).resolves.toBe('Gemini')
    expect(geminiFetch.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=AIza-test')
    expect(JSON.parse(String(geminiFetch.mock.calls[0][1]?.body)).contents[0].role).toBe('user')

    const anthropicFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Claude' }] }), { status: 200 }))
    const anthropic = createLLMClient({ id: 'a', name: 'Claude', provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-test', streaming: false, imageGeneration: false, enabled: true }, 'sk-ant-test', anthropicFetch)
    await expect(anthropic.generateText(request)).resolves.toBe('Claude')
    expect(anthropicFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
    expect((anthropicFetch.mock.calls[0][1]?.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-test')
  })

  it('redacts a key if a network error includes the request URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('fetch failed for https://api.example.test/?key=sk-secret'))
    const client = createLLMClient({ id: 'm', name: 'Network', provider: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'gpt-test', streaming: false, imageGeneration: false, enabled: true }, 'sk-secret', fetcher)
    await expect(client.generateText(request)).rejects.toMatchObject({ kind: 'network', message: expect.not.stringContaining('sk-secret') })
  })
})

describe('provider response edge cases', () => {
  const profile = { id: 'm', name: 'Test', provider: 'openai-compatible' as const, baseUrl: 'https://api.example.test/v1', model: 'test', streaming: true, imageGeneration: false, enabled: true }

  it('retains the last streaming event when the connection ends without a newline', async () => {
    const client = createLLMClient(profile, 'test', async () => new Response('data: {"choices":[{"delta":{"content":"最后一句"}}]}'))
    let output = ''
    for await (const chunk of client.streamText(request)) output += chunk
    expect(output).toBe('最后一句')
  })

  it('rejects provider error events instead of reporting an empty success', async () => {
    const client = createLLMClient(profile, 'test', async () => new Response('data: {"error":{"message":"quota exceeded"}}\n\n'))
    await expect((async () => { for await (const _ of client.streamText(request)) { /* Consume response. */ } })()).rejects.toThrow()
  })

  it('rejects a successful HTTP response with no generated text', async () => {
    const client = createLLMClient(profile, 'test', async () => new Response('{"choices":[]}'))
    await expect(client.generateText(request)).rejects.toThrow()
  })
})

it('forwards cancellation to the active HTTP request', async () => {
  const controller = new AbortController()
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true })
  }))
  const client = createLLMClient({ id: 'm', name: 'Test', provider: 'openai-compatible', baseUrl: 'https://example.test/v1', model: 'test', streaming: false, imageGeneration: false, enabled: true }, 'key', fetcher)
  const response = client.generateText({ ...request, signal: controller.signal })
  controller.abort()
  await expect(response).rejects.toThrow('Stopped')
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
})
