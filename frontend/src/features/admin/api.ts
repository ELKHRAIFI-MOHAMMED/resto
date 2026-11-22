/**
 * Back-office API (/api/admin/*, /api/auth/*). Session cookie + CSRF header
 * are handled by apiFetch. Images are uploaded with a separate multipart
 * PATCH so that every other save stays plain JSON.
 */
import { apiFetch } from '@/services/api'
import type { Paginated } from '@/types/api'

// --- Types ------------------------------------------------------------------------

export interface StaffUser {
  id: number
  email: string
  first_name: string
  last_name: string
  role: 'owner' | 'manager'
  is_owner: boolean
}

export type OrderStatus =
  'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
]

export interface AdminOrderSummary {
  id: number
  reference: string
  status: OrderStatus
  order_type: 'delivery' | 'pickup'
  customer_name: string
  customer_phone: string
  city: string
  delivery_zone_name: string
  item_count: number
  total: string
  currency: string
  created_at: string
  confirmed_at: string | null
}

export interface AdminOrderDetail extends Omit<AdminOrderSummary, 'item_count'> {
  allowed_statuses: Exclude<OrderStatus, 'pending'>[]
  delivery_address: string
  delivery_zone: number | null
  customer_notes: string
  language: string
  items: {
    id: number
    product: number | null
    product_name: string
    product_price: string
    variant_name: string
    variant_price: string
    addons: { id: number; addon: number | null; addon_name: string; addon_price: string }[]
    quantity: number
    unit_price: string
    line_total: string
    special_instructions: string
  }[]
  subtotal: string
  delivery_fee: string
  whatsapp_number: string
  whatsapp_message: string
  updated_at: string
}

export interface Dashboard {
  orders: {
    initiated: number
    confirmed: number
    revenue: string
    by_status: Record<OrderStatus, number>
  }
  products: { total: number; active: number; available: number }
  popular_products: {
    product_id: number
    name: string
    quantity: number
    revenue: string
    orders: number
  }[]
  orders_by_date: { date: string; orders: number; confirmed: number; revenue: string }[]
  period_days: number
}

export interface Translated {
  name_fr: string
  name_ar: string
  name_en: string
}

export interface AdminCategory extends Translated {
  id: number
  slug: string
  description_fr: string
  description_ar: string
  description_en: string
  image: string | null
  display_order: number
  is_active: boolean
  product_count: number
}

export interface AdminAddon extends Translated {
  id: number
  price: string
  display_order: number
  is_active: boolean
}

export interface AdminVariant extends Translated {
  id: number
  product: number
  price_delta: string
  display_order: number
  is_active: boolean
}

export interface AdminProduct extends Translated {
  id: number
  category: number
  slug: string
  description_fr: string
  description_ar: string
  description_en: string
  price: string
  sale_price: string | null
  effective_price: string
  image: string | null
  is_active: boolean
  is_available: boolean
  is_featured: boolean
  display_order: number
  addons: number[]
  variants: AdminVariant[]
  images: { id: number; product: number; image: string; display_order: number }[]
  created_at: string
  updated_at: string
}

export interface AdminZone extends Translated {
  id: number
  delivery_fee: string
  minimum_order_amount: string
  display_order: number
  is_active: boolean
}

export interface AdminSettings {
  name: string
  logo: string | null
  description_fr: string
  description_ar: string
  description_en: string
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
}

export interface AdminOpeningHour {
  id?: number
  weekday: number
  opens_at: string | null
  closes_at: string | null
  is_closed: boolean
}

// --- Helpers ---------------------------------------------------------------------

type Params = Record<string, string | number | boolean | string[] | null | undefined>

function query(params: Params = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item))
    else search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

function uploadImage(path: string, file: File, field = 'image') {
  const form = new FormData()
  form.append(field, file)
  return apiFetch<unknown>(path, { method: 'PATCH', body: form })
}

/** Generic CRUD for a collection under /admin/. */
function resource<T, Input = Partial<T>>(base: string) {
  return {
    list: (params?: Params) => apiFetch<Paginated<T>>(`${base}${query(params)}`),
    get: (id: number) => apiFetch<T>(`${base}${id}/`),
    create: (data: Input) => apiFetch<T>(base, { method: 'POST', body: data }),
    update: (id: number, data: Input) =>
      apiFetch<T>(`${base}${id}/`, { method: 'PATCH', body: data }),
    remove: (id: number) => apiFetch<unknown>(`${base}${id}/`, { method: 'DELETE' }),
  }
}

// --- Endpoints -------------------------------------------------------------------

export const authApi = {
  csrf: () => apiFetch<unknown>('/auth/csrf/'),
  me: () => apiFetch<StaffUser>('/auth/me/'),
  login: (email: string, password: string) =>
    apiFetch<StaffUser>('/auth/login/', { method: 'POST', body: { email, password } }),
  logout: () => apiFetch<unknown>('/auth/logout/', { method: 'POST' }),
}

export const dashboardApi = {
  get: (days: number) => apiFetch<Dashboard>(`/admin/dashboard/${query({ days })}`),
}

export const ordersApi = {
  list: (params: Params) =>
    apiFetch<Paginated<AdminOrderSummary>>(`/admin/orders/${query(params)}`),
  get: (id: number) => apiFetch<AdminOrderDetail>(`/admin/orders/${id}/`),
  setStatus: (id: number, status: OrderStatus) =>
    apiFetch<AdminOrderDetail>(`/admin/orders/${id}/status/`, {
      method: 'PATCH',
      body: { status },
    }),
}

export const productsApi = {
  ...resource<AdminProduct>('/admin/products/'),
  uploadImage: (id: number, file: File) => uploadImage(`/admin/products/${id}/`, file),
  clearImage: (id: number) =>
    apiFetch<AdminProduct>(`/admin/products/${id}/`, { method: 'PATCH', body: { image: null } }),
  variants: (productId: number) => ({
    create: (data: Partial<AdminVariant>) =>
      apiFetch<AdminVariant>(`/admin/products/${productId}/variants/`, {
        method: 'POST',
        body: data,
      }),
    update: (id: number, data: Partial<AdminVariant>) =>
      apiFetch<AdminVariant>(`/admin/products/${productId}/variants/${id}/`, {
        method: 'PATCH',
        body: data,
      }),
    remove: (id: number) =>
      apiFetch<unknown>(`/admin/products/${productId}/variants/${id}/`, { method: 'DELETE' }),
  }),
  addPhoto: (productId: number, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return apiFetch<unknown>(`/admin/products/${productId}/images/`, { method: 'POST', body: form })
  },
  removePhoto: (productId: number, id: number) =>
    apiFetch<unknown>(`/admin/products/${productId}/images/${id}/`, { method: 'DELETE' }),
}

export const addonsApi = resource<AdminAddon>('/admin/addons/')

export const categoriesApi = {
  ...resource<AdminCategory>('/admin/categories/'),
  uploadImage: (id: number, file: File) => uploadImage(`/admin/categories/${id}/`, file),
  clearImage: (id: number) =>
    apiFetch<AdminCategory>(`/admin/categories/${id}/`, { method: 'PATCH', body: { image: null } }),
  reorder: (ids: number[]) =>
    apiFetch<AdminCategory[]>('/admin/categories/reorder/', { method: 'POST', body: { ids } }),
}

export const zonesApi = resource<AdminZone>('/admin/delivery/zones/')

export const settingsApi = {
  get: () => apiFetch<AdminSettings>('/admin/settings/'),
  update: (data: Partial<AdminSettings>) =>
    apiFetch<AdminSettings>('/admin/settings/', { method: 'PATCH', body: data }),
  uploadLogo: (file: File) => uploadImage('/admin/settings/', file, 'logo'),
  clearLogo: () =>
    apiFetch<AdminSettings>('/admin/settings/', { method: 'PATCH', body: { logo: null } }),
  hours: () => apiFetch<AdminOpeningHour[]>('/admin/settings/hours/'),
  saveHours: (hours: AdminOpeningHour[]) =>
    apiFetch<AdminOpeningHour[]>('/admin/settings/hours/', { method: 'PUT', body: { hours } }),
}
