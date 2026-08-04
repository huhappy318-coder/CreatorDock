import { useState } from 'react'

export type UpdatePromptLanguage = 'zh-CN' | 'en'

const updateCopy: Record<UpdatePromptLanguage, { statusLabel: string; message: string; dismiss: string; reload: string }> = {
  'zh-CN': {
    statusLabel: 'CreatorDock 有可用更新',
    message: 'CreatorDock 已准备好新版本。',
    dismiss: '暂不更新',
    reload: '立即更新',
  },
  en: {
    statusLabel: 'CreatorDock update available',
    message: 'A new version of CreatorDock is ready.',
    dismiss: 'Dismiss update',
    reload: 'Reload now',
  },
}

export function UpdatePrompt({
  language = 'zh-CN',
  onDismiss,
  onReload,
}: {
  language?: UpdatePromptLanguage
  onDismiss: () => void
  onReload: () => void
}) {
  const [visible, setVisible] = useState(true)
  const copy = updateCopy[language]
  if (!visible) return null

  return (
    <section
      className="update-prompt"
      role="status"
      aria-label={copy.statusLabel}
    >
      <p>{copy.message}</p>
      <div>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            onDismiss()
          }}
        >
          {copy.dismiss}
        </button>
        <button className="primary-action" type="button" onClick={onReload}>{copy.reload}</button>
      </div>
    </section>
  )
}
