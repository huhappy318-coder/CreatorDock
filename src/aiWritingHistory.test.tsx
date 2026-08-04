import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addModelProfile, createDefaultAiConfig, MODEL_PRESETS, modelInputFromPreset, saveAiConfig } from './aiConfig'

vi.mock('./llmClient', () => ({
  createLLMClient: () => ({
    generateText: async () => '这是生成结果',
    streamText: async function* () { yield '这是生成结果' },
    testConnection: async () => ({ ok: true, latencyMs: 1 }),
  }),
}))

import { AiWorkbench } from './aiWorkbench'

describe('AI writing conversation history', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })

  it('restores an unsent writing draft after a reload', () => {
    const { unmount } = render(<AiWorkbench />)
    fireEvent.change(screen.getByLabelText('写作任务'), { target: { value: '这是一段尚未发送的草稿。' } })
    unmount()
    render(<AiWorkbench />)
    expect(screen.getByLabelText('写作任务')).toHaveValue('这是一段尚未发送的草稿。')
  })

  it('keeps the submitted task and generated result after generation and reload', async () => {
    const input = { ...modelInputFromPreset(MODEL_PRESETS[0], 'sk-test'), streaming: false }
    const config = await addModelProfile(createDefaultAiConfig(), input, 'local-passphrase')
    saveAiConfig(localStorage, config)

    const { unmount } = render(<AiWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: '模型设置' }))
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    const task = '请保留这段输入并生成一段介绍。'
    fireEvent.change(screen.getByLabelText('写作任务'), { target: { value: task } })
    fireEvent.click(screen.getByRole('button', { name: '生成内容' }))

    await waitFor(() => expect(screen.getByText('这是生成结果')).toBeInTheDocument())
    expect(screen.getByLabelText('写作任务')).toHaveValue(task)
    expect(screen.getAllByText(task).length).toBeGreaterThanOrEqual(1)

    unmount()
    render(<AiWorkbench />)
    expect(screen.getAllByText(task).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('这是生成结果')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '继续这条' }))
    expect(screen.getByLabelText('写作任务')).toHaveValue('这是生成结果')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.queryByLabelText('写作对话记录')).not.toBeInTheDocument()
    expect(localStorage.getItem('creatordock.writing.history.v1')).not.toContain('这是生成结果')

  })
})
