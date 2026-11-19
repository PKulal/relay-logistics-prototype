/**
 * PA-05 Home (today) — docs/03-partner-app.md §6.1.
 * Today's work at a glance and the next task. Content by role.
 */
import { Banknote, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { cashInHand } from '@shared/engines/receivables'
import { nextTask, riderCounts, tasksFor } from '@shared/engines/fieldTasks'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatINR } from '@shared/lib/format'
import { TaskCard } from './TaskCard'
import { useFieldSession } from './useFieldSession'

export default function PA05Home() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const tasks = useMemo(() => tasksFor(data, staff.id, now), [data, staff.id, now])
  const next = nextTask(tasks)
  const codInHand = cashInHand(data, staff.id).reduce((s, c) => s + c.amount, 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa05.hello', { name: staff.name.split(' ')[0] })}</h1>

      {/* Next task */}
      <section aria-labelledby="next-h" className="flex flex-col gap-2">
        <h2 id="next-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('pa05.next')}
        </h2>
        {next ? <TaskCard task={next} emphasis /> : <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa05.nothing')}</p>}
      </section>

      {/* Today, by role */}
      <section aria-labelledby="today-h">
        <h2 id="today-h" className="mb-2 text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('pa05.today')}
        </h2>
        {staff.role === 'rider' && (() => {
          const c = riderCounts(tasks)
          return (
            <div className="grid grid-cols-3 gap-2">
              <Tile label={t('pa05.pickups')} value={`${c.pickupsDone}/${c.pickupsDone + c.pickupsTodo}`} />
              <Tile label={t('pa05.deliveries')} value={`${c.deliveriesDone}/${c.deliveriesDone + c.deliveriesTodo}`} />
              <Tile label={t('pa05.failed')} value={String(c.failed)} danger={c.failed > 0} />
            </div>
          )
        })()}
        {staff.role === 'driver' && (
          <div className="flex flex-col gap-2">
            {tasks
              .filter((x) => x.kind === 'trip' && x.state !== 'done')
              .map((x) => (
                <div key={x.leg.id} className="rounded-2xl border bg-card p-4">
                  <p className="font-bold">{x.place}</p>
                  <p className="tabular text-muted-foreground">
                    {x.leg.id} · {t('pa05.departs', { time: x.leg.window.from.slice(11, 16) })}
                  </p>
                </div>
              ))}
          </div>
        )}
        {staff.role === 'hub' && (
          <div className="grid grid-cols-2 gap-2">
            <Tile label={t('pa05.inbound')} value={String(tasks.filter((x) => (x.kind === 'hub' || x.kind === 'receive') && x.state === 'todo').length)} />
            <Tile label={t('pa05.atHub')} value={String(tasks.filter((x) => x.kind === 'hub' && x.state === 'inProgress').length)} />
          </div>
        )}
      </section>

      {staff.role === 'rider' &&
        (codInHand > 0 ? (
          // PA-36 opened from the Home banner: deposit within 24 h (source §9)
          <Link to="/app/cod" className="flex items-center gap-3 rounded-2xl border-2 border-status-warning bg-status-warning-bg p-4" data-testid="cod-banner">
            <Banknote className="size-7 shrink-0 text-status-warning" aria-hidden />
            <span className="flex-1">
              <span className="block font-semibold">{t('pa05.cod')}</span>
              <span className="text-[13px]">{t('pa05.codDeposit')}</span>
            </span>
            <span className="tabular text-[18px] font-bold">{formatINR(codInHand)}</span>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
            <span className="font-semibold">{t('pa05.cod')}</span>
            <span className="tabular text-[18px] font-bold">{formatINR(0)}</span>
          </div>
        ))}

    </div>
  )
}

function Tile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <p className={cn('tabular font-heading text-[24px] font-bold', danger && 'text-status-danger')}>{value}</p>
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  )
}
