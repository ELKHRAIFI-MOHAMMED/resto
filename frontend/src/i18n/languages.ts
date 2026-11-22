export const SUPPORTED_LANGUAGES = ['fr', 'ar', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'fr'
export const LANGUAGE_STORAGE_KEY = 'restoflow.language'

/** Each language is always shown in its own script, whatever the UI language. */
export const LANGUAGE_META: Record<Language, { nativeName: string; shortLabel: string }> = {
  fr: { nativeName: 'Français', shortLabel: 'FR' },
  ar: { nativeName: 'العربية', shortLabel: 'عربي' },
  en: { nativeName: 'English', shortLabel: 'EN' },
}

const RTL_LANGUAGES: ReadonlySet<Language> = new Set(['ar'])

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export function getDirection(language: Language): 'rtl' | 'ltr' {
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr'
}
