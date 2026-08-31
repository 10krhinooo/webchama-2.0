import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Menu, X } from "lucide-react"
import ChamaMark from "../marketing/ChamaMark"
import StartChamaCta from "../marketing/StartChamaCta"
import ThemeToggle from "../ui/ThemeToggle"
import { useReducedMotion } from "../../hooks/useReducedMotion"
import { leaveThen } from "../../lib/leaveTransition"

const sectionLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#trust", label: "Trust" },
  { href: "#roles", label: "Roles" },
]

export default function PublicNav() {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24)
        ticking = false
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b border-border bg-paper/90 backdrop-blur transition-shadow duration-300 ${
        scrolled ? "shadow-card" : "shadow-none"
      }`}
    >
      <nav
        className={`nav-shrink shell flex origin-top items-center justify-between py-4 transition-transform duration-300 ${
          scrolled ? "scale-[0.97]" : "scale-100"
        }`}
      >
        <a href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
          <ChamaMark className="h-6 w-6 text-brand" />
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
          <ThemeToggle />
          <button
            type="button"
            onClick={() => leaveThen(() => navigate('/my-chamas'), reducedMotion)}
            className="text-sm font-semibold text-ink/70 hover:text-ink"
          >
            Sign In
          </button>
          <StartChamaCta className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark">
            Start your chama
          </StartChamaCta>
        </div>
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg p-1.5 text-ink/70 hover:bg-paper-dim hover:text-ink"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-border px-6 py-4 sm:hidden">
          <div className="flex flex-col gap-4 text-sm font-medium text-ink/70">
            {sectionLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-ink" onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                leaveThen(() => navigate('/my-chamas'), reducedMotion)
              }}
              className="text-left font-semibold text-ink/70 hover:text-ink"
            >
              Sign In
            </button>
            <StartChamaCta
              className="rounded-full bg-primary px-4 py-2 text-center font-semibold text-white transition hover:bg-primary-dark"
              onClick={() => setMenuOpen(false)}
            >
              Start your chama
            </StartChamaCta>
          </div>
        </div>
      )}
    </header>
  )
}
