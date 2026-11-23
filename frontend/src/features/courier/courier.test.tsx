import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { routes } from '@/router'
import { apiError, mockApi, renderRoutesReady, type MockRequest } from '@/test/utils'

import type { CourierOrder, CourierProfile } from './api'

const courierUser = {
  id: 9,
  email: 'rider@example.com',
  first_name: 'Youssef',
  last_name: '',
  role: 'courier',
  is_owner: false,
  is_courier: true,
}
const staffUser = { ...courierUser, id: 1, role: 'owner', is_owner: true, is_courier: false }

const profile: CourierProfile = {
  id: 3,
  email: 'rider@example.com',
  name: 'Youssef',
  phone: '0611111111',
  is_on_duty: false,
  zones: ['Maârif', 'Gauthier'],
}

const order: CourierOrder = {
  id: 42,
  reference: 'RF-2026-0042',
  status: 'confirmed',
  customer_name: 'Sara',
  customer_phone: '+212612345678',
  delivery_address: '5 rue Test',
  city: 'Casablanca',
  delivery_zone_name: 'Maârif',
  customer_notes: 'Sonner deux fois',
  items: [
    {
      id: 1,
      product_name: 'Tacos Poulet',
      variant_name: 'L',
      addons: [{ id: 1, addon_name: 'Fromage' }],
      choices: [],
      quantity: 2,
      special_instructions: '',
    },
  ],
  total: '135.00',
  currency: 'MAD',
  created_at: '2026-11-23T12:00:00Z',
  assigned_at: '2026-11-23T12:01:00Z',
  picked_up_at: null,
  delivered_at: null,
}

function mockCourierApi(user: object | null = courierUser) {
  let current = { ...order }
  let me = { ...profile }
  const calls: MockRequest[] = []
  mockApi({
    '/auth/me/': () => (user ? user : apiError(403, 'not_authenticated')),
    '/courier/me/': (request: MockRequest) => {
      calls.push(request)
      if (request.method === 'PATCH') me = { ...me, ...(request.body as object) }
      return me
    },
    '/courier/orders/': ({ url }: MockRequest) =>
      url.searchParams.get('scope') === 'done'
        ? []
        : current.status === 'completed'
          ? []
          : [current],
    '/courier/orders/42/': () => current,
    '/courier/orders/42/pickup/': (request: MockRequest) => {
      calls.push(request)
      current = { ...current, status: 'out_for_delivery', picked_up_at: '2026-11-23T12:10:00Z' }
      return current
    },
    '/courier/orders/42/deliver/': (request: MockRequest) => {
      calls.push(request)
      current = { ...current, status: 'completed', delivered_at: '2026-11-23T12:30:00Z' }
      return current
    },
  })
  return calls
}

beforeAll(async () => {
  await import('./CourierApp')
})

describe('courier app', () => {
  it('lists assigned deliveries with the amount to collect', async () => {
    mockCourierApi()
    await renderRoutesReady(routes, '/livreur')

    const card = await screen.findByRole('link', { name: /RF-2026-0042/ })
    expect(within(card).getByText('Sara')).toBeInTheDocument()
    expect(within(card).getByText(/5 rue Test/)).toBeInTheDocument()
    expect(within(card).getByText('2 articles')).toBeInTheDocument()
    expect(within(card).getByText('135 MAD')).toBeInTheDocument()
    expect(within(card).getByText('À récupérer')).toBeInTheDocument()
  })

  it('goes on duty', async () => {
    const user = userEvent.setup()
    const calls = mockCourierApi()
    await renderRoutesReady(routes, '/livreur')

    const toggle = await screen.findByRole('switch', { name: 'En service' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/Maârif, Gauthier/)).toBeInTheDocument()
    await user.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { is_on_duty: true } })
  })

  it('picks up then delivers an order, with contact and directions links', async () => {
    const user = userEvent.setup()
    const calls = mockCourierApi()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const { router } = await renderRoutesReady(routes, '/livreur/orders/42')

    expect(await screen.findByText('Sonner deux fois')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Appeler/ })).toHaveAttribute(
      'href',
      'tel:+212612345678',
    )
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/212612345678',
    )
    expect(screen.getByRole('link', { name: /Itinéraire/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=5%20rue%20Test%2C%20Casablanca',
    )

    await user.click(screen.getByRole('button', { name: 'J’ai récupéré la commande' }))
    await user.click(await screen.findByRole('button', { name: 'Commande livrée' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('RF-2026-0042'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/livreur'))
    expect(calls.map((call) => call.url.pathname)).toEqual([
      '/api/courier/orders/42/pickup/',
      '/api/courier/orders/42/deliver/',
    ])
  })

  it('sends anonymous visitors to the login page', async () => {
    mockCourierApi(null)
    await renderRoutesReady(routes, '/livreur')

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
  })

  it('tells staff accounts this is not their app', async () => {
    mockCourierApi(staffUser)
    await renderRoutesReady(routes, '/livreur')

    expect(await screen.findByText('Ce compte n’est pas un compte livreur.')).toBeInTheDocument()
  })

  it('sends couriers away from the admin dashboard', async () => {
    mockCourierApi()
    await import('@/features/admin/AdminApp')
    const { router } = await renderRoutesReady(routes, '/admin/orders')

    await waitFor(() => expect(router.state.location.pathname).toBe('/livreur'))
  })
})
