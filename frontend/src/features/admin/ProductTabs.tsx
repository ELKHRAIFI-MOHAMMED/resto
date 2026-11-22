import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { cx } from '@/lib/cx'

export function ProductTabs() {
  const { t } = useTranslation()
  const tab = ({ isActive }: { isActive: boolean }) =>
    cx(
      'min-h-10 rounded-full px-4 py-2 text-sm',
      isActive ? 'bg-foreground text-background' : 'text-muted hover:bg-surface',
    )
  return (
    <nav className="mb-6 flex gap-1" aria-label={t('admin.nav.products')}>
      <NavLink to="/admin/products" end className={tab}>
        {t('admin.nav.products')}
      </NavLink>
      <NavLink to="/admin/products/addons" className={tab}>
        {t('admin.nav.addons')}
      </NavLink>
    </nav>
  )
}
