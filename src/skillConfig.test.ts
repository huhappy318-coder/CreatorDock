import { describe, expect, it } from 'vitest'
import {
  MAX_SKILL_CHARS,
  addWritingSkill,
  deleteWritingSkill,
  fetchGithubSkill,
  loadWritingSkills,
  resolveGithubSkillUrl,
  saveWritingSkills,
  updateWritingSkill,
} from './skillConfig'

const storage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('writing skills', () => {
  it('restricts GitHub imports to HTTPS GitHub hosts and resolves blob URLs', () => {
    expect(resolveGithubSkillUrl('https://github.com/acme/creator/blob/main/SKILL.md')).toEqual([
      'https://raw.githubusercontent.com/acme/creator/main/SKILL.md',
    ])
    expect(resolveGithubSkillUrl('https://github.com/acme/creator')).toHaveLength(3)
    expect(() => resolveGithubSkillUrl('http://github.com/acme/creator')).toThrow(/HTTPS/)
    expect(() => resolveGithubSkillUrl('https://example.com/acme/creator')).toThrow(/github/i)
  })

  it('tries repository SKILL.md candidates and derives a name', async () => {
    const calls: string[] = []
    const result = await fetchGithubSkill('https://github.com/acme/creator', async (request) => {
      const url = String(request)
      calls.push(url)
      const found = url.endsWith('/master/SKILL.md')
      return new Response(found ? '# 公众号节奏\n\n建议先给场景。' : 'not found', { status: found ? 200 : 404 })
    })
    expect(calls).toEqual([
      'https://raw.githubusercontent.com/acme/creator/main/SKILL.md',
      'https://raw.githubusercontent.com/acme/creator/master/SKILL.md',
    ])
    expect(result.name).toBe('公众号节奏')
    expect(result.sourceUrl).toContain('/master/SKILL.md')
  })

  it('persists, toggles and deletes skills while rejecting oversized content', () => {
    const skills = addWritingSkill([], { name: '写作结构', source: 'upload', content: '# 结构\n先讲场景。' }, '2026-08-01T00:00:00.000Z')
    const saved = storage()
    saveWritingSkills(saved, skills)
    expect(loadWritingSkills(saved).skills[0].name).toBe('写作结构')
    const disabled = updateWritingSkill(skills, skills[0].id, { enabled: false }, '2026-08-01T00:01:00.000Z')
    expect(disabled[0].enabled).toBe(false)
    expect(deleteWritingSkill(disabled, skills[0].id)).toEqual([])
    expect(() => addWritingSkill([], { name: '太长', source: 'upload', content: 'x'.repeat(MAX_SKILL_CHARS + 1) })).toThrow(/120,000/)
  })
})
