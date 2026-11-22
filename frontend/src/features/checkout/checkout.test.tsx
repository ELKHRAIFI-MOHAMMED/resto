import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { routes } from '@/router'
import { useCartStore, type NewCartLine } from '@/store/cart'
import { useLastOrderStore } from '@/store/lastOrder'
import { fakeCreatedOrder, fakeQuote } from '@/test/fakeQuote'
import { burger, categories, hours, page, products, restaurant, tea, zones } from '@/test/fixtures'
import { apiError, mockApi, renderRoutesReady, type MockRequest } from '@/test/utils'

// Testing Library normalises the non-breaking space to a regular one.
const mad = (amount: string) => `${amount} MAD`

const teaLine: NewCartLine = {
  productId: tea.id,
  slug: tea.slug,
  name: tea.name,
  image: null,
  variantId: null,
  variantName: '',
  addonIds: [],
  addonNames: [],
  unitPriceCents: 1500,
  quantity: 2,
  specialInstructions: '',
}

const burgerLine: NewCartLine = {
  ...teaLine,
  productId: burger.id,
  slug: burger.slug,
  name: burger.name,
  variantId: 101,
  variantName: 'XL',
  addonIds: [200],
  addonNames: ['Fromage'],
  unitPriceCents: 9300,
  quantity: 1,
}

interface ApiOptions {
  quote?: (request: MockRequest) => unknown
  create?: (request: MockRequest) => unknown
}

function mockOrderingApi({ quote, create }: ApiOptions = {}) {
  const requests: MockRequest[] = []
  const fetchMock = mockApi({
    '/restaurant/': restaurant,
    '/restaurant/hours/': hours,
    '/categories/': categories,
    '/delivery/zones/': zones,
    '/products/': page(products),
    '/orders/quote/': (request: MockRequest) => (quote ? quote(request) : fakeQuote(request.body)),
    '/orders/': (request: MockRequest) => {
      requests.push(request)
      return create ? create(request) : fakeCreatedOrder(request.body)
    },
  })
  return { fetchMock, orderRequests: requests }
}

function fakeWindow() {
  return { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
}

async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nom complet'), 'Mohamed')
  await user.type(screen.getByLabelText('Téléphone'), '06 12 34 56 78')
}

describe('cart page with server quote', () => {
  beforeEach(() => useCartStore.getState().addItem(teaLine))

  it('shows the authoritative subtotal and refreshes outdated prices', async () => {
    useCartStore.setState((state) => ({
      lines: state.lines.map((line) => ({ ...line, unitPriceCents: 1000 })),
    }))
    mockOrderingApi()
    await renderRoutesReady(routes, '/cart')

    expect(
      await screen.findByText(
        'Certains prix ont changé depuis votre ajout. Le panier affiche les prix actuels.',
      ),
    ).toBeInTheDocument()
    await waitFor(() => expect(useCartStore.getState().lines[0]?.unitPriceCents).toBe(1500))
    expect(screen.getAllByText(mad('30')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(`Livraison ${mad('15')}.`)).toBeInTheDocument()
    expect(
      screen.getByText(`Plus que ${mad('270')} pour la livraison offerte.`),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Passer la commande' })).toHaveAttribute(
      'href',
      '/checkout',
    )
  })

  it('flags unavailable dishes and blocks checkout', async () => {
    mockOrderingApi({
      quote: () =>
        apiError(400, 'invalid_items', {
          items: [{ index: 0, code: 'product_unavailable', message: 'x' }],
        }),
    })
    await renderRoutesReady(routes, '/cart')

    expect(
      await screen.findByText('Ce plat n’est pas disponible pour le moment.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Retirez ou modifiez les plats signalés pour continuer.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Passer la commande' })).toBeDisabled()
  })
})

describe('checkout', () => {
  beforeEach(() => {
    useCartStore.getState().addItem(teaLine)
    useCartStore.getState().addItem(burgerLine)
    vi.stubGlobal('matchMedia', () => ({ matches: false })) // desktop by default
  })

  afterEach(() => useLastOrderStore.getState().forget())

  it('redirects to the cart when the cart is empty', async () => {
    useCartStore.getState().clear()
    mockOrderingApi()
    await renderRoutesReady(routes, '/checkout')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Votre panier' }),
    ).toBeInTheDocument()
  })

  it('validates the form with translated messages and focuses the first error', async () => {
    const user = userEvent.setup()
    const { orderRequests } = mockOrderingApi()
    await renderRoutesReady(routes, '/checkout')
    await screen.findByRole('radio', { name: /Livraison/ })

    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))

    expect(screen.getByText('Indiquez votre nom.')).toBeInTheDocument()
    expect(screen.getByText('Indiquez votre numéro de téléphone.')).toBeInTheDocument()
    expect(screen.getByText('Choisissez la livraison ou à emporter.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom complet')).toHaveFocus()
    expect(orderRequests).toHaveLength(0)
  })

  it('asks for the delivery fields only for delivery', async () => {
    const user = userEvent.setup()
    mockOrderingApi()
    await renderRoutesReady(routes, '/checkout')
    await fillContact(user)

    await user.click(await screen.findByRole('radio', { name: /Livraison/ }))
    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))
    expect(screen.getByText('Choisissez votre quartier.', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Indiquez l’adresse de livraison.')).toBeInTheDocument()
    // The city is prefilled with the restaurant's city.
    expect(screen.getByLabelText('Ville')).toHaveValue('Casablanca')

    await user.click(screen.getByRole('radio', { name: /À emporter/ }))
    expect(screen.queryByLabelText('Adresse')).not.toBeInTheDocument()
  })

  it('shows live totals with the delivery fee of the chosen zone', async () => {
    const user = userEvent.setup()
    mockOrderingApi()
    await renderRoutesReady(routes, '/checkout')

    await user.click(await screen.findByRole('radio', { name: /Livraison/ }))
    const summary = screen.getByRole('region', { name: 'Votre commande' })
    expect(within(summary).getByText('Choisissez votre quartier')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Quartier'), String(zones[0]?.id))

    // (2 x 15) + 93 = 123, + 15 delivery = 138
    await waitFor(() => expect(within(summary).getByText(mad('138'))).toBeInTheDocument())
    expect(within(summary).getByText(mad('123'))).toBeInTheDocument()
  })

  it('saves the order, then opens WhatsApp with the prefilled message (desktop)', async () => {
    const user = userEvent.setup()
    const handoff = fakeWindow()
    const open = vi.fn(() => handoff)
    vi.stubGlobal('open', open)
    const { orderRequests } = mockOrderingApi()
    const { router } = await renderRoutesReady(routes, '/checkout')

    await fillContact(user)
    await user.click(await screen.findByRole('radio', { name: /À emporter/ }))
    await user.type(screen.getByLabelText(/Remarques pour le restaurant/), 'Sonner deux fois')
    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))

    // The payload carries identifiers, quantities and a retry token, never prices.
    await waitFor(() => expect(orderRequests).toHaveLength(1))
    const body = orderRequests[0]?.body as Record<string, unknown>
    expect(body).toMatchObject({
      order_type: 'pickup',
      delivery_zone: null,
      customer_name: 'Mohamed',
      customer_phone: '06 12 34 56 78',
      delivery_address: '',
      customer_notes: 'Sonner deux fois',
      items: [
        { product: tea.id, variant: null, addons: [], quantity: 2, special_instructions: '' },
        { product: burger.id, variant: 101, addons: [200], quantity: 1, special_instructions: '' },
      ],
    })
    expect(body.client_token).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.stringify(body)).not.toMatch(/price|total/)

    // The tab opened during the click now points to WhatsApp, without opener access.
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(handoff.opener).toBeNull()
    await waitFor(() =>
      expect(handoff.location.href).toMatch(/^https:\/\/wa\.me\/212600000000\?text=/),
    )
    const text = new URL(handoff.location.href).searchParams.get('text')
    expect(text).toContain('Référence de commande: RF-2026-0042')

    // The order page keeps the reference and never claims the order was sent.
    await waitFor(() => expect(router.state.location.pathname).toBe('/order/RF-2026-0042'))
    expect(await screen.findByText('RF-2026-0042')).toBeInTheDocument()
    expect(screen.getByText(/appuyez sur Envoyer/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/commande (a été )?envoyée/i)
    expect(screen.getByRole('link', { name: 'Rouvrir WhatsApp' })).toHaveAttribute(
      'href',
      handoff.location.href,
    )
    expect(useCartStore.getState().lines).toEqual([])
    expect(useLastOrderStore.getState().order?.reference).toBe('RF-2026-0042')
  })

  it('hands off in the same tab on phones, from the order page', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }))
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    mockOrderingApi()
    await renderRoutesReady(routes, '/checkout')

    await fillContact(user)
    await user.click(await screen.findByRole('radio', { name: /À emporter/ }))
    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1))
    expect(assign.mock.calls[0]?.[0]).toMatch(/^https:\/\/wa\.me\/212600000000\?text=/)
    expect(open).not.toHaveBeenCalled()
  })

  it('closes the pre-opened tab and explains a business error', async () => {
    const user = userEvent.setup()
    const handoff = fakeWindow()
    vi.stubGlobal('open', () => handoff)
    mockOrderingApi({ create: () => apiError(409, 'ordering_closed') })
    await renderRoutesReady(routes, '/checkout')

    await fillContact(user)
    await user.click(await screen.findByRole('radio', { name: /À emporter/ }))
    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))

    expect(
      await screen.findByText('Le restaurant ne prend pas de commandes en ligne pour le moment.'),
    ).toBeInTheDocument()
    expect(handoff.close).toHaveBeenCalled()
    expect(useCartStore.getState().lines).toHaveLength(2) // nothing lost
  })

  it('retries with the same token after a network failure', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('open', () => fakeWindow())
    let attempts = 0
    const { orderRequests } = mockOrderingApi({
      create: (request) => {
        attempts += 1
        if (attempts === 1) throw new TypeError('Failed to fetch')
        return fakeCreatedOrder(request.body)
      },
    })
    await renderRoutesReady(routes, '/checkout')

    await fillContact(user)
    await user.click(await screen.findByRole('radio', { name: /À emporter/ }))
    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))
    expect(
      await screen.findByText('Connexion impossible. Vérifiez votre réseau puis réessayez.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))

    await screen.findByText('RF-2026-0042')
    const tokens = orderRequests.map(
      (request) => (request.body as { client_token: string }).client_token,
    )
    expect(tokens).toHaveLength(2)
    expect(tokens[0]).toBe(tokens[1])
  })

  it('maps server field errors back onto the form', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('open', () => fakeWindow())
    mockOrderingApi({
      create: () =>
        apiError(400, 'validation_error', { customer_phone: ['Enter a valid phone number.'] }),
    })
    await renderRoutesReady(routes, '/checkout')

    await fillContact(user)
    await user.click(await screen.findByRole('radio', { name: /À emporter/ }))
    await user.click(screen.getByRole('button', { name: 'Valider et ouvrir WhatsApp' }))

    expect(
      await screen.findByText('Ce numéro n’est pas valide. Exemple : 06 12 34 56 78.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Téléphone')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('order page', () => {
  it('survives a reload: the hand-off data is kept locally', async () => {
    mockOrderingApi()
    useLastOrderStore.getState().save(
      fakeCreatedOrder({
        order_type: 'pickup',
        items: [
          { product: tea.id, variant: null, addons: [], quantity: 1, special_instructions: '' },
        ],
        customer_name: 'Sara',
      }),
    )
    await renderRoutesReady(routes, '/order/RF-2026-0042')

    expect(screen.getByRole('link', { name: 'Ouvrir WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/212600000000\?text=Bonjour/),
    )
    expect(screen.getByRole('button', { name: 'Copier le message' })).toBeInTheDocument()
    expect(screen.getByText('Sara')).toBeInTheDocument()
  })

  it('explains when the order is not on this device', async () => {
    mockOrderingApi()
    await renderRoutesReady(routes, '/order/RF-2026-9999')

    expect(screen.getByText('Commande introuvable sur cet appareil')).toBeInTheDocument()
  })
})
