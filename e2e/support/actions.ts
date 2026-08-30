import { expect, type Page, type Response } from '@playwright/test'

/**
 * Waits for a specific GET to complete.
 *
 * Used where an assertion would otherwise race a refetch triggered by a mutation. Everything else
 * should assert on rendered content instead; there are no timeouts anywhere in this suite,
 * because a fixed wait either makes the suite slow or makes it flaky, usually both.
 */
export function waitForGet(page: Page, pathFragment: string): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.url().includes(pathFragment) &&
      response.request().method() === 'GET' &&
      response.status() < 400,
  )
}

/** Asserts the transient success banner said what we expect. */
export async function expectNotice(page: Page, pattern: RegExp) {
  await expect(page.getByRole('status').filter({ hasText: pattern }).first()).toBeVisible()
}

/** Asserts the form-level error banner said what we expect. */
export async function expectFormError(page: Page, pattern: RegExp) {
  await expect(page.getByTestId('form-error')).toContainText(pattern)
}
