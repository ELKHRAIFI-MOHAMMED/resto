/**
 * WhatsApp click-to-chat hand-off.
 *
 * The message itself is written by the backend (in the customer's language,
 * with the authoritative totals). Here we only build the link:
 * https://wa.me/<international number, digits only>?text=<URL-encoded message>
 */

const WHATSAPP_NUMBER = /^[1-9]\d{7,14}$/

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!WHATSAPP_NUMBER.test(digits)) {
    throw new Error('The WhatsApp number must be an international number (digits only).')
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/** Phones and tablets hand wa.me links to the installed app in the same tab. */
export function prefersSameTabHandoff(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}
