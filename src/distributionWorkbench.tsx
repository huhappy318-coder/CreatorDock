import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { CreatorDockConfig, LaunchEntry } from './config'
import { platformPresets, customIconSrc } from './catalog'
import { platformLabel } from './i18n'
import type { ContentPackageRecord } from './contentPackage'
import { AiWorkbench } from './aiWorkbench'
import { FloatingPanel } from './floatingPanel'
import { DISTRIBUTION_KEY, distributionMarkdown, distributionStatus, downloadDistributionFile, loadDistributions, mergeDistributionChanges, parseDistributions, serializeDistributions, validPublishedUrl, type Distribution, type DistributionStatus } from './distribution'
import './distribution.css'

type View = 'dashboard' | 'library' | 'platforms' | 'settings' | 'assistant'
const viewNames = { dashboard: '分发工作台', library: '内容库', platforms: '平台管理', settings: '设置', assistant: 'AI 辅助适配' }
const enNames = { dashboard: 'Distribution workspace', library: 'Content library', platforms: 'Platform management', settings: 'Settings', assistant: 'AI assistant' }
function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><path d="m21 3-7 18-4-7-7-4Z"/><path d="m10 14 5-5"/></>,
    library: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    platforms: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/></>,
    assistant: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.library}</svg>
}
function PlatformIcon({ entry }: { entry: LaunchEntry }) { return <img className="dock-platform-icon" src={platformPresets.find(p => p.id === entry.platformPresetId)?.iconSrc ?? customIconSrc} alt="" /> }

export function DistributionWorkbench({ config, management, onOpen }: { config: CreatorDockConfig; management: (settings: boolean) => ReactNode; onOpen: (event: MouseEvent<HTMLAnchorElement>, entry: LaunchEntry) => void }) {
  const [initial] = useState(() => loadDistributions(localStorage))
  const [records, setRecords] = useState(initial.records)
  const savedRecords = useRef(initial.records)
  const [conflictNotice, setConflictNotice] = useState('')
  const [view, setView] = useState<View>(() => { const value = new URLSearchParams(location.search).get('view'); return value && Object.hasOwn(viewNames, value) ? value as View : 'dashboard' })
  const [sourceContent, setSourceContent] = useState<{ title: string; body: string; entryId: string }>()
  const [assistantVisited, setAssistantVisited] = useState(view === 'assistant')
  const [selectedId, setSelectedId] = useState(records[0]?.id)
  const [targetId, setTargetId] = useState('')
  const [filter, setFilter] = useState<DistributionStatus>('pending')
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [editor, setEditor] = useState<'new' | Distribution | null>(null)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(initial.error ?? '')
  const [blocked, setBlocked] = useState(Boolean(initial.error))
  const [publishUrl, setPublishUrl] = useState('')
  const [publishError, setPublishError] = useState('')
  const [undoId, setUndoId] = useState<string>()
  const [mobileDetail, setMobileDetail] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const names = config.language === 'en' ? enNames : viewNames
  const active = records.filter(r => Boolean(r.archived) === archived)
  const visible = active.filter(r => (view === 'library' || distributionStatus(r) === filter) && `${r.title} ${r.body} ${r.targets.map(t => t.entry.displayName).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  const selected = visible.find(r => r.id === selectedId) ?? visible[0]
  const target = selected?.targets.find(t => t.entry.id === targetId) ?? selected?.targets[0]
  const completed = selected?.targets.filter(t => t.publishedAt).length ?? 0
  useEffect(() => { setPublishUrl(target?.publishedUrl ?? ''); setPublishError('') }, [selected?.id, target?.entry.id, target?.publishedUrl])
  const navigate = (next: View) => { setView(next); setArchived(false); setSearch(''); if (next === 'assistant') setAssistantVisited(true); const url = new URL(location.href); url.searchParams.set('view', next); history.replaceState(null, '', url); setMobileDetail(false) }
  const persist = (next: Distribution[], allowRecovery = false) => {
    if (blocked && !allowRecovery) return false
    let merged = next
    try {
      const latest = loadDistributions(localStorage)
      if (latest.error && !allowRecovery) {
        setStorageError('存储中的记录已损坏或不可读取，已停止覆盖。当前编辑仍在页面中，请导出备份后修复。')
        setBlocked(true)
        setRecords(next)
        return false
      }
      const result = mergeDistributionChanges(savedRecords.current, next, latest.error ? savedRecords.current : latest.records)
      merged = result.records
      if (result.conflicts) setConflictNotice(`检测到其他标签页修改了相同内容，已保留 ${result.conflicts} 份冲突副本，请在内容库核对。`)
      localStorage.setItem(DISTRIBUTION_KEY, serializeDistributions(merged))
      savedRecords.current = merged
      setStorageError(''); setBlocked(false)
    } catch { setStorageError('保存失败：浏览器存储空间不足或不可用。当前内容仍在页面中，请立即导出分发备份，勿刷新。') }
    setRecords(merged)
    return true
  }
  const update = (item: Distribution) => persist(records.map(r => r.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : r))
  const openEditor = (value: 'new' | Distribution) => { returnFocus.current = document.activeElement as HTMLElement; setEditor(value) }
  const closeEditor = () => { setEditor(null); returnFocus.current?.focus() }
  const copy = async (text: string, label: string) => { try { await navigator.clipboard.writeText(text); setNotice(`${label}已复制`) } catch { setNotice('复制未成功，请打开「编辑内容」手动选择复制。') } }
  const backup = () => downloadDistributionFile('creatordock-distributions.json', serializeDistributions(records), 'application/json')
  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const imported = parseDistributions(await file.text())
      const merged = [...records]
      let added = 0
      for (const item of imported) {
        const existing = merged.find(r => r.id === item.id)
        if (!existing) { merged.push(item); added++ }
        else if (JSON.stringify(existing) !== JSON.stringify(item)) { merged.push({ ...item, id: crypto.randomUUID(), title: `${item.title}（导入副本）` }); added++ }
      }
      persist(merged, true); setNotice(`已导入 ${added} 条内容；已有内容保留。`)
    } catch (error) { setNotice(error instanceof Error ? error.message : '无法导入备份') }
  }
  const markPublished = () => {
    if (!selected || !target) return
    if (!validPublishedUrl(publishUrl.trim())) { setPublishError('请输入有效的 http 或 https 链接，或留空。'); return }
    const next = { ...selected, targets: selected.targets.map(t => t.entry.id === target.entry.id ? { ...t, publishedAt: new Date().toISOString(), publishedUrl: publishUrl.trim() || undefined } : t) }
    if (update(next)) { setNotice(`${target.entry.displayName} 已记录为发布完成`); setFilter(distributionStatus(next)) }
  }
  const importPackage = (record: ContentPackageRecord) => {
    const targets = record.variants.flatMap(variant => {
      const entry = config.entries.find(e => e.id === variant.target.id)
      return entry && variant.status === 'complete' && variant.output.trim() ? [{ entry: { ...entry }, title: record.brief.trim().slice(0, 200), body: variant.output }] : []
    })
    if (!targets.length) { setNotice('没有可分发的已完成稿件，请先确认对应平台入口仍然存在。'); return }
    if (blocked) { setNotice('请先在设置中修复分发数据，再加入队列。'); return }
    const now = new Date().toISOString()
    const item: Distribution = { id: crypto.randomUUID(), title: record.brief.trim().slice(0, 200), body: targets[0].body, targets, createdAt: now, updatedAt: now }
    if (persist([item, ...records])) {
      setSelectedId(item.id); setTargetId(''); setFilter('pending'); navigate('dashboard')
      setNotice(`已加入 ${targets.length} 份平台稿件。请检查标题与正文后再发布；原内容包已保留。`)
    }
  }
  const showQueue = view === 'dashboard' || view === 'library'
  return <div className={`distribution-shell theme-${config.theme} ${config.density === 'compact' ? 'dock-compact' : ''}`} lang={config.language}>
    <aside className="dock-sidebar">
      <a className="dock-brand" href="#" onClick={event => { event.preventDefault(); navigate('dashboard') }}><span>CD</span>CreatorDock</a>
      <nav aria-label="主导航">{(['dashboard', 'library', 'platforms'] as View[]).map(key => <button key={key} title={names[key]} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon name={key}/><span>{names[key]}</span></button>)}</nav>
      <div className="dock-sidebar-bottom"><button title={names.assistant} onClick={() => navigate('assistant')} aria-current={view === 'assistant' ? 'page' : undefined}><Icon name="assistant"/><span>{names.assistant}</span></button><button title={names.settings} onClick={() => navigate('settings')} aria-current={view === 'settings' ? 'page' : undefined}><Icon name="settings"/><span>{names.settings}</span></button><small><span className="dock-local-dot"/> 数据保存在本机</small></div>
    </aside>
    <main className={`dock-main ${showQueue ? 'dock-with-detail' : ''}`}>
      <header className="dock-header"><div><h1>{names[view]}</h1><p>{view === 'dashboard' ? '管理内容，分发到每一个平台' : view === 'library' ? '每一份内容，都有完整的分发记录' : view === 'platforms' ? '管理平台入口与账号，快速进入发布后台' : view === 'assistant' ? '为不同平台准备更合适的文案' : '管理偏好设置与本机数据'}</p></div>{showQueue && <button className="dock-primary" onClick={() => openEditor('new')} disabled={blocked || !config.entries.length}>＋ 新建分发</button>}</header>
      {conflictNotice && <div className="dock-notice" role="status">{conflictNotice}<button onClick={() => setConflictNotice('')}>知道了</button></div>}
      {(notice || storageError) && <div className={`dock-notice ${storageError ? 'dock-error' : ''}`} role={storageError ? 'alert' : 'status'}>{storageError || notice} <button onClick={() => storageError ? backup() : setNotice('')}>{storageError ? '导出当前备份' : '关闭'}</button></div>}
      {storageError && notice && <div className="dock-notice" role="status">{notice}<button onClick={() => setNotice('')}>关闭</button></div>}
      {blocked && <div className="dock-recovery"><button onClick={() => { try { downloadDistributionFile('creatordock-original-data.json', localStorage.getItem(DISTRIBUTION_KEY) ?? '') } catch { setNotice('当前无法读取浏览器存储。') } }}>导出原始数据</button><label>导入修复后的备份<input type="file" accept=".json" onChange={event => void importBackup(event.target.files?.[0])}/></label></div>}
      {showQueue && <div className="dock-workspace"><section className="dock-queue" aria-label="内容队列">
        {view === 'dashboard' && <section className="dock-shortcuts"><div className="dock-section-heading"><h2>常用平台</h2><button onClick={() => navigate('platforms')}>管理平台 ↗</button></div><div className="dock-shortcut-grid">{config.entries.slice(0,4).map(entry => <a key={entry.id} href={entry.destinationUrl} target="_blank" rel="noopener noreferrer" onClick={event => onOpen(event, entry)}><PlatformIcon entry={entry}/><span><strong>{platformLabel(entry.platformPresetId, config.language, entry.displayName)}</strong><small>{entry.displayName}</small></span><span className="dock-arrow">↗</span></a>)}</div>{!config.entries.length && <button onClick={() => navigate('platforms')}>先添加一个平台账号 →</button>}</section>}
        <div className="dock-queue-toolbar">{view === 'dashboard' ? <div className="dock-tabs" role="tablist" aria-label="分发状态">{([['pending','待分发'],['progress','进行中'],['complete','已完成']] as const).map(([key,label]) => <button role="tab" key={key} aria-label={`${label} ${records.filter(r => !r.archived && distributionStatus(r) === key).length}`} aria-selected={filter === key} onClick={() => { setFilter(key); setMobileDetail(false) }}>{label}<span>{records.filter(r => !r.archived && distributionStatus(r) === key).length}</span></button>)}</div> : <div className="dock-tabs"><button aria-pressed={!archived} onClick={() => setArchived(false)}>全部内容</button><button aria-pressed={archived} onClick={() => setArchived(true)}>已归档</button></div>}<input type="search" placeholder="搜索内容" aria-label="搜索分发内容" value={search} onChange={event => setSearch(event.target.value)}/></div>
        <div className="dock-records">{visible.map(item => <button className={`dock-record ${selected?.id === item.id ? 'is-selected' : ''}`} key={item.id} onClick={() => { setSelectedId(item.id); setTargetId(''); setMobileDetail(true) }} aria-label={`查看分发：${item.title}`} aria-pressed={selected?.id === item.id}><span className="dock-thumbnail">{item.cover ? <img src={item.cover} alt=""/> : <Icon name="library"/>}</span><span className="dock-record-content"><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} 更新 · {item.targets.length} 个平台</small><span className="dock-badges">{item.targets.map(t => <span key={t.entry.id} className={t.publishedAt ? 'is-done' : ''}>{t.publishedAt ? '✓' : '○'} {t.entry.displayName}</span>)}</span></span><span className="dock-record-arrow">›</span></button>)}</div>
        {!visible.length && <div className="dock-empty"><span className="dock-empty-icon"><Icon name={search ? 'library' : 'dashboard'}/></span><h2>{search ? '没有找到相关内容' : filter === 'complete' && view === 'dashboard' ? '发布完成的内容会显示在这里' : filter === 'progress' && view === 'dashboard' ? '暂时没有进行中的分发' : archived ? '还没有归档内容' : '从第一份内容开始'}</h2><p>{search ? '换一个关键词，或清空搜索再试。' : '准备一份内容，选择平台，在这里跟进每一次发布。'}</p>{!search && !archived && filter === 'pending' && <button className="dock-primary" onClick={() => config.entries.length ? openEditor('new') : navigate('platforms')} disabled={blocked}>{config.entries.length ? '＋ 新建分发' : '添加平台'}</button>}</div>}
        <footer className="dock-queue-footer"><span>{storageError ? '● 尚未安全保存' : '✓ 内容仅保存在当前浏览器'} · {active.length} 份内容</span><button onClick={backup}>导出备份</button></footer>
      </section><aside className={`dock-detail ${mobileDetail ? 'is-open' : ''}`} aria-label="当前分发"><button className="dock-detail-back" onClick={() => setMobileDetail(false)}>← 返回内容队列</button>{selected && target ? <><div className="dock-detail-eyebrow">当前分发 <button onClick={() => openEditor(selected)}>编辑内容</button></div><h2>{selected.title}</h2><p className="dock-progress-label">{completed}/{selected.targets.length} 个平台已完成</p><progress max={selected.targets.length} value={completed} aria-label="分发进度"/>
        <div className="dock-target-list">{selected.targets.map(t => <button key={t.entry.id} className={target.entry.id === t.entry.id ? 'is-selected' : ''} onClick={() => setTargetId(t.entry.id)}><PlatformIcon entry={t.entry}/><span><strong>{platformLabel(t.entry.platformPresetId, config.language, t.entry.displayName)}</strong><small>{t.entry.displayName}</small></span><em className={t.publishedAt ? 'is-done' : ''}>{t.publishedAt ? '已发布' : t.title.trim() && t.body.trim() ? '待发布' : '待准备'}</em></button>)}</div>
        <section className="dock-preparation"><h3>{platformLabel(target.entry.platformPresetId, config.language, target.entry.displayName)}发布准备</h3><ul><li><span>{target.title.trim() ? '✓' : '○'}</span>标题已准备</li><li><span>{target.body.trim() ? '✓' : '○'}</span>正文已准备</li><li><span>{selected.cover ? '✓' : '○'}</span>{selected.cover ? '封面已准备' : '封面图片（可选）'}</li></ul><div className="dock-copy-actions"><button disabled={!target.title} onClick={() => void copy(target.title, '标题')}>复制标题</button><button disabled={!target.body} onClick={() => void copy(target.body, '正文')}>复制正文</button>{selected.cover && <a href={selected.cover} download={`cover.${selected.cover.includes('image/jpeg') ? 'jpg' : selected.cover.includes('image/webp') ? 'webp' : 'png'}`}>下载封面</a>}</div><a className="dock-open-platform" href={(config.entries.find(e => e.id === target.entry.id) ?? target.entry).destinationUrl} target="_blank" rel="noopener noreferrer" onClick={event => onOpen(event, config.entries.find(e => e.id === target.entry.id) ?? target.entry)}>打开发布后台 <span>↗</span></a><p className="dock-help">在平台完成发布后，回来记录发布结果。</p>
        {target.publishedAt ? <div className="dock-published"><strong>✓ 已记录发布</strong><p>{new Date(target.publishedAt).toLocaleString('zh-CN')}</p>{target.publishedUrl && <a href={target.publishedUrl} target="_blank" rel="noopener noreferrer">查看已发布内容 ↗</a>}<button onClick={() => { const next = { ...selected, targets: selected.targets.map(t => t.entry.id === target.entry.id ? { ...t, publishedAt: undefined, publishedUrl: undefined } : t) }; update(next); setFilter(distributionStatus(next)); setNotice('已撤销发布记录') }}>撤销发布标记</button></div> : <><label className="dock-url-label">发布链接 <span>可选</span><input type="url" placeholder="https://…" aria-label="发布链接" value={publishUrl} onChange={event => { setPublishUrl(event.target.value); setPublishError('') }}/></label>{publishError && <p role="alert" className="dock-error-text">{publishError}</p>}<button className="dock-mark-published" disabled={!target.title.trim() || !target.body.trim() || blocked} onClick={markPublished}>✓ 标记已发布</button></>}
        <button className="dock-ai-link" onClick={() => { setSourceContent({ title: target.title, body: target.body, entryId: target.entry.id }); navigate('assistant') }}><Icon name="assistant"/>AI 辅助适配 <span>↗</span></button></section><div className="dock-detail-bottom"><button onClick={() => downloadDistributionFile(`${selected.title.replace(/[\\/:*?"<>|]/g,'-')}.md`, distributionMarkdown(selected))}>导出文案</button><button disabled={blocked} onClick={() => { update({ ...selected, archived: !selected.archived }); setUndoId(selected.id); setNotice(selected.archived ? '内容已恢复' : '内容已归档，可在内容库恢复'); setMobileDetail(false) }}>{selected.archived ? '恢复内容' : '归档内容'}</button></div></> : <div className="dock-detail-placeholder"><Icon name="dashboard"/><h2>让每次分发更有条理</h2><p>选择一份内容，查看各平台的准备情况与发布进度。</p><div><span>01 准备内容</span><span>02 前往平台发布</span><span>03 记录发布结果</span></div></div>}</aside></div>}
      {undoId && <div className="dock-undo" role="status">已更新归档状态 <button onClick={() => { const item = records.find(r => r.id === undoId); if (item) update({ ...item, archived: !item.archived }); setUndoId(undefined); setNotice('已撤销归档操作') }}>撤销</button><button onClick={() => setUndoId(undefined)} aria-label="关闭撤销提示">×</button></div>}
      <div hidden={view !== 'platforms' && view !== 'settings'} className={`dock-manager ${view === 'settings' ? 'dock-manager-settings' : ''}`}>{management(view === 'settings')}</div>
      {view === 'settings' && <section className="dock-data-settings"><h2>分发数据备份</h2><p>包含内容、平台文案与发布记录。导入会合并数据，同名冲突保留副本。</p><button onClick={backup}>导出分发备份</button><label className="dock-file-button">导入分发备份<input type="file" accept=".json,application/json" onChange={event => { void importBackup(event.target.files?.[0]); event.target.value = '' }}/></label></section>}
      <section className="dock-assistant" hidden={view !== 'assistant'}>{assistantVisited && <AiWorkbench language={config.language} entries={config.entries} sourceContent={sourceContent} onDistribute={importPackage}/>}</section>
    </main>
    {editor && <div className="dock-modal-backdrop"><FloatingPanel eyebrow="CreatorDock / 分发内容" title={editor === 'new' ? '新建分发' : '编辑分发内容'} closeLabel="关闭分发编辑" onClose={closeEditor} width={660} height={710} minWidth={280} className="dock-editor"><DistributionEditor entries={config.entries} item={editor === 'new' ? undefined : editor} onCancel={closeEditor} onSave={item => { if (persist(editor === 'new' ? [item, ...records] : records.map(r => r.id === item.id ? item : r))) { setSelectedId(item.id); setFilter(distributionStatus(item)); setSearch(''); setNotice('内容已更新'); closeEditor(); navigate(item.archived || view === 'library' ? 'library' : 'dashboard'); setArchived(Boolean(item.archived)) } }}/></FloatingPanel></div>}
  </div>
}

function DistributionEditor({ entries, item, onSave, onCancel }: { entries: LaunchEntry[]; item?: Distribution; onSave: (item: Distribution) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [body, setBody] = useState(item?.body ?? '')
  const [cover, setCover] = useState(item?.cover)
  const [targets, setTargets] = useState(item?.targets ?? [])
  const [error, setError] = useState('')
  const [readingCover, setReadingCover] = useState(false)
  const coverVersion = useRef(0)
  const [customTarget, setCustomTarget] = useState('')
  const accounts = [...entries, ...(item?.targets.filter(t => !entries.some(e => e.id === t.entry.id)).map(t => t.entry) ?? [])]
  const upload = async (file?: File) => {
    if (!file) return
    const version = ++coverVersion.current
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setReadingCover(false); setError('请选择不超过 2 MB 的 PNG、JPG 或 WebP 图片'); return }
    setReadingCover(true)
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      await new Promise<void>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(); image.onerror = reject; image.src = data })
      if (version === coverVersion.current) { setCover(data); setError('') }
    } catch { setError('图片读取失败，请换一张图片') } finally { if (version === coverVersion.current) setReadingCover(false) }
  }
  const activeTarget = targets.find(t => t.entry.id === customTarget)
  return <form className="dock-editor-form" onSubmit={event => { event.preventDefault(); if (!title.trim() || !body.trim() || !targets.length) { setError('请填写标题、正文，并至少选择一个分发平台'); return } const now = new Date().toISOString(); onSave({ ...item, id: item?.id ?? crypto.randomUUID(), title: title.trim(), body, cover, targets: targets.map(t => ({ ...t, title: t.title === (item?.title ?? '') ? title.trim() : t.title, body: t.body === (item?.body ?? '') ? body : t.body })), createdAt: item?.createdAt ?? now, updatedAt: now }) }}>
    <label>内容标题<input aria-label="内容标题" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="给这份内容起个名字"/></label>
    <label>正文<textarea aria-label="正文" required rows={6} value={body} onChange={event => setBody(event.target.value)} placeholder="粘贴你准备分发的内容…"/></label>
    <fieldset><legend>分发到哪些平台</legend><div className="dock-account-picker">{accounts.map(entry => <label key={entry.id}><input type="checkbox" checked={targets.some(t => t.entry.id === entry.id)} disabled={Boolean(targets.find(t => t.entry.id === entry.id)?.publishedAt)} onChange={event => setTargets(event.target.checked ? [...targets, { entry: { ...entry }, title: item?.title ?? '', body: item?.body ?? '' }] : targets.filter(t => t.entry.id !== entry.id))}/><PlatformIcon entry={entry}/>{entry.displayName}{targets.find(t => t.entry.id === entry.id)?.publishedAt && <small>已发布</small>}</label>)}</div></fieldset>
    <label className="dock-cover-upload">封面图片 <span>可选 · PNG / JPG / WebP，最大 2 MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void upload(event.target.files?.[0])}/></label>{cover && <div className="dock-cover-preview"><img src={cover} alt="封面预览"/><button type="button" onClick={() => { ++coverVersion.current; setReadingCover(false); setCover(undefined) }}>移除封面</button></div>}
    {item && <details className="dock-adapt-editor"><summary>为不同平台单独调整文案</summary><label>选择平台<select aria-label="选择平台" value={customTarget} onChange={event => setCustomTarget(event.target.value)}><option value="">请选择</option>{targets.map(t => <option key={t.entry.id} value={t.entry.id}>{t.entry.displayName}</option>)}</select></label>{activeTarget && <><label>平台标题<input aria-label="平台标题" value={activeTarget.title} onChange={event => setTargets(targets.map(t => t.entry.id === customTarget ? { ...t, title: event.target.value } : t))}/></label><label>平台正文<textarea aria-label="平台正文" rows={5} value={activeTarget.body} onChange={event => setTargets(targets.map(t => t.entry.id === customTarget ? { ...t, body: event.target.value } : t))}/></label>{activeTarget.publishedAt && <p>修改准备文案不会更改平台上的内容或已有发布记录。</p>}</>}</details>}
    {error && <p role="alert" className="dock-error-text">{error}</p>}<div className="dock-editor-actions"><button type="button" onClick={onCancel}>取消</button><button className="dock-primary" disabled={readingCover} type="submit">{readingCover ? '读取图片中…' : item ? '保存修改' : '创建分发'}</button></div>
  </form>
}
