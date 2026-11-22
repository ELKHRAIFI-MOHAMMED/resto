import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { vi } from 'vitest'

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

export function renderRoutes(routes: RouteObject[], initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const view = renderWithProviders(<RouterProvider router={router} />)
  return { ...view, router }
}

interface MockResponse {
  __mockResponse: true
  status: number
  body: unknown
}

/** A handler result with an explicit status (default responses are 200). */
export function respond(status: number, body: unknown): MockResponse {
  return { __mockResponse: true, status, body }
}

/** API error envelope, as produced by the backend exception handler. */
export function apiError(status: number, code: string, details: unknown = null): MockResponse {
  return respond(status, { error: { code, message: code, details } })
}

export interface MockRequest {
  url: URL
  method: string
  body: unknown
}

type Handler = unknown | ((request: MockRequest) => unknown)

const isMockResponse = (value: unknown): value is MockResponse =>
  typeof value === 'object' && value !== null && '__mockResponse' in value

/**
 * Stubs fetch with API responses keyed by path (query string ignored unless
 * the handler is a function). Unknown paths answer 404 with the error envelope.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const path = url.pathname.replace(/^\/api/, '')
    if (path in routes) {
      const handler = routes[path]
      const request: MockRequest = {
        url,
        method: (init?.method ?? 'GET').toUpperCase(),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      }
      const result = typeof handler === 'function' ? await handler(request) : handler
      const { status, body } = isMockResponse(result) ? result : { status: 200, body: result }
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(
      JSON.stringify({ error: { code: 'not_found', message: 'Not found.', details: null } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
