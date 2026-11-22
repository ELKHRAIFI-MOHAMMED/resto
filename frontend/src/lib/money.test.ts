import { describe, expect, it } from 'vitest'

import { formatMoney, parseMoney } from './money'

const NBSP = String.fromCharCode(160)

describe('parseMoney', () => {
  it.each([
    ['65.00', 6500],
    ['0.10', 10],
    ['12.5', 1250],
    ['7', 700],
    ['-3.20', -320],
  ])('parses %s into %i centimes', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it('treats null as zero and rejects garbage', () => {
    expect(parseMoney(null)).toBe(0)
    expect(() => parseMoney('12,50')).toThrow()
    expect(() => parseMoney('abc')).toThrow()
  })

  it('sums without floating-point drift', () => {
    const total = [parseMoney('0.10'), parseMoney('0.20')].reduce((a, b) => a + b, 0)
    expect(total).toBe(30) // 0.1 + 0.2 !== 0.3 with floats
  })
})

describe('formatMoney', () => {
  it('drops decimals on whole amounts and keeps them otherwise', () => {
    expect(formatMoney(13000, 'en')).toBe(`130${NBSP}MAD`)
    expect(formatMoney(1250, 'en')).toBe(`12.50${NBSP}MAD`)
    expect(formatMoney(1250, 'fr')).toBe(`12,50${NBSP}MAD`)
  })

  it('uses Latin digits and the local currency label in Arabic', () => {
    expect(formatMoney(6500, 'ar')).toBe(`65${NBSP}د.م.`)
  })
})
