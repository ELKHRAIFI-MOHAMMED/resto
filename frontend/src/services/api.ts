/**
 * Thin fetch wrapper for the Django REST API.
 *
 * - Sends cookies (session auth for the admin dashboard).
 * - Adds the CSRF token to unsafe requests, as Django requires.
 * - Sends Accept-Language so translated content and validation messages
 *   come back in the active UI language.
 * - Normalises every failure into an `ApiError`.
 */
import i18n from '@/i18n'
import type { ApiErrorBody } from '@/types/api'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
const CSRF_COOKIE_NAME = 'csrftoken'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown> | null

  constructor(status: number, code: string, message: string, details: ApiError['details'] = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function readCookie(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const cookie = part.trim()
    if (cookie.startsWith(prefix)) return decodeURIComponent(cookie.slice(prefix.length))
  }
  return null
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  )
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Plain objects are JSON-encoded; FormData is sent as multipart. */
  body?: unknown
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers: extraHeaders, ...init } = options
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(extraHeaders)
  headers.set('Accept', 'application/json')
  headers.set('Accept-Language', i18n.language)

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body // the browser sets the multipart boundary
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME)
    if (csrfToken) headers.set('X-CSRFToken', csrfToken)
  }

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  let response: Response
  try {
    response = await fetch(url, { ...init, method, headers, body: payload, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'network_error', 'Network request failed')
  }

  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (isApiErrorBody(data)) {
      const { code, message, details } = data.error
      throw new ApiError(response.status, code, message, details)
    }
    throw new ApiError(response.status, 'http_error', response.statusText || 'Request failed')
  }

  return data as T
}
