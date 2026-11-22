import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cx } from '@/lib/cx'

const CONTROL =
  'w-full rounded-xl border bg-background px-4 text-foreground placeholder:text-muted transition-colors focus:border-accent focus:outline-none aria-[invalid=true]:border-danger'

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string
  optionalLabel?: string
  children: ReactNode
}

function FieldShell({ id, label, hint, error, optionalLabel, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm">
        {label}
        {optionalLabel && <span className="text-muted"> ({optionalLabel})</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-2 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`
  return hint ? `${id}-hint` : undefined
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  optionalLabel?: string
}

export function TextField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...props
}: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={cx(CONTROL, 'min-h-12 border-border', className)}
        {...props}
      />
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string
  optionalLabel?: string
}

export function TextAreaField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...props
}: TextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={cx(CONTROL, 'resize-none border-border py-3', className)}
        {...props}
      />
    </FieldShell>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={cx(CONTROL, 'min-h-12 border-border', className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}
