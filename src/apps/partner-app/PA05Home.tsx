/**
 * PA-05 Home (today) — docs/03-partner-app.md §6.1.
 * Go on duty, today's work at a glance, start the next task. Content by role.
 */
import { MessageSquare } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { nextTask, officeMessages, riderCounts, tasksFor } from '@shared/engines/fieldTasks'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatINR, formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Switch } from '@shared/ui/switch'
import { TaskCard } from './TaskCard'
import { useFieldSession } from './useFieldSession'

export default function PA05Home() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const tasks = useMemo(() => tasksFor(data, staff.id, now), [data, staff.id, now])
  const next = nextTask(tasks)
  const messages = officeMessages(data, staff.id, now)
  const busy = tasks.some((x) => x.state === 'inProgress')
  const codInHand = Object.values(data.codRecords).filter((c) => c.collectedBy === staff.id && c.status === 'collected').reduce((s, c) => s + c.amount, 0)

  const toggleDuty = (on: boolean) => {
    // Off duty is blocked while a task is in progress or COD is in hand (assumed)
    if (!on && (busy || codInHand > 0)) {
      toast.error(t('pa05.cannotGoOff'))
      return
    }
    useDemoStore.getState().setDuty(staff.id, on)
    toast.success(on ? t('pa05.nowOn') : t('pa05.nowOff'))
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa05.hello', { name: staff.name.split(' ')[0] })}</h1>

      {/* Duty */}
      <label className={cn('flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 p-4', staff.onDuty ? 'border-primary bg-primary-soft' : 'bg-card')}>
        <span>
          <span className="block text-[18px] font-bold">{staff.onDuty ? t('pa.onDuty') : t('pa.offDuty')}</span>
          {staff.onDuty && staff.dutySince && <span className="text-[14px] text-muted-foreground">{t('pa05.since', { time: formatTime(staff.dutySince) })}</span>}
        </span>
        <Switch checked={staff.onDuty} onCheckedChange={toggleDuty} className="scale-125" aria-label={t('pa05.duty')} />
      </label>

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

      {staff.role === 'rider' && (
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <span className="font-semibold">{t('pa05.cod')}</span>
          <span className="tabular text-[18px] font-bold">{formatINR(codInHand)}</span>
        </div>
      )}

      {/* Messages from office */}
      {messages.length > 0 && (
        <section aria-labelledby="msg-h" className="flex flex-col gap-2">
          <h2 id="msg-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('pa05.messages')}
          </h2>
          {messages.map((m) => (
            <p key={`${m.legId}-${m.at}`} className="flex gap-2 rounded-2xl bg-card p-4">
              <MessageSquare className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                {m.note}
                <span className="tabular block text-[13px] text-muted-foreground">
                  {m.legId} · {formatTime(m.at)}
                </span>
              </span>
            </p>
          ))}
        </section>
      )}
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
