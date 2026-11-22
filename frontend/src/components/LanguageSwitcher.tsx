import { useTranslation } from 'react-i18next'

import { LANGUAGE_META, SUPPORTED_LANGUAGES } from '@/i18n/languages'
import { cx } from '@/lib/cx'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <div role="group" aria-label={t('language.label')} className="flex items-center">
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
            className={cx(
              'min-h-10 px-1.5 text-sm transition-colors sm:px-2.5',
              isActive ? 'text-accent' : 'text-muted hover:text-foreground',
            )}
          >
            <span className={cx('pb-0.5', isActive && 'border-b border-accent')}>{shortLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
