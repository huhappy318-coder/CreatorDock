import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AiWorkbench } from './aiWorkbench'

describe('AI writing workbench', () => {
  beforeEach(() => localStorage.clear())

  it('saves a masked model profile and lets the user create a style without exposing the key', async () => {
    const { container } = render(<AiWorkbench />)
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Local model' } })
    fireEvent.change(screen.getByLabelText('模型 ID'), { target: { value: 'test-model' } })
    fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: 'sk-ui-secret' } })
    fireEvent.click(screen.getByRole('button', { name: '保存模型' }))
    await waitFor(() => expect(screen.getAllByText('Local model').length).toBeGreaterThan(0), { timeout: 5000 })
    expect(screen.queryByText('sk-ui-secret')).not.toBeInTheDocument()
    expect(localStorage.getItem('creatordock.ai.v1')).not.toContain('sk-ui-secret')

    fireEvent.change(screen.getByLabelText('风格名称'), { target: { value: '我的口吻' } })
    fireEvent.change(screen.getByLabelText('风格描述'), { target: { value: '短句，具体，有一点停顿。' } })
    const sampleInput = container.querySelector('input[accept*=".txt"]') as HTMLInputElement
    fireEvent.change(sampleInput, { target: { files: [new File(['一段样本'], 'voice.md', { type: 'text/markdown' })] } })
    await waitFor(() => expect(screen.getByDisplayValue('voice.md')).toBeInTheDocument(), { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: '保存风格' }))
    await waitFor(() => expect(screen.getAllByText(/我的口吻/).length).toBeGreaterThan(0), { timeout: 5000 })

    fireEvent.click(screen.getAllByRole('button', { name: '编辑' }).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: '新增样本' }))
    expect(screen.getAllByRole('button', { name: /删除样本/ })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: /删除样本/ }).at(-1)!)
    expect(screen.getAllByRole('button', { name: /删除样本/ })).toHaveLength(1)
  })
})
