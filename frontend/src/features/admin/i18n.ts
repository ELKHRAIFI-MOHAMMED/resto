/**
 * Administration strings live in their own files and are registered only when
 * the admin chunk loads, so public visitors never download them.
 */
import i18n from '@/i18n'
import ar from '@/locales/ar/admin.json'
import en from '@/locales/en/admin.json'
import fr from '@/locales/fr/admin.json'

for (const [language, strings] of Object.entries({ fr, ar, en })) {
  i18n.addResourceBundle(language, 'common', strings, true, true)
}
