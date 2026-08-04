import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AI_CONFIG_STORAGE_KEY,
  addModelProfile,
  addStylePreset,
  createDefaultAiConfig,
  deleteModelProfile,
  deleteStylePreset,
  exportAiConfig,
  importAiConfig,
  loadAiConfig,
  findModelPreset,
  modelInputFromPreset,
  MODEL_PRESETS,
  PROVIDER_OPTIONS,
  saveAiConfig,
  setDefaultModel,
  unlockModelApiKey,
  updateHumanizationRules,
  updateModelProfile,
  updateStylePreset,
  type AiConfig,
  type ModelPreset,
  type ModelProfileInput,
} from './aiConfig'
import { createLLMClient } from './llmClient'
import { discoverModels, type DiscoveredModel } from './modelDiscovery'
import { SkillManager } from './skillManager'
import { loadWritingSkills } from './skillConfig'
import { CoverWorkbench } from './coverWorkbench'
import { FloatingPanel } from './floatingPanel'
import { type StyleSample } from './stylePrompt'
import type { LanguageSetting } from './i18n'
import { createWritingTurn, loadWritingDraft, loadWritingHistory, saveWritingDraft, saveWritingHistory, type WritingTurn } from './writingHistory'

const defaultModelPreset = MODEL_PRESETS[0]
const emptyModel: ModelProfileInput = modelInputFromPreset(defaultModelPreset)

const emptyStyle = { name: '', description: '', samples: [] as StyleSample[], isDefault: false }
const MODEL_CONNECTION_STATUS_STORAGE_KEY = 'creatordock.ai.connection-status.v1'

type ModelConnectionStatus = 'succeeded' | 'failed'
type ModelConnectionChecks = Record<string, { status: ModelConnectionStatus, checkedAt: string, latencyMs?: number }>

function loadModelConnectionChecks(storage: Storage): ModelConnectionChecks {
  try {
    const raw = storage.getItem(MODEL_CONNECTION_STATUS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).flatMap(([modelId, value]) => {
      if (!value || typeof value !== 'object') return []
      const check = value as Record<string, unknown>
      if ((check.status !== 'succeeded' && check.status !== 'failed') || typeof check.checkedAt !== 'string' || (check.latencyMs !== undefined && typeof check.latencyMs !== 'number')) return []
      return [[modelId, { status: check.status, checkedAt: check.checkedAt, ...(typeof check.latencyMs === 'number' ? { latencyMs: check.latencyMs } : {}) }]]
    }))
  } catch { return {} }
}

function modelFormForProfile(model: Parameters<typeof findModelPreset>[0] & { id?: string; name: string; baseUrl: string; temperature?: number; maxTokens?: number; streaming: boolean; imageGeneration: boolean; enabled: boolean }): { form: ModelProfileInput, presetId?: string } {
  const preset = findModelPreset(model) ?? (model.name.trim() === '1' || model.model === 'deepseek-v4' || model.baseUrl.includes('platform.deepseek.com')
    ? MODEL_PRESETS.find((item) => item.provider === model.provider)
    : undefined)
  if (!preset) return {
    form: { name: model.name, provider: model.provider, baseUrl: model.baseUrl, model: model.model, apiKey: '', temperature: model.temperature, maxTokens: model.maxTokens, streaming: model.streaming, imageGeneration: model.imageGeneration, enabled: model.enabled },
  }
  return { form: { ...modelInputFromPreset(preset), enabled: model.enabled }, presetId: preset.id }
}

function modelPresetFromDiscovered(provider: ModelPreset['provider'], baseUrl: string, model: DiscoveredModel): ModelPreset {
  return {
    id: `${provider}:remote:${model.id}`,
    label: model.label,
    provider,
    baseUrl,
    model: model.id,
    temperature: 0.7,
    maxTokens: model.maxOutputTokens ?? 8192,
    streaming: true,
    imageGeneration: false,
  }
}

export function AiWorkbench({ language = 'zh-CN' }: { language?: LanguageSetting }) {
  const [loaded, setLoaded] = useState(() => loadAiConfig(localStorage))
  const { config } = loaded
  const tr = (zh: string, en: string): string => language === 'en' ? en : zh
  const [passphrase, setPassphrase] = useState('')
  const [modelForm, setModelForm] = useState<ModelProfileInput>(emptyModel)
  const [selectedPresetId, setSelectedPresetId] = useState(defaultModelPreset.id)
  const [modelChoices, setModelChoices] = useState<ModelPreset[]>([...MODEL_PRESETS])
  const [refreshingModels, setRefreshingModels] = useState(false)
  const [testingDraftModel, setTestingDraftModel] = useState(false)
  const [modelRefreshStatus, setModelRefreshStatus] = useState('')
  const [editingModelId, setEditingModelId] = useState<string>()
  const [styleForm, setStyleForm] = useState(emptyStyle)
  const [editingStyleId, setEditingStyleId] = useState<string>()
  const [selectedModelId, setSelectedModelId] = useState(config.defaultModelId ?? '')
  const [selectedStyleId, setSelectedStyleId] = useState(config.defaultStyleId ?? '')
  const [modelConnectionChecks, setModelConnectionChecks] = useState<ModelConnectionChecks>(() => loadModelConnectionChecks(localStorage))
  const [task, setTask] = useState(() => loadWritingDraft(localStorage))
  const [writingHistory, setWritingHistory] = useState<WritingTurn[]>(() => loadWritingHistory(localStorage))
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [activeDialog, setActiveDialog] = useState<'model' | 'style' | 'skill' | null>(null)
  const [workspace, setWorkspace] = useState<'writing' | 'cover'>('writing')
  const configFileInput = useRef<HTMLInputElement>(null)
  const sampleFileInput = useRef<HTMLInputElement>(null)
  const writingHistoryRef = useRef(writingHistory)

  const selectedModel = useMemo(() => config.models.find((model) => model.id === selectedModelId) ?? config.models.find((model) => model.id === config.defaultModelId), [config.defaultModelId, config.models, selectedModelId])
  const selectedStyle = useMemo(() => config.styles.find((style) => style.id === selectedStyleId) ?? config.styles.find((style) => style.id === config.defaultStyleId), [config.defaultStyleId, config.styles, selectedStyleId])
  const selectedModelConnection = selectedModel ? modelConnectionChecks[selectedModel.id] : undefined

  const commit = (next: AiConfig) => {
    saveAiConfig(localStorage, next)
    setLoaded({ config: next, recovered: false })
  }

  const clearMessage = () => { setStatus(''); setError('') }

  const updateModelConnectionCheck = (modelId: string, check?: ModelConnectionChecks[string]) => {
    setModelConnectionChecks((current) => {
      const next = { ...current }
      if (check) next[modelId] = check
      else delete next[modelId]
      try { localStorage.setItem(MODEL_CONNECTION_STATUS_STORAGE_KEY, JSON.stringify(next)) } catch { /* Connection metadata is optional. */ }
      return next
    })
  }

  const clearModelConnectionChecks = () => {
    setModelConnectionChecks({})
    try { localStorage.removeItem(MODEL_CONNECTION_STATUS_STORAGE_KEY) } catch { /* Connection metadata is optional. */ }
  }

  const updateWritingHistory = (updater: (current: WritingTurn[]) => WritingTurn[], persist = true) => {
    const next = updater(writingHistoryRef.current)
    writingHistoryRef.current = next
    setWritingHistory(next)
    if (persist) {
      try { saveWritingHistory(localStorage, next) }
      catch (caught) { setError(caught instanceof Error ? caught.message : tr('写作记录保存失败。', 'Writing history could not be saved.')) }
    }
  }

  const updateWritingDraft = (nextTask: string) => {
    setTask(nextTask)
    try { saveWritingDraft(localStorage, nextTask) }
    catch (caught) { setError(caught instanceof Error ? caught.message : tr('写作草稿保存失败。', 'Writing draft could not be saved.')) }
  }

  const refreshModels = async () => {
    clearMessage(); setModelRefreshStatus('')
    if (!modelForm.apiKey.trim()) { setError(tr('请先填入 API Key，再从平台刷新型号。', 'Enter the API key before refreshing models.')); return }
    setRefreshingModels(true)
    try {
      const discovered = await discoverModels({ provider: modelForm.provider, baseUrl: modelForm.baseUrl ?? '', apiKey: modelForm.apiKey })
      const choices = discovered.map((model) => modelPresetFromDiscovered(modelForm.provider, modelForm.baseUrl ?? '', model))
      setModelChoices((current) => [...current.filter((item) => !choices.some((choice) => choice.id === item.id)), ...choices])
      const first = choices[0]
      setSelectedPresetId(first.id)
      setModelForm({ ...modelInputFromPreset(first, modelForm.apiKey), enabled: modelForm.enabled ?? true })
      setModelRefreshStatus(tr(`已从平台刷新 ${choices.length} 个型号。`, `Refreshed ${choices.length} models from the provider.`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tr('型号刷新失败。', 'Model refresh failed.'))
    } finally { setRefreshingModels(false) }
  }

  const testAndSaveModel = async () => {
    if (!passphrase) throw new Error(tr('请先设置本机加密口令；口令不会保存。', 'Set a local encryption passphrase first; it is never saved.'))
    if (!modelForm.apiKey.trim()) throw new Error(tr('请先填入 API Key，再测试并保存。', 'Enter the API key before testing and saving.'))
    setTestingDraftModel(true)
    try {
      const temporaryConfig = await addModelProfile(createDefaultAiConfig(), modelForm, passphrase)
      const temporaryModel = temporaryConfig.models[0]
      if (!temporaryModel) throw new Error(tr('无法创建临时模型配置。', 'Unable to create a temporary model configuration.'))
      const key = await unlockModelApiKey(temporaryModel, passphrase)
      const result = await createLLMClient(temporaryModel, key).testConnection()
      if (!result.ok) throw result.error

      const next = await addModelProfile(config, modelForm, passphrase)
      const savedModel = next.models.at(-1)
      if (!savedModel) throw new Error(tr('模型保存后无法读取。', 'The saved model could not be read.'))
      commit(next)
      setSelectedModelId(savedModel.id)
      updateModelConnectionCheck(savedModel.id, { status: 'succeeded', checkedAt: new Date().toISOString(), latencyMs: result.latencyMs })
      setModelForm(emptyModel); setSelectedPresetId(defaultModelPreset.id); setActiveDialog(null)
      setStatus(tr(`连接成功，模型已加密保存在本机并回到写作区（${result.latencyMs} ms）。`, `Connection succeeded. The model was encrypted on this device and you are back in writing (${result.latencyMs} ms).`))
    } finally { setTestingDraftModel(false) }
  }

  const submitModel = async (event: FormEvent) => {
    event.preventDefault(); clearMessage()
    try {
      if (!editingModelId) {
        await testAndSaveModel()
        return
      }
      if (!passphrase) throw new Error(tr('请先设置本机解锁口令；口令不会保存。', 'Set a local unlock passphrase first; it is never saved.'))
      const next = await updateModelProfile(config, editingModelId, modelForm, passphrase)
      commit(next)
      updateModelConnectionCheck(editingModelId)
      setSelectedModelId(next.defaultModelId ?? '')
      setModelForm(emptyModel); setSelectedPresetId(defaultModelPreset.id); setEditingModelId(undefined); setActiveDialog(null); setStatus(tr('模型已保存。API Key 只以加密形式留在本机。', 'Model saved. The API key remains encrypted on this device.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('模型保存失败。', 'Model could not be saved.')) }
  }

  const submitStyle = (event: FormEvent) => {
    event.preventDefault(); clearMessage()
    try {
      const next = editingStyleId ? updateStylePreset(config, editingStyleId, styleForm) : addStylePreset(config, styleForm)
      commit(next); setSelectedStyleId(next.defaultStyleId ?? ''); setStyleForm(emptyStyle); setEditingStyleId(undefined); setStatus(tr('写作风格已保存。', 'Writing style saved.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('风格保存失败。', 'Writing style could not be saved.')) }
  }

  const handleSampleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const content = await readSampleFile(file)
      setStyleForm((current) => ({ ...current, samples: [...current.samples, { id: `sample-${crypto.randomUUID()}`, name: file.name, content }] }))
      setStatus(tr(`已读取样本：${file.name}`, `Sample loaded: ${file.name}`))
    } catch { setError(tr('样本文件读取失败。', 'Sample file could not be read.')) }
    event.target.value = ''
  }

  const testModel = async () => {
    clearMessage()
    if (!selectedModel) { setError(tr('请先保存并选择一个模型。', 'Save and select a model first.')); return }
    try {
      const key = await unlockModelApiKey(selectedModel, passphrase)
      const client = createLLMClient(selectedModel, key)
      const result = await client.testConnection()
      if (result.ok) {
        updateModelConnectionCheck(selectedModel.id, { status: 'succeeded', checkedAt: new Date().toISOString(), latencyMs: result.latencyMs })
        setStatus(tr(`连接成功，耗时 ${result.latencyMs} ms。`, `Connection succeeded in ${result.latencyMs} ms.`))
      } else {
        updateModelConnectionCheck(selectedModel.id, { status: 'failed', checkedAt: new Date().toISOString() })
        setError(result.error.message)
      }
    } catch {
      setError(tr('无法解锁已保存的 API Key，请检查本机解锁口令后重试。', 'Unable to unlock the saved API key. Check the local unlock passphrase and try again.'))
    }
  }

  const testDraftModel = async () => {
    clearMessage()
    if (!passphrase) { setError(tr('请先设置本机解锁口令；口令不会保存。', 'Set a local unlock passphrase first; it is never saved.')); return }
    if (!modelForm.apiKey.trim()) { setError(tr('请先填入 API Key，再测试本次设置。', 'Enter the API key before testing these settings.')); return }
    setTestingDraftModel(true)
    try {
      const temporaryConfig = await addModelProfile(createDefaultAiConfig(), modelForm, passphrase)
      const temporaryModel = temporaryConfig.models[0]
      if (!temporaryModel) throw new Error(tr('无法创建临时模型配置。', 'Unable to create a temporary model configuration.'))
      const key = await unlockModelApiKey(temporaryModel, passphrase)
      const result = await createLLMClient(temporaryModel, key).testConnection()
      if (result.ok) setStatus(tr(`本次设置连接成功，耗时 ${result.latencyMs} ms；尚未保存。`, `These settings connected in ${result.latencyMs} ms and are not saved yet.`))
      else setError(result.error.message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tr('本次设置连接测试失败。', 'These settings could not be tested.'))
    } finally { setTestingDraftModel(false) }
  }

  const startNewWritingConversation = () => {
    clearMessage()
    updateWritingDraft('')
    setStatus(tr('已开始新对话，之前的写作记录仍保留在本机。', 'New conversation started. Previous writing history remains on this device.'))
  }

  const continueWritingTurn = (turn: WritingTurn) => {
    updateWritingDraft(turn.output || turn.task)
    setStatus(tr('已带回输入框，尚未发送。', 'Returned to the editor; nothing was sent.'))
  }

  const deleteWritingTurn = (id: string) => {
    updateWritingHistory((current) => current.filter((turn) => turn.id !== id))
    setStatus(tr('该条写作记录已删除。', 'Writing record deleted.'))
  }

  const copyWritingTurn = async (turn: WritingTurn) => {
    clearMessage()
    try {
      if (!navigator.clipboard?.writeText) throw new Error(tr('当前浏览器不支持复制，请手动选择文本。', 'This browser does not support copying. Select the text manually.'))
      await navigator.clipboard.writeText(turn.output)
      setStatus(tr('生成内容已复制。', 'Generated content copied.'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('复制失败。', 'Copy failed.')) }
  }

  const generate = async () => {
    clearMessage()
    if (!task.trim()) { setError(tr('请输入写作任务。', 'Enter a writing task.')); return }
    if (!selectedModel) { setError(tr('请先保存并选择一个模型。', 'Save and select a model first.')); return }
    const turn = createWritingTurn(task)
    updateWritingHistory((current) => [...current, turn])
    setRunning(true)
    try {
      const key = await unlockModelApiKey(selectedModel, passphrase)
      const client = createLLMClient(selectedModel, key)
      const skills = loadWritingSkills(localStorage).skills.filter((skill) => skill.enabled).map(({ name, content }) => ({ name, content }))
      const request = { task, style: selectedStyle, styleEnabled: true, humanization: config.humanization, skills }
      if (selectedModel.streaming) {
        let text = ''
        for await (const chunk of client.streamText(request)) {
          text += chunk
          updateWritingHistory((current) => current.map((item) => item.id === turn.id ? { ...item, output: text } : item), false)
        }
        updateWritingHistory((current) => current.map((item) => item.id === turn.id ? { ...item, status: 'complete' } : item))
      } else {
        const text = await client.generateText(request)
        updateWritingHistory((current) => current.map((item) => item.id === turn.id ? { ...item, output: text, status: 'complete' } : item))
      }
      setStatus(tr('生成完成。', 'Generation complete.'))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : tr('生成失败。', 'Generation failed.')
      updateWritingHistory((current) => current.map((item) => item.id === turn.id ? { ...item, status: 'error', error: message } : item))
      setError(message)
    }
    finally { setRunning(false) }
  }

  const startEditModel = (id: string) => {
    const model = config.models.find((item) => item.id === id)
    if (!model) return
    const next = modelFormForProfile(model)
    setEditingModelId(id)
    setSelectedPresetId(next.presetId ?? '')
    setModelForm(next.form)
  }

  const startEditStyle = (id: string) => {
    const style = config.styles.find((item) => item.id === id)
    if (!style) return
    setEditingStyleId(id); setStyleForm({ name: style.name, description: style.description, samples: style.samples, isDefault: style.isDefault })
  }

  const importConfigFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const value = JSON.parse(await file.text())
      const models = Array.isArray(value.models) ? value.models.map((model: Record<string, unknown>) => ({ ...model, encryptedApiKey: undefined })) : value.models
      if (value.schemaVersion !== 1) throw new Error(tr('不支持的 AI 配置版本。', 'Unsupported AI configuration version.'))
      const result = importAiConfig(JSON.stringify({ ...value, models }), config)
      if (result.error) throw new Error(result.error)
      commit(result.config); clearModelConnectionChecks(); setStatus(tr('AI 配置已导入（出于安全原因不包含 API Key）。', 'AI configuration imported (API keys are excluded for safety).'))
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr('AI 配置导入失败。', 'AI configuration import failed.')) }
    event.target.value = ''
  }

  return (
    <section className="ai-workbench" aria-labelledby="ai-heading">
      <div className="ai-heading"><h2 id="ai-heading">{workspace === 'writing' ? tr('AI 写作', 'AI writing') : tr('封面生成', 'Cover generator')}</h2><div className="ai-heading-actions">{workspace === 'cover' && <button type="button" onClick={() => setWorkspace('writing')}>{tr('回到写作', 'Back to writing')}</button>}{workspace === 'writing' && <button type="button" onClick={() => setActiveDialog('model')}>{tr('模型设置', 'Model settings')}</button>}</div></div>
      {workspace === 'cover' ? <CoverWorkbench language={language} /> : <>
      {!activeDialog && (status || error || loaded.recovered) && <p className={error ? 'ai-message error' : 'ai-message'} role={error ? 'alert' : 'status'}>{error || status || tr('AI 配置损坏，已恢复空配置。', 'AI configuration was damaged; an empty configuration was restored.')}</p>}
      {activeDialog && <div className="ai-settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveDialog(null) }}>
        <FloatingPanel
          className="ai-settings-dialog"
          eyebrow={activeDialog === 'model' ? tr('配置 AI', 'Configure AI') : tr('写作辅助', 'Writing tools')}
          title={activeDialog === 'model' ? tr('模型与连接', 'Models and connection') : activeDialog === 'style' ? tr('写作风格与去 AI 味', 'Writing style and humanization') : tr('写作 Skill', 'Writing Skill')}
          closeLabel={activeDialog === 'model' ? tr('关闭模型设置', 'Close model settings') : activeDialog === 'style' ? tr('关闭风格设置', 'Close style settings') : tr('关闭 Skill 设置', 'Close Skill settings')}
          onClose={() => setActiveDialog(null)}
          width={Math.min(980, window.innerWidth - 32)}
          height={Math.min(720, window.innerHeight - 32)}
          minWidth={360}
          minHeight={320}
        >
          {(status || error || loaded.recovered) && <p className={error ? 'ai-message error panel-message' : 'ai-message panel-message'} role={error ? 'alert' : 'status'}>{error || status || tr('AI 配置损坏，已恢复空配置。', 'AI configuration was damaged; an empty configuration was restored.')}</p>}
          <div className="ai-grid ai-settings-grid">
        {activeDialog === 'model' && <section className="ai-panel model-panel" aria-labelledby="models-heading">
          <div className="panel-title"><h3 id="models-heading">{tr('模型与连接', 'Models and connection')}</h3><span>{config.models.length} {tr('个模型', 'models')}</span></div>
          <p className="panel-help">{tr('首次只需三步：选模型、填 API Key、设置本机加密口令。接口和默认参数已预填；导出文件不会包含密钥。', 'First-time setup takes three steps: choose a model, enter an API key, and set a local encryption passphrase. The endpoint and defaults are prefilled; exports never contain keys.')}</p>
          <form className="ai-form" onSubmit={submitModel}>
            <label className="ai-field">{tr('1. 模型选择', '1. Choose a model')}<select aria-label={tr('模型选择', 'Choose a model')} value={selectedPresetId} onChange={(event) => { if (event.target.value === 'custom') { setSelectedPresetId('custom'); return }; const preset = modelChoices.find((item) => item.id === event.target.value); if (!preset) return; setSelectedPresetId(preset.id); setModelForm({ ...modelInputFromPreset(preset, modelForm.apiKey), enabled: modelForm.enabled ?? true }) }}><option value="" disabled>{tr('请选择模型预设', 'Choose a model preset')}</option>{modelChoices.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}<option value="custom">{tr('自定义型号', 'Custom model')}</option></select></label>
            {selectedPresetId === 'custom' && <label className="ai-field">{tr('自定义模型 ID', 'Custom model ID')}<input value={modelForm.model} onChange={(event) => setModelForm({ ...modelForm, model: event.target.value, name: event.target.value || tr('自定义型号', 'Custom model') })} /></label>}
            <label className="ai-field">{tr('2. API Key', '2. API Key')}{editingModelId && <small>{tr('留空表示保留已有密钥', 'Leave blank to keep the saved key')}</small>}<input type="password" value={modelForm.apiKey} onChange={(event) => setModelForm({ ...modelForm, apiKey: event.target.value })} placeholder={editingModelId ? tr('已保存（不回显）', 'Saved (hidden)') : tr('粘贴你自己的 Key', 'Paste your own key')} autoComplete="off" /></label>
            <label className="ai-field">{tr(config.models.length === 0 ? '3. 首次本机加密口令' : '3. 本机解锁口令', config.models.length === 0 ? '3. First local encryption passphrase' : '3. Local unlock passphrase')}<input aria-label={tr('本机解锁口令', 'Local unlock passphrase')} aria-describedby="model-passphrase-help" type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder={tr('只在当前页面内存中使用', 'Used only in this page memory')} autoComplete="new-password" /></label><small id="model-passphrase-help" className="field-help">{tr('只在当前页面内存中使用，用于本机加密和解锁 API Key；不会上传或保存，请自行记住。', 'Used only in this page memory to encrypt and unlock the API key locally. It is never uploaded or saved, so keep it yourself.')}</small>
            <details className="model-advanced-settings"><summary>{tr('高级参数（已预填）', 'Advanced parameters (prefilled)')}</summary><div className="ai-preset-summary" aria-label={tr('模型预设参数', 'Preset parameters')}>
              <div><span>{tr('模型名称', 'Model name')}</span><strong>{modelForm.name}</strong></div>
              <div><span>{tr('模型供应商', 'Provider')}</span><strong>{PROVIDER_OPTIONS.find((option) => option.id === modelForm.provider)?.label ?? modelForm.provider}</strong></div>
              <div><span>{tr('接口地址', 'Base URL')}</span><code>{modelForm.baseUrl}</code></div>
              <div><span>{tr('模型 ID', 'Model ID')}</span><code>{modelForm.model}</code></div>
              <div><span>{tr('默认温度', 'Default temperature')}</span><strong>{modelForm.temperature ?? '—'}</strong></div>
              <div><span>{tr('最大输出 Tokens', 'Max output tokens')}</span><strong>{modelForm.maxTokens ?? '—'}</strong></div>
              <div><span>{tr('输出方式', 'Output')}</span><strong>{modelForm.streaming ? tr('流式输出', 'Streaming') : tr('一次性输出', 'Complete response')}</strong></div>
            </div><div className="model-refresh-row"><button type="button" onClick={() => void refreshModels()} disabled={refreshingModels || !modelForm.apiKey.trim()}>{refreshingModels ? tr('刷新中…', 'Refreshing…') : tr('从平台刷新型号', 'Refresh models from provider')}</button><small>{modelRefreshStatus || tr('只向当前接口地址发送 API Key，不经过 CreatorDock。', 'The key is sent only to this provider, never to CreatorDock.')}</small></div></details>
            <div className="ai-actions"><button type="button" onClick={() => void testDraftModel()} disabled={testingDraftModel || !modelForm.apiKey.trim()}>{testingDraftModel ? tr('测试中…', 'Testing…') : tr('仅测试本次设置', 'Test settings only')}</button><button className="primary-action" type="submit" disabled={testingDraftModel}>{editingModelId ? tr('更新模型', 'Update model') : tr('测试并保存', 'Test and save')}</button>{editingModelId && <button type="button" onClick={() => { setEditingModelId(undefined); setSelectedPresetId(defaultModelPreset.id); setModelForm(emptyModel) }}>{tr('取消编辑', 'Cancel edit')}</button>}</div>
          </form>
          <div className="model-list">{config.models.map((model) => <article className={`model-card ${model.id === selectedModel?.id ? 'selected' : ''}`} key={model.id}><button type="button" className="model-select" onClick={() => setSelectedModelId(model.id)}><strong>{findModelPreset(model)?.label ?? model.name}{config.defaultModelId === model.id ? ` · ${tr('默认', 'default')}` : ''}</strong><span>{PROVIDER_OPTIONS.find((option) => option.id === model.provider)?.label ?? model.provider} · {model.model}</span><small>{model.encryptedApiKey ? tr('Key 已加密保存', 'Key encrypted') : tr('未保存 Key', 'Key not saved')}</small></button><div className="model-card-actions"><button type="button" onClick={() => commit(setDefaultModel(config, model.id))}>{config.defaultModelId === model.id ? tr('默认', 'Default') : tr('设为默认', 'Set default')}</button><button type="button" onClick={() => startEditModel(model.id)}>{tr('编辑', 'Edit')}</button><button type="button" onClick={() => { commit(deleteModelProfile(config, model.id)); updateModelConnectionCheck(model.id) }}>{tr('删除', 'Delete')}</button></div></article>)}</div>
          <div className="ai-actions"><button type="button" onClick={() => void testModel()} disabled={!selectedModel}>{tr('测试当前连接', 'Test connection')}</button><button type="button" onClick={() => downloadAiConfig(config)}>{tr('导出 AI 配置', 'Export AI config')}</button><button type="button" onClick={() => configFileInput.current?.click()}>{tr('导入 AI 配置', 'Import AI config')}</button><input ref={configFileInput} className="sr-only" type="file" accept=".json,application/json" onChange={(event) => void importConfigFile(event)} /></div>
        </section>}

        {activeDialog === 'style' && <section className="ai-panel style-panel" aria-labelledby="style-heading">
          <div className="panel-title"><h3 id="style-heading">{tr('写作风格与去 AI 味', 'Writing style and humanization')}</h3><span>{selectedStyle ? `${tr('当前', 'Current')}: ${selectedStyle.name}` : tr('尚未设置风格', 'No style selected')}</span></div>
          <form className="ai-form" onSubmit={submitStyle}><label className="ai-field">{tr('风格名称', 'Style name')}<input value={styleForm.name} onChange={(event) => setStyleForm({ ...styleForm, name: event.target.value })} placeholder={tr('例如：我的公众号口吻', 'e.g. My newsletter voice')} /></label><label className="ai-field">{tr('风格描述', 'Style description')}<textarea value={styleForm.description} onChange={(event) => setStyleForm({ ...styleForm, description: event.target.value })} placeholder={tr('描述语气、节奏、常用表达和读者感受', 'Describe tone, rhythm, expressions, and reader feeling')} /></label><label className="ai-field">{tr('样本内容', 'Sample content')}<textarea value={styleForm.samples[0]?.content ?? ''} onChange={(event) => setStyleForm({ ...styleForm, samples: [{ id: styleForm.samples[0]?.id ?? `sample-${Date.now()}`, name: styleForm.samples[0]?.name ?? '手动样本', content: event.target.value }] })} placeholder={tr('粘贴一段你自己的文章；只作为风格参考，不会被当作指令', 'Paste your own writing as style reference, not instructions')} /></label><SampleList samples={styleForm.samples} onChange={(samples) => setStyleForm({ ...styleForm, samples })} language={language} /><label className="check-field"><input type="checkbox" checked={styleForm.isDefault} onChange={(event) => setStyleForm({ ...styleForm, isDefault: event.target.checked })} />{tr('设为默认风格', 'Set as default style')}</label><div className="ai-actions"><button type="button" onClick={() => sampleFileInput.current?.click()}>{tr('导入 .txt / .md 样本', 'Import .txt / .md samples')}</button><button className="primary-action" type="submit">{editingStyleId ? tr('更新风格', 'Update style') : tr('保存风格', 'Save style')}</button>{editingStyleId && <button type="button" onClick={() => { setEditingStyleId(undefined); setStyleForm(emptyStyle) }}>{tr('取消编辑', 'Cancel edit')}</button>}</div></form>
          <div className="style-list">{config.styles.map((style) => <article className={`style-card ${style.id === selectedStyle?.id ? 'selected' : ''}`} key={style.id}><button type="button" className="model-select" onClick={() => setSelectedStyleId(style.id)}><strong>{style.name}{style.isDefault ? ` · ${tr('默认', 'default')}` : ''}</strong><span>{style.description || tr('未填写描述', 'No description')}</span><small>{style.samples.length} {tr('个样本', 'samples')}</small></button><div className="model-card-actions"><button type="button" onClick={() => startEditStyle(style.id)}>{tr('编辑', 'Edit')}</button><button type="button" onClick={() => commit(deleteStylePreset(config, style.id))}>{tr('删除', 'Delete')}</button></div></article>)}</div>
          <div className="humanization-box"><label className="check-field"><input type="checkbox" checked={config.humanization.enabled} onChange={(event) => commit(updateHumanizationRules(config, { enabled: event.target.checked }))} />{tr('启用去 AI 味规则', 'Enable humanization rules')}</label><label className="ai-field">{tr('内置规则（可编辑）', 'Built-in rules (editable)')}<textarea value={config.humanization.rules} onChange={(event) => commit(updateHumanizationRules(config, { rules: event.target.value }))} /></label><div className="ai-two-col"><label className="ai-field">{tr('禁用词（每行一个）', 'Forbidden words (one per line)')}<textarea value={config.humanization.forbiddenWords.join('\n')} onChange={(event) => commit(updateHumanizationRules(config, { forbiddenWords: event.target.value.split(/\n/).map((item) => item.trim()).filter(Boolean) }))} /></label><label className="ai-field">{tr('必须习惯（每行一个）', 'Required habits (one per line)')}<textarea value={config.humanization.requiredHabits.join('\n')} onChange={(event) => commit(updateHumanizationRules(config, { requiredHabits: event.target.value.split(/\n/).map((item) => item.trim()).filter(Boolean) }))} /></label></div></div>
        </section>}

          </div>
          {activeDialog === 'skill' && <SkillManager language={language} />}
        </FloatingPanel>
      </div>}
      <div className="ai-grid ai-main-grid">
        <section className="ai-panel generation-panel" aria-label={tr('写作任务区', 'Writing task area')}>
          <p className="panel-help generation-helper">{tr('使用你自己的模型，帮你高效完成草稿撰写、改写和润色等任务。', 'Use your own model to draft, rewrite, and polish your content.')}</p>
          <aside className="writing-setup-notice" aria-label={tr('模型连接状态', 'Model connection status')}>
            <strong>{tr('模型状态', 'Model status')}</strong>
            {!selectedModel
              ? <span>{tr('未配置：设置模型后即可开始写作。', 'Unconfigured: set up a model to start writing.')}</span>
              : selectedModelConnection?.status === 'succeeded'
                ? <span>{tr(`上次连接成功${selectedModelConnection.latencyMs === undefined ? '' : ` · ${selectedModelConnection.latencyMs} ms`}`, `Last connection succeeded${selectedModelConnection.latencyMs === undefined ? '' : ` · ${selectedModelConnection.latencyMs} ms`}`)}</span>
                : selectedModelConnection?.status === 'failed'
                  ? <span>{tr('上次连接失败，请检查口令或 API Key。', 'The last connection failed. Check the passphrase or API key.')}</span>
                  : <span>{tr('已保存，尚未验证连接。', 'Saved, connection unverified.')}</span>}
            <button type="button" onClick={() => setActiveDialog('model')}>{selectedModel ? tr('测试连接', 'Test connection') : tr('去设置模型', 'Set up model')}</button>
          </aside>
          {writingHistory.length > 0 && <div className="writing-history" aria-label={tr('写作对话记录', 'Writing conversation history')}>
            <div className="writing-history-heading"><strong>{tr('写作记录', 'Writing history')}</strong><span>{tr('已保留在本机', 'Saved on this device')}</span></div>
            {writingHistory.map((turn) => <article className="writing-turn" key={turn.id}>
              <div className="writing-bubble user-bubble"><span>{tr('你', 'You')}</span><p>{turn.task}</p></div>
              <div className="writing-bubble assistant-bubble"><span>AI</span>{turn.status === 'generating' && !turn.output ? <p className="writing-pending">{tr('正在生成…', 'Generating…')}</p> : turn.status === 'interrupted' ? <p className="writing-error">{tr('上次生成已中断；你可以继续这条或删除记录。', 'The previous generation was interrupted. Continue or delete this record.')}</p> : turn.status === 'error' ? <p className="writing-error">{turn.error}</p> : <pre>{turn.output}</pre>}<div className="writing-turn-actions">{turn.output && <><button type="button" onClick={() => continueWritingTurn(turn)}>{tr('继续这条', 'Continue')}</button><button type="button" onClick={() => void copyWritingTurn(turn)}>{tr('复制', 'Copy')}</button></>}<button type="button" onClick={() => deleteWritingTurn(turn.id)}>{tr('删除', 'Delete')}</button></div></div>
            </article>)}
          </div>}
          <div className="writing-draft-heading"><strong>{tr('当前草稿', 'Current draft')}</strong><button type="button" onClick={startNewWritingConversation}>{tr('新对话', 'New conversation')}</button></div>
          <label className="ai-field">{tr('写作任务', 'Writing task')}<textarea aria-describedby="writing-draft-status" className="task-input" value={task} onChange={(event) => updateWritingDraft(event.target.value)} placeholder={tr('例如：把下面这段素材改成一篇自然口语的公众号开头……', 'e.g. Turn the material below into a natural, conversational newsletter opening…')} /></label><small id="writing-draft-status" className="writing-draft-status">{tr('草稿会自动保存在本机；新对话不会删除之前的写作记录。', 'Drafts save automatically on this device; new conversations do not delete earlier writing history.')}</small>
          <button className="primary-action generate-button" type="button" onClick={() => void generate()} disabled={running}>{running ? tr('生成中…', 'Generating…') : tr('生成内容', 'Generate')}</button>
          <div className="ai-feature-actions"><button type="button" onClick={() => setActiveDialog('style')}>{tr('写作风格与去 AI 味', 'Writing style and humanization')}</button><button type="button" onClick={() => setActiveDialog('skill')}>{tr('写作 Skill', 'Writing Skill')}</button><button type="button" onClick={() => setWorkspace('cover')}>{tr('封面生成', 'Cover generation')}</button></div>
        </section>
      </div>
      <input ref={sampleFileInput} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void handleSampleFile(event)} />
      </>}
    </section>
  )
}

function SampleList({ samples, onChange, language }: { samples: StyleSample[], onChange: (samples: StyleSample[]) => void, language: LanguageSetting }) {
  const tr = (zh: string, en: string): string => language === 'en' ? en : zh
  return <div className="sample-list" aria-label={tr('风格样本列表', 'Writing samples')}>{samples.length === 0 && <p className="panel-help sample-empty">{tr('还没有风格样本；可以继续粘贴，或导入多个 .txt/.md 文件。', 'No writing samples yet; paste text or import multiple .txt/.md files.')}</p>}{samples.map((sample, index) => <div className="sample-row" key={sample.id}><label className="ai-field">{tr(`样本 ${index + 1} 名称`, `Sample ${index + 1} name`)}<input value={sample.name} onChange={(event) => onChange(samples.map((item) => item.id === sample.id ? { ...item, name: event.target.value } : item))} /></label><label className="ai-field">{tr('样本内容', 'Sample content')}<textarea value={sample.content} onChange={(event) => onChange(samples.map((item) => item.id === sample.id ? { ...item, content: event.target.value } : item))} /></label><span className="sample-size">{sample.content.length.toLocaleString()} {tr('字符', 'chars')}</span><button type="button" aria-label={tr(`删除样本 ${sample.name || index + 1}`, `Delete sample ${sample.name || index + 1}`)} onClick={() => onChange(samples.filter((item) => item.id !== sample.id))}>{tr('删除', 'Delete')}</button></div>)}<button type="button" onClick={() => onChange([...samples, { id: `sample-${Date.now()}`, name: `${tr('手动样本', 'Manual sample')} ${samples.length + 1}`, content: '' }])}>{tr('新增样本', 'Add sample')}</button></div>
}

function readSampleFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file)
  })
}

function downloadAiConfig(config: AiConfig): void {
  const url = URL.createObjectURL(new Blob([exportAiConfig(config)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `${AI_CONFIG_STORAGE_KEY}.json`; link.click(); URL.revokeObjectURL(url)
}
