import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <title>{`${t('notFound.title')} — ${t('brand.name')}`}</title>
      <meta name="robots" content="noindex" />
      <p className="font-display text-6xl text-accent">404</p>
      <h1 className="text-2xl">{t('notFound.title')}</h1>
      <p className="text-muted">{t('notFound.description')}</p>
      <Link to="/" className="text-accent underline-offset-4 hover:underline">
        {t('notFound.backHome')}
      </Link>
    </div>
  )
}
