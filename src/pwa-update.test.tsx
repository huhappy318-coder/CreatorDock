import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdatePrompt } from './pwa-update'

afterEach(cleanup)

describe('PWA update prompt', () => {
  it('offers explicit reload and dismiss actions when an update is available', () => {
    const reload = vi.fn()
    const dismiss = vi.fn()

    render(<UpdatePrompt onDismiss={dismiss} onReload={reload} />)

    const prompt = screen.getByRole('status', { name: 'CreatorDock update available' })
    expect(prompt).toHaveTextContent('A new version of CreatorDock is ready.')

    fireEvent.click(screen.getByRole('button', { name: 'Reload now' }))
    expect(reload).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update' }))
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status', { name: 'CreatorDock update available' })).not.toBeInTheDocument()
  })
})
