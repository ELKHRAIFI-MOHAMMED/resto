import { useTranslation } from 'react-i18next'

import { SystemStatus } from '@/components/SystemStatus'

/** Phase 1 placeholder: replaced by the full homepage in Phase 3. */
export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center sm:px-6">
      <title>{`${t('brand.name')} — ${t('brand.tagline')}`}</title>
      <meta name="description" content={t('home.metaDescription')} />

      <div className="space-y-4">
        <h1 className="font-display text-5xl text-accent sm:text-6xl">{t('brand.name')}</h1>
        <p className="text-lg text-foreground sm:text-xl">{t('brand.tagline')}</p>
        <p className="mx-auto max-w-prose text-sm text-muted">{t('home.foundationNotice')}</p>
      </div>

      <SystemStatus />
    </div>
  )
}
