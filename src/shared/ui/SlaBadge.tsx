import { useTranslation } from 'react-i18next'
import type { SlaState } from '@shared/engines/sla'
import type { IsoDateTime } from '@shared/types'
import { Chip } from './StatusChip'
import type { Tone } from './tones'

const TONE: Record<SlaState, Tone> = { onTrack: 'success', atRisk: 'warning', breached: 'danger', done: 'neutral' }

function duration(ms: number) {
  const mins = Math.round(Math.abs(ms) / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** SLA state chip with the time left (or overdue) against the demo clock: "Amber 2h 10m". */
export function SlaBadge({ state, dueAt, now }: { state: SlaState; dueAt?: IsoDateTime; now: IsoDateTime }) {
  const { t } = useTranslation()
  if (state === 'done' || !dueAt) return <Chip tone={TONE[state]}>{t(`slaState.${state}`)}</Chip>
  const left = Date.parse(dueAt) - Date.parse(now)
  return (
    <Chip tone={TONE[state]} className="tabular">
      {t(`slaState.${state}`)} · {left >= 0 ? t('sla.left', { time: duration(left) }) : t('sla.breachedBy', { time: duration(left) })}
    </Chip>
  )
}
