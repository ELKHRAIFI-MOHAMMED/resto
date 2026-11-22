/**
 * The administration dashboard, loaded as its own chunk on /admin/*.
 * Every page requires a staff session; the API enforces it too.
 */
import {
  ClipboardList,
  Cog,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MapPin,
  Tags,
  UtensilsCrossed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Toaster } from '@/components/Toaster'
import { cx } from '@/lib/cx'

import { useLogout } from './auth'
import { RequireStaff } from './RequireStaff'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeliveryPage } from './pages/DeliveryPage'
import { LoginPage } from './pages/LoginPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { AddonsPage } from './pages/AddonsPage'
import { ProductEditPage } from './pages/ProductEditPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'

const NAV = [
  { to: '/admin/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', key: 'orders', icon: ClipboardList },
  { to: '/admin/products', key: 'products', icon: UtensilsCrossed },
  { to: '/admin/categories', key: 'categories', icon: Tags },
  { to: '/admin/delivery', key: 'delivery', icon: MapPin },
  { to: '/admin/settings', key: 'settings', icon: Cog },
] as const

function AdminShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout()

  return (
    <RequireStaff>
      {(user) => (
        <div className="flex min-h-dvh flex-col lg:flex-row">
          <title>{`${t('admin.title')} | ${t('brand.name')}`}</title>
          <meta name="robots" content="noindex" />
          <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-e lg:border-b-0">
            <div className="flex items-center justify-between gap-4 px-5 py-5">
              <Link to="/admin/dashboard" className="font-display text-2xl">
                {t('brand.name')}
              </Link>
              <LanguageSwitcher />
            </div>
            <nav aria-label={t('admin.nav.label')} className="px-3 pb-3">
              <ul className="flex gap-1 overflow-x-auto lg:flex-col">
                {NAV.map(({ to, key, icon: Icon }) => (
                  <li key={key}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cx(
                          'flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm whitespace-nowrap transition-colors',
                          isActive
                            ? 'bg-accent/15 text-accent'
                            : 'text-muted hover:bg-surface-raised hover:text-foreground',
                        )
                      }
                    >
                      <Icon aria-hidden className="size-4" />
                      {t(`admin.nav.${key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2 text-sm lg:block lg:space-y-1 lg:py-4">
              <p className="hidden truncate px-3 text-xs text-muted lg:block" title={user.email}>
                {user.email}
              </p>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-muted hover:text-foreground"
              >
                <ExternalLink aria-hidden className="size-4" />
                {t('admin.nav.viewSite')}
              </a>
              <button
                type="button"
                onClick={() =>
                  logout.mutate(undefined, { onSettled: () => navigate('/admin/login') })
                }
                className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-muted hover:text-foreground lg:w-full"
              >
                <LogOut aria-hidden className="size-4 rtl:-scale-x-100" />
                {t('admin.nav.logout')}
              </button>
            </div>
          </aside>
          <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-12">
            <div className="mx-auto max-w-6xl">
              <Outlet context={user} />
            </div>
          </main>
          <Toaster />
        </div>
      )}
    </RequireStaff>
  )
}

export function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<AdminShell />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/addons" element={<AddonsPage />} />
        <Route path="products/new" element={<ProductEditPage />} />
        <Route path="products/:id" element={<ProductEditPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="delivery" element={<DeliveryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}
