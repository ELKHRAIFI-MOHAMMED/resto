/** Shapes returned by the public catalog API (translated server-side). */

export interface Restaurant {
  name: string
  logo: string | null
  description: string
  address: string
  city: string
  phone: string
  whatsapp_number: string
  email: string
  currency: string
  facebook_url: string
  instagram_url: string
  tiktok_url: string
  google_maps_url: string
  is_accepting_orders: boolean
  delivery_enabled: boolean
  pickup_enabled: boolean
  minimum_order_amount: string
  free_delivery_threshold: string | null
  is_open_now: boolean
}

export interface OpeningHour {
  id: number
  /** 0 = Monday … 6 = Sunday */
  weekday: number
  opens_at: string | null
  closes_at: string | null
  is_closed: boolean
}

export interface Category {
  id: number
  slug: string
  name: string
  description: string
  image: string | null
  display_order: number
  product_count: number
}

export interface CategoryRef {
  id: number
  slug: string
  name: string
}

export interface ProductSummary {
  id: number
  slug: string
  name: string
  description: string
  category: CategoryRef
  price: string
  sale_price: string | null
  effective_price: string
  is_on_sale: boolean
  image: string | null
  is_available: boolean
  is_featured: boolean
  has_options: boolean
}

export interface ProductVariant {
  id: number
  name: string
  price_delta: string
}

export interface ProductAddon {
  id: number
  name: string
  price: string
}

export interface ProductGalleryImage {
  id: number
  image: string
}

export interface ProductDetail extends ProductSummary {
  variants: ProductVariant[]
  addons: ProductAddon[]
  images: ProductGalleryImage[]
}

export interface DeliveryZone {
  id: number
  name: string
  delivery_fee: string
  minimum_order_amount: string
}

export interface ProductFilters {
  search?: string
  category?: string
  featured?: boolean
}
