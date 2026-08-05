import { screen, fireEvent } from '@testing-library/react'

/**
 * Opens the shadcn/Radix-backed Select found via its label and picks the named option.
 * Replaces the old `fireEvent.change(select, { target: { value } })` pattern, which only
 * worked against a native <select> element.
 */
export function selectOption(labelMatcher: string | RegExp, optionName: string | RegExp) {
  fireEvent.click(screen.getByLabelText(labelMatcher))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}
