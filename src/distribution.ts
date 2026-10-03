import { isHttpUrl, type LaunchEntry } from './config'

export const DISTRIBUTION_KEY = 'creatordock.distributions.v1'
export interface DistributionTarget {
  entry: LaunchEntry
  title: string
  body: string
  publishedAt?: string
  publishedUrl?: string
}
export interface Distribution {
  id: string
  title: string
  body: string
  cover?: string
  targets: DistributionTarget[]
  createdAt: string
  updatedAt: string
  archived?: boolean
}
export type DistributionStatus = 'pending' | 'progress' | 'complete'
export function distributionStatus(item: Distribution): DistributionStatus {
  const count = item.targets.filter(target => target.publishedAt).length
  return count === item.targets.length && count > 0 ? 'complete' : count > 0 ? 'progress' : 'pending'
}
export function validCover(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 2800000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
}
export function validPublishedUrl(value: string): boolean {
  if (!value.trim()) return true
  try { const url = new URL(value); return isHttpUrl(value) && !url.username && !url.password } catch { return false }
}
export function parseDistributions(raw: string): Distribution[] {
  const data = JSON.parse(raw)
  if (data?.schemaVersion !== 1 || !Array.isArray(data.records)) throw new Error('分发备份格式不正确')
  const ids = new Set<string>()
  for (const item of data.records) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.title !== 'string' || !item.title.trim() || typeof item.body !== 'string' || !Array.isArray(item.targets) || !item.targets.length || (typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) || (typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) || (item.cover !== undefined && !validCover(item.cover)) || (item.archived !== undefined && typeof item.archived !== 'boolean')) throw new Error('分发记录不完整，原数据未被修改')
    ids.add(item.id)
    const targets = new Set<string>()
    for (const target of item.targets) {
      const entry = target?.entry
      if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || targets.has(entry.id) || typeof entry.displayName !== 'string' || !entry.displayName.trim() || (entry.profileDirectoryName !== undefined && typeof entry.profileDirectoryName !== 'string') || (entry.platformPresetId !== undefined && typeof entry.platformPresetId !== 'string') || typeof entry.destinationUrl !== 'string' || !isHttpUrl(entry.destinationUrl) || !['default', 'chrome', 'edge'].includes(entry.browserTarget) || typeof entry.createShortcut !== 'boolean' || typeof target.title !== 'string' || typeof target.body !== 'string' || (target.publishedAt !== undefined && (typeof target.publishedAt !== 'string' || !Number.isFinite(Date.parse(target.publishedAt)))) || (target.publishedUrl !== undefined && (typeof target.publishedUrl !== 'string' || !validPublishedUrl(target.publishedUrl)))) throw new Error('平台分发记录不正确，原数据未被修改')
      targets.add(entry.id)
    }
  }
  return data.records
}
export function loadDistributions(storage: Pick<Storage, 'getItem'>): { records: Distribution[]; error?: string } {
  try { const raw = storage.getItem(DISTRIBUTION_KEY); return { records: raw ? parseDistributions(raw) : [] } }
  catch { return { records: [], error: '无法读取本机分发记录。请先导出原始数据留存，修复后重新导入；现有存储不会被覆盖。' } }
}
export function serializeDistributions(records: Distribution[]): string { return JSON.stringify({ schemaVersion: 1, records }, null, 2) }
export function distributionMarkdown(item: Distribution): string {
  return `# ${item.title}\n\n${item.targets.map(target => `## ${target.entry.displayName}\n\n${target.title}\n\n${target.body}\n\n状态：${target.publishedAt ? '已发布' : '待发布'}${target.publishedUrl ? `\n链接：${target.publishedUrl}` : ''}`).join('\n\n---\n\n')}`
}
export function downloadDistributionFile(filename: string, body: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename
  document.body.append(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Only apply this tab's changes to the newest stored list. Preserve both versions
// when another tab has edited the same record since our last successful save.
export function mergeDistributionChanges(base: Distribution[], local: Distribution[], remote: Distribution[], createId: () => string = () => crypto.randomUUID()): { records: Distribution[]; conflicts: number } {
  const baseById = new Map(base.map(item => [item.id, item]))
  const remoteById = new Map(remote.map(item => [item.id, item]))
  const equal = (a: Distribution | undefined, b: Distribution | undefined) => JSON.stringify(a) === JSON.stringify(b)
  const records: Distribution[] = []
  let conflicts = 0
  for (const item of local) {
    const previous = baseById.get(item.id)
    const latest = remoteById.get(item.id)
    remoteById.delete(item.id)
    if (equal(item, previous)) {
      if (latest) records.push(latest)
    } else {
      records.push(item)
      if (latest && !equal(latest, previous) && !equal(latest, item)) {
        records.push({ ...latest, id: createId(), title: `${latest.title}（冲突副本）` })
        conflicts++
      }
    }
  }
  records.push(...remoteById.values())
  return { records, conflicts }
}
