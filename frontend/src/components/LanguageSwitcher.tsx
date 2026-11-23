import { useTranslation } from 'react-i18next'

import { LANGUAGE_META, SUPPORTED_LANGUAGES } from '@/i18n/languages'
import { cx } from '@/lib/cx'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <>
      {/* Phones: one compact native select keeps the header within 360 px. */}
      <select
        aria-label={t('language.label')}
        value={i18n.resolvedLanguage}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
        className="min-h-10 rounded-full border border-border bg-background px-2 text-sm text-foreground sm:hidden"
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language} lang={language}>
            {LANGUAGE_META[language].shortLabel}
          </option>
        ))}
      </select>
      <div role="group" aria-label={t('language.label')} className="hidden items-center sm:flex">
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
              <span className={cx('pb-0.5', isActive && 'border-b border-accent')}>
                {shortLabel}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}
