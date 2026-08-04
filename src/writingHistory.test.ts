import { describe, expect, it } from 'vitest'
import { createWritingTurn, loadWritingDraft, loadWritingHistory, saveWritingDraft, saveWritingHistory, WRITING_DRAFT_STORAGE_KEY, WRITING_HISTORY_STORAGE_KEY, type WritingTurn } from './writingHistory'

const storage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('writing history persistence', () => {
  it('round-trips turns and keeps the newest 50 entries', () => {
    const adapter = storage()
    const turns: WritingTurn[] = Array.from({ length: 51 }, (_, index) => ({
      id: `turn-${index}`,
      task: `任务 ${index}`,
      output: `结果 ${index}`,
      createdAt: new Date(0).toISOString(),
      status: 'complete',
    }))
    saveWritingHistory(adapter, turns)
    const loaded = loadWritingHistory(adapter)
    expect(adapter.getItem(WRITING_HISTORY_STORAGE_KEY)).toBeTruthy()
    expect(loaded).toHaveLength(50)
    expect(loaded[0].id).toBe('turn-1')
    expect(loaded.at(-1)?.output).toBe('结果 50')
  })

  it('recovers from malformed local data and creates a generating turn', () => {
    const adapter = storage()
    adapter.setItem(WRITING_HISTORY_STORAGE_KEY, '{broken')
    expect(loadWritingHistory(adapter)).toEqual([])
    const turn = createWritingTurn('保留这次输入')
    expect(turn.task).toBe('保留这次输入')
    expect(turn.status).toBe('generating')
  })

  it('marks a persisted in-progress turn as interrupted after a reload', () => {
    const adapter = storage()
    saveWritingHistory(adapter, [{ id: 'unfinished', task: '继续写', output: '已有片段', createdAt: new Date(0).toISOString(), status: 'generating' }])
    expect(loadWritingHistory(adapter)).toMatchObject([{ id: 'unfinished', status: 'interrupted', output: '已有片段' }])
  })

  it('round-trips an unsent writing draft independently from conversation history', () => {
    const adapter = storage()
    saveWritingDraft(adapter, '尚未发送的内容')
    expect(adapter.getItem(WRITING_DRAFT_STORAGE_KEY)).toBe('尚未发送的内容')
    expect(loadWritingDraft(adapter)).toBe('尚未发送的内容')
  })
})
