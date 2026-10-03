import '@testing-library/jest-dom/vitest'
import { screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('./pwa-register', () => {
  throw new Error('PWA registration chunk unavailable')
})

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="root"></div><div id="pwa-update-root"></div>'
})

it('renders the application when the optional PWA registration chunk rejects', async () => {
  await import('./main')

  expect(await screen.findByRole('heading', { name: '分发工作台' })).toBeInTheDocument()
})
