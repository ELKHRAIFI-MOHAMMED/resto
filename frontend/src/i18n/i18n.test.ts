import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { getDirection, isSupportedLanguage, LANGUAGE_STORAGE_KEY } from '@/i18n/languages'

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flatKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatKeys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

/** Keys without plural suffixes: Arabic has six plural forms, French two. */
function baseKeys(language: string) {
  const keys = flatKeys(i18n.getResourceBundle(language, 'common') as object)
  return [...new Set(keys.map((key) => key.replace(PLURAL_SUFFIX, '')))].sort()
}

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
    expect(i18n.t('nav.menu')).toBe('قائمة الطعام')
  })

  it('returns to left-to-right for English', async () => {
    await i18n.changeLanguage('ar')
    await i18n.changeLanguage('en')

    expect(document.documentElement.dir).toBe('ltr')
    expect(i18n.t('nav.menu')).toBe('Menu')
  })

  it('persists the selected language', async () => {
    await i18n.changeLanguage('en')

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })

  it('uses the Arabic plural forms', async () => {
    await i18n.changeLanguage('ar')

    expect(i18n.t('home.dishCount', { count: 1 })).toBe('طبق واحد')
    expect(i18n.t('home.dishCount', { count: 2 })).toBe('طبقان')
    expect(i18n.t('home.dishCount', { count: 3 })).toBe('3 أطباق')
    expect(i18n.t('home.dishCount', { count: 11 })).toBe('11 طبقًا')
  })

  it('exposes language helpers', () => {
    expect(isSupportedLanguage('ar')).toBe(true)
    expect(isSupportedLanguage('de')).toBe(false)
    expect(getDirection('ar')).toBe('rtl')
    expect(getDirection('fr')).toBe('ltr')
  })

  it('has the same translation keys in every language', () => {
    const reference = baseKeys('fr')
    expect(baseKeys('ar')).toEqual(reference)
    expect(baseKeys('en')).toEqual(reference)
  })
})
