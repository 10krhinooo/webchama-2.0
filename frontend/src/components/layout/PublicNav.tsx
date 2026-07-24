import { Link } from "react-router-dom"
import WeaveMark from "../marketing/WeaveMark"

export default function PublicNav() {
  return (
    <header className="border-b border-ink/10 bg-paper/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
          <WeaveMark className="h-6 w-6 text-primary" />
          Webchama
        </a>
        <div className="hidden items-center gap-8 text-sm font-medium text-ink/70 sm:flex">
          <a href="#how-it-works" className="hover:text-ink">
            How it works
          </a>
          <a href="#trust" className="hover:text-ink">
            Trust
          </a>
          <a href="#roles" className="hover:text-ink">
            Roles
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/chamas" className="text-sm font-semibold text-ink/70 hover:text-ink">
            Sign In
          </Link>
          <a
            href="#join"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-paper transition hover:bg-primary-dark"
          >
            Start your chama
          </a>
        </div>
      </nav>
    </header>
  )
}
