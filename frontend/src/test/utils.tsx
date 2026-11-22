import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

export function renderRoutes(routes: RouteObject[], initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return renderWithProviders(<RouterProvider router={router} />)
}
