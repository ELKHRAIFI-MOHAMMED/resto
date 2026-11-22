import { describe, expect, it } from 'vitest'

import { burger, categories, chicken, tea } from '@/test/fixtures'

import { groupByCategory } from './groupProducts'

describe('groupByCategory', () => {
  it('groups products in category display order', () => {
    const sections = groupByCategory([tea, burger, chicken], categories)

    expect(sections.map((section) => section.category.slug)).toEqual(['burgers', 'boissons'])
    expect(sections[0]?.products.map((product) => product.id)).toEqual([burger.id, chicken.id])
  })

  it('omits empty categories and keeps products of unknown categories', () => {
    const orphan = { ...tea, id: 99, category: { id: 9, slug: 'autres', name: 'Autres' } }

    const sections = groupByCategory([orphan, tea], categories)

    expect(sections.map((section) => section.category.slug)).toEqual(['boissons', 'autres'])
  })
})
