import { formatTime } from '@/lib/hours'
import type { OpeningHour, Restaurant } from '@/types/catalog'

const SCHEMA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** schema.org Restaurant description for search engines. */
export function restaurantStructuredData(
  restaurant: Restaurant,
  hours: OpeningHour[],
  origin: string,
) {
  const sameAs = [restaurant.instagram_url, restaurant.facebook_url, restaurant.tiktok_url].filter(
    Boolean,
  )
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    description: restaurant.description || undefined,
    url: origin,
    menu: `${origin}/menu`,
    image: restaurant.logo ?? undefined,
    telephone: restaurant.phone || undefined,
    email: restaurant.email || undefined,
    priceRange: restaurant.currency,
    currenciesAccepted: restaurant.currency,
    acceptsReservations: false,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address || undefined,
      addressLocality: restaurant.city || undefined,
      addressCountry: 'MA',
    },
    hasMap: restaurant.google_maps_url || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    openingHoursSpecification: hours
      .filter((slot) => !slot.is_closed)
      .map((slot) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: SCHEMA_DAYS[slot.weekday],
        opens: formatTime(slot.opens_at),
        closes: formatTime(slot.closes_at),
      })),
  }
}
