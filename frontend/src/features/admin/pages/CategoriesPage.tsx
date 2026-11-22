import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TextField } from '@/components/ui/Field'
import { useToastStore } from '@/store/toast'

import { categoriesApi, type AdminCategory } from '../api'
import { CrudPage } from '../CrudPage'
import { Checkbox, ImageInput, TranslatedFields } from '../ui'

interface Values extends Omit<AdminCategory, 'id' | 'slug' | 'image' | 'product_count'> {
  imageFile: File | null
  clearImage: boolean
  currentImage: string | null
}

export function CategoriesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  const reorder = useMutation({
    mutationFn: categoriesApi.reorder,
    onSuccess: (categories) => {
      queryClient.setQueryData(['admin', 'categories'], categories)
      showToast({ message: t('admin.categories.reordered') })
    },
  })

  const move = (items: AdminCategory[], index: number, offset: -1 | 1) => {
    const ids = items.map((item) => item.id)
    const target = index + offset
    ;[ids[index], ids[target]] = [ids[target] as number, ids[index] as number]
    reorder.mutate(ids)
  }

  return (
    <CrudPage<AdminCategory, Values>
      title={t('admin.categories.title')}
      newLabel={t('admin.categories.new')}
      queryKey="categories"
      load={async () => (await categoriesApi.list({ page_size: 100 })).results}
      save={async ({ imageFile, clearImage, currentImage: _current, ...values }, item) => {
        const saved = item
          ? await categoriesApi.update(item.id, values)
          : await categoriesApi.create(values)
        if (imageFile) await categoriesApi.uploadImage(saved.id, imageFile)
        else if (clearImage && item) await categoriesApi.clearImage(saved.id)
      }}
      remove={(item) => categoriesApi.remove(item.id)}
      nameOf={(item) => item.name_fr}
      toValues={(item) => ({
        name_fr: item?.name_fr ?? '',
        name_ar: item?.name_ar ?? '',
        name_en: item?.name_en ?? '',
        description_fr: item?.description_fr ?? '',
        description_ar: item?.description_ar ?? '',
        description_en: item?.description_en ?? '',
        display_order: item?.display_order ?? 0,
        is_active: item?.is_active ?? true,
        imageFile: null,
        clearImage: false,
        currentImage: item?.image ?? null,
      })}
      columns={[
        {
          header: t('admin.common.order'),
          cell: (item, index, items) => (
            <span className="inline-flex gap-1">
              <button
                type="button"
                disabled={index === 0 || reorder.isPending}
                onClick={() => move(items, index, -1)}
                aria-label={`${t('admin.common.moveUp')} ${item.name_fr}`}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                disabled={index === items.length - 1 || reorder.isPending}
                onClick={() => move(items, index, 1)}
                aria-label={`${t('admin.common.moveDown')} ${item.name_fr}`}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
            </span>
          ),
        },
        { header: t('admin.common.name'), cell: (item) => item.name_fr },
        {
          header: t('admin.categories.products'),
          cell: (item) => <span className="tabular-nums">{item.product_count}</span>,
        },
        {
          header: t('admin.common.active'),
          cell: (item) => (item.is_active ? t('admin.common.yes') : t('admin.common.no')),
        },
      ]}
      renderForm={(values, set, error) => (
        <>
          <TranslatedFields
            base="name"
            label={t('admin.common.name')}
            values={values as never}
            requiredFrench
            error={error}
            onChange={(field, value) => set({ [field]: value } as Partial<Values>)}
          />
          <TranslatedFields
            base="description"
            label={t('admin.common.description')}
            values={values as never}
            multiline
            error={error}
            onChange={(field, value) => set({ [field]: value } as Partial<Values>)}
          />
          <ImageInput
            label={t('admin.common.image')}
            current={values.clearImage ? null : values.currentImage}
            file={values.imageFile}
            onSelect={(imageFile) => set({ imageFile, clearImage: false })}
            onClear={() => set({ imageFile: null, clearImage: true })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('admin.common.order')}
              type="number"
              min="0"
              dir="ltr"
              value={values.display_order}
              onChange={(event) => set({ display_order: Number(event.target.value) })}
            />
          </div>
          <Checkbox
            label={t('admin.common.active')}
            checked={values.is_active}
            onChange={(is_active) => set({ is_active })}
          />
        </>
      )}
    />
  )
}
