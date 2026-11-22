import { useTranslation } from 'react-i18next'

import { cx } from '@/lib/cx'
import type { Category } from '@/types/catalog'

interface CategoryNavProps {
  categories: Category[]
  active: string | null
  onSelect: (slug: string | null) => void
}

export function CategoryNav({ categories, active, onSelect }: CategoryNavProps) {
  const { t } = useTranslation()
  const items = [{ slug: null, name: t('menu.allCategories') }, ...categories]

  return (
    <nav aria-label={t('menu.categoriesLabel')}>
      <ul className="-mx-4 flex scrollbar-none gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {items.map((category) => {
          const isActive = active === category.slug
          return (
            <li key={category.slug ?? 'all'}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelect(category.slug)}
                className={cx(
                  'min-h-10 rounded-full px-4 text-sm whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted hover:bg-surface hover:text-foreground',
                )}
              >
                {category.name}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
