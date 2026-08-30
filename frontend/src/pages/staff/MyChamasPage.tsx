import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import { getMyChamas, joinChama, type MyChama, type JoinChamaRequest } from '../../api/chamas'
import { extractErrorMessage } from '../../api/client'
import { roleBadgeText } from '../../utils/roleBadges'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import FormError from '../../components/ui/FormError'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import PhoneInput from '../../components/ui/PhoneInput'
import LoadingButton from '../../components/ui/LoadingButton'

const EMPTY_JOIN_FORM: JoinChamaRequest = {
  joinCode: '',
  fullName: '',
  phone: '',
  nationalId: '',
  nextOfKin: '',
}

export default function MyChamasPage() {
  const [chamas, setChamas] = useState<MyChama[]>([])
  const [loading, setLoading] = useState(true)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinForm, setJoinForm] = useState(EMPTY_JOIN_FORM)
  const [joining, setJoining] = useState(false)
  const [joinNotice, setJoinNotice] = useState<string | null>(null)
  const navigate = useNavigate()
  const { keycloak } = useKeycloak()
  const isSuperAdmin = keycloak.hasRealmRole('SUPER_ADMIN')

  const refresh = () => getMyChamas().then(setChamas).finally(() => setLoading(false))

  useEffect(() => {
    if (isSuperAdmin) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  const openJoinModal = () => {
    setJoinForm(EMPTY_JOIN_FORM)
    setJoinNotice(null)
    setShowJoinModal(true)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoining(true)
    setJoinNotice(null)
    try {
      const payload: JoinChamaRequest = {
        joinCode: joinForm.joinCode.trim().toUpperCase(),
        fullName: joinForm.fullName,
        phone: joinForm.phone,
        nationalId: joinForm.nationalId || undefined,
        nextOfKin: joinForm.nextOfKin || undefined,
      }
      const member = await joinChama(payload)
      setShowJoinModal(false)
      await refresh()
      navigate(`/chamas/${member.chamaId}/dashboard`)
    } catch (err) {
      setJoinNotice(extractErrorMessage(err))
    } finally {
      setJoining(false)
    }
  }

  // SUPER_ADMIN has no default chama membership (MIGRATION_PLAN.md section 5), the platform
  // overview is its real landing page, not a per-chama picker.
  if (isSuperAdmin) {
    return <Navigate to="/admin/overview" replace />
  }

  const tokenParsed = keycloak.tokenParsed as { given_name?: string; name?: string } | undefined
  const firstName = tokenParsed?.given_name ?? tokenParsed?.name?.split(' ')[0]

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-paper-dim" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {firstName && <p className="text-sm text-muted">Hello, {firstName}</p>}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">My Chamas</h1>
        <div className="flex items-center gap-4">
          <button onClick={openJoinModal} className="text-sm font-semibold text-brand hover:underline">
            Join a chama
          </button>
          <Link to="/chamas" className="text-sm font-semibold text-brand hover:underline">
            Manage chamas
          </Link>
        </div>
      </div>

      {chamas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-muted text-sm">
          You are not part of any chama yet.{' '}
          <Link to="/chamas" className="font-semibold text-brand hover:underline">
            Start one
          </Link>{' '}
          or{' '}
          <button onClick={openJoinModal} className="font-semibold text-brand hover:underline">
            join an existing one
          </button>
          .
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chamas.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/chamas/${c.id}/dashboard`)}
              className="rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/*
                The surface is the Card's, not this button's. h-full keeps a row of cards level
                when one chama carries a description and its neighbour does not.
              */}
              <Card className="h-full space-y-3 transition-shadow hover:shadow-card-hover">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-heading font-semibold text-ink">{c.name}</h2>
                  <Badge label={roleBadgeText(c.superAdmin, c.roles)} variant={c.superAdmin ? 'primary' : 'success'} />
                </div>
                {c.description && <p className="text-sm text-muted line-clamp-2">{c.description}</p>}
                <p className="font-mono text-xs text-muted">
                  {c.type.replaceAll('_', ' ')} &middot; {c.currency} {c.contributionAmount.toLocaleString()} /{' '}
                  {c.contributionFrequency.toLowerCase()}
                </p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {showJoinModal && (
        <Modal title="Join a chama" onClose={() => setShowJoinModal(false)}>
          <form onSubmit={handleJoin} className="space-y-4">
            {joinNotice && (
              <FormError message={joinNotice} />
            )}
            <FormField label="Join code" htmlFor="join-code" required hint="Ask the chama's chairperson for their join code.">
              <Input
                id="join-code"
                required
                value={joinForm.joinCode}
                onChange={(e) => setJoinForm({ ...joinForm, joinCode: e.target.value })}
                className="font-mono uppercase tracking-widest"
                placeholder="e.g. AB12CD34"
              />
            </FormField>
            <FormField label="Your full name" htmlFor="join-full-name" required>
              <Input
                id="join-full-name"
                required
                value={joinForm.fullName}
                onChange={(e) => setJoinForm({ ...joinForm, fullName: e.target.value })}
              />
            </FormField>
            <FormField label="Your phone" htmlFor="join-phone" required>
              <PhoneInput id="join-phone" value={joinForm.phone} onChange={(v) => setJoinForm({ ...joinForm, phone: v })} required />
            </FormField>
            <FormField label="National ID" htmlFor="join-national-id">
              <Input
                id="join-national-id"
                value={joinForm.nationalId}
                onChange={(e) => setJoinForm({ ...joinForm, nationalId: e.target.value })}
              />
            </FormField>
            <FormField label="Next of kin" htmlFor="join-next-of-kin">
              <Input
                id="join-next-of-kin"
                value={joinForm.nextOfKin}
                onChange={(e) => setJoinForm({ ...joinForm, nextOfKin: e.target.value })}
              />
            </FormField>
            <LoadingButton type="submit" loading={joining} loadingText="Joining…" className="w-full">
              Join Chama
            </LoadingButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
