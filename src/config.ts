import { platformPresets, type PlatformPreset } from './catalog'
import { DEFAULT_LANGUAGE, platformLabel, platformSearchLabels, type LanguageSetting } from './i18n'

export type { PlatformPreset } from './catalog'

export const CONFIG_SCHEMA_VERSION = 2 as const
export const SHORTCUT_SCHEMA_VERSION = 1 as const
export const CONFIG_STORAGE_KEY = 'creatordock.config'

export type BrowserTarget = 'default' | 'chrome' | 'edge'
export type ThemeSetting = 'light' | 'dark' | 'system'
export type DensitySetting = 'comfortable' | 'compact'
export type { LanguageSetting } from './i18n'

export interface LaunchEntry {
  id: string
  displayName: string
  destinationUrl: string
  browserTarget: BrowserTarget
  profileDirectoryName?: string
  createShortcut: boolean
  platformPresetId?: PlatformPreset['id']
}

export interface CreatorDockConfig {
  schemaVersion: typeof CONFIG_SCHEMA_VERSION
  entries: LaunchEntry[]
  theme: ThemeSetting
  density: DensitySetting
  language: LanguageSetting
}

export interface ShortcutExport {
  schemaVersion: typeof SHORTCUT_SCHEMA_VERSION
  shortcuts: Array<Pick<LaunchEntry, 'displayName' | 'destinationUrl' | 'browserTarget' | 'profileDirectoryName' | 'createShortcut'>>
}

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface NewLaunchEntry {
  displayName: string
  destinationUrl: string
  browserTarget?: BrowserTarget
  profileDirectoryName?: string
  createShortcut?: boolean
  platformPresetId?: PlatformPreset['id']
}

export type IdFactory = () => string

const createId = (): string => globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && !url.username
      && !url.password
  } catch {
    return false
  }
}

export function createDefaultConfig(idFactory: IdFactory = createId): CreatorDockConfig {
  const preset = (id: PlatformPreset['id']): PlatformPreset => {
    const found = platformPresets.find((candidate) => candidate.id === id)
    if (!found) throw new Error(`Default platform preset "${id}" is missing.`)
    return found
  }
  const makeEntry = (platformPresetId: string, displayName?: string, shortcut?: Pick<LaunchEntry, 'browserTarget' | 'profileDirectoryName' | 'createShortcut'>): LaunchEntry => {
    const platform = preset(platformPresetId)
    return {
      id: idFactory(),
      displayName: displayName ?? platformLabel(platform.id, DEFAULT_LANGUAGE, platform.name),
      destinationUrl: platform.url,
      browserTarget: shortcut?.browserTarget ?? 'default',
      ...(shortcut?.profileDirectoryName ? { profileDirectoryName: shortcut.profileDirectoryName } : {}),
      createShortcut: shortcut?.createShortcut ?? false,
      platformPresetId: platform.id,
    }
  }

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    entries: [
      makeEntry('xiaohongshu'),
      makeEntry('wechat-official-accounts'),
      makeEntry('bilibili'),
      makeEntry('douyin'),
      makeEntry('x-twitter'),
      makeEntry('wechat-official-accounts', '公众号·账号一', { browserTarget: 'chrome', profileDirectoryName: 'Default', createShortcut: true }),
      makeEntry('wechat-official-accounts', '公众号·账号二', { browserTarget: 'edge', profileDirectoryName: 'Default', createShortcut: true }),
    ],
    theme: 'system',
    density: 'comfortable',
    language: DEFAULT_LANGUAGE,
  }
}

export function addLaunchEntry(config: CreatorDockConfig, entry: NewLaunchEntry, idFactory: IdFactory = createId): CreatorDockConfig {
  const normalized = normalizeNewEntry(entry)
  const id = idFactory()
  if (config.entries.some((existingEntry) => existingEntry.id === id)) throw new Error('Launch entry identifiers must be unique.')
  return { ...config, entries: [...config.entries, { ...normalized, id }] }
}

export function editLaunchEntry(config: CreatorDockConfig, id: string, changes: Partial<NewLaunchEntry>): CreatorDockConfig {
  const entry = config.entries.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`Launch entry "${id}" does not exist.`)

  const updated = normalizeNewEntry({ ...entry, ...changes })
  return { ...config, entries: config.entries.map((candidate) => candidate.id === id ? { ...updated, id } : candidate) }
}

export function deleteLaunchEntry(config: CreatorDockConfig, id: string): CreatorDockConfig {
  return { ...config, entries: config.entries.filter((entry) => entry.id !== id) }
}

export function reorderLaunchEntry(config: CreatorDockConfig, id: string, destinationIndex: number): CreatorDockConfig {
  const sourceIndex = config.entries.findIndex((entry) => entry.id === id)
  if (sourceIndex === -1) throw new Error(`Launch entry "${id}" does not exist.`)

  const entries = [...config.entries]
  const [entry] = entries.splice(sourceIndex, 1)
  entries.splice(Math.max(0, Math.min(destinationIndex, entries.length)), 0, entry)
  return { ...config, entries }
}

export function filterLaunchEntries(entries: readonly LaunchEntry[], query = ''): LaunchEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return entries.filter((entry) =>
    (!normalizedQuery || [
      entry.displayName,
      entry.destinationUrl,
      platformPresets.find((preset) => preset.id === entry.platformPresetId)?.name ?? '',
      ...(platformPresets.find((preset) => preset.id === entry.platformPresetId)?.searchTerms ?? []),
      ...platformSearchLabels(entry.platformPresetId),
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))),
  )
}

export function saveConfig(storage: StorageAdapter, config: CreatorDockConfig, key = CONFIG_STORAGE_KEY): void {
  assertValidConfig(config)
  storage.setItem(key, exportConfig(config))
}

export function loadConfig(storage: StorageAdapter, idFactory: IdFactory = createId, key = CONFIG_STORAGE_KEY): { config: CreatorDockConfig, recovered: boolean } {
  const stored = storage.getItem(key)
  if (stored === null) return { config: createDefaultConfig(idFactory), recovered: false }

  const parsed = parseConfig(stored)
  return parsed.ok
    ? { config: parsed.config, recovered: false }
    : { config: createDefaultConfig(idFactory), recovered: true }
}

export function exportConfig(config: CreatorDockConfig): string {
  assertValidConfig(config)
  return JSON.stringify(config)
}

export function importConfig(json: string, currentConfig: CreatorDockConfig): { config: CreatorDockConfig, error?: string } {
  const parsed = parseConfig(json)
  return parsed.ok ? { config: parsed.config } : { config: currentConfig, error: parsed.error }
}

export function createShortcutExport(config: CreatorDockConfig): ShortcutExport {
  assertValidConfig(config)
  return {
    schemaVersion: SHORTCUT_SCHEMA_VERSION,
    shortcuts: config.entries.map(({ displayName, destinationUrl, browserTarget, profileDirectoryName, createShortcut }) => ({
      displayName,
      destinationUrl,
      browserTarget,
      ...(profileDirectoryName === undefined ? {} : { profileDirectoryName }),
      createShortcut,
    })),
  }
}

function normalizeNewEntry(entry: NewLaunchEntry): Omit<LaunchEntry, 'id'> {
  if (!entry.displayName.trim()) throw new Error('Display name is required.')
  if (!isHttpUrl(entry.destinationUrl)) throw new Error('Destination URL must use HTTP(S).')
  if (entry.browserTarget !== undefined && !isBrowserTarget(entry.browserTarget)) throw new Error('Browser target is invalid.')

  return {
    displayName: normalizeBuiltInDisplayName(entry.displayName.trim(), entry.platformPresetId),
    destinationUrl: entry.destinationUrl,
    browserTarget: entry.browserTarget ?? 'default',
    ...(entry.profileDirectoryName?.trim() ? { profileDirectoryName: entry.profileDirectoryName.trim() } : {}),
    createShortcut: entry.createShortcut ?? false,
    ...(entry.platformPresetId === undefined ? {} : { platformPresetId: entry.platformPresetId }),
  }
}

function parseConfig(json: string): { ok: true, config: CreatorDockConfig } | { ok: false, error: string } {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Configuration JSON is invalid.' }
  }

  try {
    const config = Array.isArray(value) ? migrateLegacyEntries(value) : validateConfig(value)
    return { ok: true, config }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Configuration is invalid.' }
  }
}

function migrateLegacyEntries(entries: unknown[]): CreatorDockConfig {
  return validateConfig({ schemaVersion: 1, entries, theme: 'system', density: 'comfortable', language: DEFAULT_LANGUAGE })
}

function assertValidConfig(config: CreatorDockConfig): void {
  validateConfig(config)
}

function validateConfig(value: unknown): CreatorDockConfig {
  if (!isRecord(value)) throw new Error('Configuration must be an object.')
  if (value.schemaVersion !== 1 && value.schemaVersion !== CONFIG_SCHEMA_VERSION) throw new Error(`Unsupported configuration schema version: ${String(value.schemaVersion)}.`)
  if (!Array.isArray(value.entries)) throw new Error('Configuration entries must be an array.')
  if (!isThemeSetting(value.theme)) throw new Error('Theme must be light, dark, or system.')
  if (!isDensitySetting(value.density)) throw new Error('Density must be comfortable or compact.')
  const language = value.language === undefined ? DEFAULT_LANGUAGE : value.language
  if (!isLanguageSetting(language)) throw new Error('Language must be zh-CN or en.')

  const entries = value.entries.map(validateLaunchEntry)
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error('Launch entry identifiers must be unique.')
  return { schemaVersion: CONFIG_SCHEMA_VERSION, entries, theme: value.theme, density: value.density, language }
}

function validateLaunchEntry(value: unknown): LaunchEntry {
  if (!isRecord(value)) throw new Error('Each launch entry must be an object.')
  if (!isNonEmptyString(value.id)) throw new Error('Launch entry identifier is required.')
  if (!isNonEmptyString(value.displayName)) throw new Error('Launch entry display name is required.')
  if (!isNonEmptyString(value.destinationUrl) || !isHttpUrl(value.destinationUrl)) throw new Error('Launch entry destination URL must use HTTP(S).')
  const browserTarget = value.browserTarget ?? 'default'
  if (!isBrowserTarget(browserTarget)) throw new Error('Launch entry browser target is invalid.')
  if (value.profileDirectoryName !== undefined && !isNonEmptyString(value.profileDirectoryName)) throw new Error('Launch entry profile directory name must be a non-empty string.')
  if (value.createShortcut !== undefined && typeof value.createShortcut !== 'boolean') throw new Error('Launch entry shortcut preference must be boolean.')
  if (value.platformPresetId !== undefined && !isNonEmptyString(value.platformPresetId)) throw new Error('Launch entry platform preset identifier must be a non-empty string.')

  return {
    id: value.id,
    displayName: normalizeBuiltInDisplayName(value.displayName, value.platformPresetId),
    destinationUrl: value.destinationUrl,
    browserTarget,
    ...(value.profileDirectoryName === undefined ? {} : { profileDirectoryName: value.profileDirectoryName }),
    createShortcut: value.createShortcut ?? false,
    ...(value.platformPresetId === undefined ? {} : { platformPresetId: value.platformPresetId }),
  }
}

function normalizeBuiltInDisplayName(displayName: string, platformPresetId: unknown): string {
  if (typeof platformPresetId !== 'string') return displayName
  const platform = platformPresets.find((candidate) => candidate.id === platformPresetId)
  if (!platform) return displayName
  const knownLabels = new Set([
    platform.name,
    platformLabel(platform.id, 'en', platform.name),
    ...platformSearchLabels(platform.id),
  ])
  return knownLabels.has(displayName) ? platformLabel(platform.id, DEFAULT_LANGUAGE, platform.name) : displayName
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isBrowserTarget(value: unknown): value is BrowserTarget {
  return value === 'default' || value === 'chrome' || value === 'edge'
}

function isThemeSetting(value: unknown): value is ThemeSetting {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isDensitySetting(value: unknown): value is DensitySetting {
  return value === 'comfortable' || value === 'compact'
}

function isLanguageSetting(value: unknown): value is LanguageSetting {
  return value === 'zh-CN' || value === 'en'
}
