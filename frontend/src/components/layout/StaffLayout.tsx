import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import { Users, Wallet, Building2, LogOut } from 'lucide-react'
import ZamuMark from '../marketing/ZamuMark'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-paper/70 hover:bg-white/10 hover:text-paper'
  }`

export default function StaffLayout() {
  const { keycloak } = useKeycloak()
  const { chamaId } = useParams<{ chamaId?: string }>()

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="w-64 shrink-0 bg-night text-paper flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <ZamuMark className="h-6 w-6 text-warning" />
          <span className="font-mono text-lg font-bold">Webchama</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavLink to="/chamas" end className={navLinkClass}>
            <Building2 className="h-4 w-4" />
            Chamas
          </NavLink>

          {chamaId && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-paper/40">
                This chama
              </p>
              <NavLink to={`/chamas/${chamaId}/members`} className={navLinkClass}>
                <Users className="h-4 w-4" />
                Members
              </NavLink>
              <NavLink to={`/chamas/${chamaId}/contributions`} className={navLinkClass}>
                <Wallet className="h-4 w-4" />
                Contributions
              </NavLink>
            </>
          )}
        </nav>

        <button
          onClick={() => keycloak.logout()}
          className="flex items-center gap-3 px-3 py-4 mx-3 mb-3 rounded-lg text-sm font-medium text-paper/70 hover:bg-white/10 hover:text-paper border-t border-white/10"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </aside>

      <main className="flex-1 p-6 lg:p-8 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  )
}
