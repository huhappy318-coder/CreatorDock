import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

interface PanelFrame {
  x: number
  y: number
  width: number
  height: number
}

interface PanelOptions {
  width: number
  height: number
  minWidth?: number
  minHeight?: number
}

interface DragSession {
  pointerId: number
  startX: number
  startY: number
  frame: PanelFrame
}

const VIEWPORT_GUTTER = 16

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight }
}

function constrainFrame(frame: PanelFrame, options: Required<PanelOptions>): PanelFrame {
  const viewport = viewportSize()
  const width = Math.min(Math.max(options.minWidth, frame.width), Math.max(options.minWidth, viewport.width - VIEWPORT_GUTTER * 2))
  const height = Math.min(Math.max(options.minHeight, frame.height), Math.max(options.minHeight, viewport.height - VIEWPORT_GUTTER * 2))
  const maxX = Math.max(VIEWPORT_GUTTER, viewport.width - width - VIEWPORT_GUTTER)
  const maxY = Math.max(VIEWPORT_GUTTER, viewport.height - height - VIEWPORT_GUTTER)
  return {
    x: Math.min(Math.max(VIEWPORT_GUTTER, frame.x), maxX),
    y: Math.min(Math.max(VIEWPORT_GUTTER, frame.y), maxY),
    width,
    height,
  }
}

function initialFrame(options: Required<PanelOptions>): PanelFrame {
  const viewport = viewportSize()
  const frame = {
    x: Math.max(VIEWPORT_GUTTER, (viewport.width - options.width) / 2),
    y: Math.max(VIEWPORT_GUTTER, (viewport.height - options.height) / 2),
    width: options.width,
    height: options.height,
  }
  return constrainFrame(frame, options)
}

export function useFloatingPanel(options: PanelOptions) {
  const normalizedOptions: Required<PanelOptions> = {
    width: options.width,
    height: options.height,
    minWidth: options.minWidth ?? 360,
    minHeight: options.minHeight ?? 280,
  }
  const [frame, setFrame] = useState(() => initialFrame(normalizedOptions))
  const dragSession = useRef<DragSession | undefined>(undefined)
  const resizeSession = useRef<DragSession | undefined>(undefined)

  useEffect(() => {
    const handleViewportResize = () => setFrame((current) => constrainFrame(current, normalizedOptions))
    window.addEventListener('resize', handleViewportResize)
    return () => window.removeEventListener('resize', handleViewportResize)
  }, [normalizedOptions.height, normalizedOptions.minHeight, normalizedOptions.minWidth, normalizedOptions.width])

  const stopPointerSession = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragSession.current?.pointerId === event.pointerId) dragSession.current = undefined
    if (resizeSession.current?.pointerId === event.pointerId) resizeSession.current = undefined
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || dragSession.current || (event.target as HTMLElement).closest('button')) return
    dragSession.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, frame }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  const handleDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current
    if (!session) return
    moveFrame(session, event.clientX, event.clientY)
  }

  const handleMouseDragStart = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0 || dragSession.current || (event.target as HTMLElement).closest('button')) return
    dragSession.current = { pointerId: -1, startX: event.clientX, startY: event.clientY, frame }
    event.preventDefault()
  }

  const handleMouseDragMove = (event: ReactMouseEvent<HTMLElement>) => {
    const session = dragSession.current
    if (!session || session.pointerId !== -1) return
    moveFrame(session, event.clientX, event.clientY)
  }

  const moveFrame = (session: DragSession, clientX: number, clientY: number) => {
    setFrame((current) => constrainFrame({ ...current, x: session.frame.x + clientX - session.startX, y: session.frame.y + clientY - session.startY }, normalizedOptions))
  }

  const handleResizeStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    resizeSession.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, frame }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  const handleResizeMove = (event: ReactPointerEvent<HTMLElement>) => {
    const session = resizeSession.current
    if (!session) return
    resizeFrame(session, event.clientX, event.clientY)
  }

  const handleMouseResizeStart = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0 || resizeSession.current) return
    resizeSession.current = { pointerId: -1, startX: event.clientX, startY: event.clientY, frame }
    event.preventDefault()
  }

  const handleMouseResizeMove = (event: ReactMouseEvent<HTMLElement>) => {
    const session = resizeSession.current
    if (!session || session.pointerId !== -1) return
    resizeFrame(session, event.clientX, event.clientY)
  }

  const resizeFrame = (session: DragSession, clientX: number, clientY: number) => {
    const viewport = viewportSize()
    const maxWidth = Math.max(normalizedOptions.minWidth, viewport.width - session.frame.x - VIEWPORT_GUTTER)
    const maxHeight = Math.max(normalizedOptions.minHeight, viewport.height - session.frame.y - VIEWPORT_GUTTER)
    setFrame((current) => ({
      ...current,
      width: Math.min(Math.max(normalizedOptions.minWidth, session.frame.width + clientX - session.startX), maxWidth),
      height: Math.min(Math.max(normalizedOptions.minHeight, session.frame.height + clientY - session.startY), maxHeight),
    }))
  }

  useEffect(() => {
    const handleDocumentMouseMove = (event: globalThis.MouseEvent) => {
      const drag = dragSession.current
      if (drag?.pointerId === -1) moveFrame(drag, event.clientX, event.clientY)
      const resize = resizeSession.current
      if (resize?.pointerId === -1) resizeFrame(resize, event.clientX, event.clientY)
    }
    const handleDocumentMouseUp = () => {
      if (dragSession.current?.pointerId === -1 || resizeSession.current?.pointerId === -1) {
        dragSession.current = undefined
        resizeSession.current = undefined
      }
    }
    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)
    }
  }, [normalizedOptions.height, normalizedOptions.minHeight, normalizedOptions.minWidth, normalizedOptions.width])

  const panelStyle: CSSProperties = {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`,
  }

  const stopMouseSession = () => { dragSession.current = undefined; resizeSession.current = undefined }
  return { frame, panelStyle, handleDragStart, handleDragMove, handleDragEnd: stopPointerSession, handleMouseDragStart, handleMouseDragMove, handleMouseDragEnd: stopMouseSession, handleResizeStart, handleResizeMove, handleResizeEnd: stopPointerSession, handleMouseResizeStart, handleMouseResizeMove, handleMouseResizeEnd: stopMouseSession }
}

interface FloatingPanelProps extends PanelOptions {
  eyebrow: string
  title: string
  closeLabel: string
  onClose: () => void
  className?: string
  children: ReactNode
}

export function FloatingPanel({ eyebrow, title, closeLabel, onClose, className = '', children, width, height, minWidth, minHeight }: FloatingPanelProps) {
  const panel = useFloatingPanel({ width, height, minWidth, minHeight })
  const closeButton = useRef<HTMLButtonElement>(null)
  const titleId = `floating-panel-title-${title.replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-').toLowerCase()}`
  useEffect(() => {
    closeButton.current?.focus()
  }, [])

  return <section className={`floating-panel ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} style={panel.panelStyle} onKeyDown={(event) => containPanelFocus(event, onClose)}>
    <div className="floating-panel-heading" onPointerDown={panel.handleDragStart} onPointerMove={panel.handleDragMove} onPointerUp={panel.handleDragEnd} onPointerCancel={panel.handleDragEnd} onMouseDown={panel.handleMouseDragStart} onMouseMove={panel.handleMouseDragMove} onMouseUp={panel.handleMouseDragEnd}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3 id={titleId}>{title}</h3>
      </div>
      <button ref={closeButton} type="button" aria-label={closeLabel} onClick={onClose}>×</button>
    </div>
    <div className="floating-panel-content">{children}</div>
    <button className="floating-panel-resize" type="button" aria-label="调整面板大小" onPointerDown={panel.handleResizeStart} onPointerMove={panel.handleResizeMove} onPointerUp={panel.handleResizeEnd} onPointerCancel={panel.handleResizeEnd} onMouseDown={panel.handleMouseResizeStart} onMouseMove={panel.handleMouseResizeMove} onMouseUp={panel.handleMouseResizeEnd} />
  </section>
}

function containPanelFocus(event: ReactKeyboardEvent<HTMLElement>, onEscape: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    onEscape()
    return
  }
  if (event.key !== 'Tab') return

  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
  )]
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
