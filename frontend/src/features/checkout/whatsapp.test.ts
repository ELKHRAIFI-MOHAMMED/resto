import { describe, expect, it, vi } from 'vitest'

import { buildWhatsAppUrl, prefersSameTabHandoff } from './whatsapp'

describe('buildWhatsAppUrl', () => {
  it('builds a wa.me link with the encoded message', () => {
    expect(buildWhatsAppUrl('212600000000', 'Bonjour')).toBe(
      'https://wa.me/212600000000?text=Bonjour',
    )
  })

  it('encodes every character that would break the URL', () => {
    const message = 'Commande RF-2026-0001\n2x Burger & frites - 130 MAD\n#1 +5% ?'

    const url = buildWhatsAppUrl('212600000000', message)

    expect(url).toBe(
      'https://wa.me/212600000000?text=Commande%20RF-2026-0001%0A2x%20Burger%20%26%20frites%20-%20130%20MAD%0A%231%20%2B5%25%20%3F',
    )
    expect(new URL(url).searchParams.get('text')).toBe(message)
  })

  it('round-trips Arabic text and accents', () => {
    const message = 'مرحباً! أود تقديم طلب.\nRéférence : RF-2026-0007 — 65 د.م.'

    const url = new URL(buildWhatsAppUrl('212600000000', message))

    expect(url.searchParams.get('text')).toBe(message)
  })

  it('accepts a formatted number but sends digits only', () => {
    expect(buildWhatsAppUrl('+212 6-00 00 00 00', 'x')).toBe('https://wa.me/212600000000?text=x')
  })

  it.each(['', '0600', 'abc', '0212600000000'])('rejects the invalid number %j', (phone) => {
    expect(() => buildWhatsAppUrl(phone, 'x')).toThrow()
  })
})

describe('prefersSameTabHandoff', () => {
  it('follows the pointer type', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }))
    expect(prefersSameTabHandoff()).toBe(true)

    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(prefersSameTabHandoff()).toBe(false)
  })
})
