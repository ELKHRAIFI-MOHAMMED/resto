import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useToastStore } from '@/store/toast'

export function Toaster() {
  const { t } = useTranslation()
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex w-full max-w-md animate-toast items-center gap-4 rounded-2xl border border-border bg-surface-raised px-5 py-3 shadow-lg shadow-black/40"
        >
          <p className="flex-1 text-sm">{toast.message}</p>
          {toast.action && (
            <Link
              to={toast.action.to}
              onClick={() => dismiss(toast.id)}
              className="text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {toast.action.label}
            </Link>
          )}
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="text-muted hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
