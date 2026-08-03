import { describe, expect, it } from 'vitest'
import { createCoverClient } from './coverClient'
import type { CoverProfile } from './coverConfig'

const profile: CoverProfile = { id: 'cover-1', name: '测试', provider: 'custom', endpoint: 'https://images.example.test/generate', model: 'cover-model', enabled: true }

describe('cover client', () => {
  it('sends a compatible image request with optional references and parses a URL', async () => {
    let init: RequestInit | undefined
    const client = createCoverClient(profile, 'secret', async (_url, request) => { init = request; return new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.test/cover.png' }] }), { status: 200 }) })
    const result = await client.generate({ prompt: '暖色杂志封面', size: '1024x1280', referenceImages: ['data:image/png;base64,abc'] })
    expect(result.imageUrl).toBe('https://cdn.example.test/cover.png')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' })
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'cover-model', size: '1024x1280', reference_images: ['data:image/png;base64,abc'] })
  })

  it('folds negative prompts into the standard prompt instead of inventing a provider field', async () => {
    let body: Record<string, unknown> = {}
    const client = createCoverClient(profile, 'secret', async (_url, request) => {
      body = JSON.parse(String(request?.body))
      return new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.test/cover.png' }] }), { status: 200 })
    })

    await client.generate({ prompt: '暖色杂志封面', negativePrompt: '模糊文字、畸形手指', size: '1024x1280' } as Parameters<typeof client.generate>[0])

    expect(body.prompt).toBe('暖色杂志封面\n\n避免出现：模糊文字、畸形手指')
    expect(body).not.toHaveProperty('negative_prompt')
  })

  it('parses base64 output and redacts network errors', async () => {
    const client = createCoverClient(profile, 'secret', async () => new Response(JSON.stringify({ data: [{ b64_json: 'abc123' }] }), { status: 200 }))
    await expect(client.generate({ prompt: '封面', size: '1024x1024' })).resolves.toMatchObject({ imageUrl: 'data:image/png;base64,abc123' })
    const failing = createCoverClient(profile, 'secret', async () => { throw new Error('secret network failure') })
    await expect(failing.generate({ prompt: '封面', size: '1024x1024' })).rejects.toThrow('[redacted] network failure')
  })
})
