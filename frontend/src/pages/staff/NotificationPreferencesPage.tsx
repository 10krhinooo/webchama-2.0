import { useEffect, useState } from 'react'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  EVENT_FAMILY_LABELS,
  type NotificationEventFamily,
  type NotificationPreference,
} from '../../api/notifications'
import { extractErrorMessage } from '../../api/client'
import Card from '../../components/ui/Card'
import LoadingButton from '../../components/ui/LoadingButton'
import FormError from '../../components/ui/FormError'
import TransientAlert from '../../components/ui/TransientAlert'
import { SkeletonLine } from '../../components/ui/Skeleton'

const FAMILIES = Object.keys(EVENT_FAMILY_LABELS) as NotificationEventFamily[]

/** Absent rows mean both channels are on, so an unsaved family starts fully enabled. */
function toMap(preferences: NotificationPreference[]): Record<string, NotificationPreference> {
  const map: Record<string, NotificationPreference> = {}
  for (const family of FAMILIES) {
    map[family] = { eventFamily: family, inAppEnabled: true, emailEnabled: true }
  }
  for (const preference of preferences) {
    map[preference.eventFamily] = preference
  }
  return map
}

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<Record<string, NotificationPreference>>(toMap([]))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getNotificationPreferences()
      .then((loaded) => {
        if (!cancelled) setPreferences(toMap(loaded))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(extractErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (family: NotificationEventFamily, channel: 'inAppEnabled' | 'emailEnabled') => {
    setPreferences((current) => ({
      ...current,
      [family]: { ...current[family], [channel]: !current[family][channel] },
    }))
  }

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await updateNotificationPreferences(FAMILIES.map((family) => preferences[family]))
      setPreferences(toMap(saved))
      setNotice('Notification preferences saved.')
    } catch (err) {
      setSaveError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="page-notification-preferences" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Notification preferences</h1>
        <p className="text-sm text-muted">
          Choose how you hear about each kind of event. These apply across every chama you belong to.
        </p>
      </div>

      {notice && <TransientAlert variant="success" message={notice} onDismiss={() => setNotice(null)} />}

      {loading ? (
        <Card className="space-y-3">
          {FAMILIES.slice(0, 6).map((family) => (
            <SkeletonLine key={family} className="h-6 w-full" />
          ))}
        </Card>
      ) : loadError ? (
        <FormError message={loadError} />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Notification preferences by event type</caption>
            <thead className="border-b border-border bg-paper-dim">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-ink/80">Event</th>
                <th scope="col" className="px-4 py-3 text-center font-medium text-ink/80">In app</th>
                <th scope="col" className="px-4 py-3 text-center font-medium text-ink/80">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FAMILIES.map((family) => (
                <tr key={family}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
                    {EVENT_FAMILY_LABELS[family]}
                  </th>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={preferences[family].inAppEnabled}
                      onChange={() => toggle(family, 'inAppEnabled')}
                      // The row header alone is not a label, so each control names both the event
                      // and the channel it controls.
                      aria-label={`${EVENT_FAMILY_LABELS[family]} in app`}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={preferences[family].emailEnabled}
                      onChange={() => toggle(family, 'emailEnabled')}
                      aria-label={`${EVENT_FAMILY_LABELS[family]} email`}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <FormError message={saveError} />

      <div className="flex justify-end">
        <LoadingButton onClick={save} loading={saving} loadingText="Saving…" disabled={loading || !!loadError}>
          Save preferences
        </LoadingButton>
      </div>
    </div>
  )
}
