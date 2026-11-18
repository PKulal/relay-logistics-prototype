import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDemoNow } from '@shared/hooks/useDemo'
import { cn } from '@/shared/lib/utils'
import type { IsoDateTime } from '@shared/types'

interface SlaTimerProps {
  dueAt: IsoDateTime
  /** Total SLA length in minutes; the timer turns amber when less than `amberPct` of it is left. */
  totalMinutes?: number
  amberPct?: number
  className?: string
}

/**
 * Time left until an SLA (design-system.md §6): green → amber → red.
 * Remaining time is measured from the demo clock (`demoNow`). Between demo-clock
 * changes it ticks down once a second so the screen feels live; the tick resets
 * whenever demoNow moves, so all tabs agree after every toolbar action.
 */
export function SlaTimer({ dueAt, totalMinutes = 120, amberPct = 25, className }: SlaTimerProps) {
  const { t } = useTranslation()
  const demoNow = useDemoNow()
  // Seconds ticked since demoNow last changed. Ticks recorded against an older demoNow don't count.
  const [ticks, setTicks] = useState({ forNow: demoNow, n: 0 })

  useEffect(() => {
    const id = setInterval(() => setTicks((s) => ({ forNow: demoNow, n: s.forNow === demoNow ? s.n + 1 : 1 })), 1000)
    return () => clearInterval(id)
  }, [demoNow])

  const tick = ticks.forNow === demoNow ? ticks.n : 0
  const secondsLeft = Math.round((Date.parse(dueAt) - Date.parse(demoNow)) / 1000) - tick
  const breached = secondsLeft < 0
  const amber = !breached && secondsLeft < (totalMinutes * 60 * amberPct) / 100
  const abs = Math.abs(secondsLeft)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const text = h >= 24 ? t('sla.days', { count: Math.floor(h / 24) }) : `${h ? `${h}h ` : ''}${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`

  return (
    <span
      role="timer"
      className={cn(
        'tabular inline-flex items-center rounded-md px-2 py-0.5 text-caption font-semibold',
        breached ? 'bg-status-danger-bg text-status-danger' : amber ? 'bg-status-warning-bg text-status-warning' : 'bg-status-success-bg text-status-success',
        className,
      )}
    >
      {breached ? t('sla.breachedBy', { time: text }) : t('sla.left', { time: text })}
    </span>
  )
}
