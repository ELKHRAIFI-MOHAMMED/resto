import { useTranslation } from 'react-i18next'

import { Money } from '@/components/Price'
import { TextField } from '@/components/ui/Field'
import { parseMoney } from '@/lib/money'

import { zonesApi, type AdminZone } from '../api'
import { CrudPage } from '../CrudPage'
import { fieldError } from '../helpers'
import { Checkbox, TranslatedFields } from '../ui'

type Values = Omit<AdminZone, 'id'>

export function DeliveryPage() {
  const { t } = useTranslation()
  return (
    <CrudPage<AdminZone, Values>
      title={t('admin.delivery.title')}
      newLabel={t('admin.delivery.new')}
      queryKey="zones"
      load={async () => (await zonesApi.list({ page_size: 100 })).results}
      save={(values, item) => (item ? zonesApi.update(item.id, values) : zonesApi.create(values))}
      remove={(item) => zonesApi.remove(item.id)}
      nameOf={(item) => item.name_fr}
      toValues={(item) => ({
        name_fr: item?.name_fr ?? '',
        name_ar: item?.name_ar ?? '',
        name_en: item?.name_en ?? '',
        delivery_fee: item?.delivery_fee ?? '0.00',
        minimum_order_amount: item?.minimum_order_amount ?? '0.00',
        display_order: item?.display_order ?? 0,
        is_active: item?.is_active ?? true,
      })}
      columns={[
        { header: t('admin.common.name'), cell: (item) => item.name_fr },
        {
          header: t('admin.delivery.fee'),
          cell: (item) => <Money cents={parseMoney(item.delivery_fee)} />,
        },
        {
          header: t('admin.delivery.minimum'),
          cell: (item) => <Money cents={parseMoney(item.minimum_order_amount)} />,
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
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label={t('admin.delivery.fee')}
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={values.delivery_fee}
              error={fieldError(error, 'delivery_fee')}
              onChange={(event) => set({ delivery_fee: event.target.value })}
            />
            <TextField
              label={t('admin.delivery.minimum')}
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={values.minimum_order_amount}
              error={fieldError(error, 'minimum_order_amount')}
              onChange={(event) => set({ minimum_order_amount: event.target.value })}
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
