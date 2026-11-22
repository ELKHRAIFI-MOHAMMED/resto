/**
 * UI internationalization. Static UI strings live in `src/locales/<lang>/`;
 * dynamic catalog content (products, categories) is translated in the database
 * and served by the API in the requested language.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import ar from '@/locales/ar/common.json'
import en from '@/locales/en/common.json'
import fr from '@/locales/fr/common.json'

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getDirection,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
} from './languages'

export const resources = {
  fr: { common: fr },
  ar: { common: ar },
  en: { common: en },
} as const

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    // Storage can be unavailable (privacy mode); fall back silently.
    return DEFAULT_LANGUAGE
  }
}

/** Keeps <html lang/dir> in sync so the whole layout mirrors for Arabic. */
function applyDocumentLanguage(language: string) {
  if (!isSupportedLanguage(language)) return
  document.documentElement.lang = language
  document.documentElement.dir = getDirection(language)
}

i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language)
  if (!isSupportedLanguage(language)) return
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Non-critical: the choice simply won't persist.
  }
})

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: 'common',
  ns: ['common'],
  initAsync: false,
  interpolation: { escapeValue: false }, // React already escapes output
})

applyDocumentLanguage(i18n.language)

export default i18n
