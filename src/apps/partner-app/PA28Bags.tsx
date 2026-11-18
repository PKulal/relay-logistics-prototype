/**
 * PA-28 Close bag, manifest and seal — docs/03-partner-app.md §6.5.
 * Pick a bag, check its contents, seal it, photograph it and add it to a
 * manifest for a vehicle. SIMULATED: "Scan bag" and "Scan seal" read the next
 * bag and the next seal on the hub's roll.
 */
import { ArrowLeft, CheckCircle2, Package, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { bagLabel, destinationName, openManifestsFor, toneOf, tripFor } from '@shared/engines/hub'
import { formatTime } from '@shared/lib/format'
import { nextBagSeal, SEAL_PATTERN } from '@shared/sim/seals'
import { useDemoStore } from '@shared/store'
import type { Bag } from '@shared/types'
import { AccessDenied } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card } from './FieldUi'
import { ManifestPrintButton } from './ManifestPrint'
import { TONE_CLASS, useHub } from './useHub'

export default function PA28Bags() {
  const { t } = useTranslation()
  const { data, hubId } = useHub()
  const [params, setParams] = useSearchParams()
  const bagId = params.get('bag') ?? ''
  if (!hubId) return <div className="p-4"><AccessDenied /></div>

  const bags = Object.values(data.bags)
    .filter((b) => b.hubId === hubId && b.status !== 'dispatched' && b.status !== 'received')
    .sort((a, b) => a.id.localeCompare(b.id))
  const open = bags.filter((b) => b.status === 'open')
  const sealed = bags.filter((b) => b.status === 'sealed')
  const select = (id: string) => setParams(id ? { bag: id } : {})
  const bag = data.bags[bagId]

  if (bag) return <BagDetail key={bag.id} bag={bag} hubId={hubId} onBack={() => select('')} />

  const firstToSeal = open.find((b) => b.pieceIds.length > 0)
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa28.title')}</h1>
      <button
        type="button"
        disabled={!firstToSeal}
        onClick={() => firstToSeal && select(firstToSeal.id)}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40"
      >
        <ScanLine className="size-5" aria-hidden /> {t('pa28.scanBag')} <SimulatedTag />
      </button>

      <section className="flex flex-col gap-2" aria-labelledby="open-h">
        <h2 id="open-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('pa28.open')} · {open.length}
        </h2>
        {open.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa28.noOpen')}</p>}
        {open.map((b) => (
          <BagRow key={b.id} bag={b} hubId={hubId} onClick={() => select(b.id)} />
        ))}
      </section>

      {sealed.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="sealed-h">
          <h2 id="sealed-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('pa28.sealed')} · {sealed.length}
          </h2>
          {sealed.map((b) => (
            <BagRow key={b.id} bag={b} hubId={hubId} />
          ))}
        </section>
      )}
    </div>
  )
}

function BagRow({ bag, hubId, onClick }: { bag: Bag; hubId: string; onClick?: () => void }) {
  const { t } = useTranslation()
  const data = useDemoStore((s) => s.data)
  const body = (
    <>
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl border-2', TONE_CLASS[toneOf(bag.destination)])}>
        <Package className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-bold">
          {bagLabel(bag)} · {destinationName(data, bag.destination, hubId)}
        </span>
        <span className="tabular block text-[13px] text-muted-foreground">
          {t('pa25.pcs', { count: bag.pieceIds.length })}
          {bag.sealNo ? ` · ${bag.sealNo} · ${bag.manifestId}` : ''}
        </span>
      </span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-2">
      {body}
    </button>
  ) : (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-2">{body}</div>
  )
}

function BagDetail({ bag, hubId, onBack }: { bag: Bag; hubId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const data = useDemoStore((s) => s.data)
  const { staff } = useHub()
  const manifests = openManifestsFor(data, hubId, bag.destination)
  const [seal, setSeal] = useState('')
  const [weight, setWeight] = useState(0)
  const [photo, setPhoto] = useState('')
  const [manifestId, setManifestId] = useState(manifests[0]?.id ?? 'new')
  const dest = destinationName(data, bag.destination, hubId)
  const sealOk = SEAL_PATTERN.test(seal)
  const nextTrip = tripFor(data, hubId, bag.destination)

  if (bag.status === 'sealed') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <section className="flex flex-col items-center gap-2 rounded-2xl border-2 border-status-success bg-status-success-bg p-6 text-center" role="status">
          <CheckCircle2 className="size-12 text-status-success" aria-hidden />
          <p className="font-heading text-[22px] font-bold">{t('pa28.sealedTitle', { bag: bagLabel(bag) })}</p>
          <p className="tabular">{t('pa28.sealedLine', { seal: bag.sealNo, manifest: bag.manifestId })}</p>
        </section>
        {bag.manifestId && <ManifestPrintButton manifestId={bag.manifestId} />}
        <button type="button" onClick={onBack} className="min-h-14 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
          {t('pa28.backToBags')}
        </button>
      </div>
    )
  }

  const ready = bag.pieceIds.length > 0 && sealOk && !!photo
  const sealIt = () => {
    useDemoStore.getState().sealBag({ bagId: bag.id, sealNo: seal, weightKg: weight > 0 ? weight : undefined, photo, manifestId: manifestId === 'new' ? undefined : manifestId, staffId: staff.id })
    toast.success(t('pa28.done', { bag: bagLabel(bag), seal }))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={onBack} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div className={cn('rounded-2xl border-2 p-4 text-center', TONE_CLASS[toneOf(bag.destination)])}>
        <p className="font-heading text-[32px] leading-none font-bold">{bagLabel(bag)}</p>
        <p className="font-heading text-[20px] font-bold">{dest}</p>
      </div>

      <Card title={t('pa28.contentsCount', { count: bag.pieceIds.length })}>
        {bag.pieceIds.length === 0 && <p className="text-muted-foreground">{t('pa28.emptyBag')}</p>}
        <ul className="flex flex-col divide-y">
          {bag.pieceIds.map((p) => (
            <li key={p} className="flex min-h-12 items-center justify-between gap-2">
              <span className="tabular">{p}</span>
              <button type="button" onClick={() => useDemoStore.getState().removeFromBag(bag.id, p)} className="min-h-12 px-2 text-[13px] font-semibold text-status-danger" aria-label={t('pa28.removeLabel', { piece: p })}>
                {t('pa28.remove')}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('pa28.seal')}>
        <div className="flex gap-2">
          <input aria-label={t('pa28.seal')} placeholder="SL-#####" value={seal} onChange={(e) => setSeal(e.target.value.toUpperCase().trim())} className="tabular h-12 min-w-0 flex-1 rounded-lg border border-input px-3 text-[18px]" />
          <button type="button" onClick={() => setSeal(nextBagSeal(data, hubId))} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary px-3 font-semibold text-primary">
            <ScanLine className="size-5" aria-hidden /> {t('pa28.scanSeal')}
          </button>
        </div>
        <SimulatedTag className="mt-1" />
        {seal && !sealOk && <p className="mt-1 text-[13px] font-medium text-status-danger">{t('pa28.sealFormat')}</p>}
      </Card>

      <Card title={t('pa28.weightOptional')}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          aria-label={t('pa28.weight')}
          value={weight > 0 ? weight : ''}
          onChange={(e) => setWeight(e.target.valueAsNumber || 0)}
          className="tabular h-12 w-full rounded-lg border border-input px-3 text-[16px]"
        />
      </Card>

      <Card title={t('pa28.photoTitle')}>
        <PhotoCapture label={t('pa28.photo')} caption={`${bagLabel(bag)} · ${seal || 'SL-'}`} value={photo} onChange={setPhoto} idBase={`${bag.id}-sealed`} required />
      </Card>

      <Card title={t('pa28.manifest')}>
        <select aria-label={t('pa28.manifest')} value={manifestId} onChange={(e) => setManifestId(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-background px-3 text-[16px]">
          {manifests.map((m) => {
            const trip = m.tripId ? data.trips[m.tripId] : undefined
            return (
              <option key={m.id} value={m.id}>
                {m.id} · {dest}
                {trip ? ` · ${data.vehicles[trip.vehicleId]?.regNo} · ${formatTime(trip.departAt)}` : ''}
              </option>
            )
          })}
          <option value="new">{t('pa28.newManifest')}</option>
        </select>
        {manifestId === 'new' && <p className="mt-1 text-[13px] text-muted-foreground">{nextTrip ? t('pa28.newOnTrip', { trip: nextTrip.id, time: formatTime(nextTrip.departAt) }) : t('pa28.newNoTrip')}</p>}
      </Card>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={sealIt} className="min-h-14 w-full rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          {t('pa28.sealAndAdd')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa28.todo')}</p>}
      </div>
    </div>
  )
}
