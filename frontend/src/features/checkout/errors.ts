/**
 * Turns API errors into translated, actionable messages. The backend sends
 * stable error codes; the wording lives in the frontend dictionaries.
 */
import type { TFunction } from 'i18next'

import type { Language } from '@/i18n/languages'
import { formatMoney, parseMoney } from '@/lib/money'
import { ApiError } from '@/services/api'
import type { ItemIssue } from '@/types/orders'

import type { CheckoutErrorKey, CheckoutErrors, CheckoutField } from './validation'

export interface DescribedOrderError {
  message: string
  fieldErrors: CheckoutErrors
  itemIssues: ItemIssue[]
}

/** Backend field name → form field and the client-side message to show. */
const SERVER_FIELDS: Record<string, [CheckoutField, CheckoutErrorKey]> = {
  customer_name: ['customerName', 'nameTooShort'],
  customer_phone: ['customerPhone', 'phoneInvalid'],
  order_type: ['orderType', 'orderTypeRequired'],
  delivery_zone: ['deliveryZone', 'zoneRequired'],
  delivery_address: ['deliveryAddress', 'addressRequired'],
  city: ['city', 'cityRequired'],
  customer_notes: ['notes', 'notesTooLong'],
}

export function itemIssuesOf(error: unknown): ItemIssue[] {
  if (!(error instanceof ApiError) || error.code !== 'invalid_items') return []
  const items = error.details?.items
  return Array.isArray(items) ? (items as ItemIssue[]) : []
}

export function describeOrderError(
  error: unknown,
  t: TFunction,
  language: Language,
): DescribedOrderError {
  const result: DescribedOrderError = { message: '', fieldErrors: {}, itemIssues: [] }

  if (!(error instanceof ApiError)) {
    result.message = t('checkout.errors.generic')
    return result
  }

  switch (error.code) {
    case 'network_error':
      result.message = t('common.networkError')
      break
    case 'throttled': {
      const seconds = Number(error.details?.retry_after_seconds ?? 60)
      result.message = t('checkout.errors.throttled', { seconds })
      break
    }
    case 'ordering_closed':
      result.message = t('checkout.errors.orderingClosed')
      break
    case 'whatsapp_not_configured':
      result.message = t('checkout.errors.notConfigured')
      break
    case 'order_type_unavailable':
      result.message = t('checkout.errors.orderTypeUnavailable')
      result.fieldErrors.orderType = 'orderTypeRequired'
      break
    case 'delivery_zone_required':
      result.message = t('checkout.errors.zoneRequired')
      result.fieldErrors.deliveryZone = 'zoneRequired'
      break
    case 'delivery_zone_invalid':
      result.message = t('checkout.errors.zoneInvalid')
      result.fieldErrors.deliveryZone = 'zoneInvalid'
      break
    case 'minimum_order_not_met': {
      const minimum = String(error.details?.minimum_order_amount ?? '0')
      result.message = t('checkout.errors.minimumNotMet', {
        amount: formatMoney(parseMoney(minimum), language),
      })
      break
    }
    case 'invalid_items':
      result.message = t('checkout.errors.invalidItems')
      result.itemIssues = itemIssuesOf(error)
      break
    case 'empty_order':
      result.message = t('cart.empty')
      break
    case 'too_many_items':
      result.message = t('checkout.errors.tooManyItems')
      break
    case 'validation_error':
      result.message = t('checkout.errors.checkFields')
      for (const field of Object.keys(error.details ?? {})) {
        const mapped = SERVER_FIELDS[field]
        if (mapped) result.fieldErrors[mapped[0]] = mapped[1]
      }
      break
    default:
      result.message = t('checkout.errors.generic')
  }
  return result
}
