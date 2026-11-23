import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ApiError } from '@/services/api'

import { useLogin, useStaffUser } from '../auth'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: user } = useStaffUser()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const from = (location.state as { from?: string } | null)?.from ?? '/admin/dashboard'
  if (user) return <Navigate to={user.is_courier ? '/livreur' : from} replace />

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate(
      { email, password },
      // Couriers land in their delivery app, staff in the dashboard.
      {
        onSuccess: (account) => navigate(account.is_courier ? '/livreur' : from, { replace: true }),
      },
    )
  }

  const error = login.error
  const message = !error
    ? null
    : error instanceof ApiError && error.code === 'throttled'
      ? t('admin.login.throttled')
      : error instanceof ApiError && error.status === 400
        ? t('admin.login.invalid')
        : t('common.networkError')

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <title>{`${t('admin.login.title')} | ${t('brand.name')}`}</title>
      <meta name="robots" content="noindex" />
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center justify-between">
          <p className="font-display text-3xl">{t('brand.name')}</p>
          <LanguageSwitcher />
        </div>
        <h1 className="font-display text-5xl">{t('admin.login.title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('admin.login.subtitle')}</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <TextField
            label={t('admin.login.email')}
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label={t('admin.login.password')}
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {message && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? t('admin.login.submitting') : t('admin.login.submit')}
          </Button>
        </form>
      </div>
    </main>
  )
}
