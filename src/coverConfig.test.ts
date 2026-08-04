import { describe, expect, it } from 'vitest'
import { addCoverProfile, createDefaultCoverConfig, loadCoverConfig, saveCoverConfig, unlockCoverApiKey, updateCoverProfile, COVER_PROVIDER_OPTIONS } from './coverConfig'

const storage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

describe('cover configuration', () => {
  it('uses HTTPS-only provider endpoints and round-trips encrypted keys', async () => {
    const config = createDefaultCoverConfig()
    const next = await addCoverProfile(config, { name: '本机封面', provider: 'openai-images', model: 'gpt-image-1', apiKey: 'img-secret' }, 'passphrase')
    expect(next.profiles[0].endpoint).toBe(COVER_PROVIDER_OPTIONS[0].endpoint)
    expect(next.profiles[0].encryptedApiKey).toBeDefined()
    const saved = storage()
    saveCoverConfig(saved, next)
    const loaded = loadCoverConfig(saved)
    expect(await unlockCoverApiKey(loaded.config.profiles[0], 'passphrase')).toBe('img-secret')
    expect(JSON.stringify(loaded.config)).not.toContain('img-secret')
  })

  it('rejects missing or non-HTTPS custom endpoints and preserves keys on edit', async () => {
    await expect(addCoverProfile(createDefaultCoverConfig(), { name: '自定义', provider: 'custom', endpoint: '', model: 'img', apiKey: 'x' }, 'p')).rejects.toThrow(/HTTPS/)
    const config = await addCoverProfile(createDefaultCoverConfig(), { name: '自定义', provider: 'custom', endpoint: 'https://images.example.test/generate', model: 'img', apiKey: 'x' }, 'p')
    const edited = await updateCoverProfile(config, config.profiles[0].id, { name: '改名', apiKey: '' }, 'p')
    expect(edited.profiles[0].name).toBe('改名')
    expect(edited.profiles[0].encryptedApiKey).toEqual(config.profiles[0].encryptedApiKey)
  })

  it('rejects credential-bearing cover endpoints', async () => {
    await expect(addCoverProfile(createDefaultCoverConfig(), { name: '不安全', provider: 'custom', endpoint: 'https://user:pass@images.example.test/generate', model: 'img', apiKey: 'x' }, 'p')).rejects.toThrow(/HTTPS/)
    const saved = storage()
    saved.setItem('creatordock.cover.v1', JSON.stringify({ schemaVersion: 1, profiles: [{ id: 'unsafe', name: '不安全', provider: 'custom', endpoint: 'https://user:pass@images.example.test/generate', model: 'img', enabled: true }] }))
    expect(loadCoverConfig(saved)).toMatchObject({ recovered: true, config: { profiles: [] } })
  })
})
