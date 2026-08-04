import { describe, expect, it, vi } from 'vitest'
import { browserWindowName, openBrowserEntryWindow, rememberBrowserWindow, BROWSER_WINDOW_STORAGE_KEY } from './browserWindows'

describe('browser entry windows', () => {
  it('uses a stable per-entry window name and focuses the popup', () => {
    const focus = vi.fn()
    const popup = { focus, opener: window } as unknown as Window
    const open = vi.fn(() => popup)
    expect(openBrowserEntryWindow('https://example.com', '公众号·账号一', open)).toBe(true)
    expect(open).toHaveBeenCalledWith('https://example.com', browserWindowName('公众号·账号一'), expect.stringContaining('popup'))
    expect(focus).toHaveBeenCalledOnce()
    expect(popup.opener).toBeNull()
  })

  it('keeps window names distinct when imported identifiers normalize to the same text', () => {
    expect(browserWindowName('账号/一')).not.toBe(browserWindowName('账号:一'))
  })

  it('records the last opened destination without storing credentials', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
    rememberBrowserWindow(storage, { entryId: 'entry-1', windowName: 'CreatorDock_entry-1', url: 'https://example.com/path?token=private-value', lastOpenedAt: '2026-08-03T00:00:00.000Z' })
    const saved = values.get(BROWSER_WINDOW_STORAGE_KEY)!
    expect(saved).toContain('entry-1')
    expect(saved).toContain('https://example.com/path')
    expect(saved).not.toMatch(/password|cookie|apiKey|token/i)
  })
})
