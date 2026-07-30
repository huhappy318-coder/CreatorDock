import {
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createRoot } from 'react-dom/client'
import { platformPresets } from './catalog'
import {
  addLaunchEntry,
  createDefaultConfig,
  createShortcutExport,
  deleteLaunchEntry,
  editLaunchEntry,
  exportConfig,
  filterLaunchEntries,
  importConfig,
  loadConfig,
  reorderLaunchEntry,
  saveConfig,
  type BrowserTarget,
  type CreatorDockConfig,
  type DensitySetting,
  type LaunchEntry,
  type NewLaunchEntry,
  type ThemeSetting,
} from './config'
import './styles.css'
import { AiWorkbench } from './aiWorkbench'

const presetById = new Map(platformPresets.map((preset) => [preset.id, preset]))

export function App() {
  const [loaded, setLoaded] = useState(() => loadConfig(localStorage))
  const { config } = loaded
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>()
  const [editingEntry, setEditingEntry] = useState<LaunchEntry | null>()
  const [deleteTarget, setDeleteTarget] = useState<LaunchEntry | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'status', message: string } | null>(
    loaded.recovered
      ? { kind: 'status', message: 'Recovered default configuration because saved data was corrupt.' }
      : null,
  )
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const mobileAddButton = useRef<HTMLButtonElement>(null)
  const workbenchAddButton = useRef<HTMLButtonElement>(null)
  const entryActionButtons = useRef(new Map<string, HTMLButtonElement>())

  const groups = useMemo(
    () => [...new Set(config.entries.map((item) => item.group))].sort((a, b) => a.localeCompare(b)),
    [config.entries],
  )
  const visibleEntries = useMemo(
    () => filterLaunchEntries(config.entries, query, activeGroup),
    [activeGroup, config.entries, query],
  )

  const commitConfig = (nextConfig: CreatorDockConfig) => {
    saveConfig(localStorage, nextConfig)
    setLoaded({ config: nextConfig, recovered: false })
  }

  const openAdd = (button: HTMLButtonElement) => {
    returnFocus.current = button
    setEditingEntry(null)
  }

  const closeEditor = () => {
    returnFocus.current?.focus()
    setEditingEntry(undefined)
  }

  const saveEntry = (value: NewLaunchEntry) => {
    commitConfig(editingEntry
      ? editLaunchEntry(config, editingEntry.id, value)
      : addLaunchEntry(config, value))
    closeEditor()
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
      setActiveGroup(undefined)
      setQuery('')
      setFeedback({ kind: 'status', message: 'Configuration imported successfully.' })
    } catch {
      setFeedback({ kind: 'error', message: 'The configuration file could not be read.' })
    }
  }

  return (
    <div className={`app-shell theme-${config.theme} density-${config.density}`}>
      <header className="mobile-header">
        <a className="brand" href="#workbench" aria-label="CreatorDock home"><span>CD</span> CreatorDock</a>
        <button ref={mobileAddButton} type="button" onClick={(event) => openAdd(event.currentTarget)}>Add destination</button>
      </header>

      <aside className="sidebar">
        <a className="brand desktop-brand" href="#workbench" aria-label="CreatorDock home"><span>CD</span> CreatorDock</a>
        <p className="sidebar-kicker">Your creator workbench</p>
        <CategoryNavigation
          activeGroup={activeGroup}
          groups={groups}
          onSelect={setActiveGroup}
        />
        <section className="settings-panel" aria-labelledby="settings-heading">
          <h2 id="settings-heading">Preferences</h2>
          <label>
            Theme
            <select
              value={config.theme}
              onChange={(event) => commitConfig({ ...config, theme: event.target.value as ThemeSetting })}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <label>
            Density
            <select
              value={config.density}
              onChange={(event) => commitConfig({ ...config, density: event.target.value as DensitySetting })}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <div className="backup-actions">
            <button type="button" onClick={() => downloadJson('creatordock-config.json', exportConfig(config))}>Export configuration</button>
            <button type="button" onClick={() => downloadJson('creatordock-shortcuts.json', JSON.stringify(createShortcutExport(config)))}>Export shortcut file</button>
            <label className="file-action">
              Import configuration
              <input
                className="sr-only"
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  void handleImport(event.target.files?.[0])
                }}
              />
            </label>
            <button
              className="reset-action"
              type="button"
              onClick={(event) => {
                returnFocus.current = event.currentTarget
                setResetOpen(true)
              }}
            >
              Reset workbench
            </button>
          </div>
        </section>
        <p className="privacy-note">Local only. No credentials, cookies, or account identities are stored.</p>
      </aside>

      <main className="workbench" id="workbench">
        {feedback && (
          <div className={`feedback ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </div>
        )}
        <header className="topbar">
          <label className="search-field">
            <span className="sr-only">Search destinations</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search accounts, platforms, groups, or URLs"
              aria-label="Search destinations"
            />
          </label>
          <button
            ref={workbenchAddButton}
            className="primary-action"
            type="button"
            onClick={(event) => openAdd(event.currentTarget)}
          >
            Add destination
          </button>
        </header>

        <section className="hero" aria-labelledby="workbench-heading">
          <p className="eyebrow">ONE QUIET PLACE</p>
          <h1 id="workbench-heading">Begin where your work lives.</h1>
          <p>Open every creator destination without mixing up the account context behind your desktop shortcuts.</p>
        </section>

        <section className="catalog" aria-labelledby="catalog-heading">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">STARTING POINTS</p>
              <h2 id="catalog-heading">{activeGroup ?? 'All destinations'}</h2>
            </div>
            <p>{visibleEntries.length} shown · {config.entries.length} total</p>
          </div>

          {visibleEntries.length === 0 ? (
            <div className="empty-state">
              <h3>{config.entries.length === 0 ? 'Your workbench is empty' : 'No destinations found'}</h3>
              <p>{config.entries.length === 0 ? 'Add a preset or custom destination to get started.' : 'Try another search or category.'}</p>
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
                    setDeleteTarget(item)
                  }}
                  onEdit={(button) => {
                    returnFocus.current = button
                    setEditingEntry(item)
                  }}
                  onEditButton={(button) => {
                    if (button) entryActionButtons.current.set(item.id, button)
                    else entryActionButtons.current.delete(item.id)
                  }}
                  onMove={moveEntry}
                  onMoveEarlier={() => moveVisibleEntry(item.id, -1)}
                  onMoveLater={() => moveVisibleEntry(item.id, 1)}
                />
              ))}
            </div>
          )}
        </section>
        <AiWorkbench />
      </main>
      {editingEntry !== undefined && (
        <EntryDialog entry={editingEntry} onClose={closeEditor} onSave={saveEntry} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          description={`Remove ${deleteTarget.displayName} from this local workbench?`}
          title="Delete destination?"
          confirmLabel="Delete destination"
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
          description="Replace this local configuration with the built-in platform catalog?"
          title="Reset workbench?"
          confirmLabel="Reset to defaults"
          onCancel={() => {
            returnFocus.current?.focus()
            setResetOpen(false)
          }}
          onConfirm={() => {
            returnFocus.current?.focus()
            commitConfig(createDefaultConfig())
            setActiveGroup(undefined)
            setQuery('')
            setFeedback({ kind: 'status', message: 'Workbench reset to defaults.' })
            setResetOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CategoryNavigation({
  activeGroup,
  groups,
  onSelect,
}: {
  activeGroup?: string
  groups: string[]
  onSelect: (group?: string) => void
}) {
  const navigation = (label: string) => (
    <nav aria-label={label}>
      <button
        className={activeGroup === undefined ? 'active' : ''}
        type="button"
        onClick={() => onSelect()}
      >
        All destinations
      </button>
      {groups.map((group) => (
        <button
          className={activeGroup === group ? 'active' : ''}
          type="button"
          onClick={() => onSelect(group)}
          key={group}
        >
          {group}
        </button>
      ))}
    </nav>
  )

  return (
    <>
      <div className="desktop-categories">{navigation('Categories')}</div>
      <details className="mobile-categories">
        <summary>Browse categories</summary>
        {navigation('Mobile categories')}
      </details>
    </>
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
}) {
  const preset = entry.platformPresetId ? presetById.get(entry.platformPresetId) : undefined
  const shortcutDetails = [
    entry.browserTarget === 'default' ? 'System' : entry.browserTarget === 'chrome' ? 'Chrome' : 'Edge',
    entry.profileDirectoryName,
    'Desktop shortcuts only',
  ].filter(Boolean).join(' · ')
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
      >
        <span className="card-number">{String(index + 1).padStart(2, '0')}</span>
        <strong>{entry.displayName}</strong>
        <span>{preset?.name ?? 'Custom destination'} · {entry.group}</span>
        {preset?.verification === 'unverified' && (
          <span className="verification-note">{preset.verificationNote}</span>
        )}
        {(entry.browserTarget !== 'default' || entry.profileDirectoryName || entry.createShortcut) && (
          <span className="shortcut-badge">{shortcutDetails}</span>
        )}
      </a>
      <div className="card-actions">
        <button
          type="button"
          aria-label={`Move ${entry.displayName} earlier`}
          disabled={!canMoveEarlier}
          onClick={onMoveEarlier}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Move ${entry.displayName} later`}
          disabled={!canMoveLater}
          onClick={onMoveLater}
        >
          ↓
        </button>
        <button
          ref={onEditButton}
          type="button"
          aria-label={`Edit ${entry.displayName}`}
          onClick={(event) => onEdit(event.currentTarget)}
        >
          Edit
        </button>
        <button type="button" aria-label={`Delete ${entry.displayName}`} onClick={(event) => onDelete(event.currentTarget)}>Delete</button>
      </div>
    </article>
  )
}

function EntryDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: LaunchEntry | null
  onClose: () => void
  onSave: (value: NewLaunchEntry) => void
}) {
  const [platformId, setPlatformId] = useState(entry?.platformPresetId ?? 'custom')
  const [displayName, setDisplayName] = useState(entry?.displayName ?? '')
  const [destinationUrl, setDestinationUrl] = useState(entry?.destinationUrl ?? '')
  const [group, setGroup] = useState(entry?.group ?? '')
  const [browserTarget, setBrowserTarget] = useState<BrowserTarget>(entry?.browserTarget ?? 'default')
  const [profileDirectoryName, setProfileDirectoryName] = useState(entry?.profileDirectoryName ?? '')
  const [createShortcut, setCreateShortcut] = useState(entry?.createShortcut ?? false)
  const [error, setError] = useState('')
  const firstField = useRef<HTMLInputElement>(null)
  const title = entry ? 'Edit destination' : 'Add destination'

  useEffect(() => {
    firstField.current?.focus()
  }, [])

  const selectPlatform = (id: string) => {
    setPlatformId(id)
    const preset = presetById.get(id)
    if (preset) {
      setDestinationUrl(preset.url)
      setGroup(preset.category)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      onSave({
        displayName,
        destinationUrl,
        group,
        browserTarget,
        profileDirectoryName,
        createShortcut,
        ...(platformId === 'custom' ? {} : { platformPresetId: platformId }),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The destination could not be saved.')
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
            Account label
            <input ref={firstField} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            Platform
            <select value={platformId} onChange={(event) => selectPlatform(event.target.value)}>
              <option value="custom">Custom HTTP(S) destination</option>
              {platformPresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <label>
            Destination URL
            <input type="url" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} />
          </label>
          <label>
            Category
            <input value={group} onChange={(event) => setGroup(event.target.value)} />
          </label>
          <label>
            Browser for desktop shortcut
            <select value={browserTarget} onChange={(event) => setBrowserTarget(event.target.value as BrowserTarget)}>
              <option value="default">System</option>
              <option value="chrome">Chrome</option>
              <option value="edge">Edge</option>
            </select>
          </label>
          <label>
            Profile directory
            <input value={profileDirectoryName} onChange={(event) => setProfileDirectoryName(event.target.value)} />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={createShortcut} onChange={(event) => setCreateShortcut(event.target.checked)} />
            Include in shortcut export
          </label>
          <p className="shortcut-explainer">Browser and profile settings apply only to generated Windows desktop shortcuts. Card clicks remain normal web links.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary-action" type="submit">Save destination</button>
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
}: {
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
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
          <button ref={cancelButton} type="button" onClick={onCancel}>Cancel</button>
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
