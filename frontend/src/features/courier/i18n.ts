/** Courier app strings, registered when the courier chunk loads. */
import i18n from '@/i18n'
import ar from '@/locales/ar/courier.json'
import en from '@/locales/en/courier.json'
import fr from '@/locales/fr/courier.json'

for (const [language, strings] of Object.entries({ fr, ar, en })) {
  i18n.addResourceBundle(language, 'common', strings, true, true)
}
