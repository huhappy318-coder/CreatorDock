import { useRegisterSW } from 'virtual:pwa-register/react'
import { UpdatePrompt, type UpdatePromptLanguage } from './pwa-update'
import { useUpdatePromptLanguage } from './pwa-language'

export function PwaUpdatePrompt({ language }: { language?: UpdatePromptLanguage }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const promptLanguage = useUpdatePromptLanguage(language)

  if (!needRefresh) return null

  return (
    <UpdatePrompt
      language={promptLanguage}
      onDismiss={() => setNeedRefresh(false)}
      onReload={() => {
        void updateServiceWorker(true)
      }}
    />
  )
}
