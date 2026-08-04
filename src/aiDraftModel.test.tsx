import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_CONFIG_STORAGE_KEY } from './aiConfig'

const MODEL_CONNECTION_STATUS_STORAGE_KEY = 'creatordock.ai.connection-status.v1'
const cryptoFlowTimeout = { timeout: 10_000 }

vi.mock('./llmClient', () => ({
  createLLMClient: () => ({
    generateText: async () => 'OK',
    streamText: async function* () { yield 'OK' },
    testConnection: async () => ({ ok: true, latencyMs: 8 }),
  }),
}))

import { AiWorkbench } from './aiWorkbench'

describe('first model setup', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })

  it('guides a new user and tests a model draft without saving its key', async () => {
    render(<AiWorkbench />)
    expect(screen.getByLabelText('模型连接状态')).toHaveTextContent('未配置')
    fireEvent.click(screen.getByRole('button', { name: '去设置模型' }))
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: 'sk-draft-only' } })
    fireEvent.click(screen.getByRole('button', { name: '测试本次设置' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('本次设置连接成功'), cryptoFlowTimeout)
    expect(localStorage.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull()
    expect(document.body.textContent).not.toContain('sk-draft-only')

    fireEvent.click(screen.getByRole('button', { name: '保存模型' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), cryptoFlowTimeout)
    expect(screen.getByRole('status')).toHaveTextContent('模型已保存')
    expect(screen.getByLabelText('模型连接状态')).toHaveTextContent('已保存，尚未验证连接')
    expect(localStorage.getItem(AI_CONFIG_STORAGE_KEY)).not.toContain('sk-draft-only')

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    fireEvent.click(screen.getByRole('button', { name: '测试当前连接' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('连接成功'), cryptoFlowTimeout)
    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    expect(screen.getByLabelText('模型连接状态')).toHaveTextContent('上次连接成功 · 8 ms')
    expect(localStorage.getItem('creatordock.ai.connection-status.v1')).not.toContain('sk-draft-only')
    expect(localStorage.getItem('creatordock.ai.connection-status.v1')).not.toContain('local-passphrase')
  })

  it('keeps the last remote result when the local passphrase can no longer unlock the saved key', async () => {
    render(<AiWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: '去设置模型' }))
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'correct-passphrase' } })
    fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: 'sk-connection-status' } })
    fireEvent.click(screen.getByRole('button', { name: '保存模型' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), cryptoFlowTimeout)

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    fireEvent.click(screen.getByRole('button', { name: '测试当前连接' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('连接成功'), cryptoFlowTimeout)
    expect(localStorage.getItem(MODEL_CONNECTION_STATUS_STORAGE_KEY)).toContain('"status":"succeeded"')

    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'wrong-passphrase' } })
    fireEvent.click(screen.getByRole('button', { name: '测试当前连接' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('无法解锁已保存的 API Key'), cryptoFlowTimeout)
    expect(localStorage.getItem(MODEL_CONNECTION_STATUS_STORAGE_KEY)).toContain('"status":"succeeded"')

    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    expect(screen.getByLabelText('模型连接状态')).toHaveTextContent('上次连接成功 · 8 ms')
  })

  it('clears connection checks after importing an AI configuration with the same model id', async () => {
    render(<AiWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: '去设置模型' }))
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'import-passphrase' } })
    fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: 'sk-import-status' } })
    fireEvent.click(screen.getByRole('button', { name: '保存模型' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), cryptoFlowTimeout)

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    fireEvent.click(screen.getByRole('button', { name: '测试当前连接' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('连接成功'), cryptoFlowTimeout)
    expect(localStorage.getItem(MODEL_CONNECTION_STATUS_STORAGE_KEY)).toContain('"status":"succeeded"')

    const imported = localStorage.getItem(AI_CONFIG_STORAGE_KEY)
    const configFileInput = document.querySelector('input[accept=".json,application/json"]') as HTMLInputElement
    fireEvent.change(configFileInput, { target: { files: [{ text: async () => imported ?? '' } as unknown as File] } })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('AI 配置已导入'), cryptoFlowTimeout)
    expect(localStorage.getItem(MODEL_CONNECTION_STATUS_STORAGE_KEY)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    expect(screen.getByLabelText('模型连接状态')).toHaveTextContent('已保存，尚未验证连接')
  })
})
