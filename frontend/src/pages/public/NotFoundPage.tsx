import { Link } from 'react-router-dom'
import WeaveMark from '../../components/marketing/WeaveMark'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <WeaveMark className="h-8 w-8 text-brand" />
      <p className="font-display text-3xl font-semibold text-ink">Page not found</p>
      <p className="text-ink/70">The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
      <Link to="/" className="font-medium text-brand underline hover:text-primary-dark">
        Back to the homepage
      </Link>
    </div>
  )
}
