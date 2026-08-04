export const BROWSER_WINDOW_STORAGE_KEY = 'creatordock.browser.windows.v1'

export interface BrowserWindowRecord {
  entryId: string
  windowName: string
  url: string
  lastOpenedAt: string
}

interface BrowserWindowStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function browserWindowName(entryId: string): string {
  const safeId = entryId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
  return `CreatorDock_${safeId || 'entry'}_${stableHash(entryId)}`
}

export function rememberBrowserWindow(storage: BrowserWindowStorage, record: BrowserWindowRecord): void {
  let records: BrowserWindowRecord[] = []
  const raw = storage.getItem(BROWSER_WINDOW_STORAGE_KEY)
  if (raw) {
    try {
      const value = JSON.parse(raw)
      if (Array.isArray(value)) records = value.filter(isBrowserWindowRecord)
    } catch {
      records = []
    }
  }
  const safeRecord = { ...record, url: redactRecordUrl(record.url) }
  const next = [...records.filter((item) => item.entryId !== record.entryId), safeRecord].slice(-100)
  storage.setItem(BROWSER_WINDOW_STORAGE_KEY, JSON.stringify(next))
}

export function openBrowserEntryWindow(
  url: string,
  entryId: string,
  openWindow: (url?: string, target?: string, features?: string) => Window | null = window.open.bind(window),
): boolean {
  const popup = openWindow(url, browserWindowName(entryId), 'popup,width=1180,height=820,resizable=yes,scrollbars=yes')
  if (!popup) return false
  try { popup.opener = null } catch { /* The browser may forbid changing opener for an external window. */ }
  try { popup.focus?.() } catch { /* A blocked focus does not prevent the destination from opening. */ }
  return true
}

function stableHash(value: string): string {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(36)
}

function redactRecordUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return value
  }
}

function isBrowserWindowRecord(value: unknown): value is BrowserWindowRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.entryId === 'string'
    && typeof record.windowName === 'string'
    && typeof record.url === 'string'
    && typeof record.lastOpenedAt === 'string'
}
