import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useToastStore } from '@/store/toast'

import { addonsApi, categoriesApi, productsApi, type AdminProduct, type AdminVariant } from '../api'
import { fieldError } from '../helpers'
import { Checkbox, FormError, ImageInput, PageHeader, Section, TranslatedFields } from '../ui'

type ProductValues = Omit<
  AdminProduct,
  | 'id'
  | 'slug'
  | 'effective_price'
  | 'image'
  | 'variants'
  | 'images'
  | 'category'
  | 'created_at'
  | 'updated_at'
> & {
  category: number | ''
}

function initialValues(product: AdminProduct | undefined): ProductValues {
  return {
    category: product?.category ?? '',
    name_fr: product?.name_fr ?? '',
    name_ar: product?.name_ar ?? '',
    name_en: product?.name_en ?? '',
    description_fr: product?.description_fr ?? '',
    description_ar: product?.description_ar ?? '',
    description_en: product?.description_en ?? '',
    price: product?.price ?? '',
    sale_price: product?.sale_price ?? null,
    is_active: product?.is_active ?? true,
    is_available: product?.is_available ?? true,
    is_featured: product?.is_featured ?? false,
    display_order: product?.display_order ?? 0,
    addons: product?.addons ?? [],
  }
}

export function ProductEditPage() {
  const { id } = useParams()
  const productId = id ? Number(id) : null
  const { t } = useTranslation()
  const product = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => productsApi.get(productId as number),
    enabled: productId !== null,
  })

  if (productId !== null && product.isPending) return <Skeleton className="h-96" />
  if (product.isError)
    return <ErrorState error={product.error} onRetry={() => void product.refetch()} />

  return (
    <>
      <Link
        to="/admin/products"
        className="mb-4 inline-block text-sm text-muted hover:text-foreground"
      >
        {t('admin.common.back')}
      </Link>
      <ProductForm key={product.data?.updated_at ?? 'new'} product={product.data} />
      {product.data ? (
        <div className="mt-6 space-y-6">
          <VariantsEditor product={product.data} />
          <GalleryEditor product={product.data} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">{t('admin.products.saveFirst')}</p>
      )}
    </>
  )
}

function ProductForm({ product }: { product: AdminProduct | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  const [values, setValues] = useState<ProductValues>(() => initialValues(product))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [clearImage, setClearImage] = useState(false)
  const set = (patch: Partial<ProductValues>) => setValues((current) => ({ ...current, ...patch }))

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => (await categoriesApi.list({ page_size: 100 })).results,
  })
  const addons = useQuery({
    queryKey: ['admin', 'addons'],
    queryFn: async () => (await addonsApi.list({ page_size: 100 })).results,
  })

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...values,
        category: Number(values.category),
        sale_price: values.sale_price || null,
      }
      const saved = product
        ? await productsApi.update(product.id, payload)
        : await productsApi.create(payload)
      if (imageFile) await productsApi.uploadImage(saved.id, imageFile)
      else if (clearImage && product) await productsApi.clearImage(saved.id)
      return saved
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      showToast({ message: product ? t('admin.common.saved') : t('admin.products.created') })
      if (!product) navigate(`/admin/products/${saved.id}`, { replace: true })
    },
  })
  const remove = useMutation({
    mutationFn: () => productsApi.remove((product as AdminProduct).id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      showToast({ message: t('admin.common.deleted', { name: product?.name_fr }) })
      navigate('/admin/products')
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }
  const error = save.error

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PageHeader
        title={product ? product.name_fr : t('admin.products.new')}
        actions={
          <>
            {product && (
              <Button
                variant="ghost"
                onClick={() =>
                  window.confirm(t('admin.common.deleteConfirm', { name: product.name_fr })) &&
                  remove.mutate()
                }
              >
                <Trash2 aria-hidden className="size-4" />
                {t('admin.common.delete')}
              </Button>
            )}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending
                ? t('admin.common.saving')
                : product
                  ? t('admin.common.save')
                  : t('admin.common.create')}
            </Button>
          </>
        }
      />
      <FormError error={error ?? remove.error} />

      <Section title={t('admin.common.translations')}>
        <div className="space-y-5">
          <label className="block text-sm">
            <span className="mb-2 block">{t('admin.products.category')}</span>
            <select
              required
              value={values.category}
              onChange={(event) =>
                set({ category: event.target.value ? Number(event.target.value) : '' })
              }
              aria-invalid={Boolean(fieldError(error, 'category'))}
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-foreground focus:border-accent focus:outline-none sm:w-80"
            >
              <option value="">{t('admin.products.chooseCategory')}</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_fr}
                </option>
              ))}
            </select>
          </label>
          <TranslatedFields
            base="name"
            label={t('admin.common.name')}
            values={values as never}
            requiredFrench
            error={error}
            onChange={(field, value) => set({ [field]: value } as Partial<ProductValues>)}
          />
          <TranslatedFields
            base="description"
            label={t('admin.common.description')}
            values={values as never}
            multiline
            error={error}
            onChange={(field, value) => set({ [field]: value } as Partial<ProductValues>)}
          />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('admin.common.price')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('admin.common.price')}
              type="number"
              min="0.01"
              step="0.01"
              dir="ltr"
              required
              value={values.price}
              error={fieldError(error, 'price')}
              onChange={(event) => set({ price: event.target.value })}
            />
            <TextField
              label={t('admin.products.salePrice')}
              hint={t('admin.products.salePriceHint')}
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={values.sale_price ?? ''}
              error={fieldError(error, 'sale_price')}
              onChange={(event) => set({ sale_price: event.target.value || null })}
            />
          </div>
        </Section>
        <Section title={t('admin.common.active')}>
          <div className="space-y-4">
            <Checkbox
              label={t('admin.common.active')}
              hint={t('admin.products.activeHint')}
              checked={values.is_active}
              onChange={(is_active) => set({ is_active })}
            />
            <Checkbox
              label={t('admin.products.available')}
              hint={t('admin.products.availableHint')}
              checked={values.is_available}
              onChange={(is_available) => set({ is_available })}
            />
            <Checkbox
              label={t('admin.products.featured')}
              checked={values.is_featured}
              onChange={(is_featured) => set({ is_featured })}
            />
            <TextField
              label={t('admin.products.displayOrder')}
              type="number"
              min="0"
              dir="ltr"
              value={values.display_order}
              onChange={(event) => set({ display_order: Number(event.target.value) })}
            />
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('admin.common.image')}>
          <ImageInput
            label={t('admin.common.image')}
            current={clearImage ? null : (product?.image ?? null)}
            file={imageFile}
            onSelect={(file) => {
              setImageFile(file)
              setClearImage(false)
            }}
            onClear={() => {
              setImageFile(null)
              setClearImage(true)
            }}
          />
        </Section>
        <Section title={t('admin.products.addonsTitle')}>
          {addons.data?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {addons.data.map((addon) => (
                <Checkbox
                  key={addon.id}
                  label={addon.name_fr}
                  checked={values.addons.includes(addon.id)}
                  onChange={(checked) =>
                    set({
                      addons: checked
                        ? [...values.addons, addon.id]
                        : values.addons.filter((addonId) => addonId !== addon.id),
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('admin.products.noAddons')}</p>
          )}
        </Section>
      </div>
    </form>
  )
}

function VariantsEditor({ product }: { product: AdminProduct }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const api = productsApi.variants(product.id)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'product', product.id] })
  const [rows, setRows] = useState<(Partial<AdminVariant> & { key: string })[]>(() =>
    product.variants.map((variant) => ({ ...variant, key: String(variant.id) })),
  )
  const saveRow = useMutation({
    mutationFn: ({ key: _key, id, ...row }: Partial<AdminVariant> & { key: string }) =>
      id ? api.update(id, row) : api.create(row),
    onSuccess: () => void refresh(),
  })
  const removeRow = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: () => void refresh(),
  })

  const update = (key: string, patch: Partial<AdminVariant>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  return (
    <Section
      title={t('admin.products.variantsTitle')}
      aside={
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                key: `new-${Date.now()}`,
                name_fr: '',
                name_ar: '',
                name_en: '',
                price_delta: '0.00',
                is_active: true,
                display_order: current.length,
              },
            ])
          }
        >
          <Plus aria-hidden className="size-4" />
          {t('admin.products.addVariant')}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted">{t('admin.products.variantsHint')}</p>
      <FormError error={saveRow.error ?? removeRow.error} />
      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid items-end gap-3 rounded-xl border border-border p-4 md:grid-cols-[repeat(3,minmax(0,1fr))_8rem_auto]"
          >
            <TextField
              label={`${t('admin.common.name')} (${t('admin.common.french')})`}
              value={row.name_fr ?? ''}
              onChange={(event) => update(row.key, { name_fr: event.target.value })}
            />
            <TextField
              label={`${t('admin.common.name')} (${t('admin.common.arabic')})`}
              dir="rtl"
              lang="ar"
              value={row.name_ar ?? ''}
              onChange={(event) => update(row.key, { name_ar: event.target.value })}
            />
            <TextField
              label={`${t('admin.common.name')} (${t('admin.common.english')})`}
              value={row.name_en ?? ''}
              onChange={(event) => update(row.key, { name_en: event.target.value })}
            />
            <TextField
              label={t('admin.products.priceDelta')}
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={row.price_delta ?? '0.00'}
              onChange={(event) => update(row.key, { price_delta: event.target.value })}
            />
            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                label={t('admin.common.active')}
                checked={row.is_active ?? true}
                onChange={(is_active) => update(row.key, { is_active })}
              />
            </div>
            <div className="flex gap-2 md:col-span-5">
              <Button
                size="sm"
                disabled={saveRow.isPending || !row.name_fr}
                onClick={() => saveRow.mutate(row)}
              >
                {t('admin.common.save')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (
                    !window.confirm(t('admin.common.deleteConfirm', { name: row.name_fr || '—' }))
                  )
                    return
                  if (row.id) removeRow.mutate(row.id)
                  setRows((current) => current.filter((item) => item.key !== row.key))
                }}
              >
                {t('admin.common.delete')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function GalleryEditor({ product }: { product: AdminProduct }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'product', product.id] })
  const add = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await productsApi.addPhoto(product.id, file)
    },
    onSettled: () => void refresh(),
  })
  const remove = useMutation({
    mutationFn: (id: number) => productsApi.removePhoto(product.id, id),
    onSuccess: () => void refresh(),
  })

  return (
    <Section
      title={t('admin.products.galleryTitle')}
      aside={
        <label className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-accent/60 px-4 text-sm text-accent hover:bg-accent/10">
          {t('admin.products.addPhotos')}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => event.target.files && add.mutate([...event.target.files])}
          />
        </label>
      }
    >
      <FormError error={add.error ?? remove.error} />
      {product.images.length ? (
        <ul className="flex flex-wrap gap-4">
          {product.images.map((photo) => (
            <li key={photo.id} className="relative">
              <img src={photo.image} alt="" className="size-28 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => remove.mutate(photo.id)}
                aria-label={t('admin.common.delete')}
                className="absolute end-1 top-1 flex size-8 items-center justify-center rounded-full bg-black/70 text-foreground hover:text-danger"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t('admin.common.empty')}</p>
      )}
    </Section>
  )
}
