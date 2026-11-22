import 'i18next'

import type frAdmin from '@/locales/fr/admin.json'
import type fr from '@/locales/fr/common.json'

// French is the reference dictionary: translation keys are type-checked.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    // Admin strings are merged into `common` when the admin chunk loads.
    resources: { common: typeof fr & typeof frAdmin }
  }
}
