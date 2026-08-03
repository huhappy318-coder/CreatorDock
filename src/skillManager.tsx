import { useState, type ChangeEvent } from 'react'
import {
  addWritingSkill,
  deleteWritingSkill,
  fetchGithubSkill,
  loadWritingSkills,
  saveWritingSkills,
  updateWritingSkill,
  extractSkillName,
  type WritingSkill,
} from './skillConfig'
import type { LanguageSetting } from './i18n'

const SUGGESTIONS = [
  ['structure', '结构与节奏', '给出开头、层次和收束方式的建议。'],
  ['headline', '标题与开头', '只提供标题方向和开头切入角度，不直接代写成稿。'],
  ['platform', '平台适配', '提示不同平台的长度、语气和信息密度差异。'],
  ['cover', '封面方向', '给出构图、色彩和视觉重点建议。'],
] as const

export function SkillManager({ language = 'zh-CN' }: { language?: LanguageSetting }) {
  const tr = (zh: string, en: string): string => language === 'en' ? en : zh
  const [loaded, setLoaded] = useState(() => loadWritingSkills(localStorage))
  const [githubUrl, setGithubUrl] = useState('')
  const [skillName, setSkillName] = useState('')
  const [suggestion, setSuggestion] = useState('structure')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const commit = (skills: WritingSkill[]) => {
    saveWritingSkills(localStorage, skills)
    setLoaded({ skills, recovered: false })
  }

  const importGithub = async () => {
    setStatus(''); setError('')
    try {
      const result = await fetchGithubSkill(githubUrl)
      commit(addWritingSkill(loaded.skills, { name: skillName.trim() || result.name, source: 'github', sourceUrl: result.sourceUrl, content: result.content }))
      setGithubUrl(''); setSkillName(''); setStatus(tr('GitHub Skill 已保存到本机。', 'GitHub skill saved locally.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('GitHub Skill 导入失败。', 'GitHub skill import failed.')) }
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setStatus(''); setError('')
    try {
      const content = await readTextFile(file)
      commit(addWritingSkill(loaded.skills, { name: skillName.trim() || extractSkillName(content, file.name), source: 'upload', content }))
      setSkillName(''); setStatus(tr('Skill 文件已保存到本机。', 'Skill file saved locally.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('Skill 文件导入失败。', 'Skill file import failed.')) }
    event.target.value = ''
  }

  return (
    <section className="ai-panel skill-panel" aria-labelledby="skills-heading">
      <div className="panel-title"><h3 id="skills-heading">{tr('写作 Skill', 'Writing skills')}</h3><span>{loaded.skills.length} {tr('个已保存', 'saved')}</span></div>
      <p className="panel-help">{tr('可从公开 GitHub SKILL.md 导入，也可以上传本地文件。Skill 只作为建议参考，不自动执行、不代替你发布内容。', 'Import a public GitHub SKILL.md or upload a local file. Skills are advisory references only; they are never executed or published for you.')}</p>
      <div className="skill-import-grid">
        <label className="ai-field">{tr('Skill 名称（可选）', 'Skill name (optional)')}<input value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder={tr('例如：公众号口吻', 'e.g. Newsletter voice')} /></label>
        <label className="ai-field">GitHub URL<input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/owner/repo/blob/main/SKILL.md" /></label>
      </div>
      <div className="ai-actions"><button className="primary-action" type="button" onClick={() => void importGithub()} disabled={!githubUrl.trim()}>{tr('从 GitHub 导入', 'Import from GitHub')}</button><label className="file-action">{tr('上传 Skill 文件', 'Upload skill file')}<input className="sr-only" type="file" accept=".md,text/markdown" onChange={(event) => void importFile(event)} /></label></div>
      <label className="ai-field skill-suggestion-field">{tr('建议方向', 'Suggestion focus')}<select value={suggestion} onChange={(event) => setSuggestion(event.target.value)}>{SUGGESTIONS.map(([id, label, description]) => <option value={id} key={id}>{tr(label, id === 'structure' ? 'Structure and rhythm' : id === 'headline' ? 'Headlines and openings' : id === 'platform' ? 'Platform adaptation' : 'Cover direction')}</option>)}</select></label>
      <p className="skill-suggestion-note">{tr(SUGGESTIONS.find(([id]) => id === suggestion)?.[2] ?? '', SUGGESTIONS.find(([id]) => id === suggestion)?.[2] ?? '')}</p>
      {(status || error || loaded.recovered) && <p className={error ? 'ai-message error' : 'ai-message'} role={error ? 'alert' : 'status'}>{error || status || tr('Skill 配置损坏，已恢复为空。', 'Skill storage was damaged; it was reset.')}</p>}
      <div className="skill-list">{loaded.skills.map((skill) => <article className="skill-card" key={skill.id}><div><strong>{skill.name}</strong><span>{skill.source === 'github' ? 'GitHub' : tr('本地上传', 'Local upload')}</span></div><div className="model-card-actions"><button type="button" onClick={() => commit(updateWritingSkill(loaded.skills, skill.id, { enabled: !skill.enabled }))}>{skill.enabled ? tr('已启用', 'Enabled') : tr('已停用', 'Disabled')}</button><button type="button" onClick={() => commit(deleteWritingSkill(loaded.skills, skill.id))}>{tr('删除', 'Delete')}</button></div></article>)}</div>
    </section>
  )
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file)
  })
}
