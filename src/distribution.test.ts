import { describe, expect, it } from 'vitest'
import { DISTRIBUTION_KEY, distributionMarkdown, distributionStatus, loadDistributions, mergeDistributionChanges, parseDistributions, serializeDistributions, validPublishedUrl, type Distribution } from './distribution'
const record = (): Distribution => ({ id: 'one', title: '一份内容', body: '原始正文', createdAt: '2026-10-03T10:00:00Z', updatedAt: '2026-10-03T10:00:00Z', targets: ['a','b'].map(id => ({ entry: { id, displayName: id, destinationUrl: 'https://example.com', browserTarget: 'default', createShortcut: false }, title: '平台标题', body: '平台正文' })) })
describe('local distribution records', () => {
  it('derives pending, partial and complete from independent platform records', () => {
    const item = record()
    expect(distributionStatus(item)).toBe('pending')
    item.targets[0].publishedAt = item.createdAt
    expect(distributionStatus(item)).toBe('progress')
    item.targets[1].publishedAt = item.createdAt
    expect(distributionStatus(item)).toBe('complete')
    delete item.targets[0].publishedAt
    expect(distributionStatus(item)).toBe('progress')
  })
  it('roundtrips content, archive state, per-platform adaptations and publishing links', () => {
    const item = { ...record(), archived: true }
    item.targets[0].publishedUrl = 'https://example.com/article'
    item.targets[0].publishedAt = item.createdAt
    expect(parseDistributions(serializeDistributions([item]))).toEqual([item])
    expect(distributionMarkdown(item)).toContain('链接：https://example.com/article')
    expect(distributionMarkdown(item)).toContain('平台正文')
  })
  it('does not silently discard or replace damaged storage', () => {
    const raw = '{ damaged user content'
    const storage = { getItem: (key: string) => key === DISTRIBUTION_KEY ? raw : null }
    expect(loadDistributions(storage)).toMatchObject({ records: [], error: expect.any(String) })
    expect(storage.getItem(DISTRIBUTION_KEY)).toBe(raw)
    expect(loadDistributions({ getItem: () => null })).toEqual({ records: [] })
  })
  it('rejects malformed imports and unsafe cover or platform destinations', () => {
    expect(() => parseDistributions('{}')).toThrow()
    expect(() => parseDistributions(serializeDistributions([record(), record()]))).toThrow()
    expect(() => parseDistributions(serializeDistributions([{ ...record(), targets: [] }]))).toThrow()
    expect(() => parseDistributions(serializeDistributions([{ ...record(), cover: 'data:image/svg+xml;base64,abc' }]))).toThrow()
    const item = record(); item.targets[0].entry.destinationUrl = 'javascript:alert(1)'
    expect(() => parseDistributions(serializeDistributions([item]))).toThrow()
  })
  it('accepts only optional credential-free HTTP(S) publication links', () => {
    expect(validPublishedUrl('')).toBe(true)
    expect(validPublishedUrl('https://example.com/post')).toBe(true)
    for (const link of ['file:///x','javascript:alert(1)','https://user:password@example.com','not a url']) expect(validPublishedUrl(link)).toBe(false)
  })
})

it('exports real Markdown line breaks while preserving literal escapes inside user text', () => {
  const item = record()
  item.targets[0].body = '第一段\n第二段，示例代码：\\n'
  const markdown = distributionMarkdown(item)
  expect(markdown.split('\n')[0]).toBe('# 一份内容')
  expect(markdown).toContain('\n\n## a\n\n平台标题\n\n第一段\n第二段，示例代码：\\n\n\n状态：待发布')
  expect(markdown).toContain('\n\n---\n\n## b\n')
})

it('rejects non-string dates and malformed optional account metadata', () => {
  const malformed = JSON.parse(serializeDistributions([record()]))
  malformed.records[0].createdAt = 1
  expect(() => parseDistributions(JSON.stringify(malformed))).toThrow()
  malformed.records[0].createdAt = record().createdAt
  malformed.records[0].targets[0].entry.profileDirectoryName = { path: 'Default' }
  expect(() => parseDistributions(JSON.stringify(malformed))).toThrow()
})


it('merges independent tab changes and preserves concurrent versions as conflict copies', () => {
  const base = record()
  const local = { ...base, title: '本页修改' }
  const extra = { ...record(), id: 'new', title: '另一页新增' }
  expect(mergeDistributionChanges([base], [local], [base, extra]).records).toEqual([local, extra])
  const remote = { ...base, title: '另一页修改' }
  expect(mergeDistributionChanges([base], [local], [remote], () => 'copy')).toEqual({
    conflicts: 1, records: [local, { ...remote, id: 'copy', title: '另一页修改（冲突副本）' }],
  })
  expect(mergeDistributionChanges([base], [base], [remote]).records).toEqual([remote])
  expect(mergeDistributionChanges([base], [local], [local]).conflicts).toBe(0)
})
