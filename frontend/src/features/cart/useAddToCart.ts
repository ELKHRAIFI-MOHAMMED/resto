import { useTranslation } from 'react-i18next'

import { estimateUnitPrice } from '@/features/cart/pricing'
import { useCartStore, type NewCartLine } from '@/store/cart'
import { useToastStore } from '@/store/toast'
import type { ProductSummary } from '@/types/catalog'

/** Adds a line to the cart and confirms it with a toast linking to the cart. */
export function useAddToCart() {
  const { t } = useTranslation()
  const addItem = useCartStore((state) => state.addItem)
  const show = useToastStore((state) => state.show)

  return (line: NewCartLine) => {
    addItem(line)
    show({
      message: t('menu.added', { name: line.name }),
      action: { label: t('menu.viewCart'), to: '/cart' },
    })
  }
}

/** One unit of a product that has no options to choose. */
export function simpleCartLine(product: ProductSummary): NewCartLine {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image,
    variantId: null,
    variantName: '',
    addonIds: [],
    addonNames: [],
    unitPriceCents: estimateUnitPrice(product, null, []),
    quantity: 1,
    specialInstructions: '',
  }
}
