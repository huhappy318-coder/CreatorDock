import { describe, expect, it } from 'vitest'
import {
  CONFIG_STORAGE_KEY,
  addLaunchEntry,
  createDefaultConfig,
  createShortcutExport,
  deleteLaunchEntry,
  duplicateLaunchEntry,
  editLaunchEntry,
  exportConfig,
  filterLaunchEntries,
  importConfig,
  isHttpUrl,
  loadConfig,
  reorderLaunchEntry,
  saveConfig,
  suggestDuplicateDisplayName,
  type CreatorDockConfig,
  type StorageAdapter,
} from './config'

const ids = (...values: string[]) => {
  let index = 0
  return () => values[index++] ?? `generated-${index}`
}

const emptyConfig = (): CreatorDockConfig => ({
  schemaVersion: 2,
  entries: [],
  theme: 'system',
  density: 'comfortable',
  language: 'zh-CN',
})

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('default configuration and URL validation', () => {
  it('creates schema v2 with exactly seven focused first-launch entries', () => {
    const config = createDefaultConfig(ids('xiaohongshu', 'wechat', 'bilibili', 'douyin', 'x', 'wechat-one', 'wechat-two'))

    expect(config).toMatchObject({ schemaVersion: 2, theme: 'system', density: 'comfortable', language: 'zh-CN' })
    expect(config.entries).toHaveLength(7)
    expect(config.entries.map((entry) => entry.platformPresetId)).toEqual([
      'xiaohongshu',
      'wechat-official-accounts',
      'bilibili',
      'douyin',
      'x-twitter',
      'wechat-official-accounts',
      'wechat-official-accounts',
    ])
    expect(config.entries[0]).toMatchObject({ id: 'xiaohongshu', displayName: '小红书', destinationUrl: 'https://creator.xiaohongshu.com/' })
    expect(config.entries[0]).not.toHaveProperty('group')
    expect(config.entries.slice(5, 7)).toMatchObject([
      { id: 'wechat-one', displayName: '公众号·账号一', browserTarget: 'chrome', profileDirectoryName: 'Default', createShortcut: true },
      { id: 'wechat-two', displayName: '公众号·账号二', browserTarget: 'edge', profileDirectoryName: 'Default', createShortcut: true },
    ])
  })

  it.each(['https://example.com', 'http://example.com/path'])('accepts %s', (url) => {
    expect(isHttpUrl(url)).toBe(true)
  })

  it.each(['ftp://example.com', 'file:///tmp/unsafe', 'javascript:alert(1)', 'not a url', 'https://demo-user:demo-pass@example.com/'])('rejects non-HTTP(S) URL %s', (url) => {
    expect(isHttpUrl(url)).toBe(false)
  })
})

describe('launch entry mutations', () => {
  it('adds duplicate-platform entries with distinct stable identifiers', () => {
    const original = emptyConfig()
    const first = addLaunchEntry(original, { displayName: 'WeChat A', destinationUrl: 'https://mp.weixin.qq.com/', platformPresetId: 'wechat-official-accounts' }, ids('first'))
    const second = addLaunchEntry(first, { displayName: 'WeChat B', destinationUrl: 'https://mp.weixin.qq.com/', platformPresetId: 'wechat-official-accounts' }, ids('second'))

    expect(second.entries.map((entry) => entry.id)).toEqual(['first', 'second'])
    expect(second.entries.map((entry) => entry.platformPresetId)).toEqual(['wechat-official-accounts', 'wechat-official-accounts'])
  })

  it('rejects an injected identifier that collides with an existing entry', () => {
    const current = addLaunchEntry(emptyConfig(), { displayName: 'First', destinationUrl: 'https://first.example' }, ids('entry-1'))

    expect(() => addLaunchEntry(current, { displayName: 'Second', destinationUrl: 'https://second.example' }, ids('entry-1'))).toThrow('identifiers must be unique')
  })

  it('edits an entry without changing its identifier and rejects unsafe URLs', () => {
    const original = addLaunchEntry(emptyConfig(), { displayName: 'Old', destinationUrl: 'https://example.com' }, ids('entry-1'))
    const edited = editLaunchEntry(original, 'entry-1', { displayName: 'New', destinationUrl: 'https://example.org' })

    expect(edited.entries[0]).toMatchObject({ id: 'entry-1', displayName: 'New', destinationUrl: 'https://example.org' })
    expect(() => editLaunchEntry(edited, 'entry-1', { destinationUrl: 'file:///unsafe' })).toThrow('HTTP(S)')
  })

  it('creates a fresh editable duplicate without carrying a hidden legacy browser profile', () => {
    const original = addLaunchEntry(emptyConfig(), {
      displayName: '公众号·账号一',
      destinationUrl: 'https://mp.weixin.qq.com/',
      browserTarget: 'chrome',
      profileDirectoryName: 'Profile 2',
      createShortcut: true,
      platformPresetId: 'wechat-official-accounts',
    }, ids('original'))
    const copyName = suggestDuplicateDisplayName(original, 'original', '副本')
    const duplicated = duplicateLaunchEntry(original, 'original', {
      displayName: copyName,
      destinationUrl: 'https://mp.weixin.qq.com/',
      browserTarget: 'edge',
      createShortcut: true,
      platformPresetId: 'wechat-official-accounts',
    }, ids('copy'))

    expect(copyName).toBe('公众号·账号一 副本')
    expect(duplicated.entries).toMatchObject([
      { id: 'original', displayName: '公众号·账号一', profileDirectoryName: 'Profile 2' },
      { id: 'copy', displayName: '公众号·账号一 副本', browserTarget: 'edge', createShortcut: true },
    ])
    expect(duplicated.entries[1]).not.toHaveProperty('profileDirectoryName')
  })

  it('deletes and reorders only the requested entries', () => {
    let config = emptyConfig()
    config = addLaunchEntry(config, { displayName: 'A', destinationUrl: 'https://a.example' }, ids('a'))
    config = addLaunchEntry(config, { displayName: 'B', destinationUrl: 'https://b.example' }, ids('b'))
    config = addLaunchEntry(config, { displayName: 'C', destinationUrl: 'https://c.example' }, ids('c'))

    expect(reorderLaunchEntry(config, 'c', 0).entries.map((entry) => entry.id)).toEqual(['c', 'a', 'b'])
    expect(deleteLaunchEntry(config, 'b').entries.map((entry) => entry.id)).toEqual(['a', 'c'])
  })
})

describe('search filtering', () => {
  it('filters case-insensitively without category state', () => {
    let config = emptyConfig()
    config = addLaunchEntry(config, { displayName: 'Video Studio', destinationUrl: 'https://video.example' }, ids('video'))
    config = addLaunchEntry(config, { displayName: 'Writing Desk', destinationUrl: 'https://writing.example' }, ids('writing'))

    const matches = filterLaunchEntries(config.entries, 'studio')
    expect(matches.map((entry) => entry.id)).toEqual(['video'])
  })

  it('finds a preset entry by platform name when its account label is different', () => {
    const config = addLaunchEntry(emptyConfig(), {
      displayName: 'Newsletter account',
      destinationUrl: 'https://mp.weixin.qq.com/',
      platformPresetId: 'wechat-official-accounts',
    }, ids('wechat-client'))

    expect(filterLaunchEntries(config.entries, 'WeChat Official Accounts')).toEqual(config.entries)
    expect(filterLaunchEntries(config.entries, '微信公众号')).toEqual(config.entries)
  })
})

describe('persistence, import and shortcut export', () => {
  it('migrates schema v1 entries by dropping groups while preserving browser profiles', () => {
    const current = createDefaultConfig()
    const legacy = JSON.stringify({
      schemaVersion: 1,
      entries: [{
        id: 'legacy-profile',
        displayName: 'Legacy account',
        destinationUrl: 'https://legacy.example',
        group: 'Writing',
        browserTarget: 'chrome',
        profileDirectoryName: 'Profile 2',
        createShortcut: true,
      }],
      theme: 'dark',
      density: 'compact',
      language: 'en',
    })

    const result = importConfig(legacy, current)
    expect(result.error).toBeUndefined()
    expect(result.config).toEqual({
      schemaVersion: 2,
      entries: [{
        id: 'legacy-profile',
        displayName: 'Legacy account',
        destinationUrl: 'https://legacy.example',
        browserTarget: 'chrome',
        profileDirectoryName: 'Profile 2',
        createShortcut: true,
      }],
      theme: 'dark',
      density: 'compact',
      language: 'en',
    })
  })

  it('translates legacy built-in platform labels to Chinese without changing account aliases', () => {
    const current = createDefaultConfig()
    const legacy = JSON.stringify({
      schemaVersion: 2,
      entries: [
        { id: 'zhihu', displayName: 'Zhihu', destinationUrl: 'https://www.zhihu.com/creator', platformPresetId: 'zhihu' },
        { id: 'custom', displayName: '我的知乎账号', destinationUrl: 'https://www.zhihu.com/creator', platformPresetId: 'zhihu' },
        { id: 'juejin', displayName: 'Juejin', destinationUrl: 'https://juejin.cn/editor/drafts/new?v=2', platformPresetId: 'juejin' },
      ],
      theme: 'system', density: 'comfortable', language: 'zh-CN',
    })

    expect(importConfig(legacy, current).config.entries.map((entry) => entry.displayName)).toEqual(['知乎', '我的知乎账号', '掘金'])
  })

  it('saves and reloads a valid configuration through injected storage', () => {
    const storage = new MemoryStorage()
    const config = addLaunchEntry(emptyConfig(), { displayName: 'Docs', destinationUrl: 'https://docs.example' }, ids('docs'))

    saveConfig(storage, config)
    expect(storage.getItem(CONFIG_STORAGE_KEY)).toContain('docs.example')
    expect(loadConfig(storage)).toEqual({ config, recovered: false })
  })

  it('recovers from corrupt storage without overwriting the corrupt value', () => {
    const storage = new MemoryStorage()
    storage.setItem(CONFIG_STORAGE_KEY, '{bad json')

    const result = loadConfig(storage, ids('one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'))
    expect(result.recovered).toBe(true)
    expect(result.config.entries).toHaveLength(7)
    expect(storage.getItem(CONFIG_STORAGE_KEY)).toBe('{bad json')
  })

  it('exports and imports a valid configuration, while invalid imports retain the current configuration', () => {
    const current = addLaunchEntry(emptyConfig(), { displayName: 'Current', destinationUrl: 'https://current.example' }, ids('current'))
    const imported = importConfig(exportConfig(current), emptyConfig())
    const rejected = importConfig('{"schemaVersion":1,"theme":"system","density":"comfortable","entries":[{"id":"bad","displayName":"Bad","destinationUrl":"file:///unsafe","group":"work"}]}', current)

    expect(imported).toEqual({ config: current })
    expect(rejected).toMatchObject({ config: current, error: expect.stringMatching(/HTTP\(S\)|destination URL/i) })
  })

  it('rejects credential-bearing URLs before they can be added, imported, saved, or shortcut-exported', () => {
    const credentialUrl = 'https://demo-user:demo-pass@example.com/'
    const current = addLaunchEntry(emptyConfig(), { displayName: 'Current', destinationUrl: 'https://current.example' }, ids('current'))
    const unsafeConfig: CreatorDockConfig = {
      ...current,
      entries: [{ ...current.entries[0], destinationUrl: credentialUrl }],
    }
    const storage = new MemoryStorage()

    expect(() => addLaunchEntry(current, { displayName: 'Unsafe', destinationUrl: credentialUrl }, ids('unsafe'))).toThrow('HTTP(S)')
    expect(importConfig(JSON.stringify(unsafeConfig), current)).toMatchObject({ config: current, error: expect.stringMatching(/HTTP\(S\)|destination URL/i) })
    expect(() => saveConfig(storage, unsafeConfig)).toThrow('HTTP(S)')
    expect(() => createShortcutExport(unsafeConfig)).toThrow('HTTP(S)')
  })

  it('migrates legacy entry arrays to schema version 2', () => {
    const legacy = JSON.stringify([{ id: 'legacy', displayName: 'Legacy', destinationUrl: 'https://legacy.example', group: 'old' }])

    expect(importConfig(legacy, emptyConfig())).toEqual({
      config: {
        schemaVersion: 2,
        entries: [{ id: 'legacy', displayName: 'Legacy', destinationUrl: 'https://legacy.example', browserTarget: 'default', createShortcut: false }],
        theme: 'system',
        density: 'comfortable',
        language: 'zh-CN',
      },
    })
  })

  it('migrates versioned configurations without a language field to Chinese', () => {
    const legacy = JSON.stringify({
      schemaVersion: 1,
      entries: [],
      theme: 'system',
      density: 'comfortable',
    })

    expect(importConfig(legacy, emptyConfig())).toEqual({ config: emptyConfig() })
  })

  it('creates a shortcut export containing only shortcut fields', () => {
    const config = addLaunchEntry(emptyConfig(), {
      displayName: 'Profiled', destinationUrl: 'https://profile.example', browserTarget: 'chrome', profileDirectoryName: 'Profile 2', createShortcut: true, platformPresetId: 'ignored',
    }, ids('profiled'))

    expect(createShortcutExport(config)).toEqual({
      schemaVersion: 1,
      shortcuts: [{ displayName: 'Profiled', destinationUrl: 'https://profile.example', browserTarget: 'chrome', profileDirectoryName: 'Profile 2', createShortcut: true }],
    })
  })
})
