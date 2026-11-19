/**
 * PA-25 "Exceptions" tile: open short / excess / seal / damage tickets on
 * shipments passing this hub, and the PA-30 report form.
 */
import { Plus, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { formatDayShort, formatTime } from '@shared/lib/format'
import { isBefore } from '@shared/lib/time'
import { AccessDenied } from '@shared/ui/Page'
import { useHub } from './useHub'

export default function HubExceptions() {
  const { t } = useTranslation()
  const { data, now, hubId, items } = useHub()
  if (!hubId) return <div className="p-4"><AccessDenied /></div>
  const legIds = new Set(items.flatMap((i) => [i.leg.id, i.from.id]))
  const open = Object.values(data.exceptions)
    .filter((x) => x.status !== 'resolved' && x.legId && legIds.has(x.legId))
    .sort((a, b) => a.actionDueAt.localeCompare(b.actionDueAt))

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa25.tile.exceptions')}</h1>
      <Link to="/app/hub/exceptions/new" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground">
        <Plus className="size-5" aria-hidden /> {t('pa30.open')}
      </Link>
      {open.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('hubx.none')}</p>}
      {open.map((x) => {
        const overdue = isBefore(x.actionDueAt, now)
        return (
          <article key={x.id} className="flex gap-3 rounded-2xl border bg-card p-4">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-status-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t(`hubx.kind.${x.type}`)}</p>
              <p className="tabular text-[13px] text-muted-foreground">
                {x.shipmentId} · {x.id} · {data.partners[x.ownerPartnerId ?? '']?.shortName}
              </p>
              <p className={cn('tabular text-[13px] font-semibold', overdue ? 'text-status-danger' : 'text-muted-foreground')}>
                {t('hubx.due', { time: `${formatDayShort(x.actionDueAt)} ${formatTime(x.actionDueAt)}` })}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
