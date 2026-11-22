import { createBrowserRouter, type RouteObject } from 'react-router'

import { PublicLayout } from '@/layouts/PublicLayout'
import { CartPage } from '@/pages/CartPage'
import { HomePage } from '@/pages/HomePage'
import { MenuPage } from '@/pages/MenuPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductPage } from '@/pages/ProductPage'

/*
 * Checkout is added with the ordering flow (Phase 4) and the /admin/*
 * dashboard in Phase 5, lazily loaded so visitors never download it.
 */
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'menu/:slug', element: <ProductPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
