import { useState } from "react"
import { Link } from "react-router-dom"
import { Menu, X } from "lucide-react"
import WeaveMark from "../marketing/WeaveMark"

const sectionLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#trust", label: "Trust" },
  { href: "#roles", label: "Roles" },
]

export default function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-ink/10 bg-paper/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
          <WeaveMark className="h-6 w-6 text-primary" />
          Webchama
        </a>
        <div className="hidden items-center gap-8 text-sm font-medium text-ink/70 sm:flex">
          {sectionLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-4 sm:flex">
          <Link to="/my-chamas" className="text-sm font-semibold text-ink/70 hover:text-ink">
            Sign In
          </Link>
          <a
            href="#join"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-paper transition hover:bg-primary-dark"
          >
            Start your chama
          </a>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-lg p-1.5 text-ink/70 hover:bg-paper-dim hover:text-ink sm:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {menuOpen && (
        <div className="border-t border-ink/10 px-6 py-4 sm:hidden">
          <div className="flex flex-col gap-4 text-sm font-medium text-ink/70">
            {sectionLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-ink" onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            <Link to="/my-chamas" className="font-semibold text-ink/70 hover:text-ink" onClick={() => setMenuOpen(false)}>
              Sign In
            </Link>
            <a
              href="#join"
              onClick={() => setMenuOpen(false)}
              className="rounded-full bg-primary px-4 py-2 text-center font-semibold text-paper transition hover:bg-primary-dark"
            >
              Start your chama
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
