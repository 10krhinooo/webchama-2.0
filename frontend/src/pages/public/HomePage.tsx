import PublicNav from "../../components/layout/PublicNav"
import PublicFooter from "../../components/layout/PublicFooter"
import ContributionPot from "../../components/marketing/ContributionPot"
import LedgerRow from "../../components/marketing/LedgerRow"
import StampApproval from "../../components/marketing/StampApproval"
import RoleCard from "../../components/marketing/RoleCard"
import WhatsAppQuote from "../../components/marketing/WhatsAppQuote"

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

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <PublicNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Table banking, digitised
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Every shilling lands in the kiondo.
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink/70">
              Webchama keeps your chama&rsquo;s contributions, loans, and payout rotation straight,
              with M-Pesa built in and two signatures required before any money moves.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#join"
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-paper transition hover:bg-primary-dark"
              >
                Start your chama
              </a>
              <a href="#how-it-works" className="text-sm font-semibold text-ink/70 hover:text-ink">
                See how zamu works &darr;
              </a>
            </div>
          </div>
          <ContributionPot percent={72} label="This cycle" sublabel="KES 144,000 of KES 200,000 mchango collected" />
        </section>

        {/* Ledger strip */}
        <section id="how-it-works" className="border-y border-ink/10 bg-paper-dim">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              What&rsquo;s in the book
            </p>
            <div className="mt-6">
              {LEDGER_ENTRIES.map((entry, i) => (
                <LedgerRow
                  key={entry.title}
                  title={entry.title}
                  description={entry.description}
                  isLast={i === LEDGER_ENTRIES.length - 1}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Trust / maker-checker */}
        <section id="trust" className="bg-success text-paper">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
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
            <div className="mt-12">
              <StampApproval />
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-center font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Everyone has a seat
          </p>
          <h2 className="mt-4 text-center text-3xl font-bold text-ink sm:text-4xl">
            Built around the roles your chama already has.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <RoleCard key={r.role} role={r.role} items={r.items} />
            ))}
          </div>
        </section>

        {/* Testimonial */}
        <section className="bg-paper-dim px-6 py-20">
          <WhatsAppQuote
            quote="We used to get confused about who had paid what. Sasa, everyone can see it on their phone before the meeting even starts."
            name="Grace W."
            role="Chairlady, Tumaini Chama"
          />
        </section>

        {/* Final CTA */}
        <section id="join" className="bg-primary text-paper">
          <div className="mx-auto max-w-2xl px-6 py-20 text-center">
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
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

export default HomePage
