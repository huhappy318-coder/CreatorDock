import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { aiWritingIconSrc, customIconSrc, platformPresets } from './catalog'

const requiredPlatforms = [
  'Xiaohongshu',
  'WeChat Official Accounts',
  'WeChat Channels',
  'Bilibili',
  'Douyin',
  'X/Twitter',
  'Kuaishou',
  'Weibo',
  'Zhihu',
  'Toutiao',
  'Baijiahao',
  'Juejin',
  'CSDN',
  'QQ Content Open Platform',
  'NetEase Media',
  'Sohu Media',
  'Yidian',
  'Dayu',
  'Xigua Video',
  'Jianshu',
  'AcFun',
  'YouTube Studio',
  'TikTok Studio',
  'Instagram',
  'Facebook / Meta',
  'LinkedIn',
  'Medium',
  'Substack',
  'WordPress.com',
  'Reddit',
  'Pinterest',
  'Twitch',
  'Threads',
  'Bluesky',
]

describe('platform catalog', () => {
  it('includes every required platform', () => {
    expect(platformPresets).toHaveLength(34)
    expect(platformPresets.map((preset) => preset.name)).toEqual(
      expect.arrayContaining(requiredPlatforms),
    )
  })

  it('provides searchable aliases for every platform', () => {
    for (const preset of platformPresets) {
      expect((preset as { searchTerms?: string[] }).searchTerms).toEqual(expect.any(Array))
      expect((preset as { searchTerms?: string[] }).searchTerms?.length).toBeGreaterThan(0)
    }

    expect(platformPresets.find((preset) => preset.id === 'xiaohongshu')).toMatchObject({ searchTerms: expect.arrayContaining(['xhs']) })
    expect(platformPresets.find((preset) => preset.id === 'youtube')).toMatchObject({ searchTerms: expect.arrayContaining(['油管']) })
  })

  it('uses unique preset identifiers', () => {
    const identifiers = platformPresets.map((preset) => preset.id)
    expect(new Set(identifiers).size).toBe(identifiers.length)
  })

  it('uses only HTTP(S) URLs', () => {
    for (const preset of platformPresets) {
      expect(new URL(preset.url).protocol).toMatch(/^https?:$/)
      expect(preset.officialUrl).toBe(preset.url)
      expect(preset.iconSrc).toMatch(/^icons\/platforms\/.+\.png$/)
      expect(existsSync(resolve('public', preset.iconSrc))).toBe(true)
      expect(preset.brandColor).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('keeps icon paths available for custom and writing workbench tiles', () => {
    expect(customIconSrc).toBe('icons/platforms/custom.png')
    expect(aiWritingIconSrc).toBe('icons/platforms/ai-writing.png')
  })
})
