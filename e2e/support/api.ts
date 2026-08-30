import type { APIResponse, Page } from '@playwright/test'
import { BACKEND_URL } from './env'

/**
 * Calls the API as the user a page is signed in as.
 *
 * The token cannot come from the saved session. keycloak-js keeps it in memory and never
 * persists it, so a request context built from storageState carries the Keycloak cookies but no
 * Authorization header, and every call comes back 401 rather than exercising the authorisation
 * rule under test. The only place the token is observable is on a request the app itself makes,
 * so it is lifted from there.
 *
 * The captured value is cached per page and refreshed once on a 401, because the app rotates its
 * token every twenty seconds and a spec can outlive the one that was captured.
 */
const cached = new WeakMap<Page, string>()

async function captureToken(page: Page): Promise<string> {
  const [request] = await Promise.all([
    page.waitForRequest(
      (candidate) =>
        candidate.url().includes('/api/') && Boolean(candidate.headers()['authorization']),
    ),
    page.reload(),
  ])
  const header = request.headers()['authorization']
  cached.set(page, header)
  return header
}

async function authHeader(page: Page): Promise<string> {
  return cached.get(page) ?? (await captureToken(page))
}

async function send(
  page: Page,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  data?: unknown,
): Promise<APIResponse> {
  const url = path.startsWith('http') ? path : `${BACKEND_URL}${path}`
  const call = (token: string) =>
    page.request[method](url, {
      headers: { Authorization: token },
      ...(data === undefined ? {} : { data: data as Record<string, unknown> }),
    })

  let response = await call(await authHeader(page))
  if (response.status() === 401) {
    cached.delete(page)
    response = await call(await captureToken(page))
  }
  return response
}

export const api = {
  get: (page: Page, path: string) => send(page, 'get', path),
  post: (page: Page, path: string, data?: unknown) => send(page, 'post', path, data),
  put: (page: Page, path: string, data?: unknown) => send(page, 'put', path, data),
  delete: (page: Page, path: string) => send(page, 'delete', path),
}
