import { apiFetch } from '@/services/api'
import type { HealthResponse } from '@/types/api'

export const systemKeys = {
  health: ['system', 'health'] as const,
}

export function getHealth(signal?: AbortSignal) {
  return apiFetch<HealthResponse>('/health/', { signal })
}
