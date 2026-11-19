import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  error?: string
  invalid?: boolean
  trailing?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, error, invalid = false, trailing, ...input },
  ref,
) {
  const describedBy = error ? `${id}-error` : undefined
  const isInvalid = invalid || Boolean(error)

  return (
    <div className={`field${isInvalid ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input
          {...input}
          ref={ref}
          id={id}
          className="field__input"
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
        />
        {trailing}
      </div>
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 4.6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11.2" r="0.8" fill="currentColor" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  )
})
