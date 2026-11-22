import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cx } from '@/lib/cx'
import { ApiError } from '@/services/api'

import { Button } from './Button'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  className?: string
}

/** Says what went wrong and offers the one useful action: trying again. */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation()
  const isNetwork = error instanceof ApiError && error.code === 'network_error'

  return (
    <div role="alert" className={cx('flex flex-col items-start gap-4 py-8', className)}>
      <p className="text-muted">{isNetwork ? t('common.networkError') : t('common.loadError')}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-start gap-3 py-12', className)}>
      <p className="font-display text-3xl text-foreground">{title}</p>
      {hint && <p className="max-w-prose text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded bg-surface', className)} />
}
