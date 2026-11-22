import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useHealth } from '@/hooks/useHealth'

type State = 'checking' | 'ok' | 'unavailable'

function StatusRow({ label, state }: { label: string; state: State }) {
  const { t } = useTranslation()
  const Icon = state === 'checking' ? LoaderCircle : state === 'ok' ? CircleCheck : CircleX
  const tone =
    state === 'ok' ? 'text-emerald-400' : state === 'unavailable' ? 'text-red-400' : 'text-muted'

  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`flex items-center gap-2 ${tone}`}>
        <Icon aria-hidden className={`size-4 ${state === 'checking' ? 'animate-spin' : ''}`} />
        {t(`status.${state}`)}
      </dd>
    </div>
  )
}

/** Development aid: confirms the frontend can reach Django and PostgreSQL. */
export function SystemStatus() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch, isFetching } = useHealth()

  const api: State = isPending ? 'checking' : data ? 'ok' : 'unavailable'
  const database: State = isPending ? 'checking' : data?.database === 'ok' ? 'ok' : 'unavailable'

  return (
    <section
      aria-labelledby="system-status-title"
      aria-busy={isFetching}
      className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 text-start"
    >
      <h2 id="system-status-title" className="mb-2 text-sm font-semibold tracking-wide uppercase">
        {t('status.title')}
      </h2>
      <dl className="divide-y divide-border text-sm">
        <StatusRow label={t('status.api')} state={api} />
        <StatusRow label={t('status.database')} state={database} />
      </dl>
      {isError && (
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 text-sm text-accent underline-offset-4 hover:underline"
        >
          {t('status.retry')}
        </button>
      )}
    </section>
  )
}
