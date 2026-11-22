/** Error envelope produced by the backend's custom DRF exception handler. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, unknown> | null
  }
}

/** DRF page-number pagination response. */
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  database: 'ok' | 'unavailable'
}
