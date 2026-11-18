import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/** Styled native <select>: accessible, mobile-friendly and easy to test. */
export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select
        {...props}
        className="h-9 w-full appearance-none rounded-md border border-input bg-background pr-8 pl-3 text-body shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-invalid:border-destructive"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  )
}
