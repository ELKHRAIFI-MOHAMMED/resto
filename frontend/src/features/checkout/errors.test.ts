import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { ApiError } from '@/services/api'

import { describeOrderError } from './errors'

const describe_ = (error: unknown, language: 'fr' | 'ar' | 'en' = 'fr') =>
  describeOrderError(error, i18n.getFixedT(language), language)

describe('describeOrderError', () => {
  it('translates business errors by code', () => {
    expect(describe_(new ApiError(409, 'ordering_closed', 'x')).message).toBe(
      'Le restaurant ne prend pas de commandes en ligne pour le moment.',
    )
    expect(describe_(new ApiError(409, 'ordering_closed', 'x'), 'ar').message).toBe(
      'المطعم لا يستقبل الطلبات عبر الإنترنت حاليًا.',
    )
  })

  it('formats the minimum order amount', () => {
    const error = new ApiError(400, 'minimum_order_not_met', 'x', {
      minimum_order_amount: '80.00',
      subtotal: '50.00',
    })

    expect(describe_(error, 'en').message).toBe(
      'The minimum delivery order for this neighbourhood is 80 MAD.',
    )
  })

  it('maps zone errors to the zone field', () => {
    expect(describe_(new ApiError(400, 'delivery_zone_invalid', 'x')).fieldErrors).toEqual({
      deliveryZone: 'zoneInvalid',
    })
  })

  it('maps backend field errors to translated client messages', () => {
    const error = new ApiError(400, 'validation_error', 'x', {
      customer_phone: ['Enter a valid phone number.'],
      delivery_address: ['The delivery address is required.'],
    })

    expect(describe_(error).fieldErrors).toEqual({
      customerPhone: 'phoneInvalid',
      deliveryAddress: 'addressRequired',
    })
  })

  it('exposes per-item issues', () => {
    const items = [{ index: 1, code: 'product_unavailable', message: 'x' }]
    const described = describe_(new ApiError(400, 'invalid_items', 'x', { items }))

    expect(described.itemIssues).toEqual(items)
  })

  it('handles throttling, network failures and unknown errors', () => {
    expect(
      describe_(new ApiError(429, 'throttled', 'x', { retry_after_seconds: 42 })).message,
    ).toBe('Trop de tentatives. Réessayez dans 42 secondes.')
    expect(describe_(new ApiError(0, 'network_error', 'x')).message).toBe(
      'Connexion impossible. Vérifiez votre réseau puis réessayez.',
    )
    expect(describe_(new Error('boom')).message).toBe(
      'La commande n’a pas pu être enregistrée. Réessayez.',
    )
  })
})
