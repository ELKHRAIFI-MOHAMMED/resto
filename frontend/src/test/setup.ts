import '@testing-library/jest-dom/vitest'
import '@/i18n'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import i18n from '@/i18n'
import { DEFAULT_LANGUAGE } from '@/i18n/languages'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage(DEFAULT_LANGUAGE)
  window.localStorage.clear()
})
