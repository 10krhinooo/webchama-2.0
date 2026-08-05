import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Reveal from './Reveal'

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

describe('Reveal', () => {
  const originalIO = window.IntersectionObserver

  beforeEach(() => {
    capturedCallback = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).IntersectionObserver = CapturingIntersectionObserver
  })

  afterEach(() => {
    window.IntersectionObserver = originalIO
  })

  it('hides content until it scrolls into view', () => {
    render(<Reveal>Section content</Reveal>)
    expect(screen.getByText('Section content').style.opacity).toBe('0')
  })

  it('reveals content once it intersects the viewport', () => {
    render(<Reveal>Section content</Reveal>)
    expect(capturedCallback).toBeTruthy()
    act(() => {
      capturedCallback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getByText('Section content').style.opacity).toBe('1')
  })

  it('renders already visible when eager', () => {
    render(<Reveal eager>Above the fold</Reveal>)
    expect(screen.getByText('Above the fold').style.opacity).toBe('1')
  })
})
