/** Helpers shared by every screen that shows an offer (pack) and its picked dishes. */
import type { CartLine, CartOfferChoice } from '@/store/cart'
import type { OfferChoice, PricedItem } from '@/types/orders'

export interface ChoiceSummary {
  group: string
  /** e.g. "2× Tacos Poulet (M), 1× Pizza Margherita" */
  items: string
}

/** Picked dishes from a quote, grouped back into cart choices (order preserved). */
export function cartChoicesFromQuote(choices: PricedItem['choices']): CartOfferChoice[] {
  const groups: CartOfferChoice[] = []
  for (const choice of choices) {
    let group = groups.find((item) => item.groupId === choice.group)
    if (!group) {
      group = { groupId: choice.group, groupName: choice.group_name, picks: [] }
      groups.push(group)
    }
    group.picks.push({
      productId: choice.product ?? 0,
      name: choice.product_name,
      quantity: choice.quantity,
    })
  }
  return groups
}

/** One line per group for saved orders and quotes. */
export function summarizeChoices(
  choices: Pick<OfferChoice, 'group_name' | 'product_name' | 'quantity'>[] = [],
): ChoiceSummary[] {
  const groups = new Map<string, string[]>()
  for (const choice of choices) {
    const items = groups.get(choice.group_name) ?? []
    items.push(`${choice.quantity}× ${choice.product_name}`)
    groups.set(choice.group_name, items)
  }
  return [...groups].map(([group, items]) => ({ group, items: items.join(', ') }))
}

/** One line per group for a cart line. */
export function summarizeCartChoices(choices: CartOfferChoice[] = []): ChoiceSummary[] {
  return choices.map((choice) => ({
    group: choice.groupName,
    items: choice.picks.map((pick) => `${pick.quantity}× ${pick.name}`).join(', '),
  }))
}

/** Page of a cart line's product or offer; `edit` opens it on that line. */
export function cartLineHref(line: Pick<CartLine, 'key' | 'slug' | 'offerId'>, edit = false) {
  const base = line.offerId != null ? `/offres/${line.slug}` : `/menu/${line.slug}`
  return edit ? `${base}?edit=${encodeURIComponent(line.key)}` : base
}
