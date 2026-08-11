import { describe, expect, it, afterEach, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { clampWindowState, getDefaultWindowState, getLeftFloatingWindowState, isTauriRuntime, openExternalUrl, shouldOfferMacDesktopAlias } from './desktop'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

type DesktopEntry = { destinationUrl: string, browserTarget: 'default' | 'chrome' | 'edge', profileDirectoryName?: string }

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
})

describe('desktop bridge', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 }

  it('computes a centered first-launch window from half of the work area', () => {
    expect(getDefaultWindowState(workArea)).toEqual({ mode: 'normal', x: 480, y: 240, width: 960, height: 560 })
  })

  it('computes a constrained left-floating always-on-top layout', () => {
    expect(getLeftFloatingWindowState(workArea)).toEqual({ mode: 'left-floating', x: 12, y: 114, width: 806, height: 811 })
  })

  it('moves saved windows back inside a changed monitor work area', () => {
    expect(clampWindowState({ mode: 'normal', x: 3000, y: -500, width: 1200, height: 900 }, { x: 100, y: 40, width: 1280, height: 720 })).toEqual({ mode: 'normal', x: 180, y: 40, width: 1200, height: 720 })
  })

  it('repairs saved windows that are smaller than the compact desktop minimum', () => {
    expect(clampWindowState({ mode: 'normal', x: 0, y: 0, width: 156, height: 24 }, workArea)).toEqual({ mode: 'normal', x: 550, y: 240, width: 820, height: 560 })
  })

  it('does not treat a browser tab as a Tauri runtime', () => {
    expect(isTauriRuntime()).toBe(false)
  })

  it('keeps browser links on the normal anchor path', async () => {
    await expect(openExternalUrl('https://example.com')).resolves.toBe(false)
  })

  it('rejects unsafe URLs before any desktop bridge call', async () => {
    await expect(openExternalUrl('file:///unsafe')).rejects.toThrow('Only HTTP(S) URLs')
    await expect(openExternalUrl('https://user:pass@example.com/')).rejects.toThrow('Only HTTP(S) URLs')
  })

  it('detects the installed Tauri runtime marker', () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    expect(isTauriRuntime()).toBe(true)
  })

  it('routes installed-app links through the Rust command', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    await expect(openExternalUrl('https://example.com/creator')).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith('open_external', { url: 'https://example.com/creator' })
  })

  it('routes a profiled Chrome entry through the restricted separate-window command', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    const bridge = await import('./desktop') as typeof import('./desktop') & {
      openDesktopEntry?: (entry: DesktopEntry) => Promise<boolean>
    }

    expect(bridge.openDesktopEntry).toBeTypeOf('function')
    await expect(bridge.openDesktopEntry!({
      destinationUrl: 'https://example.com/creator',
      browserTarget: 'chrome',
      profileDirectoryName: 'Profile 2',
    })).resolves.toBe(true)
    expect(invoke).toHaveBeenLastCalledWith('open_browser_entry', {
      url: 'https://example.com/creator',
      browserTarget: 'chrome',
      profileDirectoryName: 'Profile 2',
    })
  })

  it('rejects an unsafe legacy browser profile before calling the desktop command', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    const bridge = await import('./desktop') as typeof import('./desktop') & {
      openDesktopEntry?: (entry: DesktopEntry) => Promise<boolean>
    }

    expect(bridge.openDesktopEntry).toBeTypeOf('function')
    vi.mocked(invoke).mockClear()
    await expect(bridge.openDesktopEntry!({ destinationUrl: 'https://example.com/creator', browserTarget: 'edge', profileDirectoryName: 'Profile 2 --incognito' })).rejects.toThrow('Profile directory')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('offers the macOS desktop alias only once its status and onboarding flag are known', () => {
    expect(shouldOfferMacDesktopAlias('macos', { exists: false }, false)).toBe(true)
    expect(shouldOfferMacDesktopAlias('macos', { exists: false, requiresInstall: true }, false)).toBe(false)
    expect(shouldOfferMacDesktopAlias('macos', { exists: true }, false)).toBe(false)
    expect(shouldOfferMacDesktopAlias('windows', { exists: false }, false)).toBe(false)
    expect(shouldOfferMacDesktopAlias('macos', { exists: false }, null)).toBe(false)
  })
})
