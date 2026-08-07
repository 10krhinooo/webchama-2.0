import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import StampApproval from './StampApproval'

let capturedCallback: IntersectionObserverCallback | null = null

class CapturingIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    capturedCallback = callback
  }
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
  takeRecords = () => []
}

describe('StampApproval', () => {
  const originalIO = window.IntersectionObserver

  beforeEach(() => {
    capturedCallback = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).IntersectionObserver = CapturingIntersectionObserver
  })

  afterEach(() => {
    window.IntersectionObserver = originalIO
  })

  it('starts with both stamps hidden until the section is visible', () => {
    render(<StampApproval />)
    const requested = screen.getByText('Requested').parentElement as HTMLElement
    expect(requested.style.opacity).toBe('0')
  })

  it('reveals both stamps once the section scrolls into view', () => {
    render(<StampApproval />)
    const requested = screen.getByText('Requested').parentElement as HTMLElement
    const approved = screen.getByText('Approved').parentElement as HTMLElement

    expect(capturedCallback).toBeTruthy()
    act(() => {
      capturedCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    expect(requested.style.opacity).toBe('1')
    expect(approved.style.opacity).toBe('1')
  })

  it('renders the treasurer and chairperson sublabels', () => {
    render(<StampApproval />)
    expect(screen.getByText('Treasurer')).toBeTruthy()
    expect(screen.getByText('Chairperson')).toBeTruthy()
  })

  it('skips the reveal transition and stamp delay when the user prefers reduced motion', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = ((query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList) as typeof window.matchMedia

    render(<StampApproval />)
    const requested = screen.getByText('Requested').parentElement as HTMLElement
    const approved = screen.getByText('Approved').parentElement as HTMLElement

    expect(requested.style.transition).toBe('none')
    expect(approved.style.transition).toBe('none')

    window.matchMedia = originalMatchMedia
  })
})
