import { useQuery } from '@tanstack/react-query'

import { getHealth, systemKeys } from '@/services/system'

export function useHealth() {
  return useQuery({
    queryKey: systemKeys.health,
    queryFn: ({ signal }) => getHealth(signal),
    retry: false,
    staleTime: 30_000,
  })
}
