import { describe, expect, it } from 'vitest'
import {
  CONTENT_PACKAGE_STORAGE_KEY,
  buildPlatformTask,
  createContentPackage,
  loadContentPackages,
  saveContentPackages,
  type ContentPackageRecord,
  type ContentPackageTarget,
} from './contentPackage'

const storage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

const target = (id: string, label: string): ContentPackageTarget => ({ id, label, platformPresetId: `${id}-preset` })

describe('content package persistence', () => {
  it('builds a platform-aware task without treating the target label as user instructions', () => {
    const task = buildPlatformTask('把远程办公写成一篇实用经验分享', target('wechat', '微信公众号'))

    expect(task).toContain('把远程办公写成一篇实用经验分享')
    expect(task).toContain('微信公众号')
    expect(task).toContain('平台适配要求')
  })

  it('creates a package with generating variants and a stable local record', () => {
    const record = createContentPackage('写一篇开源项目复盘', [target('xhs', '小红书'), target('bili', '哔哩哔哩')])

    expect(record.id).toMatch(/^package-/)
    expect(record.brief).toBe('写一篇开源项目复盘')
    expect(record.variants).toMatchObject([
      { target: { id: 'xhs' }, status: 'generating', output: '' },
      { target: { id: 'bili' }, status: 'generating', output: '' },
    ])
  })

  it('round-trips only the newest 20 packages and recovers malformed storage', () => {
    const adapter = storage()
    const packages: ContentPackageRecord[] = Array.from({ length: 21 }, (_, index) => createContentPackage(`brief-${index}`, [target('xhs', '小红书')]))
    saveContentPackages(adapter, packages)

    expect(adapter.getItem(CONTENT_PACKAGE_STORAGE_KEY)).toBeTruthy()
    expect(loadContentPackages(adapter)).toHaveLength(20)
    expect(loadContentPackages(adapter)[0].brief).toBe('brief-1')

    adapter.setItem(CONTENT_PACKAGE_STORAGE_KEY, '{broken')
    expect(loadContentPackages(adapter)).toEqual([])
  })

  it('never persists credential-shaped fields from a package record', () => {
    const adapter = storage()
    const record = createContentPackage('brief', [target('xhs', '小红书')])
    saveContentPackages(adapter, [{ ...record, variants: [{ ...record.variants[0], output: 'safe draft' }] }])

    const serialized = adapter.getItem(CONTENT_PACKAGE_STORAGE_KEY) ?? ''
    expect(serialized).not.toContain('apiKey')
    expect(serialized).not.toContain('encryptedApiKey')
  })
})

it('restores unfinished variants as interrupted and keeps completed work', () => {
  const adapter = storage()
  const record = createContentPackage('brief', [target('xhs', '小红书'), target('wechat', '公众号')])
  record.variants[0] = { ...record.variants[0], status: 'complete', output: '已完成的稿件' }
  saveContentPackages(adapter, [record])
  expect(loadContentPackages(adapter)[0].variants.map((variant) => variant.status)).toEqual(['complete', 'interrupted'])
})

it('uses the actual platform even when an account has a custom display name', () => {
  const task = buildPlatformTask('分享经验', { id: 'work', label: '工作号', platformPresetId: 'xiaohongshu' })
  expect(task).toContain('小红书')
  expect(task).toContain('工作号')
})
