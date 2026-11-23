import { useQuery } from '@tanstack/react-query'

import { useLanguage } from '@/hooks/useLanguage'
import {
  catalogKeys,
  getCategories,
  getDeliveryZones,
  getOffer,
  getOffers,
  getOpeningHours,
  getProduct,
  getProducts,
  getRestaurant,
} from '@/services/catalog'
import type { ProductFilters } from '@/types/catalog'

export function useRestaurant() {
  const language = useLanguage()
  return useQuery({
    queryKey: catalogKeys.restaurant(language),
    queryFn: ({ signal }) => getRestaurant(signal),
  })
}

export function useOpeningHours() {
  return useQuery({
    queryKey: catalogKeys.hours,
    queryFn: ({ signal }) => getOpeningHours(signal),
  })
}

export function useCategories() {
  const language = useLanguage()
  return useQuery({
    queryKey: catalogKeys.categories(language),
    queryFn: ({ signal }) => getCategories(signal),
  })
}

export function useProducts(filters: ProductFilters = {}) {
  const language = useLanguage()
  return useQuery({
    queryKey: catalogKeys.products(language, filters),
    queryFn: ({ signal }) => getProducts(filters, signal),
    placeholderData: (previous) => previous, // keep the list while a search refines it
  })
}

export function useProduct(slug: string) {
  const language = useLanguage()
  return useQuery({
    queryKey: catalogKeys.product(language, slug),
    queryFn: ({ signal }) => getProduct(slug, signal),
  })
}

export function useOffers() {
  const language = useLanguage()
  return useQuery({
    queryKey: catalogKeys.offers(language),
    queryFn: ({ signal }) => getOffers(signal),
  })
}

export function useOffer(slug: string) {
  const language = useLanguage()
  return useQuery({
    queryKey: catalogKeys.offer(language, slug),
    queryFn: ({ signal }) => getOffer(slug, signal),
  })
}

export function useDeliveryZones() {
  const language = useLanguage()
  return useQuery({
    queryKey: catalogKeys.zones(language),
    queryFn: ({ signal }) => getDeliveryZones(signal),
  })
}
