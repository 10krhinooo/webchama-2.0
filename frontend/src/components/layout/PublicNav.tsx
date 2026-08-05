import { useEffect, useState } from "react"
import WeaveMark from "../marketing/WeaveMark"

export default function PublicNav() {
  const [scrolled, setScrolled] = useState(false)

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
      className={`sticky top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur transition-shadow duration-300 ${
        scrolled ? "shadow-card" : "shadow-none"
      }`}
    >
      <nav
        className={`nav-shrink mx-auto flex max-w-6xl origin-top items-center justify-between px-6 py-4 transition-transform duration-300 ${
          scrolled ? "scale-[0.97]" : "scale-100"
        }`}
      >
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
        <a
          href="#join"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-paper transition hover:bg-primary-dark"
        >
          Start your chama
        </a>
      </nav>
    </header>
  )
}
