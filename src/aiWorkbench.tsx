import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AI_CONFIG_STORAGE_KEY,
  addModelProfile,
  addStylePreset,
  deleteModelProfile,
  deleteStylePreset,
  exportAiConfig,
  importAiConfig,
  loadAiConfig,
  saveAiConfig,
  setDefaultModel,
  unlockModelApiKey,
  updateHumanizationRules,
  updateModelProfile,
  updateStylePreset,
  type AiConfig,
  type ModelProfileInput,
  type ProviderKind,
} from './aiConfig'
import { createLLMClient } from './llmClient'
import { type StyleSample } from './stylePrompt'

const emptyModel: ModelProfileInput = {
  name: '', provider: 'openai-compatible', baseUrl: '', model: '', apiKey: '',
  temperature: 0.7, maxTokens: 4096, streaming: true, imageGeneration: false, enabled: true,
}

const emptyStyle = { name: '', description: '', samples: [] as StyleSample[], isDefault: false }

export function AiWorkbench() {
  const [loaded, setLoaded] = useState(() => loadAiConfig(localStorage))
  const { config } = loaded
  const [passphrase, setPassphrase] = useState('')
  const [modelForm, setModelForm] = useState<ModelProfileInput>(emptyModel)
  const [editingModelId, setEditingModelId] = useState<string>()
  const [styleForm, setStyleForm] = useState(emptyStyle)
  const [editingStyleId, setEditingStyleId] = useState<string>()
  const [selectedModelId, setSelectedModelId] = useState(config.defaultModelId ?? '')
  const [selectedStyleId, setSelectedStyleId] = useState(config.defaultStyleId ?? '')
  const [styleEnabled, setStyleEnabled] = useState(true)
  const [task, setTask] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const configFileInput = useRef<HTMLInputElement>(null)
  const sampleFileInput = useRef<HTMLInputElement>(null)

  const selectedModel = useMemo(() => config.models.find((model) => model.id === selectedModelId) ?? config.models.find((model) => model.id === config.defaultModelId), [config.defaultModelId, config.models, selectedModelId])
  const selectedStyle = useMemo(() => config.styles.find((style) => style.id === selectedStyleId) ?? config.styles.find((style) => style.id === config.defaultStyleId), [config.defaultStyleId, config.styles, selectedStyleId])

  const commit = (next: AiConfig) => {
    saveAiConfig(localStorage, next)
    setLoaded({ config: next, recovered: false })
  }

  const clearMessage = () => { setStatus(''); setError('') }

  const submitModel = async (event: FormEvent) => {
    event.preventDefault(); clearMessage()
    try {
      if (!passphrase) throw new Error('请先设置本机解锁口令；口令不会保存。')
      const next = editingModelId
        ? await updateModelProfile(config, editingModelId, modelForm, passphrase)
        : await addModelProfile(config, modelForm, passphrase)
      commit(next)
      setSelectedModelId(next.defaultModelId ?? '')
      setModelForm(emptyModel); setEditingModelId(undefined); setStatus('模型已保存。API Key 只以加密形式留在本机。')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '模型保存失败。') }
  }

  const submitStyle = (event: FormEvent) => {
    event.preventDefault(); clearMessage()
    try {
      const next = editingStyleId ? updateStylePreset(config, editingStyleId, styleForm) : addStylePreset(config, styleForm)
      commit(next); setSelectedStyleId(next.defaultStyleId ?? ''); setStyleForm(emptyStyle); setEditingStyleId(undefined); setStatus('写作风格已保存。')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '风格保存失败。') }
  }

  const handleSampleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const content = await readSampleFile(file)
      setStyleForm((current) => ({ ...current, samples: [...current.samples, { id: `sample-${crypto.randomUUID()}`, name: file.name, content }] }))
      setStatus(`已读取样本：${file.name}`)
    } catch { setError('样本文件读取失败。') }
    event.target.value = ''
  }

  const testModel = async () => {
    clearMessage()
    if (!selectedModel) { setError('请先保存并选择一个模型。'); return }
    try {
      const key = await unlockModelApiKey(selectedModel, passphrase)
      const result = await createLLMClient(selectedModel, key).testConnection()
      if (result.ok) setStatus(`连接成功，耗时 ${result.latencyMs} ms。`)
      else setError(result.error.message)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '连接测试失败。') }
  }

  const generate = async () => {
    clearMessage(); setOutput('')
    if (!task.trim()) { setError('请输入写作任务。'); return }
    if (!selectedModel) { setError('请先保存并选择一个模型。'); return }
    setRunning(true)
    try {
      const key = await unlockModelApiKey(selectedModel, passphrase)
      const client = createLLMClient(selectedModel, key)
      const request = { task, style: selectedStyle, styleEnabled, humanization: config.humanization }
      if (selectedModel.streaming) {
        let text = ''
        for await (const chunk of client.streamText(request)) { text += chunk; setOutput(text) }
      } else setOutput(await client.generateText(request))
      setStatus('生成完成。')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '生成失败。') }
    finally { setRunning(false) }
  }

  const startEditModel = (id: string) => {
    const model = config.models.find((item) => item.id === id)
    if (!model) return
    setEditingModelId(id)
    setModelForm({ name: model.name, provider: model.provider, baseUrl: model.baseUrl, model: model.model, apiKey: '', temperature: model.temperature, maxTokens: model.maxTokens, streaming: model.streaming, imageGeneration: model.imageGeneration, enabled: model.enabled })
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
      if (value.schemaVersion !== 1) throw new Error('不支持的 AI 配置版本。')
      const result = importAiConfig(JSON.stringify({ ...value, models }), config)
      if (result.error) throw new Error(result.error)
      commit(result.config); setStatus('AI 配置已导入（出于安全原因不包含 API Key）。')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'AI 配置导入失败。') }
    event.target.value = ''
  }

  return (
    <section className="ai-workbench" aria-labelledby="ai-heading">
      <div className="ai-heading"><div><p className="eyebrow">PRIVATE AI DESK</p><h2 id="ai-heading">写作实验室</h2></div><span className="ai-privacy">直连你自己的模型 · 本机加密</span></div>
      {(status || error || loaded.recovered) && <p className={error ? 'ai-message error' : 'ai-message'} role={error ? 'alert' : 'status'}>{error || status || 'AI 配置损坏，已恢复空配置。'}</p>}
      <div className="ai-grid">
        <section className="ai-panel model-panel" aria-labelledby="models-heading">
          <div className="panel-title"><h3 id="models-heading">模型与连接</h3><span>{config.models.length} 个模型</span></div>
          <p className="panel-help">API Key 只在保存时用本机口令加密；导出文件不会包含密钥。请求由浏览器直接发往你填写的地址。</p>
          <label className="ai-field">本机解锁口令<input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="只在当前页面内存中使用" autoComplete="new-password" /></label>
          <form className="ai-form" onSubmit={submitModel}>
            <label className="ai-field">模型名称<input value={modelForm.name} onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} placeholder="例如：我的 DeepSeek" /></label>
            <label className="ai-field">提供商<select value={modelForm.provider} onChange={(event) => setModelForm({ ...modelForm, provider: event.target.value as ProviderKind })}><option value="openai-compatible">OpenAI 兼容</option><option value="dashscope">通义千问 / DashScope</option><option value="gemini">Google Gemini</option><option value="anthropic">Anthropic Claude</option></select></label>
            <label className="ai-field">Base URL<input type="url" value={modelForm.baseUrl} onChange={(event) => setModelForm({ ...modelForm, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" /></label>
            <label className="ai-field">模型 ID<input value={modelForm.model} onChange={(event) => setModelForm({ ...modelForm, model: event.target.value })} placeholder="deepseek-chat / gpt-4o-mini" /></label>
            <label className="ai-field">API Key{editingModelId && <small>留空表示保留已有密钥</small>}<input type="password" value={modelForm.apiKey} onChange={(event) => setModelForm({ ...modelForm, apiKey: event.target.value })} placeholder={editingModelId ? '已保存（不回显）' : '粘贴你自己的 Key'} autoComplete="off" /></label>
            <div className="ai-two-col"><label className="ai-field">Temperature<input type="number" min="0" max="2" step="0.1" value={modelForm.temperature ?? ''} onChange={(event) => setModelForm({ ...modelForm, temperature: event.target.value === '' ? undefined : Number(event.target.value) })} /></label><label className="ai-field">Max tokens<input type="number" min="1" value={modelForm.maxTokens ?? ''} onChange={(event) => setModelForm({ ...modelForm, maxTokens: event.target.value === '' ? undefined : Number(event.target.value) })} /></label></div>
            <div className="ai-two-col"><label className="check-field"><input type="checkbox" checked={modelForm.streaming} onChange={(event) => setModelForm({ ...modelForm, streaming: event.target.checked })} />启用流式输出</label><label className="check-field"><input type="checkbox" checked={modelForm.imageGeneration} onChange={(event) => setModelForm({ ...modelForm, imageGeneration: event.target.checked })} />支持图片生成</label></div>
            <div className="ai-actions"><button className="primary-action" type="submit">{editingModelId ? '更新模型' : '保存模型'}</button>{editingModelId && <button type="button" onClick={() => { setEditingModelId(undefined); setModelForm(emptyModel) }}>取消编辑</button>}</div>
          </form>
          <div className="model-list">{config.models.map((model) => <article className={`model-card ${model.id === selectedModel?.id ? 'selected' : ''}`} key={model.id}><button type="button" className="model-select" onClick={() => setSelectedModelId(model.id)}><strong>{model.name}{config.defaultModelId === model.id ? ' · 默认' : ''}</strong><span>{model.provider} · {model.model}</span><small>{model.encryptedApiKey ? 'Key 已加密保存' : '未保存 Key'}</small></button><div className="model-card-actions"><button type="button" onClick={() => commit(setDefaultModel(config, model.id))}>{config.defaultModelId === model.id ? '默认' : '设为默认'}</button><button type="button" onClick={() => startEditModel(model.id)}>编辑</button><button type="button" onClick={() => commit(deleteModelProfile(config, model.id))}>删除</button></div></article>)}</div>
          <div className="ai-actions"><button type="button" onClick={() => void testModel()} disabled={!selectedModel}>测试当前连接</button><button type="button" onClick={() => downloadAiConfig(config)}>导出 AI 配置</button><button type="button" onClick={() => configFileInput.current?.click()}>导入 AI 配置</button><input ref={configFileInput} className="sr-only" type="file" accept=".json,application/json" onChange={(event) => void importConfigFile(event)} /></div>
        </section>

        <section className="ai-panel style-panel" aria-labelledby="style-heading">
          <div className="panel-title"><h3 id="style-heading">写作风格与去 AI 味</h3><span>{selectedStyle ? `当前：${selectedStyle.name}` : '尚未设置风格'}</span></div>
          <form className="ai-form" onSubmit={submitStyle}><label className="ai-field">风格名称<input value={styleForm.name} onChange={(event) => setStyleForm({ ...styleForm, name: event.target.value })} placeholder="例如：我的公众号口吻" /></label><label className="ai-field">风格描述<textarea value={styleForm.description} onChange={(event) => setStyleForm({ ...styleForm, description: event.target.value })} placeholder="描述语气、节奏、常用表达和读者感受" /></label><label className="ai-field">样本内容<textarea value={styleForm.samples[0]?.content ?? ''} onChange={(event) => setStyleForm({ ...styleForm, samples: [{ id: styleForm.samples[0]?.id ?? `sample-${Date.now()}`, name: styleForm.samples[0]?.name ?? '手动样本', content: event.target.value }] })} placeholder="粘贴一段你自己的文章；只作为风格参考，不会被当作指令" /></label><SampleList samples={styleForm.samples} onChange={(samples) => setStyleForm({ ...styleForm, samples })} /><label className="check-field"><input type="checkbox" checked={styleForm.isDefault} onChange={(event) => setStyleForm({ ...styleForm, isDefault: event.target.checked })} />设为默认风格</label><div className="ai-actions"><button type="button" onClick={() => sampleFileInput.current?.click()}>导入 .txt / .md 样本</button><button className="primary-action" type="submit">{editingStyleId ? '更新风格' : '保存风格'}</button>{editingStyleId && <button type="button" onClick={() => { setEditingStyleId(undefined); setStyleForm(emptyStyle) }}>取消编辑</button>}</div></form>
          <div className="style-list">{config.styles.map((style) => <article className={`style-card ${style.id === selectedStyle?.id ? 'selected' : ''}`} key={style.id}><button type="button" className="model-select" onClick={() => setSelectedStyleId(style.id)}><strong>{style.name}{style.isDefault ? ' · 默认' : ''}</strong><span>{style.description || '未填写描述'}</span><small>{style.samples.length} 个样本</small></button><div className="model-card-actions"><button type="button" onClick={() => startEditStyle(style.id)}>编辑</button><button type="button" onClick={() => commit(deleteStylePreset(config, style.id))}>删除</button></div></article>)}</div>
          <div className="humanization-box"><label className="check-field"><input type="checkbox" checked={config.humanization.enabled} onChange={(event) => commit(updateHumanizationRules(config, { enabled: event.target.checked }))} />启用去 AI 味规则</label><label className="ai-field">内置规则（可编辑）<textarea value={config.humanization.rules} onChange={(event) => commit(updateHumanizationRules(config, { rules: event.target.value }))} /></label><div className="ai-two-col"><label className="ai-field">禁用词（每行一个）<textarea value={config.humanization.forbiddenWords.join('\n')} onChange={(event) => commit(updateHumanizationRules(config, { forbiddenWords: event.target.value.split(/\n/).map((item) => item.trim()).filter(Boolean) }))} /></label><label className="ai-field">必须习惯（每行一个）<textarea value={config.humanization.requiredHabits.join('\n')} onChange={(event) => commit(updateHumanizationRules(config, { requiredHabits: event.target.value.split(/\n/).map((item) => item.trim()).filter(Boolean) }))} /></label></div></div>
        </section>

        <section className="ai-panel generation-panel" aria-labelledby="generation-heading"><div className="panel-title"><h3 id="generation-heading">开始写作</h3><span>每次请求都会带上统一提示词</span></div><div className="ai-two-col"><label className="ai-field">使用模型<select value={selectedModel?.id ?? ''} onChange={(event) => setSelectedModelId(event.target.value)}><option value="">请选择模型</option>{config.models.filter((model) => model.enabled).map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}</select></label><label className="ai-field">使用风格<select value={selectedStyle?.id ?? ''} onChange={(event) => setSelectedStyleId(event.target.value)}><option value="">不使用风格</option>{config.styles.map((style) => <option value={style.id} key={style.id}>{style.name}</option>)}</select></label></div><label className="check-field"><input type="checkbox" checked={styleEnabled} onChange={(event) => setStyleEnabled(event.target.checked)} />本次使用写作风格和去 AI 味规则</label><label className="ai-field">写作任务<textarea className="task-input" value={task} onChange={(event) => setTask(event.target.value)} placeholder="例如：把下面这段素材改成一篇有具体细节、自然口语的公众号开头……" /></label><button className="primary-action generate-button" type="button" onClick={() => void generate()} disabled={running}>{running ? '生成中…' : '生成内容'}</button>{output && <div className="generation-output" aria-label="生成结果"><div className="output-title">生成结果</div><pre>{output}</pre></div>}</section>
      </div>
      <input ref={sampleFileInput} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void handleSampleFile(event)} />
    </section>
  )
}

function SampleList({ samples, onChange }: { samples: StyleSample[], onChange: (samples: StyleSample[]) => void }) {
  return <div className="sample-list" aria-label="风格样本列表">{samples.length === 0 && <p className="panel-help sample-empty">还没有风格样本；可以继续粘贴，或导入多个 .txt/.md 文件。</p>}{samples.map((sample, index) => <div className="sample-row" key={sample.id}><label className="ai-field">样本 {index + 1} 名称<input value={sample.name} onChange={(event) => onChange(samples.map((item) => item.id === sample.id ? { ...item, name: event.target.value } : item))} /></label><label className="ai-field">样本内容<textarea value={sample.content} onChange={(event) => onChange(samples.map((item) => item.id === sample.id ? { ...item, content: event.target.value } : item))} /></label><span className="sample-size">{sample.content.length.toLocaleString()} 字符</span><button type="button" aria-label={`删除样本 ${sample.name || index + 1}`} onClick={() => onChange(samples.filter((item) => item.id !== sample.id))}>删除</button></div>)}<button type="button" onClick={() => onChange([...samples, { id: `sample-${Date.now()}`, name: `手动样本 ${samples.length + 1}`, content: '' }])}>新增样本</button></div>
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
