import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { TextField } from '@/components/ui/Field'
import { cx } from '@/lib/cx'

import { couriersApi, zonesApi, type AdminCourier } from '../api'
import { CrudPage } from '../CrudPage'
import { fieldError } from '../helpers'
import { Checkbox } from '../ui'

interface Values {
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  zones: number[]
  is_on_duty: boolean
  is_active: boolean
}

export function CouriersPage() {
  const { t } = useTranslation()
  const zones = useQuery({
    queryKey: ['admin', 'zones'],
    queryFn: async () => (await zonesApi.list({ page_size: 100 })).results,
  })
  const zoneName = (id: number) => zones.data?.find((zone) => zone.id === id)?.name_fr ?? `#${id}`

  return (
    <CrudPage<AdminCourier, Values>
      title={t('admin.couriers.title')}
      newLabel={t('admin.couriers.new')}
      queryKey="couriers"
      load={couriersApi.list}
      save={({ password, ...values }, item) => {
        const payload = password ? { ...values, password } : values
        return item ? couriersApi.update(item.id, payload) : couriersApi.create(payload)
      }}
      remove={(item) => couriersApi.remove(item.id)}
      nameOf={(item) => [item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
      toValues={(item) => ({
        first_name: item?.first_name ?? '',
        last_name: item?.last_name ?? '',
        email: item?.email ?? '',
        phone: item?.phone ?? '',
        password: '',
        zones: item?.zones ?? [],
        is_on_duty: item?.is_on_duty ?? true,
        is_active: item?.is_active ?? true,
      })}
      columns={[
        {
          header: t('admin.common.name'),
          cell: (item) => (
            <>
              <span className="font-medium">
                {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
              </span>
              <span className="block text-xs text-muted" dir="ltr">
                {item.email}
              </span>
            </>
          ),
        },
        {
          header: t('admin.couriers.phone'),
          cell: (item) => <bdi dir="ltr">{item.phone}</bdi>,
        },
        {
          header: t('admin.couriers.zones'),
          cell: (item) =>
            item.zones.length ? (
              item.zones.map(zoneName).join(', ')
            ) : (
              <span className="text-muted">{t('admin.couriers.noZones')}</span>
            ),
        },
        {
          header: t('admin.couriers.onDuty'),
          cell: (item) => (
            <span
              className={cx(
                'inline-flex items-center gap-2 text-sm',
                item.is_on_duty ? 'text-open' : 'text-muted',
              )}
            >
              <span
                aria-hidden
                className={cx('size-2 rounded-full', item.is_on_duty ? 'bg-open' : 'bg-muted')}
              />
              {item.is_on_duty ? t('admin.couriers.onDuty') : t('admin.couriers.offDuty')}
            </span>
          ),
        },
        {
          header: t('admin.couriers.activeOrders'),
          cell: (item) => <span className="tabular-nums">{item.active_orders}</span>,
        },
        {
          header: t('admin.couriers.account'),
          cell: (item) => (item.is_active ? t('admin.common.yes') : t('admin.common.no')),
        },
      ]}
      renderForm={(values, set, error) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('admin.couriers.firstName')}
              value={values.first_name}
              autoComplete="off"
              onChange={(event) => set({ first_name: event.target.value })}
            />
            <TextField
              label={t('admin.couriers.lastName')}
              value={values.last_name}
              autoComplete="off"
              onChange={(event) => set({ last_name: event.target.value })}
            />
            <TextField
              label={t('admin.couriers.email')}
              type="email"
              dir="ltr"
              required
              autoComplete="off"
              value={values.email}
              error={fieldError(error, 'email')}
              onChange={(event) => set({ email: event.target.value })}
            />
            <TextField
              label={t('admin.couriers.phone')}
              type="tel"
              dir="ltr"
              value={values.phone}
              error={fieldError(error, 'phone')}
              onChange={(event) => set({ phone: event.target.value })}
            />
            <TextField
              label={t('admin.couriers.password')}
              type="password"
              dir="ltr"
              autoComplete="new-password"
              hint={t('admin.couriers.passwordHint')}
              value={values.password}
              error={fieldError(error, 'password')}
              onChange={(event) => set({ password: event.target.value })}
            />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm">{t('admin.couriers.zones')}</legend>
            <p className="mb-3 text-xs text-muted">{t('admin.couriers.zonesHint')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {zones.data?.map((zone) => (
                <Checkbox
                  key={zone.id}
                  label={zone.name_fr}
                  checked={values.zones.includes(zone.id)}
                  onChange={(checked) =>
                    set({
                      zones: checked
                        ? [...values.zones, zone.id]
                        : values.zones.filter((id) => id !== zone.id),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-6">
            <Checkbox
              label={t('admin.couriers.onDuty')}
              checked={values.is_on_duty}
              onChange={(is_on_duty) => set({ is_on_duty })}
            />
            <Checkbox
              label={t('admin.couriers.account')}
              checked={values.is_active}
              onChange={(is_active) => set({ is_active })}
            />
          </div>
        </>
      )}
    />
  )
}
