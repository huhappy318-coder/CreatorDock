import { platformLabel } from './i18n'

export const CONTENT_PACKAGE_SCHEMA_VERSION = 1 as const
export const CONTENT_PACKAGE_STORAGE_KEY = 'creatordock.content-packages.v1'
const MAX_CONTENT_PACKAGES = 20

export type ContentPackageTarget = {
  id: string
  label: string
  platformPresetId?: string
}

export type ContentPackageVariantStatus = 'generating' | 'complete' | 'error' | 'interrupted'

export type ContentPackageVariant = {
  id: string
  target: ContentPackageTarget
  output: string
  status: ContentPackageVariantStatus
  error?: string
}

export type ContentPackageRecord = {
  schemaVersion: typeof CONTENT_PACKAGE_SCHEMA_VERSION
  id: string
  brief: string
  targets: ContentPackageTarget[]
  variants: ContentPackageVariant[]
  createdAt: string
  updatedAt: string
}

export interface ContentPackageStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const createId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

export function createContentPackage(brief: string, targets: readonly ContentPackageTarget[]): ContentPackageRecord {
  const normalizedBrief = brief.trim()
  const normalizedTargets = normalizeTargets(targets)
  if (!normalizedBrief) throw new Error('Content package brief is required.')
  if (normalizedTargets.length === 0) throw new Error('At least one content package target is required.')

  const now = new Date().toISOString()
  const id = createId('package')
  return {
    schemaVersion: CONTENT_PACKAGE_SCHEMA_VERSION,
    id,
    brief: normalizedBrief,
    targets: normalizedTargets,
    variants: normalizedTargets.map((target) => ({
      id: `${id}:variant:${target.id}`,
      target,
      output: '',
      status: 'generating',
    })),
    createdAt: now,
    updatedAt: now,
  }
}

export function buildPlatformTask(brief: string, target: ContentPackageTarget): string {
  const normalizedBrief = brief.trim()
  const label = target.label.trim()
  if (!normalizedBrief) throw new Error('Content package brief is required.')
  if (!label) throw new Error('Content package target label is required.')

  return [
    '你正在为一个多平台内容包制作其中一个平台版本。',
    `目标平台：${platformLabel(target.platformPresetId, 'zh-CN', label)}；账号名称：${JSON.stringify(label)}`,
    '平台适配要求：根据目标平台的阅读节奏、常见篇幅、标题习惯和互动方式改写；保留事实，不虚构数据，不提及这次改写过程。',
    `原始选题与要求：\n${normalizedBrief}`,
    '请直接输出可继续编辑的成稿，不要输出分析过程或平台规则清单。',
  ].join('\n\n')
}

export function loadContentPackages(storage: ContentPackageStorage): ContentPackageRecord[] {
  const raw = storage.getItem(CONTENT_PACKAGE_STORAGE_KEY)
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter(isContentPackageRecord).slice(-MAX_CONTENT_PACKAGES).map((record) => ({
      ...record,
      variants: record.variants.map((variant) => variant.status === 'generating' ? { ...variant, status: 'interrupted' as const } : variant),
    }))
  } catch {
    return []
  }
}

export function saveContentPackages(storage: ContentPackageStorage, packages: readonly ContentPackageRecord[]): void {
  const safe = packages.filter(isContentPackageRecord).slice(-MAX_CONTENT_PACKAGES)
  storage.setItem(CONTENT_PACKAGE_STORAGE_KEY, JSON.stringify(safe))
}

function normalizeTargets(targets: readonly ContentPackageTarget[]): ContentPackageTarget[] {
  const seen = new Set<string>()
  return targets.flatMap((target) => {
    const id = target.id.trim()
    const label = target.label.trim()
    if (!id || !label || seen.has(id)) return []
    seen.add(id)
    return [{ id, label, ...(target.platformPresetId?.trim() ? { platformPresetId: target.platformPresetId.trim() } : {}) }]
  })
}

function isContentPackageRecord(value: unknown): value is ContentPackageRecord {
  if (!isRecord(value) || value.schemaVersion !== CONTENT_PACKAGE_SCHEMA_VERSION) return false
  if (typeof value.id !== 'string' || typeof value.brief !== 'string' || !Array.isArray(value.targets) || !Array.isArray(value.variants)) return false
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false
  const targets = value.targets.filter(isContentPackageTarget)
  if (targets.length !== value.targets.length || new Set(targets.map((target) => target.id)).size !== targets.length) return false
  return value.variants.every((variant) => isContentPackageVariant(variant, targets))
}

function isContentPackageTarget(value: unknown): value is ContentPackageTarget {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') return false
  return value.platformPresetId === undefined || typeof value.platformPresetId === 'string'
}

function isContentPackageVariant(value: unknown, targets: ContentPackageTarget[]): value is ContentPackageVariant {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.output !== 'string') return false
  const target = value.target
  if (!isContentPackageTarget(target)) return false
  if (!targets.some((candidate) => candidate.id === target.id && candidate.label === target.label)) return false
  if (value.status !== 'generating' && value.status !== 'complete' && value.status !== 'error' && value.status !== 'interrupted') return false
  return value.error === undefined || typeof value.error === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
