import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { platformPresets } from './catalog'
import {
  CONFIG_STORAGE_KEY,
  exportConfig,
  type CreatorDockConfig,
  type LaunchEntry,
} from './config'
import { App } from './main'

const entry = (overrides: Partial<LaunchEntry> = {}): LaunchEntry => ({
  id: 'entry-1',
  displayName: 'Studio account',
  destinationUrl: 'https://example.com/studio',
  group: 'Work',
  browserTarget: 'default',
  createShortcut: false,
  ...overrides,
})

const config = (entries: LaunchEntry[], overrides: Partial<CreatorDockConfig> = {}): CreatorDockConfig => ({
  schemaVersion: 1,
  entries,
  theme: 'system',
  density: 'comfortable',
  ...overrides,
})

const seed = (value: CreatorDockConfig) => {
  localStorage.setItem(CONFIG_STORAGE_KEY, exportConfig(value))
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(cleanup)

describe('catalog navigation and discovery', () => {
  it('keeps duplicate-platform accounts distinct and searches by platform name', () => {
    seed(config([
      entry({ id: 'work', displayName: 'Work account', platformPresetId: 'wechat-official-accounts', destinationUrl: 'https://mp.weixin.qq.com/' }),
      entry({ id: 'personal', displayName: 'Personal account', platformPresetId: 'wechat-official-accounts', destinationUrl: 'https://mp.weixin.qq.com/' }),
    ]))
    render(<App />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search destinations' }), {
      target: { value: 'WeChat Official Accounts' },
    })

    expect(screen.getByRole('link', { name: /Work account/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Personal account/ })).toBeInTheDocument()
  })

  it('filters the workbench with visible category navigation and clears the filter', () => {
    seed(config([
      entry({ id: 'video', displayName: 'Video room', group: 'Video' }),
      entry({ id: 'writing', displayName: 'Writing desk', group: 'Writing', destinationUrl: 'https://example.com/writing' }),
    ]))
    render(<App />)

    const navigation = screen.getByRole('navigation', { name: 'Categories' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Video' }))
    expect(screen.getByRole('link', { name: /Video room/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Writing desk/ })).not.toBeInTheDocument()

    fireEvent.click(within(navigation).getByRole('button', { name: 'All destinations' }))
    expect(screen.getByRole('link', { name: /Writing desk/ })).toBeInTheDocument()
  })

  it('uses isolated external links and keeps preset uncertainty notes visible', () => {
    const unverified = platformPresets.find((preset) => preset.verification === 'unverified')!
    seed(config([
      entry({
        displayName: 'Publishing account',
        destinationUrl: unverified.url,
        group: unverified.category,
        platformPresetId: unverified.id,
      }),
    ]))
    render(<App />)

    const link = screen.getByRole('link', { name: /Publishing account/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent(unverified.verificationNote!)
  })
})

describe('destination lifecycle', () => {
  it('adds, edits, and confirms deletion without confusing shortcut settings with web links', async () => {
    seed(config([]))
    render(<App />)

    const addButton = screen.getAllByRole('button', { name: 'Add destination' })[0]
    fireEvent.click(addButton)
    const dialog = screen.getByRole('dialog', { name: 'Add destination' })
    expect(within(dialog).getByLabelText('Account label')).toHaveFocus()

    fireEvent.change(within(dialog).getByLabelText('Platform'), { target: { value: 'xiaohongshu' } })
    fireEvent.change(within(dialog).getByLabelText('Account label'), { target: { value: 'Client A' } })
    fireEvent.change(within(dialog).getByLabelText('Browser for desktop shortcut'), { target: { value: 'chrome' } })
    fireEvent.change(within(dialog).getByLabelText('Profile directory'), { target: { value: 'Profile 2' } })
    fireEvent.click(within(dialog).getByLabelText('Include in shortcut export'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save destination' }))

    const link = screen.getByRole('link', { name: /Client A/ })
    expect(link).toHaveAttribute('href', 'https://creator.xiaohongshu.com/')
    expect(screen.getByText(/Chrome · Profile 2 · Desktop shortcuts only/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Client A' }))
    const editDialog = screen.getByRole('dialog', { name: 'Edit destination' })
    fireEvent.change(within(editDialog).getByLabelText('Account label'), { target: { value: 'Client B' } })
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Save destination' }))
    expect(screen.getByRole('link', { name: /Client B/ })).toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: 'Delete Client B' })
    fireEvent.click(deleteButton)
    const confirmation = screen.getByRole('alertdialog', { name: 'Delete destination?' })
    const cancelDelete = within(confirmation).getByRole('button', { name: 'Cancel' })
    const confirmDelete = within(confirmation).getByRole('button', { name: 'Delete destination' })
    expect(cancelDelete).toHaveFocus()
    fireEvent.keyDown(confirmation, { key: 'Tab', shiftKey: true })
    expect(confirmDelete).toHaveFocus()
    fireEvent.keyDown(confirmation, { key: 'Tab' })
    expect(cancelDelete).toHaveFocus()
    fireEvent.keyDown(confirmation, { key: 'Escape' })
    expect(deleteButton).toHaveFocus()
    expect(screen.getByRole('link', { name: /Client B/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Client B' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete destination' }))
    expect(screen.queryByRole('link', { name: /Client B/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your workbench is empty' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Add destination' })).toContain(document.activeElement)
    })
  })

  it('reports domain validation errors and restores focus when the dialog closes', () => {
    seed(config([]))
    render(<App />)

    const addButton = screen.getAllByRole('button', { name: 'Add destination' })[0]
    fireEvent.click(addButton)
    const dialog = screen.getByRole('dialog')
    const firstField = within(dialog).getByLabelText('Account label')
    const lastControl = within(dialog).getByRole('button', { name: 'Save destination' })
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(lastControl).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(firstField).toHaveFocus()

    fireEvent.change(within(dialog).getByLabelText('Account label'), { target: { value: 'Unsafe' } })
    fireEvent.change(within(dialog).getByLabelText('Destination URL'), { target: { value: 'file:///unsafe' } })
    fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: 'Work' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save destination' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('HTTP(S)')
    expect(screen.getByRole('heading', { name: 'Your workbench is empty' })).toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(addButton).toHaveFocus()
  })

  it('focuses the next surviving entry action after confirmed deletion', async () => {
    seed(config([
      entry({ id: 'a', displayName: 'A account' }),
      entry({ id: 'b', displayName: 'B account', destinationUrl: 'https://example.com/b' }),
      entry({ id: 'c', displayName: 'C account', destinationUrl: 'https://example.com/c' }),
    ]))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete B account' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete destination' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit C account' })).toHaveFocus())
  })
})

describe('reordering', () => {
  it('uses one ordering result for keyboard controls and pointer drag-and-drop', () => {
    seed(config([
      entry({ id: 'a', displayName: 'A account' }),
      entry({ id: 'b', displayName: 'B account', destinationUrl: 'https://example.com/b' }),
      entry({ id: 'c', displayName: 'C account', destinationUrl: 'https://example.com/c' }),
    ]))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Move B account earlier' }))
    expect(screen.getAllByRole('link', { name: /account/ }).map((link) => link.textContent)).toEqual([
      expect.stringContaining('B account'),
      expect.stringContaining('A account'),
      expect.stringContaining('C account'),
    ])

    const dataTransfer = {
      value: '',
      setData(_type: string, value: string) { this.value = value },
      getData() { return this.value },
      effectAllowed: 'move',
    }
    const source = screen.getByRole('link', { name: /C account/ }).closest('article')!
    const target = screen.getByRole('link', { name: /B account/ }).closest('article')!
    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    expect(screen.getAllByRole('link', { name: /account/ }).map((link) => link.textContent)).toEqual([
      expect.stringContaining('C account'),
      expect.stringContaining('B account'),
      expect.stringContaining('A account'),
    ])
  })

  it('moves relative to adjacent visible cards and disables controls at filtered boundaries', () => {
    seed(config([
      entry({ id: 'hidden-before', displayName: 'Hidden before', group: 'Other' }),
      entry({ id: 'a', displayName: 'A work', group: 'Work', destinationUrl: 'https://example.com/a' }),
      entry({ id: 'c', displayName: 'C work', group: 'Work', destinationUrl: 'https://example.com/c' }),
      entry({ id: 'hidden-after', displayName: 'Hidden after', group: 'Other', destinationUrl: 'https://example.com/after' }),
    ]))
    render(<App />)

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Categories' })).getByRole('button', { name: 'Work' }))
    expect(screen.getByRole('button', { name: 'Move A work earlier' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move C work later' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Move C work earlier' }))

    expect(screen.getAllByRole('link', { name: /work/ }).map((link) => link.textContent)).toEqual([
      expect.stringContaining('C work'),
      expect.stringContaining('A work'),
    ])
    expect(screen.getByRole('button', { name: 'Move C work earlier' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move A work later' })).toBeDisabled()
  })
})

describe('preferences, backup, and recovery', () => {
  it('persists theme and density choices on the workbench root', () => {
    seed(config([entry()]))
    const { container } = render(<App />)

    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } })
    fireEvent.change(screen.getByLabelText('Density'), { target: { value: 'compact' } })

    expect(container.firstChild).toHaveClass('theme-dark', 'density-compact')
    expect(JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY)!)).toMatchObject({
      theme: 'dark',
      density: 'compact',
    })
  })

  it('rejects an invalid import without mutation and accepts a valid import with feedback', async () => {
    const current = config([entry({ displayName: 'Current account' })])
    const imported = config([entry({ id: 'imported', displayName: 'Imported account', destinationUrl: 'https://imported.example' })])
    seed(current)
    render(<App />)

    const input = screen.getByLabelText('Import configuration')
    fireEvent.change(input, {
      target: {
        files: [new File(['{"schemaVersion":1,"theme":"system","density":"comfortable","entries":[{"id":"bad","displayName":"Bad","destinationUrl":"file:///unsafe","group":"Work"}]}'], 'bad.json', { type: 'application/json' })],
      },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/HTTP\(S\)|destination URL/i)
    expect(screen.getByRole('link', { name: /Current account/ })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY)!)).toEqual(current)

    fireEvent.change(input, {
      target: { files: [new File([exportConfig(imported)], 'good.json', { type: 'application/json' })] },
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Configuration imported successfully.')
    expect(screen.getByRole('link', { name: /Imported account/ })).toBeInTheDocument()
  })

  it('downloads generated full and shortcut-only JSON exports and requires confirmation before reset', async () => {
    seed(config([entry({
      displayName: 'Profiled account',
      browserTarget: 'chrome',
      profileDirectoryName: 'Profile 2',
      createShortcut: true,
    })]))
    const downloads: string[] = []
    const blobs: Blob[] = []
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        blobs.push(blob)
        return 'blob:download'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Export configuration' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export shortcut file' }))
    expect(downloads).toEqual(['creatordock-config.json', 'creatordock-shortcuts.json'])
    expect(JSON.parse(await readBlob(blobs[1]))).toEqual({
      schemaVersion: 1,
      shortcuts: [{
        displayName: 'Profiled account',
        destinationUrl: 'https://example.com/studio',
        browserTarget: 'chrome',
        profileDirectoryName: 'Profile 2',
        createShortcut: true,
      }],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reset workbench' }))
    const reset = screen.getByRole('alertdialog', { name: 'Reset workbench?' })
    expect(within(reset).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.click(within(reset).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('link', { name: /Profiled account/ })).toBeInTheDocument()

    const resetButton = screen.getByRole('button', { name: 'Reset workbench' })
    fireEvent.click(resetButton)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset to defaults' }))
    expect(screen.getByRole('link', { name: /Xiaohongshu/ })).toBeInTheDocument()
    expect(resetButton).toHaveFocus()
  })

  it('announces corrupt-storage recovery and distinguishes no search results', async () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, '{bad json')
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Recovered default configuration because saved data was corrupt.')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nothing-can-match-this' } })
    expect(screen.getByRole('heading', { name: 'No destinations found' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: /Xiaohongshu/ })).not.toBeInTheDocument())
  })
})

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}
