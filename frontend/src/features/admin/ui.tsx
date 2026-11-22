/** Small building blocks shared by the administration pages. */
import { X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { cx } from '@/lib/cx'
import { ApiError } from '@/services/api'

import { fieldError } from './helpers'

import type { OrderStatus } from './api'

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-display text-4xl">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}

export function Section({
  title,
  children,
  aside,
}: {
  title: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function FormError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return null
  const message =
    error instanceof ApiError && error.code === 'protected'
      ? t('admin.common.protected')
      : error instanceof ApiError && error.code === 'network_error'
        ? t('common.networkError')
        : t('admin.common.error')
  return (
    <p role="alert" className="rounded-xl border border-danger/50 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  )
}

interface TranslatedFieldsProps {
  base: string
  label: string
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  error?: unknown
  multiline?: boolean
  requiredFrench?: boolean
}

/** French (required), Arabic (right-to-left) and English inputs for one translated field. */
export function TranslatedFields({
  base,
  label,
  values,
  onChange,
  error,
  multiline = false,
  requiredFrench = false,
}: TranslatedFieldsProps) {
  const { t } = useTranslation()
  const languages = [
    { code: 'fr', name: t('admin.common.french'), dir: 'ltr' as const },
    { code: 'ar', name: t('admin.common.arabic'), dir: 'rtl' as const },
    { code: 'en', name: t('admin.common.english'), dir: 'ltr' as const },
  ]
  return (
    <fieldset className="grid gap-4 md:grid-cols-3">
      <legend className="sr-only">{label}</legend>
      {languages.map(({ code, name, dir }) => {
        const field = `${base}_${code}`
        const props = {
          label: `${label} (${name})`,
          value: values[field] ?? '',
          dir,
          lang: code,
          error: fieldError(error, field),
          required: requiredFrench && code === 'fr',
        }
        return multiline ? (
          <TextAreaField
            key={field}
            rows={3}
            {...props}
            onChange={(event) => onChange(field, event.target.value)}
          />
        ) : (
          <TextField
            key={field}
            {...props}
            onChange={(event) => onChange(field, event.target.value)}
          />
        )
      })}
    </fieldset>
  )
}

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-[var(--color-accent)]"
      />
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  )
}

export function ImageInput({
  label,
  current,
  file,
  onSelect,
  onClear,
}: {
  label: string
  current: string | null
  file: File | null
  onSelect: (file: File | null) => void
  onClear?: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const localPreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    },
    [localPreview],
  )
  const preview = localPreview ?? current

  return (
    <div>
      <p className="mb-2 text-sm">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="size-24 overflow-hidden rounded-xl border border-border bg-background">
          {preview && <img src={preview} alt="" className="size-full object-cover" />}
        </div>
        <div className="space-y-2">
          <label
            htmlFor={id}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-accent/60 px-4 text-sm text-accent hover:bg-accent/10"
          >
            {t('admin.common.chooseImage')}
          </label>
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
          />
          {(current || file) && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="block text-sm text-muted hover:text-danger"
            >
              {t('admin.common.removeImage')}
            </button>
          )}
          <p className="text-xs text-muted">{t('admin.common.imageHint')}</p>
        </div>
      </div>
    </div>
  )
}

export function Pagination({
  page,
  count,
  pageSize,
  onPage,
}: {
  page: number
  count: number
  pageSize: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="mt-6 flex items-center justify-between gap-4 text-sm" aria-label="pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('admin.common.previous')}
      </Button>
      <span className="text-muted">{t('admin.common.page', { page, pages })}</span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        {t('admin.common.next')}
      </Button>
    </nav>
  )
}

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'border-accent/60 text-accent',
  confirmed: 'border-open/60 text-open',
  preparing: 'border-open/60 text-open',
  ready: 'border-open/60 text-open',
  out_for_delivery: 'border-open/60 text-open',
  completed: 'border-border text-muted',
  cancelled: 'border-danger/50 text-danger',
}

/** Status shown as text plus colour, never colour alone. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={cx(
        'inline-flex rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap',
        STATUS_TONE[status],
      )}
    >
      {t(`admin.status.${status}`)}
    </span>
  )
}

/** Accessible modal: focus moves in, Escape and the close button dismiss it. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-3xl rounded-2xl border border-border bg-surface p-6"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-display text-3xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-foreground"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
