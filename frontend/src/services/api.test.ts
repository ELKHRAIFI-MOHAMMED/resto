import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

import { ApiError, apiFetch, readCookie } from './api'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: new Headers(init.headers) }
}

describe('apiFetch', () => {
  afterEach(() => {
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('prefixes the API base URL and sends the active language', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await i18n.changeLanguage('ar')

    await expect(apiFetch('/health/')).resolves.toEqual({ ok: true })

    const { url, init, headers } = lastRequest(fetchMock)
    expect(url).toBe('/api/health/')
    expect(init.credentials).toBe('include')
    expect(headers.get('Accept-Language')).toBe('ar')
    expect(headers.get('X-CSRFToken')).toBeNull()
  })

  it('JSON-encodes bodies and adds the CSRF token to unsafe requests', async () => {
    document.cookie = 'csrftoken=abc123'
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/orders/', { method: 'POST', body: { name: 'Test' } })

    const { init, headers } = lastRequest(fetchMock)
    expect(init.body).toBe('{"name":"Test"}')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-CSRFToken')).toBe('abc123')
  })

  it('turns the backend error envelope into an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'validation_error',
              message: 'Invalid input.',
              details: { phone: ['Invalid phone number.'] },
            },
          },
          400,
        ),
      ),
    )

    const error = await apiFetch('/orders/', { method: 'POST', body: {} }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: 'validation_error',
      details: { phone: ['Invalid phone number.'] },
    })
  })

  it('reports network failures distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(apiFetch('/health/')).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })
})

describe('readCookie', () => {
  it('returns null when the cookie is absent', () => {
    expect(readCookie('missing')).toBeNull()
  })
})
