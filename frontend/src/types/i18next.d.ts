import 'i18next'

import type fr from '@/locales/fr/common.json'

// French is the reference dictionary: translation keys are type-checked.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: { common: typeof fr }
  }
}
