/**
 * Automated accessibility checks (axe-core) on the main pages, in French and
 * Arabic. Colour contrast cannot be computed in jsdom and is checked on the
 * design tokens instead (see docs/architecture.md, design system).
 */
import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { routes } from '@/router'
import { useCartStore } from '@/store/cart'
import { fakeQuote } from '@/test/fakeQuote'
import {
  burger,
  burgerDetail,
  categories,
  familyOffer,
  hours,
  page,
  products,
  restaurant,
  tea,
  zones,
} from '@/test/fixtures'
import { apiError, mockApi, renderRoutesReady, type MockRequest } from '@/test/utils'

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.length} node(s) - ${violation.help}`,
  )
}

function mockEverything() {
  mockApi({
    '/restaurant/': restaurant,
    '/restaurant/hours/': hours,
    '/categories/': categories,
    '/delivery/zones/': zones,
    '/products/': page(products),
    [`/products/${burger.slug}/`]: burgerDetail,
    '/offers/': [familyOffer],
    [`/offers/${familyOffer.slug}/`]: familyOffer,
    '/orders/quote/': ({ body }: MockRequest) => fakeQuote(body),
    '/auth/me/': apiError(403, 'not_authenticated'),
  })
}

beforeAll(async () => {
  await import('@/features/admin/AdminApp')
})

describe.each(['fr', 'ar'])('accessibility (%s)', (language) => {
  const cases: [string, string, () => Promise<unknown>][] = [
    ['home', '/', () => screen.findByText(/Burgers/, { selector: 'a span' })],
    ['menu', '/menu', () => screen.findAllByRole('article')],
    ['product', `/menu/${burger.slug}`, () => screen.findAllByRole('radio')],
    ['offer', `/offres/${familyOffer.slug}`, () => screen.findAllByRole('group')],
    ['cart', '/cart', () => screen.findAllByRole('listitem')],
    ['checkout', '/checkout', () => screen.findAllByRole('radio')],
    ['admin login', '/admin/login', () => screen.findAllByRole('textbox')],
  ]

  it.each(cases)('%s page has no detectable violations', async (_name, path, ready) => {
    await i18n.changeLanguage(language)
    mockEverything()
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
    const { container } = await renderRoutesReady(routes, path)
    await ready()

    expect(await violations(container)).toEqual([])
  })
})
