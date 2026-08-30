import { Component, type ErrorInfo, type ReactNode } from 'react'
import ErrorScreen from './feedback/ErrorScreen'

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
        <ErrorScreen
          tone="danger"
          title="Something went wrong"
          description="An unexpected error stopped this page from loading. Reloading usually clears it. If it keeps happening, tell your chairperson what you were doing at the time."
          actions={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-dark transition hover:bg-primary-dark"
            >
              Reload the page
            </button>
          }
        />
      )
    }
    return this.props.children
  }
}
