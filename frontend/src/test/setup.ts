import '@testing-library/jest-dom/vitest'
import '@/i18n'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

import i18n from '@/i18n'
import { DEFAULT_LANGUAGE } from '@/i18n/languages'
import { useCartStore } from '@/store/cart'
import { useToastStore } from '@/store/toast'

// Tests run in parallel; under load, debounced quotes and lazy routes can
// take longer than the 1 s default to appear.
configure({ asyncUtilTimeout: 5000 })

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage(DEFAULT_LANGUAGE)
  useCartStore.setState({ lines: [] })
  useToastStore.setState({ toasts: [] })
  window.localStorage.clear()
})
