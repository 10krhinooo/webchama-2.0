import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

interface Props {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

/**
 * Associates a label, an error and a hint with the control they describe.
 *
 * The association is the point. Rendering an error message next to an input leaves a screen
 * reader with no way to connect the two, so the error is announced only if the user happens to
 * navigate onto it. Wiring aria-describedby and aria-invalid onto the control means the error is
 * read out as part of the field itself.
 *
 * The control is cloned to add those attributes rather than requiring every caller to thread ids
 * through by hand, which is the kind of boilerplate that gets omitted exactly when it matters.
 * A caller that sets either attribute itself keeps its own value.
 */
export default function FormField({ label, htmlFor, required, error, hint, children }: Props) {
  const errorId = `${htmlFor}-error`
  const hintId = `${htmlFor}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  const control =
    isValidElement(children) && describedBy
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-describedby':
            (children.props as Record<string, unknown>)['aria-describedby'] ?? describedBy,
          'aria-invalid': (children.props as Record<string, unknown>)['aria-invalid'] ?? (error ? true : undefined),
        })
      : children

  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink/80">
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {control}
      {error ? (
        // role="alert" so a validation failure appearing after submit is announced immediately
        // rather than only when focus happens to land on the field.
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
