import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FloatingPanel } from './floatingPanel'

describe('floating AI panels', () => {
  it('moves with the header and resizes from the corner', () => {
    render(<FloatingPanel eyebrow="测试" title="可拖动面板" closeLabel="关闭面板" onClose={() => undefined} width={640} height={420}>内容</FloatingPanel>)
    const panel = screen.getByRole('dialog', { name: '可拖动面板' }) as HTMLElement
    const header = panel.querySelector('.floating-panel-heading') as HTMLElement
    const initialLeft = panel.style.left
    const initialWidth = panel.style.width

    fireEvent.mouseDown(header, { button: 0, clientX: 200, clientY: 200 })
    fireEvent.mouseMove(header, { clientX: 260, clientY: 240 })
    fireEvent.mouseUp(header, { button: 0, clientX: 260, clientY: 240 })
    expect(panel.style.left).not.toBe(initialLeft)

    const resizeHandle = screen.getByRole('button', { name: '调整面板大小' })
    fireEvent.mouseDown(resizeHandle, { button: 0, clientX: 840, clientY: 620 })
    fireEvent.mouseMove(resizeHandle, { clientX: 900, clientY: 660 })
    fireEvent.mouseUp(resizeHandle, { button: 0, clientX: 900, clientY: 660 })
    expect(panel.style.width).not.toBe(initialWidth)
  })
})
