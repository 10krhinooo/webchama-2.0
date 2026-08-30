import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeToggle from './ThemeToggle'
import ThemeProvider from '../../theme/ThemeProvider'
import { THEME_STORAGE_KEY } from '../../theme/theme'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.className = ''
})

describe('ThemeToggle', () => {
  it('starts on the system setting', () => {
    renderToggle()
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute('title', 'Theme: System')
  })

  it('names both the current setting and the next one, since the icon cannot convey a third state', () => {
    renderToggle()
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute(
      'aria-label',
      'Theme: System. Switch to light.',
    )
  })

  it('cycles system to light to dark and back to system', () => {
    renderToggle()
    const toggle = screen.getByTestId('theme-toggle')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('title', 'Theme: Light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('title', 'Theme: Dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('title', 'Theme: System')
  })

  it('accepts an extra className so it can sit in different layouts', () => {
    render(
      <ThemeProvider>
        <ThemeToggle className="ml-2" />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme-toggle').className).toContain('ml-2')
  })

  it('hides the icon from assistive technology, since the button is already labelled', () => {
    renderToggle()
    const icon = screen.getByTestId('theme-toggle').querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})
