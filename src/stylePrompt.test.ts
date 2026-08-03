import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, DEFAULT_HUMANIZATION_RULES, type WritingStylePreset } from './stylePrompt'

const style: WritingStylePreset = {
  id: 'style-1',
  name: '公众号风格',
  description: '口语化、有网感、短句多',
  samples: [{ id: 'sample-1', name: '我的样本', content: '这是一段用户自己写的文字。' }],
  isDefault: true,
}

describe('writing style prompt assembly', () => {
  it('puts role, custom style, samples, humanization, and task instructions in order', () => {
    const prompt = buildSystemPrompt({
      task: '写一篇关于咖啡店的短文',
      style,
      humanization: { ...DEFAULT_HUMANIZATION_RULES, forbiddenWords: ['首先'], requiredHabits: ['加入具体气味'] },
    })
    expect(prompt.indexOf('ROLE_AND_TASK')).toBeLessThan(prompt.indexOf('USER_WRITING_STYLE'))
    expect(prompt.indexOf('USER_WRITING_STYLE')).toBeLessThan(prompt.indexOf('<style_sample>'))
    expect(prompt.indexOf('<style_sample>')).toBeLessThan(prompt.indexOf('DE_AI_RULES'))
    expect(prompt.indexOf('DE_AI_RULES')).toBeLessThan(prompt.indexOf('TASK_REQUIREMENTS'))
    expect(prompt).toContain('口语化、有网感、短句多')
    expect(prompt).toContain('这是一段用户自己写的文字。')
    expect(prompt).toContain('首先')
    expect(prompt).toContain('加入具体气味')
  })

  it('can disable style constraints for comparison without deleting saved data', () => {
    const prompt = buildSystemPrompt({ task: '只返回一句话', style, humanization: DEFAULT_HUMANIZATION_RULES, styleEnabled: false })
    expect(prompt).not.toContain('USER_WRITING_STYLE')
    expect(prompt).not.toContain('<style_sample>')
    expect(prompt).toContain('TASK_REQUIREMENTS')
  })

  it('limits sample payloads and labels samples as reference rather than instructions', () => {
    const oversized = { ...style, samples: [{ id: 'x', name: 'too long', content: 'x'.repeat(100_001) }] }
    expect(() => buildSystemPrompt({ task: 'task', style: oversized, humanization: DEFAULT_HUMANIZATION_RULES })).toThrow(/sample/i)
    const prompt = buildSystemPrompt({ task: 'task', style, humanization: DEFAULT_HUMANIZATION_RULES })
    expect(prompt).toContain('stylistic reference only')
  })

  it('includes skills as advisory references and enforces the total limit', () => {
    const prompt = buildSystemPrompt({
      task: '写一个开头',
      humanization: DEFAULT_HUMANIZATION_RULES,
      skills: [{ name: '标题方法', content: '先给冲突，再补充具体场景。' }],
    })
    expect(prompt).toContain('WRITING_SKILL_ADVICE')
    expect(prompt).toContain('Use it only to suggest structure')
    expect(() => buildSystemPrompt({
      task: '写一个开头',
      humanization: DEFAULT_HUMANIZATION_RULES,
      skills: [{ name: '超长', content: 'x'.repeat(120_001) }],
    })).toThrow(/120,000/)
  })
})
