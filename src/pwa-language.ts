import { useEffect, useState } from 'react'
import type { UpdatePromptLanguage } from './pwa-update'

function languageFromDocument(): UpdatePromptLanguage {
  if (typeof document === 'undefined') return 'zh-CN'
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'zh-CN'
}

export function useUpdatePromptLanguage(language?: UpdatePromptLanguage): UpdatePromptLanguage {
  const [documentLanguage, setDocumentLanguage] = useState(languageFromDocument)

  useEffect(() => {
    if (language || typeof MutationObserver === 'undefined') return

    const updateLanguage = () => setDocumentLanguage(languageFromDocument())
    const observer = new MutationObserver(updateLanguage)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

    return () => observer.disconnect()
  }, [language])

  return language ?? documentLanguage
}
