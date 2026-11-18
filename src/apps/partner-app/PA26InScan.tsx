/**
 * PA-26 Bulk in-scan — docs/03-partner-app.md §6.5.
 * Pick what has arrived (a rider's or truck's load), scan it in continuously,
 * optionally re-weigh, then finish: anything not scanned is marked short.
 */
import { AlertTriangle, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import type { HubItem } from '@shared/engines/hub'
import { formatKg } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { loadWeight } from '@shared/store/hubActions'
import { outsideTolerance } from '@shared/store/pickupActions'
import type { DemoData } from '@shared/types'
import { AccessDenied } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { Card, Choice } from './FieldUi'
import { useHub } from './useHub'

const SHORT_REASONS = ['notInLoad', 'labelDamaged', 'other'] as const

interface Source {
  key: string
  label: string
  items: HubItem[]
  pieceIds: string[]
}

/** Loads received at the hub and not yet in-scanned, grouped by who brought them. */
function sourcesOf(data: DemoData, items: HubItem[]): Source[] {
  const groups = new Map<string, Source>()
  for (const i of items.filter((x) => x.stage === 'toInScan')) {
    const received = Object.values(data.events)
      .filter((e) => e.legId === i.leg.id && e.type === 'handoverReceived')
      .at(-1)
    const giver = received?.counterpartStaffId ? data.fieldStaff[received.counterpartStaffId] : undefined
    const key = giver?.id ?? i.from.partnerId
    const label = `${giver ? `${giver.name} · ` : ''}${data.partners[giver?.partnerId ?? i.from.partnerId].shortName}`
    const g = groups.get(key) ?? { key, label, items: [], pieceIds: [] }
    g.items.push(i)
    g.pieceIds.push(...i.pieceIds)
    groups.set(key, g)
  }
  return [...groups.values()]
}

export default function PA26InScan() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff, data, hubId, items } = useHub()
  const sources = useMemo(() => sourcesOf(data, items), [data, items])
  const [sourceKey, setSourceKey] = useState('')
  const [scanned, setScanned] = useState<string[]>([])
  const [weighing, setWeighing] = useState(false)
  const [weight, setWeight] = useState(0)
  const [weightPhoto, setWeightPhoto] = useState('')
  const [shortReason, setShortReason] = useState<(typeof SHORT_REASONS)[number] | ''>('')
  const [finishing, setFinishing] = useState(false)

  if (!hubId) return <div className="p-4"><AccessDenied /></div>
  const source = sources.find((s) => s.key === sourceKey) ?? sources[0]

  if (!source) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="font-heading text-[22px] font-bold">{t('pa26.title')}</h1>
        <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa26.empty')}</p>
      </div>
    )
  }

  const mine = scanned.filter((p) => source.pieceIds.includes(p))
  const missing = source.pieceIds.filter((p) => !mine.includes(p))
  const pickupKg = loadWeight(data, mine.length ? mine : source.pieceIds)
  const weightDiffers = weight > 0 && outsideTolerance(data, pickupKg, weight)
  const ready = (!weighing || (weight > 0 && !!weightPhoto)) && (missing.length === 0 || !!shortReason)

  const finish = () => {
    navigate('/app/hub/sort')
    useDemoStore.getState().inScan({
      hubId,
      legIds: source.items.map((i) => i.leg.id),
      pieceIds: mine,
      staffId: staff.id,
      shortReason: shortReason ? t(`pa26.reason.${shortReason}`) : undefined,
      weightKg: weighing && weight > 0 ? weight : undefined,
      weightPhoto: weighing ? weightPhoto : undefined,
    })
    toast.success(t('pa26.done', { count: mine.length }))
    if (missing.length) toast.warning(t('pa26.doneShort', { count: missing.length }))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <h1 className="font-heading text-[22px] font-bold">{t('pa26.title')}</h1>

      <Card title={t('pa26.source')}>
        <select
          aria-label={t('pa26.source')}
          value={source.key}
          onChange={(e) => {
            setSourceKey(e.target.value)
            setScanned([])
            setFinishing(false)
          }}
          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-[16px]"
        >
          {sources.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} · {t('pa25.pcs', { count: s.pieceIds.length })}
            </option>
          ))}
        </select>
        <p className="tabular mt-1 text-[13px] text-muted-foreground">{source.items.map((i) => i.shipment.id).join(', ')}</p>
      </Card>

      <Card title={t('pa26.scan')}>
        <Scanner expected={source.pieceIds} scanned={mine} onScan={(c) => setScanned((x) => [...x, c])} continuousDefault />
        <p className="mt-2 text-[13px] text-muted-foreground">{t('pa26.excessHint')}</p>
      </Card>

      <Card title={t('pa26.weightCheck')}>
        <Choice checkbox checked={weighing} onClick={() => setWeighing(!weighing)} label={t('pa26.reweigh')} />
        {weighing && (
          <div className="mt-2 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium">{t('pa26.hubWeight')}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={weight > 0 ? weight : ''}
                onChange={(e) => setWeight(e.target.valueAsNumber || 0)}
                className="tabular h-12 w-full rounded-lg border border-input px-3 text-[16px]"
              />
            </label>
            <p className="tabular text-[13px] text-muted-foreground">
              <Scale className="mr-1 inline size-4" aria-hidden />
              {t('pa26.pickupWeight', { kg: formatKg(pickupKg) })}
            </p>
            {weightDiffers && (
              <p className="flex items-start gap-2 text-[13px] font-semibold text-status-warning" role="status">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa26.weightDiffers', { kg: formatKg(Math.abs(weight - pickupKg)) })}
              </p>
            )}
            <PhotoCapture label={t('pa26.scalePhoto')} caption={t('pa16.scaleCaption', { kg: weight })} value={weightPhoto} onChange={setWeightPhoto} idBase={`${hubId}-inscale`} required />
          </div>
        )}
      </Card>

      {finishing && missing.length > 0 && (
        <section className="rounded-2xl border-2 border-status-warning bg-status-warning-bg p-4">
          <p className="mb-1 flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5 text-status-warning" aria-hidden /> {t('pa26.shortTitle', { count: missing.length })}
          </p>
          <p className="tabular mb-2 text-[13px]">{missing.map((p) => p.slice(-9)).join(', ')}</p>
          {SHORT_REASONS.map((r) => (
            <Choice key={r} checked={shortReason === r} onClick={() => setShortReason(r)} label={t(`pa26.reason.${r}`)} />
          ))}
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        {missing.length > 0 && !finishing ? (
          <button type="button" onClick={() => setFinishing(true)} className="min-h-14 w-full rounded-2xl border-2 border-primary text-[18px] font-bold text-primary">
            {t('pa26.finishShort', { count: missing.length })}
          </button>
        ) : (
          <button type="button" disabled={!ready} onClick={finish} className={cn('min-h-14 w-full rounded-2xl text-[18px] font-bold disabled:opacity-40', missing.length ? 'bg-brand-amber text-ink' : 'bg-primary text-primary-foreground')}>
            {t('pa26.finish')}
          </button>
        )}
        {(missing.length === 0 || finishing) && !ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t(missing.length && !shortReason ? 'pa26.todo.reason' : 'pa26.todo.weight')}</p>}
      </div>
    </div>
  )
}
