import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router'

import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useLanguage } from '@/hooks/useLanguage'
import { weekdayName } from '@/lib/hours'
import { useToastStore } from '@/store/toast'

import { settingsApi, type AdminOpeningHour, type AdminSettings, type StaffUser } from '../api'
import { fieldError } from '../helpers'
import { Checkbox, FormError, ImageInput, PageHeader, Section, TranslatedFields } from '../ui'

export function SettingsPage() {
  const { t } = useTranslation()
  const user = useOutletContext<StaffUser>()
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: settingsApi.get,
    enabled: user.is_owner,
  })
  const hours = useQuery({
    queryKey: ['admin', 'hours'],
    queryFn: settingsApi.hours,
    enabled: user.is_owner,
  })

  if (!user.is_owner) {
    return (
      <>
        <PageHeader title={t('admin.settings.title')} />
        <p className="text-muted">{t('admin.common.ownerOnly')}</p>
      </>
    )
  }
  if (settings.isPending || hours.isPending) return <Skeleton className="h-96" />
  if (settings.isError || hours.isError) {
    return (
      <ErrorState error={settings.error ?? hours.error} onRetry={() => void settings.refetch()} />
    )
  }

  return (
    <>
      <PageHeader title={t('admin.settings.title')} />
      <div className="space-y-6">
        <SettingsForm key={settings.dataUpdatedAt} initial={settings.data} />
        <HoursEditor key={hours.dataUpdatedAt} initial={hours.data} />
      </div>
    </>
  )
}

function SettingsForm({ initial }: { initial: AdminSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  const [values, setValues] = useState(initial)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [clearLogo, setClearLogo] = useState(false)
  const set = (patch: Partial<AdminSettings>) => setValues((current) => ({ ...current, ...patch }))

  const save = useMutation({
    mutationFn: async () => {
      const payload: Partial<AdminSettings> = { ...values }
      delete payload.logo // uploaded separately
      delete payload.currency // fixed (MAD)
      await settingsApi.update({
        ...payload,
        free_delivery_threshold: values.free_delivery_threshold || null,
      })
      if (logoFile) await settingsApi.uploadLogo(logoFile)
      else if (clearLogo) await settingsApi.clearLogo()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      void queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      showToast({ message: t('admin.common.saved') })
    },
  })
  const error = save.error
  const text = (field: keyof AdminSettings, label: string, extra: Record<string, unknown> = {}) => (
    <TextField
      label={label}
      value={(values[field] as string | null) ?? ''}
      error={fieldError(error, field)}
      onChange={(event) => set({ [field]: event.target.value } as Partial<AdminSettings>)}
      {...extra}
    />
  )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormError error={error} />
      <Section title={t('admin.settings.identity')}>
        <div className="space-y-5">
          {text('name', t('admin.settings.restaurantName'), { required: true })}
          <TranslatedFields
            base="description"
            label={t('admin.common.description')}
            values={values as never}
            multiline
            error={error}
            onChange={(field, value) => set({ [field]: value } as Partial<AdminSettings>)}
          />
          <ImageInput
            label={t('admin.settings.logo')}
            current={clearLogo ? null : initial.logo}
            file={logoFile}
            onSelect={(file) => {
              setLogoFile(file)
              setClearLogo(false)
            }}
            onClear={() => {
              setLogoFile(null)
              setClearLogo(true)
            }}
          />
        </div>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('admin.settings.contact')}>
          <div className="space-y-4">
            {text('whatsapp_number', t('admin.settings.whatsapp'), {
              dir: 'ltr',
              inputMode: 'tel',
              hint: t('admin.settings.whatsappHint'),
            })}
            {text('phone', t('admin.settings.phone'), { dir: 'ltr', inputMode: 'tel' })}
            {text('email', t('admin.settings.email'), { type: 'email', dir: 'ltr' })}
            {text('address', t('admin.settings.address'))}
            {text('city', t('admin.settings.city'))}
          </div>
        </Section>
        <Section title={t('admin.settings.ordering')}>
          <div className="space-y-4">
            <Checkbox
              label={t('admin.settings.acceptingOrders')}
              checked={values.is_accepting_orders}
              onChange={(is_accepting_orders) => set({ is_accepting_orders })}
            />
            <Checkbox
              label={t('admin.settings.deliveryEnabled')}
              checked={values.delivery_enabled}
              onChange={(delivery_enabled) => set({ delivery_enabled })}
            />
            <Checkbox
              label={t('admin.settings.pickupEnabled')}
              checked={values.pickup_enabled}
              onChange={(pickup_enabled) => set({ pickup_enabled })}
            />
            {text('minimum_order_amount', t('admin.settings.minimumOrder'), {
              type: 'number',
              min: 0,
              step: '0.01',
              dir: 'ltr',
            })}
            {text('free_delivery_threshold', t('admin.settings.freeDelivery'), {
              type: 'number',
              min: 0,
              step: '0.01',
              dir: 'ltr',
              hint: t('admin.settings.freeDeliveryHint'),
            })}
          </div>
        </Section>
      </div>
      <Section title={t('admin.settings.social')}>
        <div className="grid gap-4 md:grid-cols-2">
          {text('instagram_url', 'Instagram', { type: 'url', dir: 'ltr' })}
          {text('facebook_url', 'Facebook', { type: 'url', dir: 'ltr' })}
          {text('tiktok_url', 'TikTok', { type: 'url', dir: 'ltr' })}
          {text('google_maps_url', t('admin.settings.maps'), { type: 'url', dir: 'ltr' })}
        </div>
      </Section>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('admin.common.saving') : t('admin.common.save')}
        </Button>
      </div>
    </form>
  )
}

const short = (value: string | null) => (value ? value.slice(0, 5) : '')

function HoursEditor({ initial }: { initial: AdminOpeningHour[] }) {
  const { t } = useTranslation()
  const language = useLanguage()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  // One list of slots per weekday; an empty list means closed.
  const [week, setWeek] = useState(() =>
    Array.from({ length: 7 }, (_, weekday) =>
      initial
        .filter((slot) => slot.weekday === weekday && !slot.is_closed)
        .map((slot) => ({ opens_at: short(slot.opens_at), closes_at: short(slot.closes_at) })),
    ),
  )
  const save = useMutation({
    mutationFn: () =>
      settingsApi.saveHours(
        week.flatMap((slots, weekday): AdminOpeningHour[] =>
          slots.length
            ? slots.map((slot) => ({
                weekday,
                opens_at: slot.opens_at,
                closes_at: slot.closes_at,
                is_closed: false,
              }))
            : [{ weekday, opens_at: null, closes_at: null, is_closed: true }],
        ),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'hours'] })
      void queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      showToast({ message: t('admin.common.saved') })
    },
  })
  const update = (
    weekday: number,
    index: number,
    patch: Partial<{ opens_at: string; closes_at: string }>,
  ) =>
    setWeek((current) =>
      current.map((slots, day) =>
        day === weekday
          ? slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
          : slots,
      ),
    )

  return (
    <Section title={t('admin.settings.hours')}>
      <p className="mb-4 text-sm text-muted">{t('admin.settings.overnightHint')}</p>
      <FormError error={save.error} />
      <div className="divide-y divide-border">
        {week.map((slots, weekday) => (
          <div key={weekday} className="grid gap-3 py-4 md:grid-cols-[10rem_minmax(0,1fr)]">
            <p className="capitalize">{weekdayName(weekday, language)}</p>
            <div className="space-y-2">
              {slots.length === 0 && (
                <p className="text-sm text-muted">{t('admin.settings.closedDay')}</p>
              )}
              {slots.map((slot, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3">
                  <TextField
                    label={t('admin.settings.opensAt')}
                    type="time"
                    dir="ltr"
                    required
                    value={slot.opens_at}
                    onChange={(event) => update(weekday, index, { opens_at: event.target.value })}
                  />
                  <TextField
                    label={t('admin.settings.closesAt')}
                    type="time"
                    dir="ltr"
                    required
                    value={slot.closes_at}
                    onChange={(event) => update(weekday, index, { closes_at: event.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={t('admin.settings.removeSlot')}
                    onClick={() =>
                      setWeek((current) =>
                        current.map((day, i) =>
                          i === weekday ? day.filter((_, j) => j !== index) : day,
                        ),
                      )
                    }
                    className="mb-1 flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-danger"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setWeek((current) =>
                    current.map((day, i) =>
                      i === weekday ? [...day, { opens_at: '12:00', closes_at: '15:00' }] : day,
                    ),
                  )
                }
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Plus aria-hidden className="size-4" />
                {t('admin.settings.addSlot')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t('admin.common.saving') : t('admin.settings.saveHours')}
        </Button>
      </div>
    </Section>
  )
}
