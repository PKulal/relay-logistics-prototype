import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { STATUS_TRACK } from '@shared/engines/tracking'
import type { Shipment } from '@shared/types'

/** Source §7.1: the seven-step status track. */
export function StatusTrack({ step, status }: { step: number; status: Shipment['status'] }) {
  const { t } = useTranslation()
  const exception = status === 'undelivered' || status === 'deliveredWithException' || status === 'returnToOrigin'
  return (
    <div>
      <ol className="grid grid-cols-7 gap-1" aria-label={t('cp17.track')}>
        {STATUS_TRACK.map((st, i) => (
          <li key={st} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-1.5">
            <span className={cn('h-2 rounded-full', i < step || (i === step && !exception) ? 'bg-primary' : i === step ? 'bg-status-warning' : 'bg-gray-100')} />
            <span className={cn('text-[11px] leading-tight sm:text-caption', i === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{t(`status.shipment.${st}`)}</span>
          </li>
        ))}
      </ol>
      {exception && <p className="mt-2 text-caption font-semibold text-status-warning">{t(`status.shipment.${status}`)}</p>}
    </div>
  )
}
