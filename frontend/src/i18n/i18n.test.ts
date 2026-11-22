import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { getDirection, isSupportedLanguage, LANGUAGE_STORAGE_KEY } from '@/i18n/languages'

describe('i18n', () => {
  it('defaults to French in left-to-right mode', () => {
    expect(i18n.language).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('switches the whole document to right-to-left for Arabic', async () => {
    await i18n.changeLanguage('ar')

    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(i18n.t('nav.home')).toBe('الرئيسية')
  })

  it('returns to left-to-right for English', async () => {
    await i18n.changeLanguage('ar')
    await i18n.changeLanguage('en')

    expect(document.documentElement.dir).toBe('ltr')
    expect(i18n.t('nav.home')).toBe('Home')
  })

  it('persists the selected language', async () => {
    await i18n.changeLanguage('en')

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })

  it('exposes language helpers', () => {
    expect(isSupportedLanguage('ar')).toBe(true)
    expect(isSupportedLanguage('de')).toBe(false)
    expect(getDirection('ar')).toBe('rtl')
    expect(getDirection('fr')).toBe('ltr')
  })

  it('has the same translation keys in every language', () => {
    const keys = (obj: object, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
          ? keys(value as object, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      )
    const reference = keys(i18n.getResourceBundle('fr', 'common') as object).sort()

    for (const language of ['ar', 'en']) {
      expect(keys(i18n.getResourceBundle(language, 'common') as object).sort()).toEqual(reference)
    }
  })
})
