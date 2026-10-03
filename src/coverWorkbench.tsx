import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { addCoverProfile, COVER_PROVIDER_OPTIONS, deleteCoverProfile, loadCoverConfig, saveCoverConfig, unlockCoverApiKey, updateCoverProfile, type CoverConfig, type CoverProfileInput, type CoverProviderKind } from './coverConfig'
import { CoverError, createCoverClient } from './coverClient'
import { FloatingPanel } from './floatingPanel'
import type { LanguageSetting } from './i18n'

const emptyProfile: CoverProfileInput = { name: '', provider: 'openai-images', endpoint: '', model: 'gpt-image-1', apiKey: '', enabled: true }
const RATIO_OPTIONS = [
  ['1:1', '1024x1024'], ['4:5', '1024x1280'], ['3:4', '1024x1365'], ['16:9', '1536x864'], ['9:16', '864x1536'], ['2:3', '1024x1536'], ['3:2', '1536x1024'],
] as const
const STYLE_OPTIONS = [
  ['editorial', '编辑杂志', '留白、层次清楚、适合文章封面'],
  ['warm-china', '温暖东方', '米白、朱砂、纸张与自然光'],
  ['modern-tech', '现代科技', '干净几何、深色底、少量高亮'],
  ['product', '产品展示', '主体突出、背景克制、适合工具或课程'],
] as const

export function CoverWorkbench({ language = 'zh-CN' }: { language?: LanguageSetting }) {
  const tr = (zh: string, en: string): string => language === 'en' ? en : zh
  const [loaded, setLoaded] = useState(() => loadCoverConfig(localStorage))
  const { config } = loaded
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [ratio, setRatio] = useState('4:5')
  const [style, setStyle] = useState('editorial')
  const [references, setReferences] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [profileForm, setProfileForm] = useState<CoverProfileInput>(emptyProfile)
  const [editingId, setEditingId] = useState<string>()
  const referenceInput = useRef<HTMLInputElement>(null)
  const selectedProfile = useMemo(() => config.profiles.find((profile) => profile.id === config.defaultProfileId) ?? config.profiles.find((profile) => profile.enabled), [config.defaultProfileId, config.profiles])
  const ratioOptions = selectedProfile?.model.startsWith('gpt-image-1') ? RATIO_OPTIONS.filter(([label]) => ['1:1', '2:3', '3:2'].includes(label)) : RATIO_OPTIONS
  const effectiveRatio = ratioOptions.some(([label]) => label === ratio) ? ratio : '1:1'
  const selectedStyle = STYLE_OPTIONS.find(([id]) => id === style) ?? STYLE_OPTIONS[0]

  const commit = (next: CoverConfig) => { saveCoverConfig(localStorage, next); setLoaded({ config: next, recovered: false }) }
  const clearMessage = () => { setStatus(''); setError('') }

  const saveProfile = async () => {
    clearMessage()
    try {
      if (!passphrase) throw new Error(tr('请先设置本机解锁口令。', 'Set a local unlock passphrase first.'))
      const next = editingId ? await updateCoverProfile(config, editingId, profileForm, passphrase) : await addCoverProfile(config, profileForm, passphrase)
      commit(next); setProfileForm(emptyProfile); setEditingId(undefined); setStatus(tr('封面接口已保存，密钥只留在本机。', 'Cover provider saved; the key stays on this device.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('封面接口保存失败。', 'Cover provider could not be saved.')) }
  }

  const generate = async () => {
    clearMessage(); setImageUrl('')
    if (!prompt.trim()) { setError(tr('请先写下封面主题或画面要求。', 'Describe the cover subject first.')); return }
    if (!selectedProfile) { setError(tr('请先在封面设置里保存一个图片接口。', 'Save an image provider in cover settings first.')); setSettingsOpen(true); return }
    setRunning(true)
    try {
      const key = await unlockCoverApiKey(selectedProfile, passphrase)
      const size = ratioOptions.find(([label]) => label === effectiveRatio)?.[1] ?? '1024x1280'
      const result = await createCoverClient(selectedProfile, key).generate({ prompt: `${prompt.trim()}\n视觉方向：${selectedStyle[1]}（${selectedStyle[2]}）\n画面比例：${effectiveRatio}`, negativePrompt, size, referenceImages: references })
      setImageUrl(result.imageUrl); setStatus(tr('封面已生成。仅保存在当前页面，不会自动发布。', 'Cover generated. It stays in this page and is never published automatically.'))
    } catch (caught) {
      setError(caught instanceof CoverError && caught.kind === 'unsupported'
        ? references.length
          ? tr('参考素材需要专用图片编辑适配器；当前版本不会把图片发送到接口。请移除参考素材后生成封面。', 'Reference material needs a dedicated image-edit adapter. This version will not send images to the provider; remove the references before generating.')
          : tr('当前版本尚未适配该厂商的生图请求格式。请改用 OpenAI Images 兼容接口，或在该厂商提供兼容地址后使用“自定义接口”。', 'This provider needs a dedicated image-request adapter. Use an OpenAI Images-compatible endpoint, or choose Custom after the provider offers a compatible endpoint.')
        : caught instanceof Error ? caught.message : tr('封面生成失败。', 'Cover generation failed.'))
    }
    finally { setRunning(false) }
  }

  const handleReferences = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 3)
    clearMessage()
    try {
      const next = await Promise.all(files.map(readImageFile))
      setReferences(next)
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('参考素材读取失败。', 'Reference material could not be read.')) }
    event.target.value = ''
  }

  const startEdit = (id: string) => {
    const profile = config.profiles.find((item) => item.id === id)
    if (!profile) return
    setEditingId(id); setProfileForm({ name: profile.name, provider: profile.provider, endpoint: profile.endpoint, model: profile.model, apiKey: '', enabled: profile.enabled })
  }

  return <section className="cover-workbench" aria-label={tr('封面生成工作区', 'Cover generation workspace')}>
    <div className="cover-hero"><div><p className="eyebrow">{tr('视觉工作区', 'Visual workspace')}</p></div><button type="button" onClick={() => setSettingsOpen(true)}>{tr('封面设置', 'Cover settings')}</button></div>
    <p className="panel-help">{tr('选择比例和风格，补充负面提示词，制作发布封面。', 'Choose a ratio and style, add a negative prompt, and create a publishing cover.')}</p>
    <label className="ai-field">{tr('封面主题与画面要求', 'Cover brief')}<textarea className="cover-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={tr('例如：一篇关于独立创作者如何建立工作流的文章封面，主体是桌面上的笔记本和一束光……', 'e.g. A cover for an article about an independent creator workflow, with a notebook on a desk and one beam of light…')} /></label>
    <label className="ai-field">{tr('负面提示词（可选）', 'Negative prompt (optional)')}<textarea value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder={tr('例如：模糊文字、畸形手指、过度饱和', 'e.g. blurry text, malformed hands, oversaturation')} /></label>
    <div className="cover-controls"><label className="ai-field">{tr('画面比例', 'Aspect ratio')}<select value={effectiveRatio} onChange={(event) => setRatio(event.target.value)}>{ratioOptions.map(([label]) => <option value={label} key={label}>{label}</option>)}</select></label><label className="ai-field">{tr('预设风格', 'Style preset')}<select value={style} onChange={(event) => setStyle(event.target.value)}>{STYLE_OPTIONS.map(([id, label]) => <option value={id} key={id}>{tr(label, id === 'editorial' ? 'Editorial magazine' : id === 'warm-china' ? 'Warm East Asian' : id === 'modern-tech' ? 'Modern tech' : 'Product showcase')}</option>)}</select></label></div>
    <div className="cover-reference-row"><div><strong>{tr('参考素材', 'Reference material')}</strong><p>{references.length ? `${references.length} ${tr('张已选择', 'selected')}` : tr('可选，最多 3 张；当前版本需要专用图片编辑适配器后才能发送。', 'Optional, up to 3 images; a dedicated image-edit adapter is required before they can be sent.')}</p></div><button type="button" onClick={() => referenceInput.current?.click()}>{tr('添加图片', 'Add images')}</button><input ref={referenceInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void handleReferences(event)} /></div>
    {references.length > 0 && <div className="cover-thumbnails">{references.map((src, index) => <button type="button" key={`${src.slice(0, 20)}-${index}`} onClick={() => setReferences((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={tr(`移除参考图 ${index + 1}`, `Remove reference ${index + 1}`)}><img src={src} alt="" /></button>)}</div>}
    <button className="primary-action cover-generate-button" type="button" onClick={() => void generate()} disabled={running}>{running ? tr('生成中…', 'Generating…') : tr('生成封面', 'Generate cover')}</button>
    {imageUrl && <div className="cover-result"><img src={imageUrl} alt={tr('生成的封面', 'Generated cover')} /><div><a className="primary-action cover-download" href={imageUrl} download="creatordock-cover.png">{tr('下载封面', 'Download cover')}</a><button className="cover-reference-again" type="button" onClick={() => setReferences((items) => items.includes(imageUrl) ? items : [...items.slice(-2), imageUrl])}>{tr('将本次封面作为参考', 'Use this cover as a reference')}</button></div></div>}
    {(status || error || loaded.recovered) && <p className={error ? 'ai-message error' : 'ai-message'} role={error ? 'alert' : 'status'}>{error || status || tr('封面配置损坏，已恢复为空。', 'Cover configuration was damaged; it was reset.')}</p>}
    {settingsOpen && <div className="cover-settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
      <FloatingPanel
        className="cover-settings-dialog"
        eyebrow={tr('连接图片 API', 'Connect image API')}
        title={tr('封面接口与密钥', 'Cover provider and key')}
        closeLabel={tr('关闭封面设置', 'Close cover settings')}
        onClose={() => setSettingsOpen(false)}
        width={Math.min(620, window.innerWidth - 32)}
        height={Math.min(720, window.innerHeight - 32)}
        minWidth={360}
        minHeight={320}
      >
        <p className="panel-help">{tr('没有内置 Key。当前只会发送 OpenAI Images 兼容格式；协议不同的厂商需要专用适配器，旧配置会保留但不会被误发请求。', 'There is no built-in key. This version sends only OpenAI Images-compatible requests; providers with other protocols need a dedicated adapter. Existing profiles are retained but never sent with a guessed request format.')}</p>
        <label className="ai-field">{tr('本机解锁口令', 'Local unlock passphrase')}<input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="new-password" /></label>
        <div className="cover-profile-form">
          <label className="ai-field">{tr('接口名称', 'Profile name')}<input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} placeholder={tr('例如：我的封面接口', 'e.g. My cover endpoint')} /></label>
          <label className="ai-field">{tr('接口类型', 'Provider type')}<select value={profileForm.provider} onChange={(event) => { const provider = event.target.value as CoverProviderKind; setProfileForm({ ...profileForm, provider, endpoint: COVER_PROVIDER_OPTIONS.find((option) => option.id === provider)?.endpoint ?? '' }) }}>{COVER_PROVIDER_OPTIONS.map((option) => <option key={option.id} value={option.id} disabled={!option.supportsOpenAiImagesRequest}>{option.label}</option>)}</select></label>
          <label className="ai-field">{tr('接口地址（HTTPS）', 'Endpoint (HTTPS)')}<input type="url" value={profileForm.endpoint} onChange={(event) => setProfileForm({ ...profileForm, endpoint: event.target.value })} placeholder="https://api.example.com/images/generations" /></label>
          <label className="ai-field">{tr('模型 ID', 'Model ID')}<input value={profileForm.model} onChange={(event) => setProfileForm({ ...profileForm, model: event.target.value })} /></label>
          <label className="ai-field">API Key{editingId && <small>{tr('留空表示保留已有密钥', 'Leave blank to keep the saved key')}</small>}<input type="password" value={profileForm.apiKey} onChange={(event) => setProfileForm({ ...profileForm, apiKey: event.target.value })} autoComplete="off" /></label>
        </div>
        <div className="ai-actions"><button className="primary-action" type="button" onClick={() => void saveProfile()}>{editingId ? tr('更新接口', 'Update provider') : tr('保存接口', 'Save provider')}</button>{editingId && <button type="button" onClick={() => { setEditingId(undefined); setProfileForm(emptyProfile) }}>{tr('取消编辑', 'Cancel edit')}</button>}</div>
        <div className="model-list">{config.profiles.map((profile) => <article className={`model-card ${profile.id === selectedProfile?.id ? 'selected' : ''}`} key={profile.id}><button className="model-select" type="button" onClick={() => commit({ ...config, defaultProfileId: profile.id })}><strong>{profile.name}{profile.id === config.defaultProfileId ? ` · ${tr('默认', 'default')}` : ''}</strong><span>{profile.provider} · {profile.model}</span><small>{profile.encryptedApiKey ? tr('Key 已加密保存', 'Key encrypted') : tr('未保存 Key', 'Key not saved')}</small></button><div className="model-card-actions"><button type="button" onClick={() => startEdit(profile.id)}>{tr('编辑', 'Edit')}</button><button type="button" onClick={() => commit(deleteCoverProfile(config, profile.id))}>{tr('删除', 'Delete')}</button></div></article>)}</div>
      </FloatingPanel>
    </div>}
  </section>
}

function readImageFile(file: File): Promise<string> {
  if (file.size > 4 * 1024 * 1024) return Promise.reject(new Error('Each reference image must be 4 MB or smaller.'))
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.addEventListener('load', () => resolve(String(reader.result))); reader.addEventListener('error', () => reject(reader.error)); reader.readAsDataURL(file) })
}
