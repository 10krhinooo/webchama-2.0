import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams, useLocation } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import { Users, Wallet, Building2, LogOut, ChevronDown, LayoutDashboard, HandCoins, RotateCw, FileText, ShieldCheck, Vote, HeartHandshake, Gauge, AlertTriangle, Menu, X, Gavel } from 'lucide-react'
import WeaveMark from '../marketing/WeaveMark'
import ThemeToggle from '../ui/ThemeToggle'
import { getChama, type Chama } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'
import { roleBadgeText } from '../../utils/roleBadges'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `sidebar-nav-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-paper/70 hover:bg-surface/10 hover:text-paper'
  }`

/** Explicit per-item stagger rather than CSS nth-child, since a heading (`This chama`) sits between
 * the top-level and chama-scoped links, which would throw off nth-child's sibling count. */
const navDelay = (index: number) => ({ animationDelay: `${index * 40}ms` })

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

export default function StaffLayout() {
  const { keycloak } = useKeycloak()
  const { chamaId } = useParams<{ chamaId?: string }>()
  const location = useLocation()
  const chama = useChamaName(chamaId ? Number(chamaId) : undefined)
  const { roles, isSuperAdmin, isManager, loading: roleLoading } = useMyMembership(
    chamaId ? Number(chamaId) : undefined,
  )
  const [navOpen, setNavOpen] = useState(false)

  // Close the mobile drawer on every navigation rather than leaving it open over the new page.
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  const tokenParsed = keycloak.tokenParsed as { name?: string; preferred_username?: string; email?: string } | undefined
  const displayName = tokenParsed?.name ?? tokenParsed?.preferred_username ?? 'Account'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div data-testid="staff-layout" className="flex min-h-screen bg-paper">
      {navOpen && (
        <div
          data-testid="nav-backdrop"
          className="fixed inset-0 z-30 bg-black/40 dark:bg-black/60 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto bg-night text-paper transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2">
            <WeaveMark className="h-6 w-6 text-accent" />
            <span className="font-heading text-lg font-bold">Webchama</span>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="rounded-lg p-1 text-paper/70 hover:bg-surface/10 hover:text-paper lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {!keycloak.hasRealmRole('SUPER_ADMIN') && (
            <NavLink to="/my-chamas" end className={navLinkClass} style={navDelay(0)}>
              <Building2 className="h-4 w-4" />
              My Chamas
            </NavLink>
          )}

          {keycloak.hasRealmRole('SUPER_ADMIN') && (
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
                <p className="text-xs font-semibold uppercase tracking-wide text-paper/40">This chama</p>
                {!roleLoading && (
                  <span className="mt-1 inline-block rounded-full bg-surface/10 px-2 py-0.5 text-[11px] font-medium text-paper/70">
                    {roleBadgeText(isSuperAdmin, roles)}
                  </span>
                )}
              </div>
              <NavLink to={`/chamas/${chamaId}/dashboard`} className={navLinkClass} style={navDelay(2)}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/members`} className={navLinkClass} style={navDelay(3)}>
                <Users className="h-4 w-4" />
                Members
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/contributions`} className={navLinkClass} style={navDelay(4)}>
                <Wallet className="h-4 w-4" />
                Contributions
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/loans`} className={navLinkClass} style={navDelay(5)}>
                <HandCoins className="h-4 w-4" />
                Loans
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/payouts`} className={navLinkClass} style={navDelay(6)}>
                <RotateCw className="h-4 w-4" />
                Payouts
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/penalties`} className={navLinkClass} style={navDelay(7)}>
                <Gavel className="h-4 w-4" />
                Penalties
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/welfare-fund`} className={navLinkClass} style={navDelay(8)}>
                <HeartHandshake className="h-4 w-4" />
                Welfare Fund
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/resolutions`} className={navLinkClass} style={navDelay(9)}>
                <Vote className="h-4 w-4" />
                Resolutions
              </NavLink>
              {!roleLoading && isManager && (
                <NavLink to={`/chamas/${chamaId}/documents`} className={navLinkClass} style={navDelay(10)}>
                  <FileText className="h-4 w-4" />
                  Documents
                </NavLink>
              )}
              {!roleLoading && isManager && (
                <NavLink to={`/chamas/${chamaId}/approvals`} className={navLinkClass} style={navDelay(11)}>
                  <ShieldCheck className="h-4 w-4" />
                  Approvals
                </NavLink>
              )}
            </>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="rounded-lg p-1.5 text-muted hover:bg-paper-dim hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
              {keycloak.hasRealmRole('SUPER_ADMIN') ? (
                <Link to="/admin/overview" className="shrink-0 font-medium text-muted hover:text-ink">
                  Platform Overview
                </Link>
              ) : (
                <Link to="/my-chamas" className="shrink-0 font-medium text-muted hover:text-ink">
                  My Chamas
                </Link>
              )}
              {chama && (
                <>
                  <span className="shrink-0 text-muted/50">/</span>
                  <span className="truncate font-medium text-ink">{chama.name}</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />

            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper-dim [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-brand">
                  {initials || '?'}
                </span>
                <span className="hidden text-sm font-medium text-ink sm:block">{displayName}</span>
                <ChevronDown className="h-4 w-4 text-muted" />
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-border bg-surface p-1 shadow-card">
                {tokenParsed?.email && (
                  <p className="truncate px-3 py-2 text-xs text-muted">{tokenParsed.email}</p>
                )}
                <button
                  onClick={() => keycloak.logout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </details>
          </div>
        </header>

        <main className="flex-1 overflow-x-auto p-6 lg:p-8">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
