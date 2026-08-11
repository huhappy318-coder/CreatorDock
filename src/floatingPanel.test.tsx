import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FloatingPanel } from './floatingPanel'

describe('floating AI panels', () => {
  afterEach(cleanup)
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

  it('focuses the close control, contains Tab focus, and closes with Escape', () => {
    const onClose = vi.fn()
    render(<FloatingPanel eyebrow="测试" title="键盘面板" closeLabel="关闭面板" onClose={onClose} width={640} height={420}>
      <input aria-label="写作任务" />
      <button type="button">生成内容</button>
    </FloatingPanel>)

    const panel = screen.getByRole('dialog', { name: '键盘面板' })
    const close = screen.getByRole('button', { name: '关闭面板' })
    const resizeHandle = screen.getByRole('button', { name: '调整面板大小' })

    expect(close).toHaveFocus()
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true })
    expect(resizeHandle).toHaveFocus()
    fireEvent.keyDown(panel, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
