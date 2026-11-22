import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { routes } from '@/router'
import { useCartStore } from '@/store/cart'
import {
  burger,
  burgerDetail,
  categories,
  hours,
  page,
  products,
  restaurant,
  tea,
  zones,
} from '@/test/fixtures'
import { mockApi, renderRoutes } from '@/test/utils'

// Testing Library normalises the non-breaking space to a regular one.
const mad = (amount: string) => `${amount} MAD`

function mockCatalog(extra: Record<string, unknown> = {}) {
  return mockApi({
    '/restaurant/': restaurant,
    '/restaurant/hours/': hours,
    '/categories/': categories,
    '/delivery/zones/': zones,
    '/products/': (url: URL) => {
      const search = url.searchParams.get('search')?.toLowerCase()
      const featured = url.searchParams.get('featured') === 'true'
      return page(
        products.filter(
          (product) =>
            (!search || product.name.toLowerCase().includes(search)) &&
            (!featured || product.is_featured),
        ),
      )
    },
    [`/products/${burger.slug}/`]: burgerDetail,
    ...extra,
  })
}

describe('home page', () => {
  beforeEach(() => {
    mockCatalog()
  })

  it('renders live restaurant data', async () => {
    renderRoutes(routes, '/')

    expect(
      screen.getByRole('heading', { level: 1, name: 'La table du quartier, livrée chez vous.' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Ouvert maintenant')).toBeInTheDocument()
    // Menu board: categories with dish counts
    expect(await screen.findByRole('link', { name: /Burgers.*2 plats/ })).toHaveAttribute(
      'href',
      '/menu?category=burgers',
    )
    // Facts come from the delivery zones and settings
    expect(screen.getByText('Livraison dans 1 quartier')).toBeInTheDocument()
    expect(screen.getByText(`Livraison offerte dès ${mad('300')}`)).toBeInTheDocument()
    // Contact and hours
    expect(screen.getByRole('link', { name: 'Écrire sur WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/212600000000',
    )
    expect(screen.getAllByText('12:00–15:00')).toHaveLength(8) // hero + 7 days
  })
})

describe('menu page', () => {
  it('groups products by category with prices and availability', async () => {
    mockCatalog()
    renderRoutes(routes, '/menu')

    const burgers = await screen.findByRole('region', { name: 'Burgers' })
    expect(within(burgers).getByRole('heading', { name: 'Double Cheese' })).toBeInTheDocument()
    expect(within(burgers).getByText(mad('65'))).toBeInTheDocument()
    expect(within(burgers).getByText('Indisponible')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Boissons' })).toBeInTheDocument()
  })

  it('filters by category', async () => {
    const user = userEvent.setup()
    mockCatalog()
    renderRoutes(routes, '/menu')

    await user.click(await screen.findByRole('button', { name: 'Boissons' }))

    expect(screen.queryByRole('region', { name: 'Burgers' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Boissons' })).toBeInTheDocument()
  })

  it('searches through the API and shows the empty state', async () => {
    const user = userEvent.setup()
    const fetchMock = mockCatalog()
    renderRoutes(routes, '/menu')
    await screen.findByRole('region', { name: 'Burgers' })

    await user.type(screen.getByLabelText('Rechercher un plat'), 'sushi')

    expect(await screen.findByText('Aucun plat ne correspond à « sushi ».')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('search=sushi'))).toBe(true)
  })

  it('adds a product without options in one tap', async () => {
    const user = userEvent.setup()
    mockCatalog()
    renderRoutes(routes, '/menu')

    await user.click(
      await screen.findByRole('button', { name: 'Ajouter Thé à la menthe au panier' }),
    )

    expect(useCartStore.getState().lines).toMatchObject([
      { productId: tea.id, quantity: 1, unitPriceCents: 1500 },
    ])
    expect(await screen.findByText('Thé à la menthe ajouté au panier')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Panier, 1 article' })).toBeInTheDocument()
  })

  it('sends products with options to their page', async () => {
    mockCatalog()
    renderRoutes(routes, '/menu')

    expect(
      await screen.findByRole('link', { name: 'Choisir les options de Double Cheese' }),
    ).toHaveAttribute('href', '/menu/double-cheese')
  })
})

describe('product page', () => {
  it('builds a line from the chosen variant, add-ons, quantity and notes', async () => {
    const user = userEvent.setup()
    mockCatalog()
    renderRoutes(routes, '/menu/double-cheese')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Double Cheese' }),
    ).toBeInTheDocument()
    // First variant preselected; total reflects options as they change
    expect(screen.getByRole('radio', { name: /Simple/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /XL/ }))
    await user.click(screen.getByRole('checkbox', { name: /Fromage/ }))
    await user.click(screen.getByRole('button', { name: 'Ajouter une unité' }))
    await user.type(screen.getByLabelText(/Remarques pour la cuisine/), 'Bien cuit')

    const submit = screen.getByRole('button', { name: /Ajouter au panier/ })
    expect(submit).toHaveTextContent(mad('186')) // (65 + 20 + 8) x 2
    await user.click(submit)

    expect(useCartStore.getState().lines).toMatchObject([
      {
        productId: burger.id,
        variantId: 101,
        variantName: 'XL',
        addonIds: [200],
        addonNames: ['Fromage'],
        quantity: 2,
        unitPriceCents: 9300,
        specialInstructions: 'Bien cuit',
      },
    ])
  })

  it('disables ordering for unavailable products', async () => {
    mockCatalog({ [`/products/${burger.slug}/`]: { ...burgerDetail, is_available: false } })
    renderRoutes(routes, '/menu/double-cheese')

    expect(
      await screen.findByText('Ce plat n’est pas disponible pour le moment.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ajouter au panier/ })).toBeDisabled()
  })

  it('explains when a dish no longer exists', async () => {
    mockCatalog()
    renderRoutes(routes, '/menu/plat-supprime')

    expect(await screen.findByText('Ce plat n’est plus à la carte')).toBeInTheDocument()
  })

  it('renders right-to-left in Arabic', async () => {
    await i18n.changeLanguage('ar')
    mockCatalog()
    renderRoutes(routes, '/menu/double-cheese')

    await screen.findByRole('heading', { level: 1 })
    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getByRole('button', { name: /أضف إلى السلة/ })).toBeInTheDocument()
    expect(screen.getByText('الإضافات', { exact: false })).toBeInTheDocument()
  })
})

describe('cart page', () => {
  it('shows the empty state', () => {
    mockCatalog()
    renderRoutes(routes, '/cart')

    expect(screen.getByText('Votre panier est vide.')).toBeInTheDocument()
  })

  it('updates quantities, the estimated subtotal and removes lines', async () => {
    const user = userEvent.setup()
    mockCatalog()
    useCartStore.getState().addItem({
      productId: tea.id,
      slug: tea.slug,
      name: tea.name,
      image: null,
      variantId: null,
      variantName: '',
      addonIds: [],
      addonNames: [],
      unitPriceCents: 1500,
      quantity: 1,
      specialInstructions: '',
    })
    renderRoutes(routes, '/cart')

    await user.click(screen.getByRole('button', { name: 'Ajouter une unité' }))
    expect(screen.getAllByText(mad('30'))).toHaveLength(2) // line total + subtotal

    await user.click(screen.getByRole('button', { name: 'Retirer Thé à la menthe' }))
    await waitFor(() => expect(screen.getByText('Votre panier est vide.')).toBeInTheDocument())
  })
})

describe('routing', () => {
  it('renders a 404 page for unknown paths', () => {
    mockCatalog()
    renderRoutes(routes, '/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
  })
})
