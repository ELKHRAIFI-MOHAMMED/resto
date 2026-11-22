import { describe, expect, it } from 'vitest'

import ar from '@/locales/ar/admin.json'
import en from '@/locales/en/admin.json'
import fr from '@/locales/fr/admin.json'

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function baseKeys(obj: object, prefix = ''): string[] {
  const keys = Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? baseKeys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
  return [...new Set(keys.map((key) => key.replace(PLURAL_SUFFIX, '')))].sort()
}

describe('admin translations', () => {
  it('have the same keys in every language', () => {
    expect(baseKeys(ar)).toEqual(baseKeys(fr))
    expect(baseKeys(en)).toEqual(baseKeys(fr))
  })
})
