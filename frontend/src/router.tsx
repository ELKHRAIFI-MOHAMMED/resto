import { createBrowserRouter, type RouteObject } from 'react-router'

import { PublicLayout } from '@/layouts/PublicLayout'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { HomePage } from '@/pages/HomePage'
import { MenuPage } from '@/pages/MenuPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OrderPage } from '@/pages/OrderPage'
import { ProductPage } from '@/pages/ProductPage'

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'menu/:slug', element: <ProductPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'order/:reference', element: <OrderPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // The dashboard is its own chunk: public visitors never download it.
    path: 'admin/*',
    lazy: async () => ({ Component: (await import('@/features/admin/AdminApp')).AdminApp }),
  },
]

export const router = createBrowserRouter(routes)
