import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { itemIssuesOf } from '@/features/checkout/errors'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLanguage } from '@/hooks/useLanguage'
import { parseMoney } from '@/lib/money'
import { cartChoicesFromQuote } from '@/lib/offers'
import { quoteOrder, toOrderItems } from '@/services/orders'
import { useCartStore, type CartLine } from '@/store/cart'
import type { ItemIssue, OrderType, QuoteRequest } from '@/types/orders'

interface QuoteOptions {
  orderType?: OrderType | null
  deliveryZone?: number | null
}

export type LineIssues = Record<string, ItemIssue['code']>

/**
 * Prices the cart through the API (the single source of truth for amounts).
 * Without an order type (cart page) only the items are priced; with
 * delivery and a zone, the fee and minimum order apply too.
 *
 * It also keeps the stored cart in step: prices and names are refreshed from
 * the quote, and the backend's per-item problems are mapped to cart lines.
 */
export function useCartQuote({ orderType = null, deliveryZone = null }: QuoteOptions = {}) {
  const language = useLanguage()
  const lines = useCartStore((state) => state.lines)
  const syncLines = useCartStore((state) => state.syncLines)
  // Wait for quantity taps to settle before asking the server.
  const quotedLines = useDebouncedValue(lines, 250)
  const pricesChanged = useCartStore((state) => state.pricesChanged)

  const request = useMemo<QuoteRequest>(() => {
    // Delivery without a zone yet: price the items only.
    const type = orderType === 'delivery' && !deliveryZone ? null : orderType
    return {
      items: toOrderItems(quotedLines),
      order_type: type,
      delivery_zone: type === 'delivery' ? deliveryZone : null,
    }
  }, [quotedLines, orderType, deliveryZone])

  const query = useQuery({
    queryKey: ['order-quote', language, request],
    queryFn: ({ signal }) => quoteOrder(request, signal),
    enabled: request.items.length > 0,
    retry: false,
    staleTime: 15_000,
    placeholderData: (previous) => previous,
  })

  const quote = query.data
  useEffect(() => {
    if (!quote || quote.items.length !== quotedLines.length) return
    const updates = quote.items.map((item, index) => ({
      key: (quotedLines[index] as CartLine).key,
      unitPriceCents: parseMoney(item.unit_price),
      name: item.product_name,
      variantName: item.variant_name,
      addonNames: item.addons.map((addon) => addon.name),
      ...(item.offer != null ? { choices: cartChoicesFromQuote(item.choices) } : {}),
    }))
    syncLines(updates) // the store raises `pricesChanged` if an amount moved
  }, [quote, quotedLines, syncLines])

  const lineIssues = useMemo<LineIssues>(() => {
    const issues: LineIssues = {}
    for (const issue of itemIssuesOf(query.error)) {
      const line = quotedLines[issue.index]
      if (line) issues[line.key] = issue.code
    }
    return issues
  }, [query.error, quotedLines])

  // The quote matches the cart on screen once the quoted items (ids, options,
  // quantities) equal the current ones; name or price syncs do not count.
  const isSettled =
    JSON.stringify(toOrderItems(lines)) === JSON.stringify(request.items) && !query.isFetching

  return {
    quote: query.isError ? undefined : quote,
    error: query.error,
    isPending: lines.length > 0 && (query.isPending || !isSettled),
    lineIssues,
    pricesChanged,
    refetch: query.refetch,
  }
}
