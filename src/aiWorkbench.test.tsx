import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AiWorkbench } from './aiWorkbench'

describe('AI writing workbench', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })

  it('keeps model, style, and skill configuration in separate focused dialogs', async () => {
    const { container } = render(<AiWorkbench />)
    expect(screen.getByRole('heading', { name: 'AI 写作', level: 2 })).toBeInTheDocument()
    expect(screen.getByLabelText('写作任务')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成内容' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '写作风格与去 AI 味' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '写作 Skill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '封面生成' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '模型设置' }))
    const modelDialog = screen.getByRole('dialog', { name: '模型与连接' })
    expect(modelDialog).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '写作风格与去 AI 味' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '写作 Skill' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.change(screen.getByLabelText('模型选择'), { target: { value: 'qwen3.7-plus' } })
    expect(screen.getByText('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBeInTheDocument()
    expect(screen.getByText('qwen3.7-plus')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: 'sk-ui-secret' } })
    fireEvent.click(screen.getByRole('button', { name: '保存模型' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '模型与连接' })).not.toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByRole('status')).toHaveTextContent('模型已保存')
    expect(screen.getByLabelText('模型连接状态')).toHaveTextContent('已保存，尚未验证连接')
    expect(screen.queryByText('sk-ui-secret')).not.toBeInTheDocument()
    expect(localStorage.getItem('creatordock.ai.v1')).not.toContain('sk-ui-secret')

    fireEvent.click(screen.getByRole('button', { name: '写作风格与去 AI 味' }))
    expect(screen.getByRole('dialog', { name: '写作风格与去 AI 味' })).toBeInTheDocument()
    expect(screen.queryByLabelText('模型名称')).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: '关闭风格设置' }))

    fireEvent.click(screen.getByRole('button', { name: '写作 Skill' }))
    expect(screen.getByRole('dialog', { name: '写作 Skill' })).toBeInTheDocument()
    expect(screen.queryByLabelText('风格名称')).not.toBeInTheDocument()
  })

  it('keeps cover generation as a separate compact workspace', () => {
    render(<AiWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: '封面生成' }))
    expect(screen.getByRole('heading', { name: '封面生成', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '封面设置' })).toBeInTheDocument()
    expect(screen.getByLabelText('负面提示词（可选）')).toBeInTheDocument()
    expect(screen.getByText('选择比例和风格，补充负面提示词，制作发布封面。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '模型设置' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '封面设置' }))
    const coverDialog = screen.getByRole('dialog', { name: '封面接口与密钥' })
    expect(coverDialog).toHaveClass('floating-panel')
    expect(screen.getByRole('button', { name: '调整面板大小' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭封面设置' }))
    fireEvent.click(screen.getByRole('button', { name: '回到写作' }))
    expect(screen.getByRole('heading', { name: 'AI 写作', level: 2 })).toBeInTheDocument()
  })

  it('keeps the main model connection state available in English', () => {
    render(<AiWorkbench language="en" />)
    expect(screen.getByLabelText('Model connection status')).toHaveTextContent('Unconfigured')
    expect(screen.getByRole('button', { name: 'Set up model' })).toBeInTheDocument()
  })
})
