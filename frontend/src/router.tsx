import { createBrowserRouter, type RouteObject } from 'react-router'

import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/*
 * Public routes (/menu, /cart, /checkout, …) are added in Phases 3–4 and the
 * /admin/* dashboard in Phase 5, each lazily loaded.
 */
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
