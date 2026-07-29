import { useState } from 'react'

export function UpdatePrompt({
  onDismiss,
  onReload,
}: {
  onDismiss: () => void
  onReload: () => void
}) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <section
      className="update-prompt"
      role="status"
      aria-label="CreatorDock update available"
    >
      <p>A new version of CreatorDock is ready.</p>
      <div>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            onDismiss()
          }}
        >
          Dismiss update
        </button>
        <button className="primary-action" type="button" onClick={onReload}>Reload now</button>
      </div>
    </section>
  )
}
