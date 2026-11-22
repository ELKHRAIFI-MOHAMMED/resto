/**
 * Money helpers. The API sends decimal strings ("65.00"); the frontend works in
 * integer centimes so that sums never suffer floating-point errors. Totals
 * shown before checkout are estimates: the backend recomputes every amount.
 */
import type { Language } from '@/i18n/languages'

const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/

export function parseMoney(value: string | null | undefined): number {
  if (value == null) return 0
  const match = MONEY_PATTERN.exec(value.trim())
  if (!match) throw new Error(`Invalid money value: ${value}`)
  const [, sign, whole = '0', fraction = ''] = match
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return sign ? -cents : cents
}

const NBSP = String.fromCharCode(160)
const LOCALES: Record<Language, string> = { fr: 'fr-MA', ar: 'ar-MA', en: 'en-GB' }
const CURRENCY_LABELS: Record<Language, Record<string, string>> = {
  fr: { MAD: 'MAD' },
  ar: { MAD: 'د.م.' },
  en: { MAD: 'MAD' },
}

/** Formats centimes for display, e.g. 130 MAD or 12,50 MAD; whole amounts drop the decimals. */
export function formatMoney(cents: number, language: Language, currency = 'MAD'): string {
  const whole = cents % 100 === 0
  const amount = new Intl.NumberFormat(LOCALES[language], {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(cents / 100)
  const label = CURRENCY_LABELS[language][currency] ?? currency
  return `${amount}${NBSP}${label}` // the amount never wraps away from its currency
}
