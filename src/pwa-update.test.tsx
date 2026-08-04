import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdatePrompt } from './pwa-update'

afterEach(cleanup)

describe('PWA update prompt', () => {
  it('uses Chinese-first copy and offers explicit reload and dismiss actions', () => {
    const reload = vi.fn()
    const dismiss = vi.fn()

    render(<UpdatePrompt onDismiss={dismiss} onReload={reload} />)

    const prompt = screen.getByRole('status', { name: 'CreatorDock 有可用更新' })
    expect(prompt).toHaveTextContent('CreatorDock 已准备好新版本。')

    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    expect(reload).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '暂不更新' }))
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status', { name: 'CreatorDock 有可用更新' })).not.toBeInTheDocument()
  })

  it('keeps the English copy available when explicitly requested', () => {
    render(<UpdatePrompt language="en" onDismiss={vi.fn()} onReload={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'CreatorDock update available' })).toHaveTextContent(
      'A new version of CreatorDock is ready.',
    )
    expect(screen.getByRole('button', { name: 'Reload now' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss update' })).toBeInTheDocument()
  })

  it('updates visible copy when the active language changes at runtime', () => {
    const { rerender } = render(<UpdatePrompt language="zh-CN" onDismiss={vi.fn()} onReload={vi.fn()} />)

    rerender(<UpdatePrompt language="en" onDismiss={vi.fn()} onReload={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'CreatorDock update available' })).toBeInTheDocument()
  })
})
