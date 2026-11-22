import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import type { StaffUser } from './api'
import { useStaffUser } from './auth'

/** Renders children for staff; sends anonymous visitors to the login page. */
export function RequireStaff({ children }: { children: (user: StaffUser) => ReactNode }) {
  const { data: user, isPending, isError } = useStaffUser()
  const location = useLocation()
  if (isPending) return <div className="min-h-dvh" aria-busy="true" />
  if (isError || !user) {
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
    )
  }
  return <>{children(user)}</>
}
