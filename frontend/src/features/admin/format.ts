const LOCALES: Record<string, string> = { fr: 'fr-MA', ar: 'ar-MA', en: 'en-GB' }

/** Date and time in the restaurant's timezone, with Latin digits. */
export function formatDateTime(value: string, language: string) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? 'fr-MA', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Africa/Casablanca',
    numberingSystem: 'latn',
  }).format(new Date(value))
}
