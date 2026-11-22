import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function PublicLayout() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <nav
          aria-label={t('nav.mainNavigation')}
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"
        >
          <Link to="/" className="font-display text-xl tracking-wide text-accent">
            {t('brand.name')}
          </Link>
          <LanguageSwitcher />
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
        {t('footer.rights', { year, name: t('brand.name') })}
      </footer>
    </div>
  )
}
