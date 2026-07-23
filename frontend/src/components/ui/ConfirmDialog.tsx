import Modal from './Modal'
import Button from './Button'
import LoadingButton from './LoadingButton'
import type { ButtonVariant } from './Button'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ButtonVariant
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Replaces the native window.confirm() dialog with the app's own modal, so
 * destructive/confirming actions match the rest of the app's focus-trapped,
 * on-brand modal pattern instead of an unstyled browser-native prompt.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-ink/80">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <LoadingButton variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </LoadingButton>
      </div>
    </Modal>
  )
}
