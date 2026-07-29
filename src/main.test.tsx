import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { platformPresets } from './catalog'
import { App } from './main'

describe('CreatorDock catalog mockup', () => {
  it('renders explicit uncertainty notes for unverified platform destinations', () => {
    render(<App />)

    for (const preset of platformPresets.filter((item) => item.verification === 'unverified')) {
      expect(screen.getByRole('link', { name: new RegExp(preset.name) })).toHaveTextContent(
        preset.verificationNote!,
      )
    }
  })
})
