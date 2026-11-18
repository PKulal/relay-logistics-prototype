import { Inbox, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface EmptyStateProps {
  title: string
  body?: string
  icon?: LucideIcon
  /** The next action (design-system.md §7: every list has an empty state with a next action) */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, body, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="mt-2 text-card-title">{title}</h3>
      {body && <p className="max-w-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
