import Spinner from './Spinner'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  spinnerColor?: 'primary' | 'white'
}

export default function LoadingButton({
  loading = false,
  loadingText,
  spinnerColor = 'primary',
  children,
  disabled,
  className = '',
  type = 'button',
  ...props
}: Props) {
  return (
    <button type={type} {...props} disabled={disabled || loading} className={className}>
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner size="sm" color={spinnerColor} />
          {loadingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
