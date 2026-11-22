import { useTranslation } from 'react-i18next'

import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from '@/i18n/languages'

export function useLanguage(): Language {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage
  return isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE
}
