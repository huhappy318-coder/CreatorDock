import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { UpdatePrompt } from './pwa-update'
import { useUpdatePromptLanguage } from './pwa-language'

const originalLanguage = document.documentElement.lang

function PromptProbe({ language }: { language?: 'zh-CN' | 'en' }) {
  const activeLanguage = useUpdatePromptLanguage(language)
  return <UpdatePrompt language={activeLanguage} onDismiss={() => {}} onReload={() => {}} />
}

afterEach(() => {
  cleanup()
  document.documentElement.lang = originalLanguage
})

describe('PWA document language', () => {
  it('updates visible copy when html lang changes while the prompt is mounted', async () => {
    document.documentElement.lang = 'zh-CN'
    render(<PromptProbe />)

    expect(screen.getByRole('status', { name: 'CreatorDock 有可用更新' })).toBeInTheDocument()

    document.documentElement.lang = 'en'

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'CreatorDock update available' })).toBeInTheDocument()
    })
  })

  it('keeps an explicit language override when html lang changes', async () => {
    document.documentElement.lang = 'zh-CN'
    render(<PromptProbe language="en" />)

    document.documentElement.lang = 'zh-CN'

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'CreatorDock update available' })).toBeInTheDocument()
    })
  })
})
