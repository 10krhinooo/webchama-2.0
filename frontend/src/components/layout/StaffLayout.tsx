import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams, useLocation } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import PageTransition from './PageTransition'
import { useKeycloak } from '@react-keycloak/web'
import { Users, Wallet, Building2, LogOut, UserRound, ChevronDown, LayoutDashboard, HandCoins, RotateCw, FileText, ShieldCheck, Vote, HeartHandshake, Gauge, AlertTriangle, Menu, X, Gavel, CalendarDays, PiggyBank } from 'lucide-react'
import ChamaMark from '../marketing/ChamaMark'
import ThemeToggle from '../ui/ThemeToggle'
import NotificationBell from './NotificationBell'
import { getChama, type Chama } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'
import { roleBadgeText } from '../../utils/roleBadges'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `sidebar-nav-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-on-dark/70 hover:bg-on-dark/10 hover:text-on-dark'
  }`

/** Explicit per-item stagger rather than CSS nth-child, since a heading (`This chama`) sits between
 * the top-level and chama-scoped links, which would throw off nth-child's sibling count. */
const navDelay = (index: number) => ({ animationDelay: `${index * 40}ms` })

/** The chama-scoped links, in the order a member meets them. Kept beside the nav that renders it. */
const CHAMA_LINKS = [
  { to: 'my-money', label: 'My money', Icon: PiggyBank, managerOnly: false },
  { to: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, managerOnly: false },
  { to: 'members', label: 'Members', Icon: Users, managerOnly: false },
  { to: 'contributions', label: 'Contributions', Icon: Wallet, managerOnly: false },
  { to: 'loans', label: 'Loans', Icon: HandCoins, managerOnly: false },
  { to: 'payouts', label: 'Payouts', Icon: RotateCw, managerOnly: false },
  { to: 'penalties', label: 'Penalties', Icon: Gavel, managerOnly: false },
  { to: 'welfare-fund', label: 'Welfare Fund', Icon: HeartHandshake, managerOnly: false },
  { to: 'meetings', label: 'Meetings', Icon: CalendarDays, managerOnly: false },
  { to: 'resolutions', label: 'Resolutions', Icon: Vote, managerOnly: false },
  { to: 'documents', label: 'Documents', Icon: FileText, managerOnly: true },
  { to: 'approvals', label: 'Approvals', Icon: ShieldCheck, managerOnly: true },
] as const

/** Matches a chama-scoped path segment back to its nav label, for the breadcrumb. */
const SECTION_LABELS: Record<string, string> = {
  ...Object.fromEntries(CHAMA_LINKS.map((l) => [l.to, l.label])),
  profile: 'Your profile',
  'notification-preferences': 'Notification preferences',
  overview: 'Platform overview',
  'security-events': 'Security events',
  chamas: 'Chamas',
}

function useChamaName(chamaId: number | undefined) {
  const [chama, setChama] = useState<Chama | null>(null)

  useEffect(() => {
    if (!chamaId) {
      setChama(null)
      return
    }
    let cancelled = false
    getChama(chamaId)
      .then((c) => {
        if (!cancelled) setChama(c)
      })
      .catch(() => {
        if (!cancelled) setChama(null)
      })
    return () => {
      cancelled = true
    }
  }, [chamaId])

  return chama
}

/**
 * The current page's own name, for the breadcrumb.
 *
 * The sidebar carries the only other current-page indicator and it is hidden below `lg`, so on the
 * device this app expects most of its traffic from, nothing on screen said which page you were on.
 * Derived from the path rather than passed down, so a new route gets a breadcrumb by adding one
 * entry to SECTION_LABELS instead of touching every page component.
 */
function useSectionLabel(pathname: string): string | null {
  const last = pathname.split('/').filter(Boolean).pop()
  if (!last) return null
  return SECTION_LABELS[last] ?? null
}

interface NavProps {
  chamaId: string | undefined
  isManager: boolean
  roleLoading: boolean
  isSuperAdmin: boolean
  roles: string[]
}

/**
 * The navigation itself, rendered twice: once as the desktop sidebar and once inside the mobile
 * drawer's dialog. Extracted so the two cannot drift, which matters more than it sounds, because
 * the drawer is the only copy most of this product's users will ever see.
 */
function ChamaNav({ chamaId, isManager, roleLoading, isSuperAdmin, roles }: NavProps) {
  const { keycloak } = useKeycloak()
  const superAdmin = keycloak.hasRealmRole('SUPER_ADMIN')

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {!superAdmin && (
        <NavLink to="/my-chamas" end className={navLinkClass} style={navDelay(0)}>
          <Building2 className="h-4 w-4" />
          My Chamas
        </NavLink>
      )}

      {superAdmin && (
        <>
          <NavLink to="/admin/overview" className={navLinkClass} style={navDelay(0)}>
            <Gauge className="h-4 w-4" />
            Platform Overview
          </NavLink>
          <NavLink to="/admin/security-events" className={navLinkClass} style={navDelay(1)}>
            <AlertTriangle className="h-4 w-4" />
            Security Events
          </NavLink>
        </>
      )}

      {chamaId && (
        <>
          <div className="px-3 pb-1 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-dark/40">This chama</p>
            {!roleLoading && (
              <span className="mt-1 inline-block rounded-full bg-on-dark/10 px-2 py-0.5 text-[11px] font-medium text-on-dark/70">
                {roleBadgeText(isSuperAdmin, roles)}
              </span>
            )}
          </div>
          {CHAMA_LINKS.filter((link) => !link.managerOnly || (!roleLoading && isManager)).map(
            (link, index) => (
              <NavLink
                key={link.to}
                to={`/chamas/${chamaId}/${link.to}`}
                className={navLinkClass}
                style={navDelay(index + 2)}
              >
                <link.Icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ),
          )}
        </>
      )}
    </nav>
  )
}

function SidebarBrand({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5">
      <div className="flex items-center gap-2">
        <ChamaMark className="h-6 w-6 text-accent" />
        <span className="font-heading text-lg font-bold">Webchama</span>
      </div>
      {children}
    </div>
  )
}

export default function StaffLayout() {
  const { keycloak } = useKeycloak()
  const { chamaId } = useParams<{ chamaId?: string }>()
  const location = useLocation()
  const chama = useChamaName(chamaId ? Number(chamaId) : undefined)
  const { roles, isSuperAdmin, isManager, loading: roleLoading } = useMyMembership(
    chamaId ? Number(chamaId) : undefined,
  )
  const [navOpen, setNavOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const sectionLabel = useSectionLabel(location.pathname)

  // Close the mobile drawer and the account menu on every navigation rather than leaving either
  // open over the new page. The menu was previously a <details> element, which had no way to know
  // a navigation had happened at all, so "Your profile" left it hanging open on the profile page.
  useEffect(() => {
    setNavOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  const tokenParsed = keycloak.tokenParsed as { name?: string; preferred_username?: string; email?: string } | undefined
  const displayName = tokenParsed?.name ?? tokenParsed?.preferred_username ?? 'Account'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const navProps: NavProps = { chamaId, isManager, roleLoading, isSuperAdmin, roles }

  return (
    <div data-testid="staff-layout" className="flex min-h-screen bg-paper">
      {/*
        First focusable thing on every page. The sidebar renders fourteen links before <main>, so
        without this a keyboard user traverses the entire navigation on every single page load.
        Visually hidden until focused, which is the only state it needs to be visible in.
      */}
      <a
        href="#main-content"
        className="sr-only left-4 top-4 z-50 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed"
      >
        Skip to content
      </a>

      {/*
        The desktop sidebar. `hidden lg:flex` rather than a transform, so below `lg` it is genuinely
        absent from the accessibility tree and the tab order instead of merely off-screen. The
        previous version translated it out of view with `-translate-x-full`, which moves pixels and
        nothing else: every one of these links stayed focusable, so a phone user tabbed through
        fourteen invisible destinations before reaching the page.
      */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-night text-on-dark lg:flex">
        <SidebarBrand />
        <ChamaNav {...navProps} />
      </aside>

      {/*
        The mobile drawer, as a real dialog. Radix brings the focus trap, the Escape handler, the
        return of focus to the trigger on close, and `aria-modal`, all of which this was missing
        while hand-rolled. It also only mounts while open, so the closed state cannot be tabbed
        into by construction rather than by remembering to set `inert`.
      */}
      <DialogPrimitive.Root open={navOpen} onOpenChange={setNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-testid="nav-backdrop"
            className="fixed inset-0 z-30 bg-black/40 dark:bg-black/60 lg:hidden"
          />
          <DialogPrimitive.Content
            aria-label="Main navigation"
            className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto bg-night text-on-dark outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Main navigation</DialogPrimitive.Title>
            <SidebarBrand>
              <DialogPrimitive.Close
                type="button"
                aria-label="Close menu"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-on-dark/70 hover:bg-on-dark/10 hover:text-on-dark"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </SidebarBrand>
            <ChamaNav {...navProps} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              // 44px minimum, per WCAG 2.5.8. This is a one-thumb product and the icon inside is 20px.
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-paper-dim hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
              {keycloak.hasRealmRole('SUPER_ADMIN') ? (
                <Link to="/admin/overview" className="hidden shrink-0 font-medium text-muted hover:text-ink sm:block">
                  Platform Overview
                </Link>
              ) : (
                <Link to="/my-chamas" className="hidden shrink-0 font-medium text-muted hover:text-ink sm:block">
                  My Chamas
                </Link>
              )}
              {/*
                Below `sm` the trail collapses to the current page alone. There is not room for
                more: at 360px, beside a menu button, a bell, a theme toggle and an avatar, a
                three-part trail truncates to "Umo... / Con...", which names neither. The page is
                the part worth keeping, because it is the part the hidden sidebar was carrying.
              */}
              {chama && (
                <>
                  <span className="hidden shrink-0 text-muted/50 sm:inline">/</span>
                  <span className="hidden truncate font-medium text-ink sm:inline">{chama.name}</span>
                </>
              )}
              {sectionLabel && (
                <>
                  <span className="hidden shrink-0 text-muted/50 sm:inline">/</span>
                  <span className="truncate font-medium text-ink" aria-current="page">
                    {sectionLabel}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />

            {/*
              A dialog rather than the <details> element this used to be. `details` cannot close on
              an outside click, on Escape, or on navigation, so it stayed open over whatever page
              you had just moved to. Radix Dialog is already a dependency; a dropdown-menu package
              would give richer menu semantics for two links, which does not justify the weight.
            */}
            <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogPrimitive.Trigger
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper-dim"
                aria-label="Account menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-brand">
                  {initials || '?'}
                </span>
                <span className="hidden text-sm font-medium text-ink sm:block">{displayName}</span>
                <ChevronDown className="h-4 w-4 text-muted" />
              </DialogPrimitive.Trigger>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-40" />
                <DialogPrimitive.Content
                  aria-label="Account"
                  className="fixed right-4 top-16 z-50 w-56 rounded-xl border border-border bg-surface p-1 shadow-card outline-none"
                >
                  <DialogPrimitive.Title className="sr-only">Account</DialogPrimitive.Title>
                  {tokenParsed?.email && (
                    <p className="truncate px-3 py-2 text-xs text-muted">{tokenParsed.email}</p>
                  )}
                  <Link
                    to="/profile"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
                  >
                    <UserRound className="h-4 w-4" />
                    Your profile
                  </Link>
                  <button
                    onClick={() => keycloak.logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          </div>
        </header>

        {/*
          `.shell` is the app's single content width (index.css). It was applied only to the public
          marketing site, so every staff page stretched the full width of whatever monitor it was
          opened on. It carries its own horizontal padding, hence `py-*` here rather than `p-*`.

          `overflow-x-auto` is deliberately gone: `Table` already wraps every table in its own
          scroll container, and having both meant a wide table produced a scrollbar inside a
          scrollbar while the page shell itself slid sideways.
        */}
        <main id="main-content" className="shell flex-1 py-6 lg:py-8">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
