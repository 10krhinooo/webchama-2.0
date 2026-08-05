import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import { Users, Wallet, Building2, LogOut, ChevronDown, LayoutDashboard, HandCoins, RotateCw, Menu, X } from 'lucide-react'
import WeaveMark from '../marketing/WeaveMark'
import { getChama, type Chama } from '../../api/chamas'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `sidebar-nav-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-paper/70 hover:bg-white/10 hover:text-paper'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close the mobile drawer on every navigation rather than leaving it open over the new page.
  useEffect(() => {
    setSidebarOpen(false)
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
    <div className="flex min-h-screen bg-paper">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col bg-night text-paper transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5">
          <span className="flex items-center gap-2">
            <WeaveMark className="h-6 w-6 text-accent" />
            <span className="font-heading text-lg font-bold">Webchama</span>
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-paper/70 hover:bg-white/10 hover:text-paper lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavLink to="/chamas" end className={navLinkClass} style={navDelay(0)}>
            <Building2 className="h-4 w-4" />
            Chamas
          </NavLink>

          {chamaId && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-paper/40">
                This chama
              </p>
              <NavLink to={`/chamas/${chamaId}/dashboard`} className={navLinkClass} style={navDelay(1)}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/members`} className={navLinkClass} style={navDelay(2)}>
                <Users className="h-4 w-4" />
                Members
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/contributions`} className={navLinkClass} style={navDelay(3)}>
                <Wallet className="h-4 w-4" />
                Contributions
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/loans`} className={navLinkClass} style={navDelay(4)}>
                <HandCoins className="h-4 w-4" />
                Loans
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/payouts`} className={navLinkClass} style={navDelay(5)}>
                <RotateCw className="h-4 w-4" />
                Payouts
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-1.5 text-muted hover:bg-paper-dim hover:text-ink lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
              <Link to="/chamas" className="font-medium text-muted hover:text-ink">
                Chamas
              </Link>
              {chama && (
                <>
                  <span className="text-muted/50">/</span>
                  <span className="font-medium text-ink">{chama.name}</span>
                </>
              )}
            </nav>
          </div>

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper-dim [&::-webkit-details-marker]:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials || '?'}
              </span>
              <span className="hidden text-sm font-medium text-ink sm:block">{displayName}</span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-black/10 bg-white p-1 shadow-card">
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
