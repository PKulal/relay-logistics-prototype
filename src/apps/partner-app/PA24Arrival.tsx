/**
 * PA-24 Arrival and seal check — docs/03-partner-app.md §6.4.
 * Seals are checked in front of the hub staff before unloading; a broken seal
 * is recorded first so liability is clear (source §5.1, §10). Then the code
 * for the destination hub (PA-19 → hub's PA-20).
 */
import { MapPin, Send, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { Trip } from '@shared/types'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Card, Choice } from './FieldUi'
import { dayTime, tripFacts } from './tripView'
import { useFieldSession } from './useFieldSession'

export default function PA24Arrival({ trip }: { trip: Trip }) {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const f = tripFacts(data, trip)
  const [broken, setBroken] = useState<Record<string, string>>({})
  const ready = Object.values(broken).every(Boolean)

  const handOver = () => {
    useDemoStore.getState().handOverAtArrival({ tripId: trip.id, staffId: staff.id, broken: Object.entries(broken).map(([seal, photo]) => ({ seal, photo })) })
    if (Object.keys(broken).length) toast.warning(t('pa24.sealRecorded'))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{trip.id}</p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa24.title')}</h1>
      </div>
      <Card title={t('pa24.arrived')}>
        <p className="flex items-center gap-2 text-[18px] font-semibold">
          <MapPin className="size-5 text-primary" aria-hidden /> {f.to.name}
        </p>
        <p className="tabular text-muted-foreground">{trip.arrivedAt ? dayTime(trip.arrivedAt) : ''}</p>
      </Card>

      <Card title={t('pa24.seals')}>
        <p className="mb-2 text-[13px] text-muted-foreground">{t('pa24.sealsHelp')}</p>
        {f.seals.map((seal) => (
          <div key={seal} className="border-b py-2 last:border-0">
            <p className="tabular text-[13px] text-muted-foreground">{trip.sealNos.includes(seal) ? t('pa20m.doorSeal') : t('pa24.bagSeal')}</p>
            <Choice checked={!(seal in broken)} onClick={() => setBroken((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== seal)))} label={t('pa24.intactYes', { seal })} />
            <Choice checked={seal in broken} onClick={() => setBroken((b) => ({ ...b, [seal]: b[seal] ?? '' }))} label={t('pa24.intactNo')} />
            {seal in broken && <PhotoCapture label={t('pa20.sealPhoto')} caption={seal} value={broken[seal]} onChange={(v) => setBroken((b) => ({ ...b, [seal]: v }))} idBase={`${trip.id}-arrival-seal`} required />}
          </div>
        ))}
      </Card>

      {Object.keys(broken).length > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-status-warning bg-status-warning-bg p-3 text-[13px] font-semibold">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden /> {t('pa24.brokenNote', { partner: data.partners[data.fieldStaff[trip.driverId]?.partnerId ?? '']?.shortName ?? '' })}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={handOver} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          <Send className="size-5" aria-hidden /> {t('pa24.handOver')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa20.todo.photos')}</p>}
      </div>
    </div>
  )
}
