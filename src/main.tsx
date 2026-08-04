import {
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
} from 'react'
import { createRoot } from 'react-dom/client'
import { customIconSrc, platformPresets } from './catalog'
import {
  addLaunchEntry,
  createDefaultConfig,
  createShortcutExport,
  deleteLaunchEntry,
  duplicateLaunchEntry,
  editLaunchEntry,
  exportConfig,
  filterLaunchEntries,
  importConfig,
  loadConfig,
  reorderLaunchEntry,
  saveConfig,
  suggestDuplicateDisplayName,
  type BrowserTarget,
  type CreatorDockConfig,
  type DensitySetting,
  type LanguageSetting,
  type LaunchEntry,
  type NewLaunchEntry,
  type ThemeSetting,
} from './config'
import { platformLabel, translate } from './i18n'
import './styles.css'
import { AiWorkbench } from './aiWorkbench'
import { browserWindowName, openBrowserEntryInNewWindow, openBrowserEntryWindow, rememberBrowserWindow } from './browserWindows'
import {
  createDesktopAlias,
  getDesktopAliasStatus,
  getDesktopPlatform,
  getMacDesktopAliasOnboardingHandled,
  initializeDesktopWindow,
  isTauriRuntime,
  markMacDesktopAliasOnboardingHandled,
  openDesktopConfigStore,
  openExternalUrl,
  removeDesktopAlias,
  shouldOfferMacDesktopAlias,
  type DesktopAliasStatus,
  type DesktopConfigStore,
  type DesktopPlatform,
  type DesktopWindowController,
  type WindowMode,
} from './desktop'

const presetById = new Map(platformPresets.map((preset) => [preset.id, preset]))

export function App() {
  const desktopRuntime = isTauriRuntime()
  const [loaded, setLoaded] = useState(() => loadConfig(localStorage))
  const [desktopStore, setDesktopStore] = useState<DesktopConfigStore | null>(null)
  const [desktopReady, setDesktopReady] = useState(!desktopRuntime)
  const { config } = loaded
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(config.language, key, values)

  useEffect(() => {
    document.documentElement.lang = config.language
  }, [config.language])

  const [query, setQuery] = useState('')
  const [editingEntry, setEditingEntry] = useState<LaunchEntry | null>()
  const [copyingEntry, setCopyingEntry] = useState<LaunchEntry | null>(null)
  const [entryMenuId, setEntryMenuId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LaunchEntry | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'status', message: string } | null>(
    loaded.recovered
      ? { kind: 'status', message: translate(loaded.config.language, 'recoveredBrowser') }
      : null,
  )
  const [desktopAlias, setDesktopAlias] = useState<DesktopAliasStatus | null>(null)
  const [desktopPlatform, setDesktopPlatform] = useState<DesktopPlatform>('other')
  const [desktopAliasBusy, setDesktopAliasBusy] = useState(false)
  const [desktopAliasFeedback, setDesktopAliasFeedback] = useState<string | null>(null)
  const [macDesktopAliasOnboardingHandled, setMacDesktopAliasOnboardingHandled] = useState<boolean | null>(null)
  const [desktopWindow, setDesktopWindow] = useState<DesktopWindowController | null>(null)
  const [windowMode, setWindowMode] = useState<WindowMode>('normal')
  const [windowBusy, setWindowBusy] = useState(false)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const mobileAddButton = useRef<HTMLButtonElement>(null)
  const workbenchAddButton = useRef<HTMLButtonElement>(null)
  const entryActionButtons = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (!desktopRuntime) return
    let cancelled = false
    void openDesktopConfigStore()
      .then(async (store) => {
        if (cancelled) return
        if (!store) {
          setDesktopReady(true)
          setFeedback({ kind: 'error', message: t('desktopStorageUnavailable') })
          return
        }
        const result = await store.read()
        if (cancelled) return
        setDesktopStore(store)
        setLoaded({ config: result.config, recovered: result.recovered })
        if (!result.hasStoredConfig || result.recovered) await store.write(result.config)
        if (result.recovered) setFeedback({ kind: 'status', message: t('recoveredDesktop') })
        setDesktopReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setDesktopReady(true)
        setFeedback({ kind: 'error', message: t('desktopStorageOpenFailed') })
      })
    return () => {
      cancelled = true
    }
  }, [desktopRuntime])

  useEffect(() => {
    if (!desktopRuntime) return
    let cancelled = false
    let controller: DesktopWindowController | null = null
    void initializeDesktopWindow()
      .then((value) => {
        if (cancelled) {
          value?.dispose()
          return
        }
        controller = value
        setDesktopWindow(value)
        if (value) setWindowMode(value.getMode())
      })
      .catch(() => setFeedback({ kind: 'error', message: t('windowChangeFailed') }))
    return () => {
      cancelled = true
      controller?.dispose()
    }
  }, [desktopRuntime])

  useEffect(() => {
    if (!desktopRuntime) return
    void getDesktopPlatform().then(setDesktopPlatform).catch(() => setDesktopPlatform('other'))
    void getDesktopAliasStatus()
      .then(setDesktopAlias)
      .catch(() => setDesktopAliasFeedback(t('desktopShortcutStatusUnavailable')))
  }, [desktopRuntime])

  useEffect(() => {
    if (!desktopRuntime || desktopPlatform !== 'macos' || desktopAlias === null) return
    let cancelled = false
    void getMacDesktopAliasOnboardingHandled()
      .then((handled) => {
        if (!cancelled) setMacDesktopAliasOnboardingHandled(handled)
      })
      .catch(() => {
        if (!cancelled) setMacDesktopAliasOnboardingHandled(null)
      })
    return () => {
      cancelled = true
    }
  }, [desktopAlias, desktopPlatform, desktopRuntime])

  const visibleEntries = useMemo(
    () => filterLaunchEntries(config.entries, query),
    [config.entries, query],
  )

  const commitConfig = (nextConfig: CreatorDockConfig) => {
    if (!desktopRuntime || !desktopStore) saveConfig(localStorage, nextConfig)
    setLoaded({ config: nextConfig, recovered: false })
    void desktopStore?.write(nextConfig).catch(() => {
      setFeedback({ kind: 'error', message: t('desktopStorageSaveFailed') })
    })
  }

  const handleDestinationOpen = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    url: string,
    entryId: string,
    displayName: string,
    mode: 'account' | 'new' = 'account',
  ) => {
    if (desktopRuntime) {
      event.preventDefault()
      void openExternalUrl(url).catch(() => {
        setFeedback({ kind: 'error', message: t('destinationOpenFailed') })
      })
      return
    }
    let opened = false
    try {
      opened = mode === 'new' ? openBrowserEntryInNewWindow(url) : openBrowserEntryWindow(url, entryId)
    } catch {
      opened = false
    }
    if (!opened) {
      setFeedback({ kind: 'status', message: `${displayName} · ${t('destinationOpenedInTab')}` })
      return
    }
    event.preventDefault()
    if (mode === 'account') {
      try {
        rememberBrowserWindow(localStorage, { entryId, windowName: browserWindowName(entryId), url, lastOpenedAt: new Date().toISOString() })
      } catch {
        // The window already opened, so preserve the success state even if metadata cannot be stored.
      }
    }
    setFeedback({ kind: 'status', message: `${displayName} · ${t(mode === 'new' ? 'destinationOpenedInNewWindow' : 'destinationOpenedInWindow')}` })
  }

  const toggleDesktopAlias = async () => {
    setDesktopAliasBusy(true)
    setDesktopAliasFeedback(null)
    try {
      const next = desktopAlias?.exists
        ? await removeDesktopAlias()
        : await createDesktopAlias()
      setDesktopAlias(next)
      setDesktopAliasFeedback(next.exists ? t('desktopAliasCreated') : t('desktopAliasRemoved'))
    } catch {
      setDesktopAliasFeedback(t('desktopAliasChangeFailed'))
    } finally {
      setDesktopAliasBusy(false)
    }
  }

  const dismissMacDesktopAliasOnboarding = async () => {
    try {
      await markMacDesktopAliasOnboardingHandled()
      setMacDesktopAliasOnboardingHandled(true)
    } catch {
      setDesktopAliasFeedback(t('desktopAliasChangeFailed'))
    }
  }

  const createMacDesktopAliasFromOnboarding = async () => {
    setDesktopAliasBusy(true)
    setDesktopAliasFeedback(null)
    try {
      const next = await createDesktopAlias()
      setDesktopAlias(next)
      if (next.exists) {
        await markMacDesktopAliasOnboardingHandled()
        setMacDesktopAliasOnboardingHandled(true)
        setDesktopAliasFeedback(t('desktopAliasCreated'))
      }
    } catch {
      setDesktopAliasFeedback(t('desktopAliasChangeFailed'))
    } finally {
      setDesktopAliasBusy(false)
    }
  }

  const changeWindowMode = async (action: 'toggle' | 'reset') => {
    if (!desktopWindow) return
    setWindowBusy(true)
    try {
      setWindowMode(action === 'toggle' ? await desktopWindow.toggleLeftFloating() : await desktopWindow.resetDefault())
    } catch {
      setFeedback({ kind: 'error', message: t('windowChangeFailed') })
    } finally {
      setWindowBusy(false)
    }
  }

  const openAdd = (button: HTMLButtonElement) => {
    returnFocus.current = button
    setCopyingEntry(null)
    setEditingEntry(null)
  }

  const closeEditor = () => {
    returnFocus.current?.focus()
    setCopyingEntry(null)
    setEditingEntry(undefined)
  }

  const saveEntry = (value: NewLaunchEntry) => {
    commitConfig(copyingEntry
      ? duplicateLaunchEntry(config, copyingEntry.id, value)
      : editingEntry
        ? editLaunchEntry(config, editingEntry.id, value)
        : addLaunchEntry(config, value))
    closeEditor()
  }

  const copyEntry = (entry: LaunchEntry, button: HTMLButtonElement) => {
    returnFocus.current = button
    setEntryMenuId(null)
    setCopyingEntry(entry)
    setEditingEntry({
      ...entry,
      displayName: suggestDuplicateDisplayName(config, entry.id, t('copyNameSuffix')),
    })
  }

  const moveEntry = (id: string, destinationIndex: number) => {
    commitConfig(reorderLaunchEntry(config, id, destinationIndex))
  }

  const moveVisibleEntry = (id: string, direction: -1 | 1) => {
    const visibleIndex = visibleEntries.findIndex((entry) => entry.id === id)
    const target = visibleEntries[visibleIndex + direction]
    if (!target) return
    moveEntry(id, config.entries.findIndex((entry) => entry.id === target.id))
  }

  const focusAddDestination = () => {
    const candidates = [workbenchAddButton.current, mobileAddButton.current].filter(
      (button): button is HTMLButtonElement => button !== null,
    )
    const visibleButton = candidates.find((button) => {
      for (let element: HTMLElement | null = button; element; element = element.parentElement) {
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return false
      }
      return true
    })
    ;(visibleButton ?? candidates[0])?.focus()
  }

  const handleImport = async (file?: File) => {
    if (!file) return
    try {
      const result = importConfig(await readTextFile(file), config)
      if (result.error) {
        setFeedback({ kind: 'error', message: result.error })
        return
      }
      commitConfig(result.config)
      setQuery('')
      setFeedback({ kind: 'status', message: t('configImported') })
    } catch {
      setFeedback({ kind: 'error', message: t('configReadFailed') })
    }
  }

  if (!desktopReady) {
    return <div className="desktop-loading" role="status">{t('preparing')}</div>
  }

  return (
    <div className={`app-shell theme-${config.theme} density-${config.density}`} lang={config.language}>
      <header className="mobile-header">
        <a className="brand" href="#workbench" aria-label={t('brandHome')}><span>CD</span> CreatorDock</a>
        <button ref={mobileAddButton} type="button" onClick={(event) => openAdd(event.currentTarget)}>{t('addDestination')}</button>
      </header>

      <main className="workbench" id="workbench">
        {feedback && (
          <div className={`feedback ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </div>
        )}
        <header className="compact-header">
          <div className="brand-stack">
            <a className="brand" href="#workbench" aria-label={t('brandHome')}><span>CD</span> CreatorDock</a>
          </div>
          <div className="header-actions">
            {desktopRuntime && <div className="window-actions" aria-label={t('desktopEntry')}><button type="button" disabled={windowBusy || !desktopWindow} onClick={() => void changeWindowMode('toggle')}>{windowMode === 'left-floating' ? t('restoreWindow') : t('leftFloating')}</button><button type="button" disabled={windowBusy || !desktopWindow} onClick={() => void changeWindowMode('reset')}>{t('resetWindow')}</button></div>}
            <label className="header-select">
              <span className="sr-only">{t('language')}</span>
              <select aria-label={t('language')} value={config.language} onChange={(event) => commitConfig({ ...config, language: event.target.value as LanguageSetting })}>
                <option value="zh-CN">{t('chinese')}</option>
                <option value="en">{t('english')}</option>
              </select>
            </label>
            <button ref={workbenchAddButton} className="primary-action" type="button" onClick={(event) => openAdd(event.currentTarget)}>{t('addDestination')}</button>
          </div>
        </header>

        <div className="workbench-toolbar">
          <label className="search-field">
            <span className="sr-only">{t('searchDestinations')}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchDestinations')}
            />
          </label>
        </div>

        <details className="settings-panel compact-settings">
          <summary>{t('preferences')}</summary>
          <div className="settings-grid">
            <label>{t('theme')}<select aria-label={t('theme')} value={config.theme} onChange={(event) => commitConfig({ ...config, theme: event.target.value as ThemeSetting })}><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option><option value="system">{t('system')}</option></select></label>
            <label>{t('density')}<select aria-label={t('density')} value={config.density} onChange={(event) => commitConfig({ ...config, density: event.target.value as DensitySetting })}><option value="comfortable">{t('comfortable')}</option><option value="compact">{t('compact')}</option></select></label>
          </div>
          <div className="backup-actions">
            <button type="button" onClick={() => downloadJson('creatordock-config.json', exportConfig(config))}>{t('exportConfiguration')}</button>
            <button type="button" onClick={() => downloadJson('creatordock-shortcuts.json', JSON.stringify(createShortcutExport(config)))}>{t('exportShortcutFile')}</button>
            <label className="file-action">{t('importConfiguration')}<input className="sr-only" type="file" accept=".json,application/json" onChange={(event) => void handleImport(event.target.files?.[0])} /></label>
            <button className="reset-action" type="button" onClick={(event) => { returnFocus.current = event.currentTarget; setResetOpen(true) }}>{t('resetWorkbench')}</button>
          </div>
          {desktopRuntime && desktopPlatform === 'macos' && (
            <section className="desktop-panel" aria-labelledby="desktop-heading">
              <h2 id="desktop-heading">{t('desktopEntry')}</h2>
              <p>{desktopAlias?.exists ? t('desktopAvailable') : t('createOptionalAlias')}</p>
              <button type="button" disabled={desktopAliasBusy} onClick={() => void toggleDesktopAlias()}>{desktopAliasBusy ? t('working') : desktopAlias?.exists ? t('removeDesktopAlias') : t('createDesktopAlias')}</button>
              {desktopAliasFeedback && <p className="desktop-feedback" role="status">{desktopAliasFeedback}</p>}
            </section>
          )}
          <p className="privacy-note">{t('localPrivacy')}</p>
        </details>

        <section className="hero compact-hero" aria-labelledby="workbench-heading">
          <h1 id="workbench-heading">{t('heroTitle')}</h1>
        </section>

        <section className="catalog" aria-labelledby="catalog-heading">
          <div className="catalog-heading">
          <div>
              <h2 id="catalog-heading">{t('allDestinations')}</h2>
            </div>
            <p>{t('shownTotal', { shown: visibleEntries.length, total: config.entries.length })}</p>
          </div>

          {visibleEntries.length === 0 ? (
            <div className="empty-state">
              <h3>{config.entries.length === 0 ? t('workbenchEmpty') : t('noDestinations')}</h3>
              <p>{config.entries.length === 0 ? t('addPreset') : t('trySearch')}</p>
            </div>
          ) : (
            <div className="platform-grid">
              {visibleEntries.map((item, visibleIndex) => (
                <DestinationCard
                  entry={item}
                  index={config.entries.findIndex((entry) => entry.id === item.id)}
                  key={item.id}
                  canMoveEarlier={visibleIndex > 0}
                  canMoveLater={visibleIndex < visibleEntries.length - 1}
                  onDelete={(button) => {
                    returnFocus.current = button
                    setEntryMenuId(null)
                    setDeleteTarget(item)
                  }}
                  onEdit={(button) => {
                    returnFocus.current = button
                    setCopyingEntry(null)
                    setEntryMenuId(null)
                    setEditingEntry(item)
                  }}
                  onEditButton={(button) => {
                    if (button) entryActionButtons.current.set(item.id, button)
                    else entryActionButtons.current.delete(item.id)
                  }}
                  onMove={moveEntry}
                  onMoveEarlier={() => moveVisibleEntry(item.id, -1)}
                  onMoveLater={() => moveVisibleEntry(item.id, 1)}
                  menuOpen={entryMenuId === item.id}
                  onMenuClose={() => setEntryMenuId(null)}
                  onMenuToggle={() => setEntryMenuId((current) => current === item.id ? null : item.id)}
                  onCopy={(button) => copyEntry(item, button)}
                  onOpen={handleDestinationOpen}
                  onOpenNew={(event) => {
                    setEntryMenuId(null)
                    handleDestinationOpen(event, item.destinationUrl, item.id, item.displayName, 'new')
                  }}
                  allowNewWindow={!desktopRuntime}
                  language={config.language}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <aside className="ai-column"><AiWorkbench language={config.language} /></aside>
      {shouldOfferMacDesktopAlias(desktopPlatform, desktopAlias, macDesktopAliasOnboardingHandled) && (
        <section className="mac-alias-onboarding" role="status" aria-label={t('macDesktopAliasTitle')}>
          <strong>{t('macDesktopAliasTitle')}</strong>
          <p>{t('macDesktopAliasDescription')}</p>
          <div>
            <button className="primary-action" type="button" disabled={desktopAliasBusy} onClick={() => void createMacDesktopAliasFromOnboarding()}>{desktopAliasBusy ? t('working') : t('createDesktopAlias')}</button>
            <button type="button" disabled={desktopAliasBusy} onClick={() => void dismissMacDesktopAliasOnboarding()}>{t('macDesktopAliasSkip')}</button>
          </div>
        </section>
      )}
      {editingEntry !== undefined && (
        <EntryDialog entry={editingEntry} isDuplicate={copyingEntry !== null} onClose={closeEditor} onSave={saveEntry} language={config.language} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          description={t('removeFromWorkbench', { name: deleteTarget.displayName })}
          title={t('deleteDestinationQuestion')}
          confirmLabel={t('confirmDelete')}
          language={config.language}
          onCancel={() => {
            returnFocus.current?.focus()
            setDeleteTarget(null)
          }}
          onConfirm={() => {
            const deletedVisibleIndex = visibleEntries.findIndex((entry) => entry.id === deleteTarget.id)
            const focusEntry = visibleEntries[deletedVisibleIndex + 1] ?? visibleEntries[deletedVisibleIndex - 1]
            const entryAction = focusEntry ? entryActionButtons.current.get(focusEntry.id) : undefined
            if (entryAction) entryAction.focus()
            else focusAddDestination()
            commitConfig(deleteLaunchEntry(config, deleteTarget.id))
            setDeleteTarget(null)
          }}
        />
      )}
      {resetOpen && (
        <ConfirmDialog
          description={t('resetDescription')}
          title={t('resetWorkbenchQuestion')}
          confirmLabel={t('resetDefaults')}
          language={config.language}
          onCancel={() => {
            returnFocus.current?.focus()
            setResetOpen(false)
          }}
          onConfirm={() => {
            returnFocus.current?.focus()
            commitConfig(createDefaultConfig())
            setQuery('')
            setFeedback({ kind: 'status', message: t('workbenchReset') })
            setResetOpen(false)
          }}
        />
      )}
    </div>
  )
}

function DestinationCard({
  entry,
  index,
  canMoveEarlier,
  canMoveLater,
  onDelete,
  onEdit,
  onEditButton,
  onMove,
  onMoveEarlier,
  onMoveLater,
  onOpen,
  onOpenNew,
  onCopy,
  onMenuClose,
  onMenuToggle,
  menuOpen,
  allowNewWindow,
  language,
}: {
  entry: LaunchEntry
  index: number
  canMoveEarlier: boolean
  canMoveLater: boolean
  onDelete: (button: HTMLButtonElement) => void
  onEdit: (button: HTMLButtonElement) => void
  onEditButton: (button: HTMLButtonElement | null) => void
  onMove: (id: string, destinationIndex: number) => void
  onMoveEarlier: () => void
  onMoveLater: () => void
  onOpen: (event: ReactMouseEvent<HTMLAnchorElement>, url: string, entryId: string, displayName: string) => void
  onOpenNew: (event: ReactMouseEvent<HTMLAnchorElement>) => void
  onCopy: (button: HTMLButtonElement) => void
  onMenuClose: () => void
  onMenuToggle: () => void
  menuOpen: boolean
  allowNewWindow: boolean
  language: LanguageSetting
}) {
  const preset = entry.platformPresetId ? presetById.get(entry.platformPresetId) : undefined
  return (
    <article
      className="destination-card"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-creatordock-entry', entry.id)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const id = event.dataTransfer.getData('application/x-creatordock-entry')
        if (id) onMove(id, index)
      }}
      >
      <a
        className="card-link"
        href={entry.destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => onOpen(event, entry.destinationUrl, entry.id, entry.displayName)}
      >
        <span className="card-icon-wrap" style={{ '--card-accent': preset?.brandColor ?? '#e17045' } as CSSProperties}>
          <img className="card-icon" src={preset?.iconSrc ?? customIconSrc} alt="" aria-hidden="true" />
        </span>
        <strong>{entry.displayName}</strong>
      </a>
      <div className="card-actions">
        <button
          type="button"
          aria-label={translate(language, 'moveEarlier', { name: entry.displayName })}
          disabled={!canMoveEarlier}
          onClick={onMoveEarlier}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={translate(language, 'moveLater', { name: entry.displayName })}
          disabled={!canMoveLater}
          onClick={onMoveLater}
        >
          ↓
        </button>
        <button
          ref={onEditButton}
          type="button"
          aria-label={`${translate(language, 'edit')} ${entry.displayName}`}
          onClick={(event) => onEdit(event.currentTarget)}
        >
          {translate(language, 'edit')}
        </button>
        <button type="button" aria-label={`${translate(language, 'delete')} ${entry.displayName}`} onClick={(event) => onDelete(event.currentTarget)}>{translate(language, 'delete')}</button>
        <div
          className="card-menu-wrap"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onMenuClose()
          }}
        >
          <button
            type="button"
            aria-label={translate(language, 'moreDestinationActions', { name: entry.displayName })}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={onMenuToggle}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="card-menu" role="menu">
              <button type="button" role="menuitem" onClick={(event) => onCopy(event.currentTarget)}>{translate(language, 'copyDestination')}</button>
              {allowNewWindow && (
                <a
                  href={entry.destinationUrl}
                  rel="noopener noreferrer"
                  role="menuitem"
                  target="_blank"
                  onClick={onOpenNew}
                >
                  {translate(language, 'openInNewWindow')}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function EntryDialog({
  entry,
  isDuplicate,
  onClose,
  onSave,
  language,
}: {
  entry: LaunchEntry | null
  isDuplicate: boolean
  onClose: () => void
  onSave: (value: NewLaunchEntry) => void
  language: LanguageSetting
}) {
  const [platformId, setPlatformId] = useState(entry?.platformPresetId ?? 'custom')
  const initialPlatform = entry?.platformPresetId ? presetById.get(entry.platformPresetId) : undefined
  const [platformQuery, setPlatformQuery] = useState(initialPlatform ? platformLabel(initialPlatform.id, language, initialPlatform.name) : '')
  const [platformOpen, setPlatformOpen] = useState(false)
  const [highlightedPlatform, setHighlightedPlatform] = useState(0)
  const [displayName, setDisplayName] = useState(entry?.displayName ?? '')
  const [destinationUrl, setDestinationUrl] = useState(entry?.destinationUrl ?? '')
  const [browserTarget, setBrowserTarget] = useState<BrowserTarget>(entry?.browserTarget ?? 'default')
  const [createShortcut, setCreateShortcut] = useState(entry?.createShortcut ?? false)
  const [error, setError] = useState('')
  const firstField = useRef<HTMLInputElement>(null)
  const title = isDuplicate ? translate(language, 'copyDestination') : entry ? translate(language, 'editDestination') : translate(language, 'addDestination')

  useEffect(() => {
    firstField.current?.focus()
  }, [])

  const platformOptions = useMemo(() => {
    const normalized = platformQuery.trim().toLocaleLowerCase()
    return platformPresets.filter((preset) => !normalized || [
      preset.name,
      platformLabel(preset.id, language, preset.name),
      ...preset.searchTerms,
    ].some((value) => value.toLocaleLowerCase().includes(normalized)))
  }, [language, platformQuery])

  const selectPlatform = (id: string) => {
    setPlatformId(id)
    const preset = presetById.get(id)
    if (preset) {
      setDestinationUrl(preset.url)
      setPlatformQuery(platformLabel(preset.id, language, preset.name))
    } else {
      setPlatformQuery(translate(language, 'customHttpDestination'))
    }
    setPlatformOpen(false)
    setHighlightedPlatform(0)
  }

  const handlePlatformKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (platformOpen) {
        event.preventDefault()
        event.stopPropagation()
        setPlatformOpen(false)
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setPlatformOpen(true)
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setHighlightedPlatform((index) => Math.max(0, Math.min(platformOptions.length - 1, index + direction)))
      return
    }
    if (event.key === 'Enter' && platformOpen && platformOptions[highlightedPlatform]) {
      event.preventDefault()
      selectPlatform(platformOptions[highlightedPlatform].id)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      onSave({
        displayName,
        destinationUrl,
        browserTarget,
        createShortcut,
        ...(platformId === 'custom' ? {} : { platformPresetId: platformId }),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : translate(language, 'destinationOpenFailed'))
    }
  }

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-dialog-title"
        onKeyDown={(event) => containDialogFocus(event, onClose)}
      >
        <h2 id="entry-dialog-title">{title}</h2>
        <form onSubmit={submit}>
          <label>
            {translate(language, 'accountLabel')}
            <input ref={firstField} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <div className="platform-combobox-field">
            <label htmlFor="platform-search">{translate(language, 'platform')}</label>
            <input
              id="platform-search"
              role="combobox"
              type="search"
              value={platformQuery}
              placeholder={translate(language, 'searchPlatforms')}
              aria-autocomplete="list"
              aria-controls="platform-results"
              aria-expanded={platformOpen}
              onFocus={() => setPlatformOpen(true)}
              onChange={(event) => {
                setPlatformQuery(event.target.value)
                setPlatformOpen(true)
                setHighlightedPlatform(0)
              }}
              onKeyDown={handlePlatformKeyDown}
            />
            {platformOpen && (
              <div id="platform-results" className="platform-results" role="listbox" aria-label={translate(language, 'platformResults')}>
                {!platformQuery.trim() && (
                  <button type="button" role="option" aria-selected={platformId === 'custom'} onMouseDown={(event) => event.preventDefault()} onClick={() => selectPlatform('custom')}>
                    {translate(language, 'customHttpDestination')}
                  </button>
                )}
                {platformOptions.map((preset, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={platformId === preset.id}
                    className={highlightedPlatform === index ? 'highlighted' : ''}
                    key={preset.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectPlatform(preset.id)}
                  >
                    <img src={preset.iconSrc} alt="" />
                    <span>{platformLabel(preset.id, language, preset.name)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <label>
            {translate(language, 'destinationUrl')}
            <input type="url" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={createShortcut} onChange={(event) => setCreateShortcut(event.target.checked)} />
            {translate(language, 'includeShortcut')}
          </label>
          {createShortcut && (
            <label>
              {translate(language, 'browserShortcut')}
              <select value={browserTarget} onChange={(event) => setBrowserTarget(event.target.value as BrowserTarget)}>
                <option value="default">{translate(language, 'system')}</option>
                <option value="chrome">Chrome</option>
                <option value="edge">Edge</option>
              </select>
            </label>
          )}
          <p className="shortcut-explainer">{translate(language, 'shortcutExplainer')}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>{translate(language, 'cancel')}</button>
            <button className="primary-action" type="submit">{translate(language, 'saveDestination')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  language,
}: {
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  language: LanguageSetting
}) {
  const cancelButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButton.current?.focus()
  }, [])

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog-panel confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onKeyDown={(event) => containDialogFocus(event, onCancel)}
      >
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="dialog-actions">
          <button ref={cancelButton} type="button" onClick={onCancel}>{translate(language, 'cancel')}</button>
          <button className="danger-action" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function containDialogFocus(event: ReactKeyboardEvent<HTMLElement>, onEscape: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    onEscape()
    return
  }
  if (event.key !== 'Tab') return

  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)',
  )]
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file)
  })
}

function downloadJson(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const root = document.getElementById('root')

if (root) {
  const applicationRoot = createRoot(root)
  applicationRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // The installed Tauri app has its own embedded resources and must not share
  // the browser PWA service worker cache. Browser/PWA builds still register it
  // so offline loading and update prompts continue to work there.
  if (!isTauriRuntime()) {
    void import('./pwa-register')
      .then(({ PwaUpdatePrompt }) => {
        applicationRoot.render(
          <StrictMode>
            <App />
            <PwaUpdatePrompt />
          </StrictMode>,
        )
      })
      .catch(() => {
        // PWA update registration is optional; the local application remains usable.
      })
  }
}
