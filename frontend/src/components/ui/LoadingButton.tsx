import Spinner from './Spinner'
import Button, { type ButtonVariant } from './Button'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  loadingText?: string
  spinnerColor?: 'primary' | 'white'
}

export default function LoadingButton({
  variant = 'primary',
  loading = false,
  loadingText,
  spinnerColor,
  children,
  disabled,
  ...props
}: Props) {
  const resolvedSpinnerColor = spinnerColor ?? (variant === 'secondary' || variant === 'ghost' ? 'primary' : 'white')
  return (
    <Button variant={variant} {...props} disabled={disabled || loading}>
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner size="sm" color={resolvedSpinnerColor} />
          {loadingText ?? children}
        </span>
      ) : (
        children
      )}
    </Button>
  )
}
