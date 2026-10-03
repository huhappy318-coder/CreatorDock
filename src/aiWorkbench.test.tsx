import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./llmClient', () => ({
  createLLMClient: () => ({
    generateText: async () => 'OK',
    streamText: async function* () { yield 'OK' },
    testConnection: async () => ({ ok: true, latencyMs: 8 }),
  }),
}))

import { AiWorkbench } from './aiWorkbench'
import { addModelProfile, createDefaultAiConfig, MODEL_PRESETS, modelInputFromPreset, saveAiConfig } from './aiConfig'
import type { LaunchEntry } from './config'

const packageEntries: LaunchEntry[] = [
  { id: 'xhs', displayName: '小红书', destinationUrl: 'https://creator.xiaohongshu.com/', browserTarget: 'default', createShortcut: false, platformPresetId: 'xiaohongshu' },
  { id: 'wechat', displayName: '微信公众号', destinationUrl: 'https://mp.weixin.qq.com/', browserTarget: 'default', createShortcut: false, platformPresetId: 'wechat-official-accounts' },
]

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
    expect(screen.getByText('首次只需三步：选模型、填 API Key、设置本机加密口令。接口和默认参数已预填；导出文件不会包含密钥。')).toBeInTheDocument()
    expect(screen.getByText('高级参数（已预填）').closest('details')).not.toHaveAttribute('open')
    expect(screen.queryByRole('heading', { name: '写作风格与去 AI 味' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '写作 Skill' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.change(screen.getByLabelText('模型选择'), { target: { value: 'qwen3.7-plus' } })
    expect(screen.getByText('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBeInTheDocument()
    expect(screen.getByText('qwen3.7-plus')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: 'sk-ui-secret' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并返回' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '模型与连接' })).not.toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByRole('status')).toHaveTextContent('模型已加密保存在本机并回到写作区。建议再测试连接。')
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

  it('derives content package targets from the existing workbench entries', () => {
    render(<AiWorkbench entries={packageEntries} />)

    expect(screen.getByRole('button', { name: '单篇写作' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '内容包' })).toBeInTheDocument()
    expect(screen.getByLabelText('内容包目标')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '小红书' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '微信公众号' })).toBeInTheDocument()
  })

  it('generates and renders one local variant for every selected target', async () => {
    const input = { ...modelInputFromPreset(MODEL_PRESETS[0], 'sk-package'), streaming: false }
    const config = await addModelProfile(createDefaultAiConfig(), input, 'local-passphrase')
    saveAiConfig(localStorage, config)

    render(<AiWorkbench entries={packageEntries} />)
    fireEvent.click(screen.getByRole('button', { name: '模型设置' }))
    fireEvent.change(screen.getByLabelText('本机解锁口令'), { target: { value: 'local-passphrase' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    fireEvent.change(screen.getByLabelText('写作任务'), { target: { value: '写一篇关于独立创作者工作流的分享' } })
    fireEvent.click(screen.getByRole('button', { name: '生成内容包' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('内容包已生成 2/2 份平台稿'))
    expect(screen.getByLabelText('最近内容包')).toBeInTheDocument()
    expect(screen.getAllByText('OK')).toHaveLength(2)
    expect(localStorage.getItem('creatordock.content-packages.v1')).toContain('小红书')
    expect(localStorage.getItem('creatordock.content-packages.v1')).toContain('微信公众号')
  })

  it('shows direct first-use setup actions when model or style is missing', () => {
    render(<AiWorkbench />)

    expect(screen.getByLabelText('开始创作')).toHaveTextContent('先完成两步')
    expect(screen.getByRole('button', { name: '设置模型' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加个人风格' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '设置模型' }))
    expect(screen.getByRole('dialog', { name: '模型与连接' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭模型设置' }))
    fireEvent.click(screen.getByRole('button', { name: '添加个人风格' }))
    expect(screen.getByRole('dialog', { name: '写作风格与去 AI 味' })).toBeInTheDocument()
  })

  it('keeps cover generation as a separate compact workspace', () => {
    render(<AiWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: '封面生成' }))
    expect(screen.getByRole('heading', { name: '封面生成', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '封面设置' })).toBeInTheDocument()
    expect(screen.getByLabelText('负面提示词（可选）')).toBeInTheDocument()
    expect(screen.getByText('选择比例和风格，补充负面提示词，制作发布封面。')).toBeInTheDocument()
    expect(screen.getByText('可选，最多 3 张；当前版本需要专用图片编辑适配器后才能发送。')).toBeInTheDocument()
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

it('recovers older packages, edits drafts durably and reports storage failure without crashing', async () => {
  const { createContentPackage, saveContentPackages } = await import('./contentPackage')
  const old = createContentPackage('旧选题', [{ id: 'xhs', label: '小红书' }])
  old.variants[0] = { ...old.variants[0], status: 'complete', output: '旧成稿' }
  const recent = createContentPackage('新选题', [{ id: 'wechat', label: '公众号' }])
  localStorage.clear()
  saveContentPackages(localStorage, [old, recent])
  cleanup()
  const { unmount } = render(<AiWorkbench entries={packageEntries} />)
  expect(screen.getByText('上次生成已中断，可重试未完成稿件。')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('历史内容包'), { target: { value: old.id } })
  fireEvent.change(screen.getByLabelText('编辑 小红书 稿件'), { target: { value: '修改后的成稿' } })
  expect(localStorage.getItem('creatordock.content-packages.v1')).toContain('修改后的成稿')
  unmount()
  render(<AiWorkbench entries={packageEntries} />)
  fireEvent.change(screen.getByLabelText('历史内容包'), { target: { value: old.id } })
  expect(screen.getByLabelText('编辑 小红书 稿件')).toHaveValue('修改后的成稿')
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
  try {
    fireEvent.change(screen.getByLabelText('编辑 小红书 稿件'), { target: { value: '仍可导出的内容' } })
    expect(screen.getByRole('alert')).toHaveTextContent('本机存储已满或不可用')
    expect(screen.getByLabelText('编辑 小红书 稿件')).toHaveValue('仍可导出的内容')
    expect(screen.getByRole('button', { name: '导出内容包' })).toBeEnabled()
  } finally { write.mockRestore(); cleanup() }
})
