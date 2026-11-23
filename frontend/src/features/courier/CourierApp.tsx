/**
 * Courier app (/livreur/*), its own lazily loaded chunk. Mobile-first:
 * a courier sees only their deliveries and moves them forward.
 */
import '@/features/admin/i18n' // shared login page strings
import './i18n'

import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/Toaster'
import { useLogout, useStaffUser } from '@/features/admin/auth'
import { LoginPage } from '@/features/admin/pages/LoginPage'

import { CourierHomePage } from './pages/CourierHomePage'
import { CourierOrderPage } from './pages/CourierOrderPage'

function CourierShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useLogout()
  const { data: user, isPending } = useStaffUser()

  if (isPending) return <div className="min-h-dvh" aria-busy="true" />
  if (!user) {
    return <Navigate to="/livreur/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <title>{`${t('courier.title')} | ${t('brand.name')}`}</title>
      <meta name="robots" content="noindex" />
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Link to="/livreur" className="me-auto font-display text-xl">
            {t('brand.name')}
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            type="button"
            aria-label={t('admin.nav.logout')}
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => navigate('/livreur/login') })
            }
            className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
          >
            <LogOut aria-hidden className="size-[1.125rem] rtl:-scale-x-100" />
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        {user.is_courier ? (
          <Outlet />
        ) : (
          <div className="space-y-4 py-10">
            <p className="text-lg">{t('courier.notCourier')}</p>
            <Link to="/admin" className="text-accent hover:underline">
              {t('courier.toAdmin')}
            </Link>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  )
}

export function CourierApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<CourierShell />}>
        <Route index element={<CourierHomePage />} />
        <Route path="orders/:id" element={<CourierOrderPage />} />
        <Route path="*" element={<Navigate to="/livreur" replace />} />
      </Route>
    </Routes>
  )
}
