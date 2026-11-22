/**
 * Client-side checkout validation, for instant, translated feedback. It
 * mirrors the backend rules; the backend still validates everything.
 */
import type { OrderType } from '@/types/orders'

export interface CheckoutValues {
  customerName: string
  customerPhone: string
  orderType: OrderType | null
  deliveryZone: number | null
  deliveryAddress: string
  city: string
  notes: string
}

export type CheckoutField = keyof CheckoutValues

export type CheckoutErrorKey =
  | 'nameRequired'
  | 'nameTooShort'
  | 'phoneRequired'
  | 'phoneInvalid'
  | 'orderTypeRequired'
  | 'zoneRequired'
  | 'zoneInvalid'
  | 'addressRequired'
  | 'cityRequired'
  | 'notesTooLong'

export type CheckoutErrors = Partial<Record<CheckoutField, CheckoutErrorKey>>

export const NOTES_MAX_LENGTH = 500

const SEPARATORS = /[\s\-.()/]/g
const PHONE_PATTERNS = [
  /^0[5-7]\d{8}$/, // Moroccan national: 06…, 07…, 05…
  /^(?:\+|00)212[5-7]\d{8}$/, // Moroccan international
  /^(?:\+|00)[1-9]\d{7,14}$/, // any other international number
]

export function isValidPhone(raw: string): boolean {
  const value = raw.replace(SEPARATORS, '')
  return PHONE_PATTERNS.some((pattern) => pattern.test(value))
}

export function validateCheckout(values: CheckoutValues): CheckoutErrors {
  const errors: CheckoutErrors = {}
  const name = values.customerName.trim()

  if (!name) errors.customerName = 'nameRequired'
  else if (name.length < 2) errors.customerName = 'nameTooShort'

  if (!values.customerPhone.trim()) errors.customerPhone = 'phoneRequired'
  else if (!isValidPhone(values.customerPhone)) errors.customerPhone = 'phoneInvalid'

  if (!values.orderType) errors.orderType = 'orderTypeRequired'

  if (values.orderType === 'delivery') {
    if (!values.deliveryZone) errors.deliveryZone = 'zoneRequired'
    if (!values.deliveryAddress.trim()) errors.deliveryAddress = 'addressRequired'
    if (!values.city.trim()) errors.city = 'cityRequired'
  }

  if (values.notes.length > NOTES_MAX_LENGTH) errors.notes = 'notesTooLong'

  return errors
}
