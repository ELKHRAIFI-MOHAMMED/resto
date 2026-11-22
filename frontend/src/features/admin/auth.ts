import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError } from '@/services/api'

import { authApi, type StaffUser } from './api'

export const meKey = ['admin', 'me'] as const

/** The logged-in staff member, or null when there is no valid session. */
export function useStaffUser() {
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<StaffUser | null> => {
      try {
        return await authApi.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await authApi.csrf() // the login view is CSRF-protected
      return authApi.login(email, password)
    },
    onSuccess: (user) => queryClient.setQueryData(meKey, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ['admin'] })
      queryClient.setQueryData(meKey, null)
    },
  })
}
