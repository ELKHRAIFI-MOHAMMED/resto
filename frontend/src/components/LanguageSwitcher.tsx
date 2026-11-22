import { useTranslation } from 'react-i18next'

import { LANGUAGE_META, SUPPORTED_LANGUAGES } from '@/i18n/languages'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <div role="group" aria-label={t('language.label')} className="flex items-center gap-1">
      {SUPPORTED_LANGUAGES.map((language) => {
        const { nativeName, shortLabel } = LANGUAGE_META[language]
        const isActive = i18n.resolvedLanguage === language
        return (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={isActive}
            aria-label={t('language.switchTo', { language: nativeName })}
            title={nativeName}
            onClick={() => void i18n.changeLanguage(language)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? 'bg-accent font-semibold text-background'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {shortLabel}
          </button>
        )
      })}
    </div>
  )
}
