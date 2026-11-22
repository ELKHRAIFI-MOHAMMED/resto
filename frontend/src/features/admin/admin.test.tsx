import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { routes } from '@/router'
import { apiError, mockApi, renderRoutes, type MockRequest } from '@/test/utils'

import type { AdminOrderDetail, Dashboard, StaffUser } from './api'

const owner: StaffUser = {
  id: 1,
  email: 'owner@example.com',
  first_name: '',
  last_name: '',
  role: 'owner',
  is_owner: true,
}
const manager: StaffUser = {
  ...owner,
  id: 2,
  email: 'manager@example.com',
  role: 'manager',
  is_owner: false,
}

const dashboard: Dashboard = {
  orders: {
    initiated: 12,
    confirmed: 9,
    revenue: '1450.00',
    by_status: {
      pending: 3,
      confirmed: 2,
      preparing: 1,
      ready: 0,
      out_for_delivery: 1,
      completed: 4,
      cancelled: 1,
    },
  },
  products: { total: 14, active: 14, available: 13 },
  popular_products: [
    { product_id: 3, name: 'Tacos Poulet', quantity: 8, revenue: '480.00', orders: 6 },
  ],
  orders_by_date: [
    { date: '2026-11-21', orders: 4, confirmed: 3, revenue: '500.00' },
    { date: '2026-11-22', orders: 8, confirmed: 6, revenue: '950.00' },
  ],
  period_days: 30,
}

const order: AdminOrderDetail = {
  id: 7,
  reference: 'RF-2026-0007',
  status: 'pending',
  allowed_statuses: ['confirmed', 'cancelled'],
  order_type: 'delivery',
  customer_name: 'Sara',
  customer_phone: '+212612345678',
  city: 'Casablanca',
  delivery_address: '5 rue Test',
  delivery_zone: 1,
  delivery_zone_name: 'Maârif',
  customer_notes: '',
  language: 'fr',
  items: [
    {
      id: 1,
      product: 3,
      product_name: 'Tacos Poulet',
      product_price: '45.00',
      variant_name: 'L',
      variant_price: '15.00',
      addons: [],
      quantity: 2,
      unit_price: '60.00',
      line_total: '120.00',
      special_instructions: '',
    },
  ],
  subtotal: '120.00',
  delivery_fee: '15.00',
  total: '135.00',
  currency: 'MAD',
  whatsapp_number: '212600000000',
  whatsapp_message: 'Bonjour ! Je souhaite passer une commande.',
  created_at: '2026-11-22T18:00:00Z',
  updated_at: '2026-11-22T18:00:00Z',
  confirmed_at: null,
}

const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results })

function mockAdmin(user: StaffUser | null, extra: Record<string, unknown> = {}) {
  let session = user
  const calls: MockRequest[] = []
  mockApi({
    '/auth/csrf/': null,
    '/auth/me/': () => (session ? session : apiError(403, 'not_authenticated')),
    '/auth/login/': (request: MockRequest) => {
      const body = request.body as { password: string }
      if (body.password !== 'right-password')
        return apiError(400, 'validation_error', { non_field_errors: ['x'] })
      session = owner
      return owner
    },
    '/auth/logout/': () => {
      session = null
      return null
    },
    '/admin/dashboard/': dashboard,
    '/admin/orders/': page([{ ...order, item_count: 1 }]),
    '/admin/orders/7/': order,
    '/admin/orders/7/status/': (request: MockRequest) => {
      calls.push(request)
      return {
        ...order,
        status: 'confirmed',
        allowed_statuses: ['preparing', 'cancelled'],
        confirmed_at: '2026-11-22T18:05:00Z',
      }
    },
    '/admin/categories/': page([
      { id: 1, name_fr: 'Burgers', name_ar: '', name_en: '', slug: 'burgers' },
    ]),
    '/admin/addons/': page([
      {
        id: 5,
        name_fr: 'Fromage',
        name_ar: '',
        name_en: '',
        price: '8.00',
        is_active: true,
        display_order: 0,
      },
    ]),
    '/admin/products/': (request: MockRequest) => {
      calls.push(request)
      return request.method === 'POST' ? { id: 42, ...(request.body as object) } : page([])
    },
    ...extra,
  })
  return calls
}

// The dashboard is a lazy chunk: compile it once up front so tests time UI, not bundling.
beforeAll(async () => {
  await import('./AdminApp')
})

describe('admin access', () => {
  it('sends anonymous visitors to the login page, then back after logging in', async () => {
    const user = userEvent.setup()
    mockAdmin(null)
    const { router } = renderRoutes(routes, '/admin/orders')

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('E-mail'), 'owner@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByText('E-mail ou mot de passe incorrect.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Mot de passe'))
    await user.type(screen.getByLabelText('Mot de passe'), 'right-password')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/orders'))
    expect(await screen.findByRole('heading', { name: 'Commandes' })).toBeInTheDocument()
  })

  it('logs out', async () => {
    const user = userEvent.setup()
    mockAdmin(owner)
    const { router } = renderRoutes(routes, '/admin/dashboard')

    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'))
  })
})

describe('dashboard', () => {
  it('shows the key figures and an accessible chart', async () => {
    mockAdmin(owner)
    renderRoutes(routes, '/admin/dashboard')

    expect(await screen.findByText('Commandes initiées')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    // fr-MA groups thousands with a dot (1.450); accept any separator.
    expect(screen.getByText(/^1\D?450\sMAD$/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Nombre de commandes par jour/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tacos Poulet' })).toHaveAttribute(
      'href',
      '/admin/products/3',
    )
  })
})

describe('orders', () => {
  it('lists orders and confirms one manually', async () => {
    const user = userEvent.setup()
    const calls = mockAdmin(owner)
    renderRoutes(routes, '/admin/orders')

    await user.click(await screen.findByRole('link', { name: 'RF-2026-0007' }))

    expect(
      await screen.findByText(
        'Confirmez seulement après avoir reçu le message WhatsApp du client.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Répondre au client sur WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/212612345678',
    )

    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText('Statut mis à jour : Confirmée')).toBeInTheDocument()
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { status: 'confirmed' } })
    expect(screen.getByRole('button', { name: 'Lancer la préparation' })).toBeInTheDocument()
  })

  it('asks before cancelling', async () => {
    const user = userEvent.setup()
    const calls = mockAdmin(owner)
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    renderRoutes(routes, '/admin/orders/7')

    await user.click(await screen.findByRole('button', { name: 'Annuler la commande' }))

    expect(window.confirm).toHaveBeenCalledWith('Annuler la commande RF-2026-0007 ?')
    expect(calls).toHaveLength(0)
  })
})

describe('products', () => {
  it('creates a product with translations, prices and add-ons', async () => {
    const user = userEvent.setup()
    const calls = mockAdmin(owner, { '/admin/products/42/': { id: 42, name_fr: 'Burger' } })
    renderRoutes(routes, '/admin/products/new')

    await screen.findByRole('option', { name: 'Burgers' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Catégorie' }), '1')
    await user.type(screen.getByLabelText('Nom (Français)'), 'Burger végétarien')
    await user.type(screen.getByLabelText('Nom (Arabe)'), 'برغر نباتي')
    await user.type(screen.getByLabelText('Prix', { selector: 'input[required]' }), '48')
    await user.click(screen.getByRole('checkbox', { name: 'Fromage' }))
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      category: 1,
      name_fr: 'Burger végétarien',
      name_ar: 'برغر نباتي',
      price: '48',
      sale_price: null,
      addons: [5],
      is_active: true,
    })
  })
})

describe('settings', () => {
  it('is reserved to the owner', async () => {
    mockAdmin(manager)
    renderRoutes(routes, '/admin/settings')

    expect(
      await screen.findByText('Seul le propriétaire peut modifier ces réglages.'),
    ).toBeInTheDocument()
  })
})
