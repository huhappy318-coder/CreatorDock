export const SKILL_STORAGE_KEY = 'creatordock.skills.v1'
export const MAX_SKILL_CHARS = 120_000

export type SkillSource = 'github' | 'upload'

export interface WritingSkill {
  id: string
  name: string
  source: SkillSource
  sourceUrl?: string
  content: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SkillStorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface NewWritingSkill {
  name: string
  source: SkillSource
  sourceUrl?: string
  content: string
}

const createId = (): string => `skill-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

export function loadWritingSkills(storage: SkillStorageAdapter): { skills: WritingSkill[], recovered: boolean } {
  const raw = storage.getItem(SKILL_STORAGE_KEY)
  if (!raw) return { skills: [], recovered: false }
  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) throw new Error('Skills must be an array.')
    return { skills: value.map(parseSkill), recovered: false }
  } catch {
    return { skills: [], recovered: true }
  }
}

export function saveWritingSkills(storage: SkillStorageAdapter, skills: WritingSkill[]): void {
  storage.setItem(SKILL_STORAGE_KEY, JSON.stringify(skills.map(parseSkill)))
}

export function addWritingSkill(skills: WritingSkill[], input: NewWritingSkill, now = new Date().toISOString()): WritingSkill[] {
  const skill = parseSkill({
    id: createId(),
    name: input.name,
    source: input.source,
    sourceUrl: input.sourceUrl,
    content: input.content,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  })
  return [...skills, skill]
}

export function updateWritingSkill(skills: WritingSkill[], id: string, changes: Partial<Pick<WritingSkill, 'name' | 'enabled'>>, now = new Date().toISOString()): WritingSkill[] {
  if (!skills.some((skill) => skill.id === id)) throw new Error('The selected skill does not exist.')
  return skills.map((skill) => skill.id === id ? { ...skill, ...changes, updatedAt: now } : skill)
}

export function deleteWritingSkill(skills: WritingSkill[], id: string): WritingSkill[] {
  return skills.filter((skill) => skill.id !== id)
}

export function extractSkillName(content: string, fallback = 'Imported writing skill'): string {
  const heading = content.match(/^\s*#\s+(.+)$/m)?.[1]?.trim()
  if (heading) return heading.slice(0, 100)
  return fallback
}

export function resolveGithubSkillUrl(value: string): string[] {
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error('GitHub skill URL is invalid.') }
  if (url.protocol !== 'https:') throw new Error('GitHub skill URL must use HTTPS.')
  const host = url.hostname.toLowerCase()
  if (host === 'raw.githubusercontent.com') return [url.toString()]
  if (host !== 'github.com' && host !== 'www.github.com') throw new Error('Only github.com or raw.githubusercontent.com is allowed.')
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) throw new Error('GitHub URL must include an owner and repository.')
  const [owner, repository] = parts
  if (parts[2] === 'blob' && parts.length >= 5) {
    const branch = parts[3]
    const path = parts.slice(4).join('/')
    return [`https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${path}`]
  }
  return [
    `https://raw.githubusercontent.com/${owner}/${repository}/main/SKILL.md`,
    `https://raw.githubusercontent.com/${owner}/${repository}/master/SKILL.md`,
    `https://raw.githubusercontent.com/${owner}/${repository}/main/README.md`,
  ]
}

export async function fetchGithubSkill(value: string, fetcher: typeof fetch = fetch): Promise<{ content: string, sourceUrl: string, name: string }> {
  const candidates = resolveGithubSkillUrl(value)
  for (const candidate of candidates) {
    const response = await fetcher(candidate)
    if (!response.ok) continue
    const content = await response.text()
    const name = extractSkillName(content, candidate.split('/').pop()?.replace(/\.md$/i, '') || 'GitHub skill')
    parseSkill({ id: 'preview', name, source: 'github', sourceUrl: candidate, content, enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    return { content, sourceUrl: candidate, name }
  }
  throw new Error('GitHub skill could not be fetched. Check the public URL or upload the file instead.')
}

function parseSkill(value: unknown): WritingSkill {
  if (!value || typeof value !== 'object') throw new Error('Skill is invalid.')
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.content !== 'string' || (item.source !== 'github' && item.source !== 'upload')) throw new Error('Skill fields are invalid.')
  const content = item.content.trim()
  if (!content) throw new Error('Skill content cannot be empty.')
  if (content.length > MAX_SKILL_CHARS) throw new Error(`Skill content exceeds ${MAX_SKILL_CHARS.toLocaleString()} characters.`)
  if (item.sourceUrl !== undefined && typeof item.sourceUrl !== 'string') throw new Error('Skill source URL is invalid.')
  if (typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') throw new Error('Skill timestamps are invalid.')
  return {
    id: item.id,
    name: item.name.trim().slice(0, 100) || 'Unnamed skill',
    source: item.source,
    ...(typeof item.sourceUrl === 'string' ? { sourceUrl: item.sourceUrl } : {}),
    content,
    enabled: item.enabled !== false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}
