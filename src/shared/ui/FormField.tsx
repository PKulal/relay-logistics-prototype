import { cn } from '@/shared/lib/utils'
import { Input } from './input'
import { Label } from './label'

interface FieldProps {
  label: string
  htmlFor?: string
  children: React.ReactNode
  /** Already-translated error message */
  error?: string
  hint?: React.ReactNode
  required?: boolean
  small?: boolean
  className?: string
}

/** Label + control + error/hint (design-system.md §8: every field has a visible label). */
export function Field({ label, htmlFor, children, error, hint, required, small, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className={small ? 'text-caption' : undefined}>
        {label}
        {required && (
          <span className="text-status-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-caption font-medium text-status-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-caption text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

/** Numeric text input (keeps digits and one decimal point) with a label. */
export function NumField({ label, id, value, onChange, error, small = true }: { label: string; id: string; value: string; onChange: (v: string) => void; error?: string; small?: boolean }) {
  return (
    <Field label={label} htmlFor={id} small={small} error={error}>
      <Input id={id} inputMode="decimal" className="tabular" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!error} />
    </Field>
  )
}
