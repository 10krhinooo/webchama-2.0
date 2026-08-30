import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render errors anywhere below it so a bug in one page shows a recoverable message
 * instead of an unhandled blank white screen (AUDIT_PLAN.md P3). React error boundaries only
 * catch errors thrown during render/lifecycle, not inside event handlers or async code, which is
 * why this wraps the whole router rather than individual pages.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-night">Something went wrong</h1>
          <p className="max-w-md text-sm text-night/70">
            An unexpected error occurred while loading this page. Try reloading, or go back and try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-dark"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
