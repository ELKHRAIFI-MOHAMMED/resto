/** Courier app API (/api/courier/*): only the orders assigned to the logged-in courier. */
import { apiFetch } from '@/services/api'

export type CourierOrderStatus = 'confirmed' | 'preparing' | 'out_for_delivery' | 'completed'

export interface CourierProfile {
  id: number
  email: string
  name: string
  phone: string
  is_on_duty: boolean
  zones: string[]
}

export interface CourierOrder {
  id: number
  reference: string
  status: CourierOrderStatus
  customer_name: string
  customer_phone: string
  delivery_address: string
  city: string
  delivery_zone_name: string
  customer_notes: string
  items: {
    id: number
    product_name: string
    variant_name: string
    addons: { id: number; addon_name: string }[]
    choices: { id: number; group_name: string; product_name: string; quantity: number }[]
    quantity: number
    special_instructions: string
  }[]
  total: string
  currency: string
  created_at: string
  assigned_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
}

export const courierApi = {
  me: () => apiFetch<CourierProfile>('/courier/me/'),
  setOnDuty: (is_on_duty: boolean) =>
    apiFetch<CourierProfile>('/courier/me/', { method: 'PATCH', body: { is_on_duty } }),
  orders: (scope: 'active' | 'done') => apiFetch<CourierOrder[]>(`/courier/orders/?scope=${scope}`),
  order: (id: number) => apiFetch<CourierOrder>(`/courier/orders/${id}/`),
  pickup: (id: number) =>
    apiFetch<CourierOrder>(`/courier/orders/${id}/pickup/`, { method: 'POST' }),
  deliver: (id: number) =>
    apiFetch<CourierOrder>(`/courier/orders/${id}/deliver/`, { method: 'POST' }),
}

/** Google Maps directions to the delivery address. */
export function directionsUrl(order: Pick<CourierOrder, 'delivery_address' | 'city'>) {
  const query = [order.delivery_address, order.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
}
