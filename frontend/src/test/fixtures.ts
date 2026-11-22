/** API-shaped test data (mirrors the Django serializers). */
import type {
  Category,
  DeliveryZone,
  OpeningHour,
  ProductDetail,
  ProductSummary,
  Restaurant,
} from '@/types/catalog'

export const restaurant: Restaurant = {
  name: 'Test Resto',
  logo: null,
  description: 'Une cuisine de test.',
  address: '1 rue Test',
  city: 'Casablanca',
  phone: '0522000000',
  whatsapp_number: '212600000000',
  email: 'contact@example.com',
  currency: 'MAD',
  facebook_url: '',
  instagram_url: 'https://instagram.com/test',
  tiktok_url: '',
  google_maps_url: '',
  is_accepting_orders: true,
  delivery_enabled: true,
  pickup_enabled: true,
  minimum_order_amount: '60.00',
  free_delivery_threshold: '300.00',
  is_open_now: true,
}

export const hours: OpeningHour[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  id: weekday + 1,
  weekday,
  opens_at: '12:00:00',
  closes_at: '15:00:00',
  is_closed: false,
}))

export const categories: Category[] = [
  {
    id: 1,
    slug: 'burgers',
    name: 'Burgers',
    description: 'Pains briochés.',
    image: null,
    display_order: 1,
    product_count: 2,
  },
  {
    id: 2,
    slug: 'boissons',
    name: 'Boissons',
    description: '',
    image: null,
    display_order: 2,
    product_count: 1,
  },
]

const base = {
  description: '',
  sale_price: null,
  is_on_sale: false,
  image: null,
  is_available: true,
  is_featured: false,
  has_options: false,
}

export const burger: ProductSummary = {
  ...base,
  id: 10,
  slug: 'double-cheese',
  name: 'Double Cheese',
  description: 'Deux steaks, cheddar.',
  category: { id: 1, slug: 'burgers', name: 'Burgers' },
  price: '75.00',
  sale_price: '65.00',
  effective_price: '65.00',
  is_on_sale: true,
  is_featured: true,
  has_options: true,
}

export const chicken: ProductSummary = {
  ...base,
  id: 11,
  slug: 'chicken',
  name: 'Chicken Crispy',
  category: { id: 1, slug: 'burgers', name: 'Burgers' },
  price: '58.00',
  effective_price: '58.00',
  is_available: false,
}

export const tea: ProductSummary = {
  ...base,
  id: 20,
  slug: 'the-menthe',
  name: 'Thé à la menthe',
  category: { id: 2, slug: 'boissons', name: 'Boissons' },
  price: '15.00',
  effective_price: '15.00',
}

export const products = [burger, chicken, tea]

export const burgerDetail: ProductDetail = {
  ...burger,
  variants: [
    { id: 100, name: 'Simple', price_delta: '0.00' },
    { id: 101, name: 'XL', price_delta: '20.00' },
  ],
  addons: [
    { id: 200, name: 'Fromage', price: '8.00' },
    { id: 201, name: 'Bacon', price: '12.50' },
  ],
  images: [],
}

export const zones: DeliveryZone[] = [
  { id: 1, name: 'Maârif', delivery_fee: '15.00', minimum_order_amount: '60.00' },
]

export function page<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results }
}
