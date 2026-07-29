import { describe, expect, it } from 'vitest'
import {
  CONFIG_STORAGE_KEY,
  addLaunchEntry,
  createDefaultConfig,
  createShortcutExport,
  deleteLaunchEntry,
  editLaunchEntry,
  exportConfig,
  filterLaunchEntries,
  groupLaunchEntries,
  importConfig,
  isHttpUrl,
  loadConfig,
  reorderLaunchEntry,
  saveConfig,
  type CreatorDockConfig,
  type StorageAdapter,
} from './config'

const ids = (...values: string[]) => {
  let index = 0
  return () => values[index++] ?? `generated-${index}`
}

const emptyConfig = (): CreatorDockConfig => ({
  schemaVersion: 1,
  entries: [],
  theme: 'system',
  density: 'comfortable',
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
  it('creates a versioned configuration from every platform preset', () => {
    const config = createDefaultConfig(ids('one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'))

    expect(config).toMatchObject({ schemaVersion: 1, theme: 'system', density: 'comfortable' })
    expect(config.entries).toHaveLength(13)
    expect(config.entries[0]).toMatchObject({ id: 'one', displayName: 'Xiaohongshu', destinationUrl: 'https://creator.xiaohongshu.com/', group: 'social' })
  })

  it.each(['https://example.com', 'http://example.com/path'])('accepts %s', (url) => {
    expect(isHttpUrl(url)).toBe(true)
  })

  it.each(['ftp://example.com', 'file:///tmp/unsafe', 'javascript:alert(1)', 'not a url'])('rejects non-HTTP(S) URL %s', (url) => {
    expect(isHttpUrl(url)).toBe(false)
  })
})

describe('launch entry mutations', () => {
  it('adds duplicate-platform entries with distinct stable identifiers', () => {
    const original = emptyConfig()
    const first = addLaunchEntry(original, { displayName: 'WeChat A', destinationUrl: 'https://mp.weixin.qq.com/', group: 'social', platformPresetId: 'wechat-official-accounts' }, ids('first'))
    const second = addLaunchEntry(first, { displayName: 'WeChat B', destinationUrl: 'https://mp.weixin.qq.com/', group: 'social', platformPresetId: 'wechat-official-accounts' }, ids('second'))

    expect(second.entries.map((entry) => entry.id)).toEqual(['first', 'second'])
    expect(second.entries.map((entry) => entry.platformPresetId)).toEqual(['wechat-official-accounts', 'wechat-official-accounts'])
  })

  it('edits an entry without changing its identifier and rejects unsafe URLs', () => {
    const original = addLaunchEntry(emptyConfig(), { displayName: 'Old', destinationUrl: 'https://example.com', group: 'work' }, ids('entry-1'))
    const edited = editLaunchEntry(original, 'entry-1', { displayName: 'New', destinationUrl: 'https://example.org' })

    expect(edited.entries[0]).toMatchObject({ id: 'entry-1', displayName: 'New', destinationUrl: 'https://example.org' })
    expect(() => editLaunchEntry(edited, 'entry-1', { destinationUrl: 'file:///unsafe' })).toThrow('HTTP(S)')
  })

  it('deletes and reorders only the requested entries', () => {
    let config = emptyConfig()
    config = addLaunchEntry(config, { displayName: 'A', destinationUrl: 'https://a.example', group: 'one' }, ids('a'))
    config = addLaunchEntry(config, { displayName: 'B', destinationUrl: 'https://b.example', group: 'one' }, ids('b'))
    config = addLaunchEntry(config, { displayName: 'C', destinationUrl: 'https://c.example', group: 'two' }, ids('c'))

    expect(reorderLaunchEntry(config, 'c', 0).entries.map((entry) => entry.id)).toEqual(['c', 'a', 'b'])
    expect(deleteLaunchEntry(config, 'b').entries.map((entry) => entry.id)).toEqual(['a', 'c'])
  })
})

describe('search and group filtering', () => {
  it('filters case-insensitively and groups matching entries by group', () => {
    let config = emptyConfig()
    config = addLaunchEntry(config, { displayName: 'Video Studio', destinationUrl: 'https://video.example', group: 'Video' }, ids('video'))
    config = addLaunchEntry(config, { displayName: 'Writing Desk', destinationUrl: 'https://writing.example', group: 'Writing' }, ids('writing'))

    const matches = filterLaunchEntries(config.entries, 'studio', 'Video')
    expect(matches.map((entry) => entry.id)).toEqual(['video'])
    expect(groupLaunchEntries(config.entries)).toEqual({ Video: [config.entries[0]], Writing: [config.entries[1]] })
  })
})

describe('persistence, import and shortcut export', () => {
  it('saves and reloads a valid configuration through injected storage', () => {
    const storage = new MemoryStorage()
    const config = addLaunchEntry(emptyConfig(), { displayName: 'Docs', destinationUrl: 'https://docs.example', group: 'work' }, ids('docs'))

    saveConfig(storage, config)
    expect(storage.getItem(CONFIG_STORAGE_KEY)).toContain('docs.example')
    expect(loadConfig(storage)).toEqual({ config, recovered: false })
  })

  it('recovers from corrupt storage without overwriting the corrupt value', () => {
    const storage = new MemoryStorage()
    storage.setItem(CONFIG_STORAGE_KEY, '{bad json')

    const result = loadConfig(storage, ids('one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'))
    expect(result.recovered).toBe(true)
    expect(result.config.entries).toHaveLength(13)
    expect(storage.getItem(CONFIG_STORAGE_KEY)).toBe('{bad json')
  })

  it('exports and imports a valid configuration, while invalid imports retain the current configuration', () => {
    const current = addLaunchEntry(emptyConfig(), { displayName: 'Current', destinationUrl: 'https://current.example', group: 'work' }, ids('current'))
    const imported = importConfig(exportConfig(current), emptyConfig())
    const rejected = importConfig('{"schemaVersion":1,"theme":"system","density":"comfortable","entries":[{"id":"bad","displayName":"Bad","destinationUrl":"file:///unsafe","group":"work"}]}', current)

    expect(imported).toEqual({ config: current })
    expect(rejected).toMatchObject({ config: current, error: expect.stringMatching(/HTTP\(S\)|destination URL/i) })
  })

  it('migrates legacy entry arrays to schema version 1', () => {
    const legacy = JSON.stringify([{ id: 'legacy', displayName: 'Legacy', destinationUrl: 'https://legacy.example', group: 'old' }])

    expect(importConfig(legacy, emptyConfig())).toEqual({
      config: {
        schemaVersion: 1,
        entries: [{ id: 'legacy', displayName: 'Legacy', destinationUrl: 'https://legacy.example', group: 'old', browserTarget: 'default', createShortcut: false }],
        theme: 'system',
        density: 'comfortable',
      },
    })
  })

  it('creates a shortcut export containing only shortcut fields', () => {
    const config = addLaunchEntry(emptyConfig(), {
      displayName: 'Profiled', destinationUrl: 'https://profile.example', group: 'work', browserTarget: 'chrome', profileDirectoryName: 'Profile 2', createShortcut: true, platformPresetId: 'ignored',
    }, ids('profiled'))

    expect(createShortcutExport(config)).toEqual({
      schemaVersion: 1,
      shortcuts: [{ displayName: 'Profiled', destinationUrl: 'https://profile.example', browserTarget: 'chrome', profileDirectoryName: 'Profile 2', createShortcut: true }],
    })
  })
})
