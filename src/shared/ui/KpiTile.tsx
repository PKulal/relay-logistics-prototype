import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from './skeleton'
import type { Tone } from './tones'

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  info: 'text-status-info',
  neutral: 'text-muted-foreground',
}

interface KpiTileProps {
  label: string
  value: React.ReactNode
  /** Small line under the value, e.g. "+12 vs yesterday" */
  hint?: React.ReactNode
  hintTone?: Tone
  icon?: LucideIcon
  loading?: boolean
  onClick?: () => void
  className?: string
}

/** A dashboard number (design-system.md §6). Numbers use Montserrat and tabular figures. */
export function KpiTile({ label, value, hint, hintTone = 'neutral', icon: Icon, loading, onClick, className }: KpiTileProps) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-xl border bg-card p-4 text-left shadow-card',
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-primary" aria-hidden />}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="tabular font-heading text-page-title font-bold">{value}</span>
      )}
      {hint && !loading && <span className={cn('text-caption', TONE_TEXT[hintTone])}>{hint}</span>}
    </Comp>
  )
}
