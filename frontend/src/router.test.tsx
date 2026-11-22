import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { routes } from '@/router'
import { renderRoutes } from '@/test/utils'

describe('routes', () => {
  it('renders the home page with live system status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: 'ok', database: 'ok' }), { status: 200 }),
        ),
    )

    renderRoutes(routes, '/')

    expect(screen.getByRole('heading', { level: 1, name: 'RestoFlow' })).toBeInTheDocument()
    expect(await screen.findAllByText('Opérationnel')).toHaveLength(2)
  })

  it('shows the database as unavailable when the health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'degraded', database: 'unavailable' }), {
          status: 503,
        }),
      ),
    )

    renderRoutes(routes, '/')

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('renders a 404 page for unknown paths', () => {
    vi.stubGlobal('fetch', vi.fn())

    renderRoutes(routes, '/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
  })
})
