import { describe, expect, it, vi } from 'vitest'
import { createCoverClient } from './coverClient'
import type { CoverProfile } from './coverConfig'

const profile: CoverProfile = { id: 'cover-1', name: '测试', provider: 'custom', endpoint: 'https://images.example.test/generate', model: 'cover-model', enabled: true }

describe('cover client', () => {
  it('refuses to send reference images without a dedicated image-edit adapter', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = createCoverClient(profile, 'secret', fetcher)

    await expect(client.generate({ prompt: '暖色杂志封面', size: '1024x1280', referenceImages: ['data:image/png;base64,abc'] })).rejects.toMatchObject({ kind: 'unsupported' })
    expect(fetcher).not.toHaveBeenCalled()
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

  it('blocks known provider-native profiles before sending an OpenAI Images request body', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const legacyProfile: CoverProfile = {
      ...profile,
      provider: 'dashscope-image',
      endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-to-image/image-synthesis',
    }

    const client = createCoverClient(legacyProfile, 'secret', fetcher)

    await expect(client.generate({ prompt: '封面', size: '1024x1024' })).rejects.toMatchObject({ kind: 'unsupported' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('parses base64 output and redacts network errors', async () => {
    const client = createCoverClient(profile, 'secret', async () => new Response(JSON.stringify({ data: [{ b64_json: 'abc123' }] }), { status: 200 }))
    await expect(client.generate({ prompt: '封面', size: '1024x1024' })).resolves.toMatchObject({ imageUrl: 'data:image/png;base64,abc123' })
    const failing = createCoverClient(profile, 'secret', async () => { throw new Error('secret network failure') })
    await expect(failing.generate({ prompt: '封面', size: '1024x1024' })).rejects.toThrow('[redacted] network failure')
  })
})

it('uses GPT Image output_format rather than the unsupported response_format field', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'abc' }] })))
  const client = createCoverClient({ ...profile, provider: 'openai-images', model: 'gpt-image-1' }, 'key', fetcher)
  await client.generate({ prompt: '封面', size: '1024x1536' })
  const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
  expect(payload).not.toHaveProperty('response_format')
  expect(payload.output_format).toBe('png')
})
