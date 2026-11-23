import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'

import { routes } from '@/router'
import { toOrderItems } from '@/services/orders'
import { useCartStore, type NewCartLine } from '@/store/cart'
import { fakeQuote } from '@/test/fakeQuote'
import { categories, familyOffer, hours, page, products, restaurant, zones } from '@/test/fixtures'
import { mockApi, renderRoutes, renderRoutesReady, type MockRequest } from '@/test/utils'

function mockOffers() {
  return mockApi({
    '/restaurant/': restaurant,
    '/restaurant/hours/': hours,
    '/categories/': categories,
    '/delivery/zones/': zones,
    '/products/': page(products),
    '/offers/': [familyOffer],
    [`/offers/${familyOffer.slug}/`]: familyOffer,
    '/orders/quote/': ({ body }: MockRequest) => fakeQuote(body),
  })
}

const familyLine: NewCartLine = {
  productId: null,
  offerId: familyOffer.id,
  choices: [
    {
      groupId: 1,
      groupName: 'Plats',
      picks: [{ productId: 10, name: 'Double Cheese (Simple)', quantity: 2 }],
    },
    {
      groupId: 2,
      groupName: 'Boissons',
      picks: [{ productId: 20, name: 'Thé à la menthe', quantity: 1 }],
    },
  ],
  slug: familyOffer.slug,
  name: familyOffer.name,
  image: null,
  variantId: null,
  variantName: '',
  addonIds: [],
  addonNames: [],
  unitPriceCents: 9900,
  quantity: 1,
  specialInstructions: '',
}

beforeAll(async () => {
  await import('@/pages/OfferPage')
  await import('@/pages/MenuPage')
})

describe('offers', () => {
  it('are shown on the menu with their rules', async () => {
    mockOffers()
    await renderRoutesReady(routes, '/menu')

    expect(await screen.findByRole('heading', { name: 'Nos offres' })).toBeInTheDocument()
    const card = screen.getByRole('link', { name: /Offre Famille/ })
    expect(card).toHaveAttribute('href', '/offres/offre-famille')
    expect(within(card).getByText('2 Plats · 1 Boissons')).toBeInTheDocument()
  })

  it('are built by picking dishes in every group, then added to the cart', async () => {
    const user = userEvent.setup()
    mockOffers()
    await renderRoutesReady(routes, '/offres/offre-famille')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Offre Famille' }),
    ).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /Ajouter au panier/ })
    expect(submit).toBeDisabled()
    // Unavailable dishes cannot be picked
    expect(screen.getByRole('button', { name: 'Ajouter : Chicken Crispy' })).toBeDisabled()

    const addBurger = screen.getByRole('button', { name: 'Ajouter : Double Cheese' })
    await user.click(addBurger)
    await user.click(addBurger)
    expect(addBurger).toBeDisabled() // the group is full
    const mains = screen.getByRole('group', { name: 'Plats' })
    expect(within(mains).getByText('2 / 2 choisis')).toBeInTheDocument()
    expect(screen.getByText('Encore 1 à choisir dans « Boissons ».')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ajouter : Thé à la menthe' }))
    expect(submit).toBeEnabled()
    expect(submit).toHaveTextContent('99 MAD')
    await user.click(submit)

    const { lines } = useCartStore.getState()
    expect(lines).toMatchObject([{ ...familyLine, key: expect.stringContaining('offer|7') }])
    expect(toOrderItems(lines)).toEqual([
      {
        offer: 7,
        choices: [
          { group: 1, products: [10, 10] },
          { group: 2, products: [20] },
        ],
        quantity: 1,
        special_instructions: '',
      },
    ])
  })

  it('show their picks in the cart and can be edited', async () => {
    const user = userEvent.setup()
    mockOffers()
    useCartStore.getState().addItem(familyLine)
    const { router } = renderRoutes(routes, '/cart')

    expect(screen.getByText('Plats : 2× Double Cheese (Simple)')).toBeInTheDocument()
    expect(screen.getByText('Boissons : 1× Thé à la menthe')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Modifier Offre Famille' }))

    const remove = await screen.findByRole('button', { name: 'Enlever : Double Cheese' })
    expect(within(screen.getByRole('group', { name: 'Plats' })).getByText('2 / 2 choisis'))
    await user.click(remove)
    expect(screen.getByRole('button', { name: /Mettre à jour/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Ajouter : Double Cheese' }))
    await user.type(screen.getByLabelText(/Remarques pour la cuisine/), 'Sans sauce')
    await user.click(screen.getByRole('button', { name: /Mettre à jour/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/cart'))
    expect(useCartStore.getState().lines).toMatchObject([
      { offerId: 7, specialInstructions: 'Sans sauce', quantity: 1 },
    ])
    // The cart is priced by the server, offer included
    await waitFor(() => expect(screen.getAllByText('99 MAD').length).toBeGreaterThan(1))
  })

  it('explain when an offer has ended', async () => {
    mockOffers()
    await renderRoutesReady(routes, '/offres/offre-terminee')

    expect(await screen.findByText('Cette offre n’est plus disponible')).toBeInTheDocument()
  })
})
