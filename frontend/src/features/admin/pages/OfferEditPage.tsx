import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useToastStore } from '@/store/toast'

import {
  allProducts,
  categoriesApi,
  offersApi,
  type AdminOffer,
  type AdminOfferGroup,
  type AdminProduct,
} from '../api'
import { fieldError } from '../helpers'
import { Checkbox, FormError, ImageInput, PageHeader, Section, TranslatedFields } from '../ui'

const MAX_GROUP_QUANTITY = 20

type GroupRow = AdminOfferGroup & { key: string }

interface OfferValues {
  name_fr: string
  name_ar: string
  name_en: string
  description_fr: string
  description_ar: string
  description_en: string
  price: string
  is_active: boolean
  starts_on: string
  ends_on: string
  display_order: number
}

function initialValues(offer: AdminOffer | undefined): OfferValues {
  return {
    name_fr: offer?.name_fr ?? '',
    name_ar: offer?.name_ar ?? '',
    name_en: offer?.name_en ?? '',
    description_fr: offer?.description_fr ?? '',
    description_ar: offer?.description_ar ?? '',
    description_en: offer?.description_en ?? '',
    price: offer?.price ?? '',
    is_active: offer?.is_active ?? true,
    starts_on: offer?.starts_on ?? '',
    ends_on: offer?.ends_on ?? '',
    display_order: offer?.display_order ?? 0,
  }
}

let rowCounter = 0
const newRow = (): GroupRow => ({
  key: `new-${(rowCounter += 1)}`,
  name_fr: '',
  name_ar: '',
  name_en: '',
  quantity: 1,
  products: [],
})

const isGroupValid = (group: GroupRow) =>
  group.name_fr.trim() !== '' &&
  group.quantity >= 1 &&
  group.quantity <= MAX_GROUP_QUANTITY &&
  group.products.length > 0

export function OfferEditPage() {
  const { id } = useParams()
  const offerId = id ? Number(id) : null
  const { t } = useTranslation()
  const offer = useQuery({
    queryKey: ['admin', 'offer', offerId],
    queryFn: () => offersApi.get(offerId as number),
    enabled: offerId !== null,
  })

  if (offerId !== null && offer.isPending) return <Skeleton className="h-96" />
  if (offer.isError) return <ErrorState error={offer.error} onRetry={() => void offer.refetch()} />

  return (
    <>
      <Link
        to="/admin/offers"
        className="mb-4 inline-block text-sm text-muted hover:text-foreground"
      >
        {t('admin.common.back')}
      </Link>
      <OfferForm key={offer.data?.updated_at ?? 'new'} offer={offer.data} />
    </>
  )
}

function OfferForm({ offer }: { offer: AdminOffer | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  const [values, setValues] = useState<OfferValues>(() => initialValues(offer))
  const [groups, setGroups] = useState<GroupRow[]>(() =>
    offer?.groups.length
      ? offer.groups.map((group) => ({ ...group, key: String(group.id) }))
      : [newRow()],
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [clearImage, setClearImage] = useState(false)
  const [showGroupErrors, setShowGroupErrors] = useState(false)
  const set = (patch: Partial<OfferValues>) => setValues((current) => ({ ...current, ...patch }))
  const setGroup = (key: string, patch: Partial<GroupRow>) =>
    setGroups((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const products = useQuery({ queryKey: ['admin', 'products', 'all'], queryFn: allProducts })
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => (await categoriesApi.list({ page_size: 100 })).results,
  })
  // Products grouped by category, in menu order, for the dish checklists.
  const sections = useMemo(
    () =>
      (categories.data ?? [])
        .map((category) => ({
          category,
          products: (products.data ?? []).filter((product) => product.category === category.id),
        }))
        .filter((section) => section.products.length > 0),
    [categories.data, products.data],
  )

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...values,
        starts_on: values.starts_on || null,
        ends_on: values.ends_on || null,
        groups: groups.map(({ key: _key, id: _id, ...group }, position) => ({
          ...group,
          display_order: position,
        })),
      }
      const saved = offer
        ? await offersApi.update(offer.id, payload)
        : await offersApi.create(payload)
      if (imageFile) await offersApi.uploadImage(saved.id, imageFile)
      else if (clearImage && offer) await offersApi.clearImage(saved.id)
      return saved
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offer'] })
      showToast({ message: offer ? t('admin.common.saved') : t('admin.offers.created') })
      if (!offer) navigate(`/admin/offers/${saved.id}`, { replace: true })
    },
  })
  const remove = useMutation({
    mutationFn: () => offersApi.remove((offer as AdminOffer).id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] })
      showToast({ message: t('admin.common.deleted', { name: offer?.name_fr }) })
      navigate('/admin/offers')
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!groups.length || !groups.every(isGroupValid)) {
      setShowGroupErrors(true)
      return
    }
    setShowGroupErrors(false)
    save.mutate()
  }
  const error = save.error

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PageHeader
        title={offer ? offer.name_fr : t('admin.offers.new')}
        actions={
          <>
            {offer && (
              <Button
                variant="ghost"
                onClick={() =>
                  window.confirm(t('admin.common.deleteConfirm', { name: offer.name_fr })) &&
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
                : offer
                  ? t('admin.common.save')
                  : t('admin.common.create')}
            </Button>
          </>
        }
      />
      <FormError error={error ?? remove.error} />

      <Section title={t('admin.common.translations')}>
        <div className="space-y-5">
          <TranslatedFields
            base="name"
            label={t('admin.common.name')}
            values={values as never}
            requiredFrench
            error={error}
            onChange={(field, value) => set({ [field]: value } as Partial<OfferValues>)}
          />
          <TranslatedFields
            base="description"
            label={t('admin.common.description')}
            values={values as never}
            multiline
            error={error}
            onChange={(field, value) => set({ [field]: value } as Partial<OfferValues>)}
          />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('admin.offers.priceAndPeriod')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('admin.offers.price')}
              hint={t('admin.offers.priceHint')}
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
              label={t('admin.products.displayOrder')}
              type="number"
              min="0"
              dir="ltr"
              value={values.display_order}
              onChange={(event) => set({ display_order: Number(event.target.value) })}
            />
            <TextField
              label={t('admin.offers.startsOn')}
              hint={t('admin.offers.periodHint')}
              type="date"
              dir="ltr"
              value={values.starts_on}
              error={fieldError(error, 'starts_on')}
              onChange={(event) => set({ starts_on: event.target.value })}
            />
            <TextField
              label={t('admin.offers.endsOn')}
              type="date"
              dir="ltr"
              min={values.starts_on || undefined}
              value={values.ends_on}
              error={fieldError(error, 'ends_on')}
              onChange={(event) => set({ ends_on: event.target.value })}
            />
          </div>
          <div className="mt-5">
            <Checkbox
              label={t('admin.common.active')}
              hint={t('admin.offers.activeHint')}
              checked={values.is_active}
              onChange={(is_active) => set({ is_active })}
            />
          </div>
        </Section>
        <Section title={t('admin.common.image')}>
          <ImageInput
            label={t('admin.common.image')}
            current={clearImage ? null : (offer?.image ?? null)}
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
      </div>

      <Section
        title={t('admin.offers.groupsTitle')}
        aside={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setGroups((current) => [...current, newRow()])}
          >
            <Plus aria-hidden className="size-4" />
            {t('admin.offers.addGroup')}
          </Button>
        }
      >
        <p className="mb-5 max-w-prose text-sm text-muted">{t('admin.offers.groupsHint')}</p>
        {showGroupErrors && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-danger/50 px-4 py-3 text-sm text-danger"
          >
            {groups.length ? t('admin.offers.groupInvalid') : t('admin.offers.groupRequired')}
          </p>
        )}
        {products.isError || categories.isError ? (
          <ErrorState
            error={products.error ?? categories.error}
            onRetry={() => {
              void products.refetch()
              void categories.refetch()
            }}
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group, index) => (
              <GroupEditor
                key={group.key}
                index={index}
                group={group}
                sections={sections}
                invalid={showGroupErrors && !isGroupValid(group)}
                onChange={(patch) => setGroup(group.key, patch)}
                onRemove={() =>
                  setGroups((current) => current.filter((row) => row.key !== group.key))
                }
              />
            ))}
          </div>
        )}
      </Section>
    </form>
  )
}

function GroupEditor({
  index,
  group,
  sections,
  invalid,
  onChange,
  onRemove,
}: {
  index: number
  group: GroupRow
  sections: { category: { id: number; name_fr: string }; products: AdminProduct[] }[]
  invalid: boolean
  onChange: (patch: Partial<GroupRow>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const toggle = (productId: number, checked: boolean) =>
    onChange({
      products: checked
        ? [...group.products, productId]
        : group.products.filter((idValue) => idValue !== productId),
    })
  const title = group.name_fr || t('admin.offers.groupNumber', { number: index + 1 })

  return (
    <fieldset
      aria-invalid={invalid}
      className={`space-y-5 rounded-xl border p-4 sm:p-5 ${invalid ? 'border-danger/60' : 'border-border'}`}
    >
      <legend className="px-2 text-sm font-medium">{title}</legend>
      <div className="flex flex-wrap items-end gap-4">
        <div className="grow">
          <TranslatedFields
            base="name"
            label={t('admin.offers.groupName')}
            values={group as never}
            requiredFrench
            onChange={(field, value) => onChange({ [field]: value } as Partial<GroupRow>)}
          />
        </div>
        <TextField
          label={t('admin.offers.quantity')}
          type="number"
          min="1"
          max={MAX_GROUP_QUANTITY}
          dir="ltr"
          required
          className="w-40"
          value={group.quantity}
          onChange={(event) => onChange({ quantity: Number(event.target.value) })}
        />
      </div>

      <div>
        <p className="mb-3 text-sm">
          {t('admin.offers.dishes')}{' '}
          <span className="text-muted">
            {t('admin.offers.selectedCount', { count: group.products.length })}
          </span>
        </p>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sections.map(({ category, products }) => {
            const ids = products.map((product) => product.id)
            const allChecked = ids.every((idValue) => group.products.includes(idValue))
            return (
              <div key={category.id} className="rounded-lg bg-background/40 p-3">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">
                    {category.name_fr}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        products: allChecked
                          ? group.products.filter((idValue) => !ids.includes(idValue))
                          : [...new Set([...group.products, ...ids])],
                      })
                    }
                    aria-label={
                      allChecked
                        ? t('admin.offers.clearCategory', { category: category.name_fr })
                        : t('admin.offers.selectCategory', { category: category.name_fr })
                    }
                    className="text-xs text-accent underline-offset-4 hover:underline"
                  >
                    {allChecked ? t('admin.offers.clearAll') : t('admin.offers.selectAll')}
                  </button>
                </div>
                <div className="space-y-2">
                  {products.map((product) => (
                    <Checkbox
                      key={product.id}
                      label={
                        product.is_active
                          ? product.name_fr
                          : `${product.name_fr} (${t('admin.common.inactive')})`
                      }
                      checked={group.products.includes(product.id)}
                      onChange={(checked) => toggle(product.id, checked)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={onRemove}>
        <Trash2 aria-hidden className="size-4" />
        {t('admin.offers.removeGroup')}
      </Button>
    </fieldset>
  )
}
