import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addModelProfile, createDefaultAiConfig, MODEL_PRESETS, modelInputFromPreset, saveAiConfig } from './aiConfig'

const streamControl = vi.hoisted(() => ({
  pauseAfterFirstChunk: false,
  resume: undefined as undefined | (() => void),
  throwAfterFirstChunk: false,
}))

vi.mock('./llmClient', () => ({
  createLLMClient: () => ({
    generateText: async () => '这是生成结果',
    streamText: async function* () {
      yield '这是生成结果'
      if (streamControl.pauseAfterFirstChunk) {
        await new Promise<void>((resolve) => { streamControl.resume = resolve })
      } else if (streamControl.throwAfterFirstChunk) {
        throw new Error('stream disconnected')
      }
    },
    testConnection: async () => ({ ok: true, latencyMs: 1 }),
  }),
}))

import { AiWorkbench } from './aiWorkbench'

describe('AI writing conversation history', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
    streamControl.pauseAfterFirstChunk = false
    streamControl.resume = undefined
    streamControl.throwAfterFirstChunk = false
  })

  it('restores an unsent writing draft after a reload', () => {
    const { unmount } = render(<AiWorkbench />)
    fireEvent.change(screen.getByLabelText('写作任务'), { target: { value: '这是一段尚未发送的草稿。' } })
    unmount()
    render(<AiWorkbench />)
    expect(screen.getByLabelText('写作任务')).toHaveValue('这是一段尚未发送的草稿。')
  })

  it('persists a streamed partial response before it completes and restores it as interrupted', async () => {
    const input = { ...modelInputFromPreset(MODEL_PRESETS[0], 'sk-test'), streaming: true }
    const config = await addModelProfile(createDefaultAiConfig(), input, 'local-passphrase')
    saveAiConfig(localStorage, config)
    streamControl.pauseAfterFirstChunk = true

    const { unmount } = render(<AiWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: '模型设置' }))
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    fireEvent.change(screen.getByLabelText('写作任务'), { target: { value: '请保留流式生成中的内容。' } })
    fireEvent.click(screen.getByRole('button', { name: '生成内容' }))

    await waitFor(() => expect(screen.getByText('这是生成结果')).toBeInTheDocument())
    await new Promise((resolve) => setTimeout(resolve, 550))
    const saved = localStorage.getItem('creatordock.writing.history.v1')
    expect(saved).toContain('这是生成结果')
    expect(saved).toContain('"status":"generating"')

    unmount()
    render(<AiWorkbench />)
    expect(screen.getByText('上次生成已中断；你可以继续这条或删除记录。')).toBeInTheDocument()
    expect(screen.getByText('这是生成结果')).toBeInTheDocument()
  })

  it('keeps partial streamed output visible when the provider errors after sending a chunk', async () => {
    const input = { ...modelInputFromPreset(MODEL_PRESETS[0], 'sk-test'), streaming: true }
    const config = await addModelProfile(createDefaultAiConfig(), input, 'local-passphrase')
    saveAiConfig(localStorage, config)
    streamControl.throwAfterFirstChunk = true

    render(<AiWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: '模型设置' }))
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    fireEvent.change(screen.getByLabelText('写作任务'), { target: { value: '请保留报错前已生成的内容。' } })
    fireEvent.click(screen.getByRole('button', { name: '生成内容' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('stream disconnected'))
    expect(screen.getByText('这是生成结果')).toBeInTheDocument()
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
    expect(screen.getByText('草稿会自动保存在本机；新对话不会删除之前的写作记录。')).toBeInTheDocument()

    unmount()
    render(<AiWorkbench />)
    expect(screen.getAllByText(task).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('这是生成结果')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清空记录' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新对话' }))
    expect(screen.getByLabelText('写作任务')).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('已开始新对话，之前的写作记录仍保留在本机')
    expect(screen.getAllByText(task).length).toBeGreaterThanOrEqual(1)
    expect(localStorage.getItem('creatordock.writing.history.v1')).toContain('这是生成结果')

    fireEvent.click(screen.getByRole('button', { name: '继续 / 改写' }))
    expect(screen.getByLabelText('写作任务')).toHaveValue(`原任务：${task}\n\n已有内容：\n这是生成结果\n\n请在保留上述上下文的基础上继续写作或按我的要求修改：`)
    expect(screen.getByRole('status')).toHaveTextContent('已带回原任务和已有内容，尚未发送')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.queryByLabelText('写作对话记录')).not.toBeInTheDocument()
    expect(localStorage.getItem('creatordock.writing.history.v1')).not.toContain('这是生成结果')

  })
})
