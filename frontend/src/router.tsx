import { createBrowserRouter, type RouteObject } from 'react-router'

import { PublicLayout } from '@/layouts/PublicLayout'
import { CartPage } from '@/pages/CartPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      // Home, cart and 404 stay in the main bundle; other pages load on demand.
      {
        path: 'menu',
        lazy: async () => ({ Component: (await import('@/pages/MenuPage')).MenuPage }),
      },
      {
        path: 'menu/:slug',
        lazy: async () => ({ Component: (await import('@/pages/ProductPage')).ProductPage }),
      },
      {
        path: 'offres/:slug',
        lazy: async () => ({ Component: (await import('@/pages/OfferPage')).OfferPage }),
      },
      { path: 'cart', element: <CartPage /> },
      {
        path: 'checkout',
        lazy: async () => ({ Component: (await import('@/pages/CheckoutPage')).CheckoutPage }),
      },
      {
        path: 'order/:reference',
        lazy: async () => ({ Component: (await import('@/pages/OrderPage')).OrderPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // The dashboard is its own chunk: public visitors never download it.
    path: 'admin/*',
    lazy: async () => ({ Component: (await import('@/features/admin/AdminApp')).AdminApp }),
  },
  {
    // The couriers' delivery app, also its own chunk.
    path: 'livreur/*',
    lazy: async () => ({ Component: (await import('@/features/courier/CourierApp')).CourierApp }),
  },
]

export const router = createBrowserRouter(routes)
