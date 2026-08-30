import { Link } from 'react-router-dom'
import ErrorScreen from '../../components/feedback/ErrorScreen'

export default function NotFoundPage() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found"
      description="The page you were looking for does not exist, or it has moved since the link was made."
      actions={
        <>
          <Link
            to="/"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-dark transition hover:bg-primary-dark"
          >
            Back to the homepage
          </Link>
          <Link
            to="/my-chamas"
            className="rounded-full border border-border-strong px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper-dim"
          >
            Go to my chamas
          </Link>
        </>
      }
    />
  )
}
