/**
 * Test stand-in for POST /api/orders/quote/ and /api/orders/: prices
 * fixture products the way the backend does, so UI tests exercise real flows.
 */
import { formatMoney } from '@/lib/money'
import { burgerDetail, products, restaurant, tea, zones } from '@/test/fixtures'
import type { CreatedOrder, OrderItemInput, Quote, QuoteRequest } from '@/types/orders'

const toDecimal = (cents: number) => (cents / 100).toFixed(2)
const cents = (value: string) => Math.round(Number(value) * 100)

const details: Record<
  number,
  { variants: typeof burgerDetail.variants; addons: typeof burgerDetail.addons }
> = {
  [burgerDetail.id]: { variants: burgerDetail.variants, addons: burgerDetail.addons },
  [tea.id]: { variants: [], addons: [] },
}

export function fakeQuote(request: unknown): Quote {
  const { items, order_type = null, delivery_zone = null } = request as QuoteRequest
  const priced = items.map((item: OrderItemInput) => {
    const product = products.find((candidate) => candidate.id === item.product)
    if (!product) throw new Error(`Unknown product ${item.product}`)
    const options = details[product.id] ?? { variants: [], addons: [] }
    const variant = options.variants.find((candidate) => candidate.id === item.variant) ?? null
    const addons = options.addons.filter((addon) => item.addons.includes(addon.id))
    const unit =
      cents(product.effective_price) +
      (variant ? cents(variant.price_delta) : 0) +
      addons.reduce((sum, addon) => sum + cents(addon.price), 0)
    return {
      product: product.id,
      product_name: product.name,
      product_price: product.effective_price,
      variant: variant?.id ?? null,
      variant_name: variant?.name ?? '',
      variant_price: variant?.price_delta ?? '0.00',
      addons: addons.map((addon) => ({ id: addon.id, name: addon.name, price: addon.price })),
      quantity: item.quantity,
      unit_price: toDecimal(unit),
      line_total: toDecimal(unit * item.quantity),
    }
  })
  const subtotal = priced.reduce((sum, item) => sum + cents(item.line_total), 0)
  const zone =
    order_type === 'delivery'
      ? zones.find((candidate) => candidate.id === delivery_zone)
      : undefined
  const fee = zone ? cents(zone.delivery_fee) : 0
  return {
    order_type,
    items: priced,
    subtotal: toDecimal(subtotal),
    delivery_fee: toDecimal(fee),
    total: toDecimal(subtotal + fee),
    currency: 'MAD',
    delivery_zone: zone?.id ?? null,
    delivery_zone_name: zone?.name ?? '',
    minimum_order_amount: zone ? zone.minimum_order_amount : '0.00',
    free_delivery_applied: false,
  }
}

export function fakeCreatedOrder(request: unknown, reference = 'RF-2026-0042'): CreatedOrder {
  const body = request as QuoteRequest & Record<string, string>
  const quote = fakeQuote(body)
  const lines = quote.items.map(
    (item) =>
      `${item.quantity}x ${item.product_name} - ${formatMoney(cents(item.line_total), 'fr')}`,
  )
  return {
    reference,
    status: 'pending',
    order_type: body.order_type as CreatedOrder['order_type'],
    customer_name: body.customer_name ?? '',
    customer_phone: '+212612345678',
    delivery_address: body.delivery_address ?? '',
    city: body.city ?? '',
    delivery_zone_name: quote.delivery_zone_name,
    customer_notes: body.customer_notes ?? '',
    items: quote.items.map((item, index) => ({
      id: index + 1,
      product: item.product,
      product_name: item.product_name,
      variant_name: item.variant_name,
      addons: item.addons.map((addon) => ({
        id: addon.id,
        addon: addon.id,
        addon_name: addon.name,
        addon_price: addon.price,
      })),
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      special_instructions: '',
    })),
    subtotal: quote.subtotal,
    delivery_fee: quote.delivery_fee,
    total: quote.total,
    currency: 'MAD',
    language: 'fr',
    created_at: '2026-11-22T18:00:00Z',
    whatsapp: {
      phone: restaurant.whatsapp_number,
      message: `Bonjour ! Je souhaite passer une commande.\n\nRéférence de commande: ${reference}\n\n${lines.join('\n')}\n\nTOTAL: ${formatMoney(cents(quote.total), 'fr')}`,
    },
  }
}
