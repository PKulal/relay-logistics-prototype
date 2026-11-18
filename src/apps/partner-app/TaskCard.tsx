/** A task card for the phone (PA-05 next task, PA-06 list): big text, 48 px targets. */
import { ArrowLeftRight, Boxes, ChevronRight, Navigation, PackageCheck, PhoneCall, Truck, Warehouse } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import type { Task, TaskKind } from '@shared/engines/fieldTasks'
import { taskDistance } from '@shared/engines/fieldTasks'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDayShort } from '@shared/lib/format'
import { useFieldSession } from './useFieldSession'

const ICON: Record<TaskKind, typeof Truck> = { pickup: Boxes, handover: ArrowLeftRight, trip: Truck, hub: Warehouse, delivery: PackageCheck }

const SLA_CLASS = {
  onTrack: 'text-status-success',
  atRisk: 'text-status-warning',
  breached: 'text-status-danger',
  done: 'text-muted-foreground',
}

export function TaskCard({ task, emphasis }: { task: Task; emphasis?: boolean }) {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const Icon = ICON[task.kind]
  const dist = taskDistance(data, staff, task)
  const loc = task.kind === 'pickup' ? data.pickupLocations[task.shipment.pickupLocationId] : undefined
  const isNew = task.newNotificationIds.length > 0
  const today = task.leg.window.from.slice(0, 10) === now.slice(0, 10)

  return (
    <article className={cn('rounded-2xl border bg-card shadow-card', emphasis && 'border-primary', isNew && 'ring-2 ring-brand-amber')}>
      <Link to={`/app/tasks/${task.leg.id}`} className="flex items-start gap-3 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{t(`pa.task.${task.kind}`)}</span>
            {isNew && <span className="rounded-full bg-brand-amber px-2 text-[12px] font-bold text-ink">{t('pa.new')}</span>}
          </span>
          <span className="block truncate">{task.place}</span>
          <span className={cn('tabular block font-semibold', SLA_CLASS[task.sla])}>
            {!today && `${formatDayShort(task.leg.window.from)} `}
            {task.leg.window.from.slice(11, 16)}–{task.leg.window.to.slice(11, 16)}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5 text-[13px] text-muted-foreground">
            <span>{t('pp.pcs', { count: task.shipment.pieces.length })}</span>
            {dist !== undefined && <span>· {t('pa.km', { km: dist })}</span>}
            {task.tags.map((tag) => (
              <span key={tag} className="rounded bg-gray-100 px-1.5 text-gray-700">
                {t(`pa.tag.${tag}`)}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight className="mt-3 size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {loc && task.state === 'todo' && (
        <div className="grid grid-cols-2 border-t">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 font-semibold text-primary">
            <Navigation className="size-4" aria-hidden /> {t('pa.navigate')}
          </a>
          <button type="button" onClick={() => toast.success(t('pa.calling', { name: loc.contact.name }))} className="flex min-h-12 items-center justify-center gap-2 border-l font-semibold text-primary">
            <PhoneCall className="size-4" aria-hidden /> {t('pa.call')}
          </button>
        </div>
      )}
    </article>
  )
}
