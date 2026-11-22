import { describe, expect, it } from 'vitest'

import { isValidPhone, validateCheckout, type CheckoutValues } from './validation'

const valid: CheckoutValues = {
  customerName: 'Mohamed',
  customerPhone: '06 12 34 56 78',
  orderType: 'delivery',
  deliveryZone: 1,
  deliveryAddress: '5 rue Test',
  city: 'Casablanca',
  notes: '',
}

describe('isValidPhone', () => {
  it.each([
    '0612345678',
    '06 12 34 56 78',
    '07-12-34-56-78',
    '0522.00.00.00',
    '+212612345678',
    '00212 612 345 678',
    '+33 6 12 34 56 78',
  ])('accepts %s', (phone) => {
    expect(isValidPhone(phone)).toBe(true)
  })

  it.each(['', '12345', '0812345678', '06123', 'abc', '+0123456789'])('rejects %j', (phone) => {
    expect(isValidPhone(phone)).toBe(false)
  })
})

describe('validateCheckout', () => {
  it('accepts a complete delivery order', () => {
    expect(validateCheckout(valid)).toEqual({})
  })

  it('requires the delivery fields only for delivery', () => {
    const delivery = { ...valid, deliveryZone: null, deliveryAddress: ' ', city: '' }
    expect(validateCheckout(delivery)).toEqual({
      deliveryZone: 'zoneRequired',
      deliveryAddress: 'addressRequired',
      city: 'cityRequired',
    })

    expect(validateCheckout({ ...delivery, orderType: 'pickup' })).toEqual({})
  })

  it('reports name, phone, type and notes problems', () => {
    expect(
      validateCheckout({
        ...valid,
        customerName: 'A',
        customerPhone: '0812',
        orderType: null,
        notes: 'x'.repeat(501),
      }),
    ).toEqual({
      customerName: 'nameTooShort',
      customerPhone: 'phoneInvalid',
      orderType: 'orderTypeRequired',
      notes: 'notesTooLong',
    })
    expect(validateCheckout({ ...valid, customerName: '  ', customerPhone: '' })).toMatchObject({
      customerName: 'nameRequired',
      customerPhone: 'phoneRequired',
    })
  })
})
