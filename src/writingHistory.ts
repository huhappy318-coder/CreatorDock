export const WRITING_HISTORY_STORAGE_KEY = 'creatordock.writing.history.v1'
export const WRITING_DRAFT_STORAGE_KEY = 'creatordock.writing.draft.v1'
const MAX_WRITING_TURNS = 50

export type WritingTurnStatus = 'generating' | 'complete' | 'error' | 'interrupted'

export interface WritingTurn {
  id: string
  task: string
  output: string
  createdAt: string
  status: WritingTurnStatus
  error?: string
}

export interface WritingHistoryStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function loadWritingHistory(storage: WritingHistoryStorage): WritingTurn[] {
  const raw = storage.getItem(WRITING_HISTORY_STORAGE_KEY)
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value
      .filter(isWritingTurn)
      .slice(-MAX_WRITING_TURNS)
      .map((turn) => turn.status === 'generating' ? { ...turn, status: 'interrupted' } : turn)
  } catch {
    return []
  }
}

export function saveWritingHistory(storage: WritingHistoryStorage, history: WritingTurn[]): void {
  storage.setItem(WRITING_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-MAX_WRITING_TURNS)))
}

export function loadWritingDraft(storage: WritingHistoryStorage): string {
  return storage.getItem(WRITING_DRAFT_STORAGE_KEY) ?? ''
}

export function saveWritingDraft(storage: WritingHistoryStorage, draft: string): void {
  storage.setItem(WRITING_DRAFT_STORAGE_KEY, draft)
}

export function createWritingTurn(task: string): WritingTurn {
  const id = globalThis.crypto?.randomUUID?.() ?? `turn-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return { id, task, output: '', createdAt: new Date().toISOString(), status: 'generating' }
}

function isWritingTurn(value: unknown): value is WritingTurn {
  if (!value || typeof value !== 'object') return false
  const turn = value as Record<string, unknown>
  return typeof turn.id === 'string'
    && typeof turn.task === 'string'
    && typeof turn.output === 'string'
    && typeof turn.createdAt === 'string'
    && (turn.status === 'generating' || turn.status === 'complete' || turn.status === 'error' || turn.status === 'interrupted')
    && (turn.error === undefined || typeof turn.error === 'string')
}
