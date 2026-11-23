/** Shapes of the order quote and creation endpoints. */

export type OrderType = 'delivery' | 'pickup'

export interface ProductItemInput {
  product: number
  variant: number | null
  addons: number[]
  quantity: number
  special_instructions: string
}

export interface OfferItemInput {
  offer: number
  /** Product ids picked in each group (repeated when picked several times). */
  choices: { group: number; products: number[] }[]
  quantity: number
  special_instructions: string
}

export type OrderItemInput = ProductItemInput | OfferItemInput

/** A dish picked in an offer, as priced or saved by the backend. */
export interface OfferChoice {
  group_name: string
  product: number | null
  product_name: string
  quantity: number
}

export interface QuoteRequest {
  order_type?: OrderType | null
  delivery_zone?: number | null
  items: OrderItemInput[]
}

export interface CreateOrderRequest extends QuoteRequest {
  order_type: OrderType
  client_token: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  city: string
  customer_notes: string
}

export interface PricedAddon {
  id: number
  name: string
  price: string
}

export interface PricedItem {
  product: number | null
  offer: number | null
  choices: (OfferChoice & { group: number })[]
  product_name: string
  product_price: string
  variant: number | null
  variant_name: string
  variant_price: string
  addons: PricedAddon[]
  quantity: number
  unit_price: string
  line_total: string
}

export interface Quote {
  order_type: OrderType | null
  items: PricedItem[]
  subtotal: string
  delivery_fee: string
  total: string
  currency: string
  delivery_zone: number | null
  delivery_zone_name: string
  minimum_order_amount: string
  free_delivery_applied: boolean
}

export interface OrderItemSnapshot {
  id: number
  product: number | null
  offer: number | null
  choices: (OfferChoice & { id: number })[]
  product_name: string
  variant_name: string
  addons: { id: number; addon: number | null; addon_name: string; addon_price: string }[]
  quantity: number
  unit_price: string
  line_total: string
  special_instructions: string
}

export interface CreatedOrder {
  reference: string
  status: string
  order_type: OrderType
  customer_name: string
  customer_phone: string
  delivery_address: string
  city: string
  delivery_zone_name: string
  customer_notes: string
  items: OrderItemSnapshot[]
  subtotal: string
  delivery_fee: string
  total: string
  currency: string
  language: string
  created_at: string
  whatsapp: { phone: string; message: string }
}

/** One problem with a cart line, as reported by the backend (`details.items[]`). */
export interface ItemIssue {
  index: number
  code:
    | 'product_not_found'
    | 'product_unavailable'
    | 'variant_required'
    | 'variant_invalid'
    | 'addon_invalid'
    | 'offer_not_found'
    | 'offer_choices_invalid'
    | 'offer_choice_unavailable'
  message: string
}
