import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { CategoryNav } from '@/features/menu/CategoryNav'
import { groupByCategory } from '@/features/menu/groupProducts'
import { ProductRow } from '@/features/menu/ProductRow'
import { useCategories, useProducts } from '@/hooks/useCatalog'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export function MenuPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const activeCategory = params.get('category')
  const [query, setQuery] = useState(params.get('q') ?? '')
  const search = useDebouncedValue(query.trim(), 300)

  // Keep the URL in sync so a filtered menu can be shared or restored.
  useEffect(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (search) next.set('q', search)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [search, setParams])

  const categories = useCategories()
  const products = useProducts(search ? { search } : {})

  const sections = useMemo(() => {
    const visible = (products.data ?? []).filter(
      (product) => !activeCategory || product.category.slug === activeCategory,
    )
    return groupByCategory(visible, categories.data ?? [])
  }, [products.data, categories.data, activeCategory])

  const resultCount = sections.reduce((count, section) => count + section.products.length, 0)

  const selectCategory = (slug: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (slug) next.set('category', slug)
      else next.delete('category')
      return next
    })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <title>{`${t('menu.title')} | ${t('brand.name')}`}</title>
      <meta name="description" content={t('menu.metaDescription')} />

      <header className="pt-12 pb-8 sm:pt-16">
        <h1 className="font-display text-5xl sm:text-6xl">{t('menu.title')}</h1>
      </header>

      <div className="sticky top-16 z-30 -mx-4 border-b border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="relative lg:w-80">
            <label htmlFor="menu-search" className="sr-only">
              {t('menu.searchLabel')}
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              id="menu-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('menu.searchPlaceholder')}
              maxLength={80}
              className="min-h-11 w-full rounded-full border border-border bg-surface ps-11 pe-11 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('menu.clearSearch')}
                className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
          {categories.data && (
            <CategoryNav
              categories={categories.data}
              active={activeCategory}
              onSelect={selectCategory}
            />
          )}
        </div>
      </div>

      <div aria-live="polite" aria-busy={products.isFetching}>
        {search && products.data && resultCount > 0 && (
          <p className="pt-8 text-sm text-muted">
            {t('menu.results', { count: resultCount, query: search })}
          </p>
        )}

        {products.isPending || categories.isPending ? (
          <MenuSkeleton />
        ) : products.isError || categories.isError ? (
          <ErrorState
            error={products.error ?? categories.error}
            onRetry={() => {
              void products.refetch()
              void categories.refetch()
            }}
          />
        ) : resultCount === 0 ? (
          search ? (
            <EmptyState
              title={t('menu.noResults', { query: search })}
              hint={t('menu.noResultsHint')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  {t('menu.clearSearch')}
                </Button>
              }
            />
          ) : (
            <EmptyState title={t('menu.empty')} />
          )
        ) : (
          sections.map(({ category, products: items }) => (
            <section
              key={category.id}
              aria-labelledby={`section-${category.slug}`}
              className="grid gap-x-12 border-b border-border py-10 last:border-b-0 lg:grid-cols-[16rem_1fr]"
            >
              <div className="lg:sticky lg:top-40 lg:self-start">
                <h2 id={`section-${category.slug}`} className="font-display text-3xl sm:text-4xl">
                  {category.name}
                </h2>
                {category.description && (
                  <p className="mt-2 max-w-xs text-sm text-muted">{category.description}</p>
                )}
              </div>
              <div className="mt-4 divide-y divide-border lg:mt-0">
                {items.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

function MenuSkeleton() {
  return (
    <div className="space-y-6 py-10">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex gap-6">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <Skeleton className="size-24 rounded-xl sm:size-28" />
        </div>
      ))}
    </div>
  )
}
