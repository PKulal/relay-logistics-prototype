import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface StepperProps {
  steps: string[]
  /** Index of the current step (0-based). Earlier steps show as done. */
  current: number
  onStepClick?: (index: number) => void
  className?: string
}

/** Multi-step form header (design-system.md §6). Done steps can be clicked to go back. */
export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn('flex w-full items-center gap-2', className)}>
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        const clickable = done && !!onStepClick
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              aria-current={active ? 'step' : undefined}
              className={cn('flex items-center gap-2 text-left', clickable ? 'cursor-pointer' : 'cursor-default')}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-caption font-semibold',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-gray-100 text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn('hidden text-caption md:inline', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {label}
              </span>
            </button>
            {i < steps.length - 1 && <span className={cn('h-0.5 flex-1 rounded', done ? 'bg-primary' : 'bg-gray-100')} />}
          </li>
        )
      })}
    </ol>
  )
}
