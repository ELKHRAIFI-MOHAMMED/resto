import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { Price } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { ButtonLink } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cx } from '@/lib/cx'

import { categoriesApi, productsApi, type AdminProduct } from '../api'
import { ProductTabs } from '../ProductTabs'
import { TABLE, TD, TH } from '../helpers'
import { FormError, PageHeader, Pagination } from '../ui'

const PAGE_SIZE = 25

export function ProductsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const page = Number(params.get('page') ?? 1)
  const category = params.get('category') ?? ''

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => (await categoriesApi.list({ page_size: 100 })).results,
  })
  const products = useQuery({
    queryKey: ['admin', 'products', { search: debouncedSearch, category, page }],
    queryFn: () =>
      productsApi.list({ search: debouncedSearch, category, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  // Quick switches for the daily routine: sold out today, hidden, featured.
  const toggle = useMutation({
    mutationFn: ({
      product,
      field,
    }: {
      product: AdminProduct
      field: 'is_available' | 'is_active' | 'is_featured'
    }) => productsApi.update(product.id, { [field]: !product[field] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
  })

  const setParam = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })

  const switchCell = (
    product: AdminProduct,
    field: 'is_available' | 'is_active' | 'is_featured',
    label: string,
  ) => (
    <input
      type="checkbox"
      checked={product[field]}
      disabled={toggle.isPending}
      onChange={() => toggle.mutate({ product, field })}
      aria-label={`${label}: ${product.name_fr}`}
      className="size-4 accent-[var(--color-accent)]"
    />
  )

  return (
    <>
      <PageHeader
        title={t('admin.products.title')}
        actions={
          <ButtonLink to="/admin/products/new">
            <Plus aria-hidden className="size-4" />
            {t('admin.products.new')}
          </ButtonLink>
        }
      />
      <ProductTabs />
      <div className="mb-6 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TextField
          label={t('admin.common.search')}
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setParam('page', '')
          }}
        />
        <label className="text-sm">
          <span className="mb-2 block">{t('admin.products.category')}</span>
          <select
            value={category}
            onChange={(event) => setParam('category', event.target.value)}
            className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-foreground focus:border-accent focus:outline-none"
          >
            <option value="">{t('admin.common.all')}</option>
            {categories.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name_fr}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormError error={toggle.error} />

      {products.isPending ? (
        <Skeleton className="h-64" />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>{t('admin.common.name')}</th>
                  <th className={TH}>{t('admin.products.category')}</th>
                  <th className={TH}>{t('admin.common.price')}</th>
                  <th className={TH}>{t('admin.products.available')}</th>
                  <th className={TH}>{t('admin.common.active')}</th>
                  <th className={TH}>{t('admin.products.featured')}</th>
                </tr>
              </thead>
              <tbody>
                {products.data.results.map((product) => (
                  <tr key={product.id} className={cx(!product.is_active && 'opacity-60')}>
                    <td className={TD}>
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="flex items-center gap-3 hover:text-accent"
                      >
                        <ProductImage
                          src={product.image}
                          alt=""
                          className="size-10 shrink-0 rounded-lg"
                        />
                        <span className="font-medium">{product.name_fr}</span>
                      </Link>
                    </td>
                    <td className={TD}>
                      {categories.data?.find((item) => item.id === product.category)?.name_fr}
                    </td>
                    <td className={cx(TD, 'whitespace-nowrap')}>
                      <Price
                        amount={product.effective_price}
                        original={product.sale_price ? product.price : null}
                      />
                    </td>
                    <td className={TD}>
                      {switchCell(product, 'is_available', t('admin.products.available'))}
                    </td>
                    <td className={TD}>
                      {switchCell(product, 'is_active', t('admin.common.active'))}
                    </td>
                    <td className={TD}>
                      {switchCell(product, 'is_featured', t('admin.products.featured'))}
                    </td>
                  </tr>
                ))}
                {products.data.results.length === 0 && (
                  <tr>
                    <td colSpan={6} className={cx(TD, 'text-center text-muted')}>
                      {t('admin.products.noProducts')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            count={products.data.count}
            pageSize={PAGE_SIZE}
            onPage={(next) => setParam('page', String(next))}
          />
        </>
      )}
    </>
  )
}
