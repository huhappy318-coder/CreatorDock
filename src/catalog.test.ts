import { describe, expect, it } from 'vitest'
import { platformPresets } from './catalog'

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
]

describe('platform catalog', () => {
  it('includes every required platform', () => {
    expect(platformPresets.map((preset) => preset.name)).toEqual(
      expect.arrayContaining(requiredPlatforms),
    )
  })

  it('uses unique preset identifiers', () => {
    const identifiers = platformPresets.map((preset) => preset.id)
    expect(new Set(identifiers).size).toBe(identifiers.length)
  })

  it('uses only HTTP(S) URLs', () => {
    for (const preset of platformPresets) {
      expect(new URL(preset.url).protocol).toMatch(/^https?:$/)
    }
  })
})
