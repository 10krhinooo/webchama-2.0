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

/**
 * Picks an option from one of the app's selects.
 *
 * They are Radix comboboxes rather than native `<select>` elements, so `selectOption` does not
 * apply: the trigger has to be opened and the option clicked, and the listbox renders in a portal
 * outside the form.
 */
export async function chooseOption(page: Page, selectId: string, optionLabel: string | RegExp) {
  await page.locator(`#${selectId}`).click()
  await page.getByRole('option', { name: optionLabel }).click()
}

/** A value that cannot collide with a previous run, for records Keycloak keeps between resets. */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
