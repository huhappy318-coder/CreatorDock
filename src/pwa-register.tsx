import { useRegisterSW } from 'virtual:pwa-register/react'
import { UpdatePrompt } from './pwa-update'

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <UpdatePrompt
      onDismiss={() => setNeedRefresh(false)}
      onReload={() => {
        void updateServiceWorker(true)
      }}
    />
  )
}
