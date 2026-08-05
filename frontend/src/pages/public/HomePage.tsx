import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import PublicNav from "../../components/layout/PublicNav"
import PublicFooter from "../../components/layout/PublicFooter"
import ContributionPot from "../../components/marketing/ContributionPot"
import LedgerRow from "../../components/marketing/LedgerRow"
import StampApproval from "../../components/marketing/StampApproval"
import RoleCard from "../../components/marketing/RoleCard"
import WhatsAppQuote from "../../components/marketing/WhatsAppQuote"
import WovenBackdrop from "../../components/marketing/WovenBackdrop"
import Reveal from "../../components/ui/Reveal"
import { useReducedMotion } from "../../hooks/useReducedMotion"

gsap.registerPlugin(ScrollTrigger)

const LEDGER_ENTRIES = [
  {
    title: "Mchango tracking",
    description:
      "Every contribution is logged the moment it lands, no more chasing M-Pesa screenshots on WhatsApp.",
  },
  {
    title: "Zamu, automated",
    description: "The payout order is set once and kept fair. Everyone can see whose turn is next.",
  },
  {
    title: "Two signatures, always",
    description: "No single treasurer can move a payout alone. The chairperson signs off too.",
  },
  {
    title: "M-Pesa native",
    description: "Members pay by STK push straight from their phone. The ledger updates itself.",
  },
]

const ROLES = [
  {
    role: "Chairperson",
    items: ["Approve loans and payouts", "Manage members", "See every chama's books"],
  },
  {
    role: "Treasurer",
    items: ["Record contributions and repayments", "Request payouts", "Generate statements"],
  },
  {
    role: "Secretary",
    items: ["Keep the minutes", "Track attendance", "Send meeting reminders"],
  },
  {
    role: "Member",
    items: ["Pay by M-Pesa", "Check your payout position", "Message the WhatsApp bot anytime"],
  },
]

/**
 * The hero headline, revealed left-to-right like ink filling in a ledger line, once it scrolls
 * into view. Kept as a single text node (rather than splitting into per-word spans) via a
 * clip-path wipe, so the rendered text stays exactly "Every shilling lands in the kiondo." — the
 * page's own tests match on that literal string, and text-testing-library matchers stop working
 * once text is fragmented across sibling elements.
 */
function Headline({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const [lit, setLit] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLit(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <h1 ref={ref} className={`headline-reveal ${lit ? "is-lit" : ""} ${className ?? ""}`} data-depth="4">
      {text}
    </h1>
  )
}

function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const roleGridRef = useRef<HTMLDivElement>(null)
  const [roleGridInView, setRoleGridInView] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    // ScrollTrigger needs real scroll geometry and ResizeObserver, neither of which jsdom (unit
    // tests) provides. Also skipped for reduced-motion and for coarse-pointer (touch) devices —
    // scroll-linked transforms are the effect most likely to feel janky on a mid-range phone, and
    // this is exactly the traffic this app expects most: chama members checking in over mobile data.
    const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
    if (reduceMotion || isTouchDevice || typeof ResizeObserver === "undefined") return
    const ctx = gsap.context(() => {
      gsap.to(glowRef.current, {
        yPercent: 35,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      })
      // A subtle Ken Burns zoom on the whole hero (background + content together) as it scrolls
      // past — GSAP owns the transform directly rather than juggling it against React's style prop.
      gsap.to(heroRef.current, {
        scale: 1.06,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      })
    })
    return () => ctx.revert()
  }, [reduceMotion])

  useEffect(() => {
    const el = roleGridRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRoleGridInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <PublicNav />

      <main className="flex-1">
        {/* Hero — depth-0 woven backdrop, depth-1 glow, depth-3 ContributionPot (the hero object),
            depth-4 headline/CTA. GSAP scrubs the glow drift and a subtle hero scale on scroll. */}
        <section ref={heroRef} className="relative overflow-hidden">
          <div className="layer depth-0 weave-drift" aria-hidden="true">
            <WovenBackdrop className="h-full w-full" />
          </div>
          <div ref={glowRef} className="layer depth-1" aria-hidden="true">
            <div className="absolute -top-24 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
            <div data-depth="4">
              <Reveal eager>
                <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Table banking, digitised
                </p>
              </Reveal>
              <Headline
                text="Every shilling lands in the kiondo."
                className="mt-4 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl"
              />
              <Reveal eager delayMs={200}>
                <p className="mt-6 max-w-md text-lg text-ink/70">
                  Webchama keeps your chama&rsquo;s contributions, loans, and payout rotation straight,
                  with M-Pesa built in and two signatures required before any money moves.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    href="#join"
                    className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-primary-dark"
                  >
                    Start your chama
                  </a>
                  <a href="#how-it-works" className="text-sm font-semibold text-ink/70 hover:text-ink">
                    See how zamu works &darr;
                  </a>
                </div>
              </Reveal>
            </div>
            <div data-depth="3" className="depth-3">
              <div className="float-loop">
                <ContributionPot percent={72} label="This cycle" sublabel="KES 144,000 of KES 200,000 mchango collected" />
              </div>
            </div>
          </div>
        </section>

        {/* Ledger strip */}
        <section id="how-it-works" className="border-y border-ink/10 bg-paper-dim">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <Reveal>
              <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                What&rsquo;s in the book
              </p>
            </Reveal>
            <div className="mt-6">
              {LEDGER_ENTRIES.map((entry, i) => (
                <Reveal key={entry.title} delayMs={i * 90}>
                  <LedgerRow
                    title={entry.title}
                    description={entry.description}
                    isLast={i === LEDGER_ENTRIES.length - 1}
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Trust / maker-checker */}
        <section id="trust" className="bg-success text-paper">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <Reveal>
              <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-paper/70">
                Why trust matters most
              </p>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                One person should never hold your chama&rsquo;s money alone.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-paper/80">
                It is the reason good chamas fall apart: a single signatory, a missing receipt, a
                disagreement nobody can settle. Webchama requires two separate approvals before any
                loan or payout is released, and keeps a permanent record of who signed what.
              </p>
            </Reveal>
            <div className="mt-12">
              <StampApproval />
            </div>
          </div>
        </section>

        {/* Roles — cascading card stack, staggered via CSS nth-child delay once the grid scrolls into view */}
        <section id="roles" className="mx-auto max-w-6xl px-6 py-20">
          <Reveal variant="fade">
            <p className="text-center font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Everyone has a seat
            </p>
            <h2 className="mt-4 text-center text-3xl font-bold text-ink sm:text-4xl">
              Built around the roles your chama already has.
            </h2>
          </Reveal>
          <div
            ref={roleGridRef}
            className={`stagger-children mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 ${roleGridInView ? "stagger-in" : ""}`}
          >
            {ROLES.map((r) => (
              <div key={r.role} className="transition-transform duration-300 hover:-translate-y-1">
                <RoleCard role={r.role} items={r.items} />
              </div>
            ))}
          </div>
        </section>

        {/* Testimonial */}
        <section className="bg-paper-dim px-6 py-20">
          <Reveal variant="scale">
            <WhatsAppQuote
              quote="We used to get confused about who had paid what. Sasa, everyone can see it on their phone before the meeting even starts."
              name="Grace W."
              role="Chairlady, Tumaini Chama"
            />
          </Reveal>
        </section>

        {/* Final CTA */}
        <section id="join" className="relative overflow-hidden bg-primary text-paper">
          <div className="layer depth-0 weave-drift" aria-hidden="true">
            <WovenBackdrop className="h-full w-full" tone="night" />
          </div>
          <Reveal className="relative mx-auto max-w-2xl px-6 py-20 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Bring your chama&rsquo;s ledger online.</h2>
            <p className="mt-4 text-paper/80">
              Free for chamas under 20 members. Set up your rotation, invite your members, and
              take your first mchango by M-Pesa this week.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#join"
                className="rounded-full bg-paper px-6 py-3 text-sm font-semibold text-primary transition hover:bg-paper-dim"
              >
                Start your chama
              </a>
              <a
                href="#join"
                className="rounded-full border border-paper/40 px-6 py-3 text-sm font-semibold text-paper transition hover:bg-primary-dark"
              >
                Chat with us on WhatsApp
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

export default HomePage
