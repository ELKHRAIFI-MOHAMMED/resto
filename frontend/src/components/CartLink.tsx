import { ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { selectItemCount, useCartStore } from '@/store/cart'

export function CartLink() {
  const { t } = useTranslation()
  const count = useCartStore(selectItemCount)

  return (
    <Link
      to="/cart"
      aria-label={t('nav.cartLabel', { count })}
      className="relative flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface"
    >
      <ShoppingBag aria-hidden className="size-5" strokeWidth={1.5} />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -end-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-background tabular-nums"
        >
          {count}
        </span>
      )}
    </Link>
  )
}
