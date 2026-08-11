import { beforeEach, describe, expect, it } from 'vitest'
import {
  AI_CONFIG_STORAGE_KEY,
  addModelProfile,
  addStylePreset,
  createDefaultAiConfig,
  exportAiConfig,
  importAiConfig,
  loadAiConfig,
  MODEL_PRESETS,
  modelInputFromPreset,
  PROVIDER_OPTIONS,
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

  it('rejects credential-bearing model endpoints when saving and importing', async () => {
    await expect(addModelProfile(createDefaultAiConfig(), { ...openAiInput, baseUrl: 'https://user:pass@api.example.test/v1' }, 'passphrase')).rejects.toThrow(/HTTP|URL/i)
    const current = createDefaultAiConfig()
    const result = importAiConfig(JSON.stringify({ schemaVersion: 1, models: [{ id: 'm', name: 'Unsafe', provider: 'openai-compatible', baseUrl: 'https://user:pass@api.example.test/v1', model: 'x', streaming: false, imageGeneration: false, enabled: true }], styles: [], humanization: current.humanization }), current)
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

  it('offers China-focused providers with safe default HTTPS endpoints', async () => {
    let config = createDefaultAiConfig()
    for (const option of PROVIDER_OPTIONS.filter((item) => item.region === 'china')) {
      config = await addModelProfile(config, {
        ...openAiInput,
        name: option.label,
        provider: option.id,
        baseUrl: undefined,
        model: `${option.id}-model`,
      }, 'passphrase')
    }
    expect(config.models).toHaveLength(PROVIDER_OPTIONS.filter((item) => item.region === 'china').length)
    expect(config.models.every((model) => model.baseUrl.startsWith('https://'))).toBe(true)
  })

  it('provides Chinese model presets that fill technical fields automatically', () => {
    expect(MODEL_PRESETS.length).toBeGreaterThan(3)
    const input = modelInputFromPreset(MODEL_PRESETS[0], 'sk-user-supplied')
    expect(input).toMatchObject({ name: 'DeepSeek V4 Flash（快速）', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash', temperature: 0.7, maxTokens: 8192, streaming: true })
    expect(input.apiKey).toBe('sk-user-supplied')
  })

  it('keeps the curated global model list on current model identifiers', () => {
    const presetModels = MODEL_PRESETS.map((preset) => preset.model)
    expect(presetModels).toContain('gpt-5.6-sol')
    expect(presetModels).toContain('gpt-5.6-terra')
    expect(presetModels).toContain('gpt-5.6-luna')
    expect(presetModels).toContain('kimi-k2.6')
    expect(presetModels).toContain('claude-sonnet-5')
    expect(presetModels).toContain('claude-haiku-4-5-20251001')
    expect(presetModels).toContain('gemini-3.5-flash-lite')
    expect(presetModels).not.toContain('gpt-5.2')
    expect(presetModels).not.toContain('kimi-k2.5')
    expect(presetModels).not.toContain('claude-sonnet-4-0')
  })

  it('leaves provider-managed sampling unset for models that reject arbitrary temperature values', () => {
    const temperatureManagedByProvider = MODEL_PRESETS.filter((preset) => ['gemini', 'moonshot', 'anthropic'].includes(preset.provider))
    expect(temperatureManagedByProvider).not.toHaveLength(0)
    expect(temperatureManagedByProvider.every((preset) => preset.temperature === undefined)).toBe(true)
    expect(modelInputFromPreset(temperatureManagedByProvider[0], 'key')).not.toHaveProperty('temperature')
  })

  it('removes legacy temperature values for providers that manage sampling themselves', async () => {
    const gemini = MODEL_PRESETS.find((preset) => preset.provider === 'gemini')!
    const added = await addModelProfile(
      createDefaultAiConfig(),
      { ...modelInputFromPreset(gemini, 'AIza-test'), temperature: 0.7 },
      'passphrase',
    )
    expect(added.models[0]).not.toHaveProperty('temperature')

    const current = createDefaultAiConfig()
    currentStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      models: [{
        id: 'legacy-kimi',
        name: 'Kimi legacy',
        provider: 'moonshot',
        baseUrl: 'https://api.moonshot.cn/v1',
        model: 'kimi-k2.6',
        temperature: 0.7,
        maxTokens: 8192,
        streaming: true,
        imageGeneration: false,
        enabled: true,
      }],
      styles: [],
      humanization: current.humanization,
    }))
    expect(loadAiConfig(currentStorage).config.models[0]).not.toHaveProperty('temperature')
  })

  it('repairs the legacy placeholder DeepSeek profile when loading saved config', () => {
    const current = createDefaultAiConfig()
    const result = importAiConfig(JSON.stringify({
      schemaVersion: 1,
      models: [{ id: 'legacy', name: '1', provider: 'deepseek', baseUrl: 'https://platform.deepseek.com/v4', model: 'deepseek-v4', streaming: true, imageGeneration: false, enabled: true }],
      styles: [], humanization: current.humanization,
    }), current)
    expect(result.config.models[0]).toMatchObject({ name: 'DeepSeek V4 Flash（快速）', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash', temperature: 0.7, maxTokens: 8192 })
  })
})
