import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import type { Notification } from '../../api/notifications'

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * The notification bell and its panel.
 *
 * The panel is a plain popover rather than a Radix dialog: it must not trap focus or block the
 * page, since it is ambient rather than a task the user has to finish. It closes on Escape and on
 * an outside click, which is the behaviour a dialog would otherwise have provided.
 */
export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const openNotification = (notification: Notification) => {
    setOpen(false)
    if (!notification.readAt) void markRead(notification.id)
    if (notification.link) navigate(notification.link)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="notification-bell"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="true"
        // The count is in the accessible name rather than only in the badge, so it is announced
        // instead of being conveyed by a small coloured dot.
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper-dim hover:text-ink"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-panel"
          className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <p className="font-heading text-sm font-semibold text-ink">Notifications</p>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs text-brand hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate('/notification-preferences')
                }}
                className="text-xs text-muted hover:underline"
              >
                Settings
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-paper-dim ${
                      notification.readAt ? '' : 'bg-primary-light/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{notification.title}</p>
                      {!notification.readAt && (
                        <span className="sr-only">Unread</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{notification.body}</p>
                    <p className="mt-1 text-[11px] text-subtle">{relativeTime(notification.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
