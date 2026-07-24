import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import { Users, Wallet, Building2, LogOut, ChevronDown, LayoutDashboard, HandCoins, RotateCw, FileText, ShieldCheck } from 'lucide-react'
import WeaveMark from '../marketing/WeaveMark'
import { getChama, type Chama } from '../../api/chamas'
import { useMyMembership } from '../../hooks/useMyMembership'

const ROLE_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  MEMBER: 'Member',
}

function roleBadgeText(isSuperAdmin: boolean, roles: string[]): string {
  if (isSuperAdmin) return 'Platform admin'
  if (roles.length === 0) return 'Member'
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-paper/70 hover:bg-white/10 hover:text-paper'
  }`

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
  const chama = useChamaName(chamaId ? Number(chamaId) : undefined)
  const { roles, isSuperAdmin, isManager, loading: roleLoading } = useMyMembership(
    chamaId ? Number(chamaId) : undefined,
  )

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
      <aside className="flex w-64 shrink-0 flex-col bg-night text-paper">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
          <WeaveMark className="h-6 w-6 text-accent" />
          <span className="font-heading text-lg font-bold">Webchama</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavLink to="/chamas" end className={navLinkClass}>
            <Building2 className="h-4 w-4" />
            Chamas
          </NavLink>

          {chamaId && (
            <>
              <div className="px-3 pb-1 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-paper/40">This chama</p>
                {!roleLoading && (
                  <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-paper/70">
                    {roleBadgeText(isSuperAdmin, roles)}
                  </span>
                )}
              </div>
              <NavLink to={`/chamas/${chamaId}/dashboard`} className={navLinkClass}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/members`} className={navLinkClass}>
                <Users className="h-4 w-4" />
                Members
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/contributions`} className={navLinkClass}>
                <Wallet className="h-4 w-4" />
                Contributions
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/loans`} className={navLinkClass}>
                <HandCoins className="h-4 w-4" />
                Loans
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/payouts`} className={navLinkClass}>
                <RotateCw className="h-4 w-4" />
                Payouts
              </NavLink>
              {!roleLoading && isManager && (
                <NavLink to={`/chamas/${chamaId}/documents`} className={navLinkClass}>
                  <FileText className="h-4 w-4" />
                  Documents
                </NavLink>
              )}
              {!roleLoading && isManager && (
                <NavLink to={`/chamas/${chamaId}/approvals`} className={navLinkClass}>
                  <ShieldCheck className="h-4 w-4" />
                  Approvals
                </NavLink>
              )}
            </>
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink/10 bg-white px-6 py-3">
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
