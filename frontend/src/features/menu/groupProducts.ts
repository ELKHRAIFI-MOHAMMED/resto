import type { Category, CategoryRef, ProductSummary } from '@/types/catalog'

export interface MenuSection {
  category: Pick<Category, 'id' | 'slug' | 'name'> & { description?: string }
  products: ProductSummary[]
}

/** Groups products by category, following the categories' display order. */
export function groupByCategory(products: ProductSummary[], categories: Category[]): MenuSection[] {
  const byCategory = new Map<number, { ref: CategoryRef; products: ProductSummary[] }>()
  for (const product of products) {
    const entry = byCategory.get(product.category.id)
    if (entry) entry.products.push(product)
    else byCategory.set(product.category.id, { ref: product.category, products: [product] })
  }

  const sections: MenuSection[] = []
  for (const category of categories) {
    const entry = byCategory.get(category.id)
    if (entry) {
      sections.push({ category, products: entry.products })
      byCategory.delete(category.id)
    }
  }
  // Products whose category is not in the list (should not happen) are still shown.
  for (const { ref, products: rest } of byCategory.values()) {
    sections.push({ category: ref, products: rest })
  }
  return sections
}
