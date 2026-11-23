import { UtensilsCrossed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'

import { CartLink } from '@/components/CartLink'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/Toaster'
import { useRestaurant } from '@/hooks/useCatalog'
import { cx } from '@/lib/cx'

function Wordmark() {
  const { t } = useTranslation()
  const { data: restaurant } = useRestaurant()
  return (
    <Link
      to="/"
      className="font-display text-xl leading-none tracking-wide whitespace-nowrap text-foreground sm:text-2xl"
    >
      {restaurant?.name ?? t('brand.name')}
    </Link>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'text-sm whitespace-nowrap transition-colors',
    isActive ? 'text-accent' : 'text-muted hover:text-foreground',
  )

export function PublicLayout() {
  const { t } = useTranslation()
  const { data: restaurant } = useRestaurant()
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-background"
      >
        {t('nav.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <nav
          aria-label={t('nav.mainNavigation')}
          className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6"
        >
          <Wordmark />
          <div className="ms-auto flex items-center gap-2 sm:gap-7">
            <NavLink to="/menu" className={navLinkClass}>
              {/* Icon on phones, text from the sm breakpoint; the label is always announced. */}
              <UtensilsCrossed aria-hidden className="size-5 sm:hidden" strokeWidth={1.5} />
              <span className="sr-only sm:not-sr-only">{t('nav.menu')}</span>
            </NavLink>
            <Link
              to={{ pathname: '/', hash: 'infos' }}
              className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline"
            >
              {t('nav.info')}
            </Link>
            <LanguageSwitcher />
            <ThemeToggle />
            <CartLink />
          </div>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t('footer.rights', { year, name: restaurant?.name ?? t('brand.name') })}</p>
          <p>{t('footer.credits')}</p>
        </div>
      </footer>

      <Toaster />
      <ScrollRestoration />
    </div>
  )
}
