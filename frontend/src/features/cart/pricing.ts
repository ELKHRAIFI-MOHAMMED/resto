/**
 * Price *estimates* shown while browsing. They mirror the backend rule
 * (product price + variant + add-ons) only for display: the order total is
 * always recomputed by the API, which is the single source of truth.
 */
import { parseMoney } from '@/lib/money'
import type { ProductAddon, ProductSummary, ProductVariant } from '@/types/catalog'

export function estimateUnitPrice(
  product: Pick<ProductSummary, 'effective_price'>,
  variant: Pick<ProductVariant, 'price_delta'> | null,
  addons: Pick<ProductAddon, 'price'>[],
): number {
  return (
    parseMoney(product.effective_price) +
    (variant ? parseMoney(variant.price_delta) : 0) +
    addons.reduce((sum, addon) => sum + parseMoney(addon.price), 0)
  )
}
