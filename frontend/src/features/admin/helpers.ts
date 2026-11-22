import { ApiError } from '@/services/api'

export const TABLE = 'w-full text-start text-sm'
export const TH = 'border-b border-border px-3 py-2 text-start text-xs font-medium text-muted'
export const TD = 'border-b border-border px-3 py-3 align-middle'

/** Field-level message from a DRF validation error envelope, if any. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || error.code !== 'validation_error') return undefined
  const messages = error.details?.[field]
  return Array.isArray(messages) ? String(messages[0]) : undefined
}
