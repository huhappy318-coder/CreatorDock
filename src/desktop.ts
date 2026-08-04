import { exportConfig, isHttpUrl, loadConfig, type CreatorDockConfig, type IdFactory, type StorageAdapter } from './config'

const DESKTOP_CONFIG_FILE = 'creatordock.json'
const WINDOW_STATE_KEY = 'windowState'
const MAC_DESKTOP_ALIAS_ONBOARDING_KEY = 'macDesktopAliasOnboardingHandled'

type TauriStore = {
  get<T>(key: string): Promise<T | null | undefined>
  set<T>(key: string, value: T): Promise<void>
  save(): Promise<void>
}

export interface DesktopConfigStore {
  read(idFactory?: IdFactory): Promise<{ config: CreatorDockConfig, recovered: boolean, hasStoredConfig: boolean }>
  write(config: CreatorDockConfig): Promise<void>
}

export interface DesktopAliasStatus {
  exists: boolean
  path?: string
}

export type DesktopPlatform = 'macos' | 'windows' | 'other'

export type WindowMode = 'normal' | 'left-floating'

export interface WindowState {
  mode: WindowMode
  x: number
  y: number
  width: number
  height: number
}

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

interface StoredWindowState {
  current: WindowState
  normal: WindowState
}

export interface DesktopWindowController {
  getMode(): WindowMode
  toggleLeftFloating(): Promise<WindowMode>
  resetDefault(): Promise<WindowMode>
  dispose(): void
}

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: unknown
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function getDefaultWindowState(workArea: WorkArea): WindowState {
  const width = Math.min(workArea.width, clamp(Math.round(workArea.width * 0.5), 820, 1000))
  const height = Math.min(workArea.height, clamp(Math.round(workArea.height * 0.5), 560, 720))
  return {
    mode: 'normal',
    x: Math.floor(workArea.x + (workArea.width - width) / 2),
    y: Math.floor(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  }
}

export function getLeftFloatingWindowState(workArea: WorkArea): WindowState {
  const width = Math.min(workArea.width, clamp(Math.round(workArea.width * 0.42), 780, 900))
  const height = Math.min(workArea.height, clamp(Math.round(workArea.height * 0.78), 560, 820))
  return {
    mode: 'left-floating',
    x: workArea.x + Math.min(12, Math.max(0, workArea.width - width)),
    y: Math.floor(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  }
}

export function clampWindowState(state: WindowState, workArea: WorkArea): WindowState {
  const minimumWidth = state.mode === 'left-floating' ? 780 : 820
  const minimumHeight = 560
  const rawWidth = Math.round(state.width)
  const rawHeight = Math.round(state.height)
  const wasBelowMinimum = rawWidth < minimumWidth || rawHeight < minimumHeight
  const width = Math.min(Math.max(minimumWidth, rawWidth), workArea.width)
  const height = Math.min(Math.max(minimumHeight, rawHeight), workArea.height)
  return {
    mode: state.mode,
    x: wasBelowMinimum ? Math.floor(workArea.x + (workArea.width - width) / 2) : clamp(Math.round(state.x), workArea.x, workArea.x + workArea.width - width),
    y: wasBelowMinimum ? Math.floor(workArea.y + (workArea.height - height) / 2) : clamp(Math.round(state.y), workArea.y, workArea.y + workArea.height - height),
    width,
    height,
  }
}

function isWindowState(value: unknown): value is WindowState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return (state.mode === 'normal' || state.mode === 'left-floating')
    && ['x', 'y', 'width', 'height'].every((key) => typeof state[key] === 'number' && Number.isFinite(state[key]))
    && Number(state.width) > 0 && Number(state.height) > 0
}

function isStoredWindowState(value: unknown): value is StoredWindowState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return isWindowState(state.current) && isWindowState(state.normal)
}

export async function initializeDesktopWindow(): Promise<DesktopWindowController | null> {
  if (!isTauriRuntime()) return null

  const [{ load }, windowApi] = await Promise.all([
    import('@tauri-apps/plugin-store'),
    import('@tauri-apps/api/window'),
  ])
  const store = await load(DESKTOP_CONFIG_FILE, { autoSave: false }) as unknown as TauriStore
  const appWindow = windowApi.getCurrentWindow()
  const monitors = await windowApi.availableMonitors()
  const fallbackMonitor = await windowApi.currentMonitor() ?? await windowApi.primaryMonitor() ?? monitors[0]
  if (!fallbackMonitor) return null

  const toWorkArea = (monitor: typeof fallbackMonitor): WorkArea => {
    const position = monitor.workArea.position.toLogical(monitor.scaleFactor)
    const size = monitor.workArea.size.toLogical(monitor.scaleFactor)
    return { x: position.x, y: position.y, width: size.width, height: size.height }
  }
  const monitorAreas = monitors.map(toWorkArea)
  const fallbackArea = toWorkArea(fallbackMonitor)
  const findArea = (state?: WindowState): WorkArea => {
    if (!state) return fallbackArea
    const centerX = state.x + state.width / 2
    const centerY = state.y + state.height / 2
    return monitorAreas.find((area) => centerX >= area.x && centerX < area.x + area.width && centerY >= area.y && centerY < area.y + area.height) ?? fallbackArea
  }

  const storedValue = await store.get<StoredWindowState>(WINDOW_STATE_KEY)
  const stored = isStoredWindowState(storedValue) ? storedValue : undefined
  let normalState = stored
    ? clampWindowState({ ...stored.normal, mode: 'normal' as const }, findArea(stored.normal))
    : getDefaultWindowState(fallbackArea)
  let currentState = stored?.current.mode === 'left-floating'
    ? getLeftFloatingWindowState(findArea(stored.current))
    : clampWindowState(stored?.current ?? normalState, findArea(stored?.current))
  let disposed = false
  let saveTimer: number | undefined

  const save = async () => {
    if (disposed) return
    await store.set(WINDOW_STATE_KEY, { current: currentState, normal: normalState } satisfies StoredWindowState)
    await store.save()
  }
  const apply = async (state: WindowState) => {
    if (await appWindow.isMaximized()) await appWindow.unmaximize()
    await appWindow.setAlwaysOnTop(state.mode === 'left-floating')
    await appWindow.setSize(new windowApi.LogicalSize(state.width, state.height))
    await appWindow.setPosition(new windowApi.LogicalPosition(state.x, state.y))
    currentState = state
  }
  const captureNormalState = async () => {
    if (currentState.mode !== 'normal' || await appWindow.isMaximized() || await appWindow.isFullscreen()) return
    const scaleFactor = await appWindow.scaleFactor()
    const position = (await appWindow.outerPosition()).toLogical(scaleFactor)
    const size = (await appWindow.outerSize()).toLogical(scaleFactor)
    normalState = { mode: 'normal', x: position.x, y: position.y, width: size.width, height: size.height }
    currentState = normalState
    await save()
  }
  const scheduleCapture = () => {
    if (disposed || currentState.mode !== 'normal') return
    if (saveTimer !== undefined) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => { void captureNormalState() }, 250)
  }

  await apply(currentState)
  await save()
  const unlistenMoved = await appWindow.onMoved(scheduleCapture)
  const unlistenResized = await appWindow.onResized(scheduleCapture)

  return {
    getMode: () => currentState.mode,
    async toggleLeftFloating() {
      if (currentState.mode === 'normal') {
        await captureNormalState()
        const monitor = await windowApi.currentMonitor() ?? fallbackMonitor
        await apply(getLeftFloatingWindowState(toWorkArea(monitor)))
      } else {
        const monitor = await windowApi.currentMonitor() ?? fallbackMonitor
        await apply(clampWindowState(normalState, toWorkArea(monitor)))
      }
      await save()
      return currentState.mode
    },
    async resetDefault() {
      const monitor = await windowApi.currentMonitor() ?? fallbackMonitor
      normalState = getDefaultWindowState(toWorkArea(monitor))
      await apply(normalState)
      await save()
      return currentState.mode
    },
    dispose() {
      disposed = true
      if (saveTimer !== undefined) window.clearTimeout(saveTimer)
      unlistenMoved()
      unlistenResized()
    },
  }
}

export async function openDesktopConfigStore(): Promise<DesktopConfigStore | null> {
  if (!isTauriRuntime()) return null

  const { load } = await import('@tauri-apps/plugin-store')
  const store = await load(DESKTOP_CONFIG_FILE, { autoSave: false }) as unknown as TauriStore
  return {
    async read(idFactory) {
      const stored = await store.get<string>('creatorDockConfig')
      const adapter: StorageAdapter = {
        getItem: () => typeof stored === 'string' ? stored : null,
        setItem: () => undefined,
      }
      const loaded = loadConfig(adapter, idFactory)
      return { ...loaded, hasStoredConfig: typeof stored === 'string' }
    },
    async write(config) {
      await store.set('creatorDockConfig', exportConfig(config))
      await store.save()
    },
  }
}

export async function openExternalUrl(url: string): Promise<boolean> {
  if (!isHttpUrl(url)) throw new Error('Only HTTP(S) URLs can be opened.')
  if (!isTauriRuntime()) return false

  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('open_external', { url })
  return true
}

export async function getDesktopAliasStatus(): Promise<DesktopAliasStatus | null> {
  if (!isTauriRuntime()) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<DesktopAliasStatus>('desktop_alias_status')
}

export async function getDesktopPlatform(): Promise<DesktopPlatform> {
  if (!isTauriRuntime()) return 'other'
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<DesktopPlatform>('desktop_platform')
}

export async function createDesktopAlias(name = 'CreatorDock'): Promise<DesktopAliasStatus> {
  if (!isTauriRuntime()) throw new Error('Desktop aliases are available in the installed app.')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<DesktopAliasStatus>('create_desktop_alias', { name })
}

export async function removeDesktopAlias(name = 'CreatorDock'): Promise<DesktopAliasStatus> {
  if (!isTauriRuntime()) throw new Error('Desktop aliases are available in the installed app.')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<DesktopAliasStatus>('remove_desktop_alias', { name })
}

export function shouldOfferMacDesktopAlias(
  platform: DesktopPlatform,
  alias: DesktopAliasStatus | null,
  onboardingHandled: boolean | null,
): boolean {
  return platform === 'macos' && alias?.exists === false && onboardingHandled === false
}

export async function getMacDesktopAliasOnboardingHandled(): Promise<boolean | null> {
  if (!isTauriRuntime()) return null
  const { load } = await import('@tauri-apps/plugin-store')
  const store = await load(DESKTOP_CONFIG_FILE, { autoSave: false }) as unknown as TauriStore
  return (await store.get<boolean>(MAC_DESKTOP_ALIAS_ONBOARDING_KEY)) === true
}

export async function markMacDesktopAliasOnboardingHandled(): Promise<void> {
  if (!isTauriRuntime()) return
  const { load } = await import('@tauri-apps/plugin-store')
  const store = await load(DESKTOP_CONFIG_FILE, { autoSave: false }) as unknown as TauriStore
  await store.set(MAC_DESKTOP_ALIAS_ONBOARDING_KEY, true)
  await store.save()
}
