import type { Language } from '@/i18n/languages'
import { apiFetch } from '@/services/api'
import type { Paginated } from '@/types/api'
import type {
  Category,
  DeliveryZone,
  Offer,
  OpeningHour,
  ProductDetail,
  ProductFilters,
  ProductSummary,
  Restaurant,
} from '@/types/catalog'

/**
 * Translated content depends on the request language, so every translated
 * query key includes it: switching language refetches in the new language.
 */
export const catalogKeys = {
  restaurant: (language: Language) => ['restaurant', language] as const,
  hours: ['restaurant', 'hours'] as const,
  categories: (language: Language) => ['categories', language] as const,
  products: (language: Language, filters: ProductFilters) =>
    ['products', language, filters] as const,
  product: (language: Language, slug: string) => ['product', language, slug] as const,
  zones: (language: Language) => ['delivery-zones', language] as const,
  offers: (language: Language) => ['offers', language] as const,
  offer: (language: Language, slug: string) => ['offer', language, slug] as const,
}

export function getRestaurant(signal?: AbortSignal) {
  return apiFetch<Restaurant>('/restaurant/', { signal })
}

export function getOpeningHours(signal?: AbortSignal) {
  return apiFetch<OpeningHour[]>('/restaurant/hours/', { signal })
}

export function getCategories(signal?: AbortSignal) {
  return apiFetch<Category[]>('/categories/', { signal })
}

export function getDeliveryZones(signal?: AbortSignal) {
  return apiFetch<DeliveryZone[]>('/delivery/zones/', { signal })
}

export function getProduct(slug: string, signal?: AbortSignal) {
  return apiFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}/`, { signal })
}

export function getOffers(signal?: AbortSignal) {
  return apiFetch<Offer[]>('/offers/', { signal })
}

export function getOffer(slug: string, signal?: AbortSignal) {
  return apiFetch<Offer>(`/offers/${encodeURIComponent(slug)}/`, { signal })
}

const PAGE_SIZE = 100
const MAX_PAGES = 20

/** The whole (filtered) menu: follows pagination so the menu can group by category. */
export async function getProducts(
  filters: ProductFilters = {},
  signal?: AbortSignal,
): Promise<ProductSummary[]> {
  const params = new URLSearchParams({ page_size: String(PAGE_SIZE) })
  if (filters.search) params.set('search', filters.search)
  if (filters.category) params.set('category', filters.category)
  if (filters.featured) params.set('featured', 'true')

  const products: ProductSummary[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    params.set('page', String(page))
    const data = await apiFetch<Paginated<ProductSummary>>(`/products/?${params}`, { signal })
    products.push(...data.results)
    if (!data.next) break
  }
  return products
}
