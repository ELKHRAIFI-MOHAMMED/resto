import { useTranslation } from 'react-i18next'

import { Money } from '@/components/Price'
import { TextField } from '@/components/ui/Field'
import { parseMoney } from '@/lib/money'

import { addonsApi, type AdminAddon } from '../api'
import { CrudPage } from '../CrudPage'
import { ProductTabs } from '../ProductTabs'
import { fieldError } from '../helpers'
import { Checkbox, TranslatedFields } from '../ui'

type Values = Omit<AdminAddon, 'id'>

export function AddonsPage() {
  const { t } = useTranslation()
  return (
    <CrudPage<AdminAddon, Values>
      title={t('admin.addons.title')}
      newLabel={t('admin.addons.new')}
      queryKey="addons"
      intro={<ProductTabs />}
      load={async () => (await addonsApi.list({ page_size: 100 })).results}
      save={(values, item) => (item ? addonsApi.update(item.id, values) : addonsApi.create(values))}
      remove={(item) => addonsApi.remove(item.id)}
      nameOf={(item) => item.name_fr}
      toValues={(item) => ({
        name_fr: item?.name_fr ?? '',
        name_ar: item?.name_ar ?? '',
        name_en: item?.name_en ?? '',
        price: item?.price ?? '0.00',
        display_order: item?.display_order ?? 0,
        is_active: item?.is_active ?? true,
      })}
      columns={[
        { header: t('admin.common.name'), cell: (item) => item.name_fr },
        {
          header: t('admin.common.price'),
          cell: (item) => <Money cents={parseMoney(item.price)} />,
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
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('admin.common.price')}
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={values.price}
              error={fieldError(error, 'price')}
              onChange={(event) => set({ price: event.target.value })}
            />
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
