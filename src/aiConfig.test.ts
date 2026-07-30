import { beforeEach, describe, expect, it } from 'vitest'
import {
  AI_CONFIG_STORAGE_KEY,
  addModelProfile,
  addStylePreset,
  createDefaultAiConfig,
  exportAiConfig,
  importAiConfig,
  loadAiConfig,
  unlockModelApiKey,
  updateHumanizationRules,
  type AiConfig,
  type ModelProfileInput,
} from './aiConfig'

const openAiInput: ModelProfileInput = {
  name: 'Local DeepSeek',
  provider: 'openai-compatible',
  baseUrl: 'https://api.example.test/v1',
  model: 'deepseek-chat',
  apiKey: 'sk-test-only',
  streaming: true,
  imageGeneration: false,
}

function storage(): Storage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}

describe('encrypted AI configuration', () => {
  let currentStorage: Storage

  beforeEach(() => {
    currentStorage = storage()
  })

  it('creates an empty versioned configuration without provider credentials', () => {
    const config = createDefaultAiConfig()
    expect(config.schemaVersion).toBe(1)
    expect(config.models).toEqual([])
    expect(config.styles).toEqual([])
    expect(JSON.stringify(config)).not.toContain('sk-')
  })

  it('encrypts a model key, unlocks it with the passphrase, and rejects a wrong passphrase', async () => {
    const config = await addModelProfile(createDefaultAiConfig(), openAiInput, 'correct horse')
    expect(JSON.stringify(config)).not.toContain('sk-test-only')
    expect(config.models[0].encryptedApiKey).toBeTruthy()
    await expect(unlockModelApiKey(config.models[0], 'correct horse')).resolves.toBe('sk-test-only')
    await expect(unlockModelApiKey(config.models[0], 'wrong horse')).rejects.toThrow()
  })

  it('persists encrypted config and exports metadata without ciphertext or key material', async () => {
    const config = await addModelProfile(createDefaultAiConfig(), openAiInput, 'passphrase')
    currentStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config))
    const loaded = loadAiConfig(currentStorage)
    expect(loaded.config.models).toHaveLength(1)
    const exported = exportAiConfig(config)
    expect(exported).not.toContain('sk-test-only')
    expect(exported).not.toContain('encryptedApiKey')
    expect(exported).toContain('Local DeepSeek')
  })

  it('rejects invalid imports without replacing the current valid configuration', async () => {
    const current = await addModelProfile(createDefaultAiConfig(), openAiInput, 'passphrase')
    const result = importAiConfig('{"schemaVersion":999}', current)
    expect(result.config).toEqual(current)
    expect(result.error).toMatch(/schema/i)
  })

  it('rejects imported model URLs outside HTTP(S)', () => {
    const current = createDefaultAiConfig()
    const result = importAiConfig(JSON.stringify({ schemaVersion: 1, models: [{ id: 'm', name: 'Unsafe', provider: 'openai-compatible', baseUrl: 'javascript:alert(1)', model: 'x', streaming: false, imageGeneration: false, enabled: true }], styles: [], humanization: current.humanization }), current)
    expect(result.config).toEqual(current)
    expect(result.error).toMatch(/URL|invalid/i)
  })

  it('supports multiple model profiles and style presets with one default each', async () => {
    let config = await addModelProfile(createDefaultAiConfig(), openAiInput, 'passphrase')
    config = await addModelProfile(config, { ...openAiInput, name: 'Gemini', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', apiKey: 'AIza-test' }, 'passphrase')
    config = addStylePreset(config, { name: '公众号风格', description: '口语化、具体、短句', samples: [] })
    config = addStylePreset(config, { name: '小红书风格', description: '轻快、有画面', samples: [] })
    config = updateHumanizationRules(config, { forbiddenWords: ['首先', '综上'], requiredHabits: ['多写具体细节'] })
    expect(config.models).toHaveLength(2)
    expect(config.styles.filter((style) => style.isDefault)).toHaveLength(1)
    expect(config.humanization.forbiddenWords).toContain('首先')
  })
})
