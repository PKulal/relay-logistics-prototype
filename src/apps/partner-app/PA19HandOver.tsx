/**
 * PA-19 Hand over (give) — docs/03-partner-app.md §6.3.
 * Scan the goods out, take a photo, show the code. The hand-over is complete
 * only when the receiver confirms on their phone (PA-20); this screen waits for it.
 */
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { nextLegOf } from '@shared/engines/fieldTasks'
import { useData } from '@shared/hooks/useDemo'
import { formatTime } from '@shared/lib/format'
import { handoverQrValue, spacedCode } from '@shared/sim/handover'
import { useDemoStore } from '@shared/store'
import { handoverState } from '@shared/store/handoverActions'
import type { Leg } from '@shared/types'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { QrCode } from '@shared/ui/QrCode'
import { Scanner } from '@shared/ui/Scanner'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card } from './FieldUi'
import { ProblemList } from './PA20Receive'
import { useFieldSession } from './useFieldSession'

export default function PA19HandOver({ leg }: { leg: Leg }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const s = data.shipments[leg.shipmentId]
  const to = nextLegOf(data, leg)
  const receiver = to?.staffId ? data.fieldStaff[to.staffId] : undefined
  const toPartner = to ? data.partners[to.partnerId] : undefined
  const pincode = data.pincodes[to?.type === 'destHub' || to?.type === 'lastMile' ? s.destPincode : s.originPincode]
  const place = to?.type === 'lineHaul' || to?.type === 'lastMile' ? (receiver?.name ?? '') : (data.hubs[pincode.hubId!]?.name ?? pincode.city)
  const { given, received } = handoverState(data, leg.id)

  // Seals are needed when goods leave in a sealed bag or truck; a vehicle number when they go onto one
  const needsSeal = leg.type === 'originHub' || leg.type === 'lineHaul'
  const needsVehicle = to?.type === 'lineHaul'
  const [scanned, setScanned] = useState<string[]>([])
  const [seal, setSeal] = useState('')
  const [vehicle, setVehicle] = useState(to?.vehicleId ? (data.vehicles[to.vehicleId]?.regNo ?? '') : '')
  const [photo, setPhoto] = useState('')

  const expected = s.pieces.map((p) => p.id)
  const ready = scanned.length === expected.length && !!photo && (!needsSeal || !!seal.trim()) && (!needsVehicle || !!vehicle.trim())
  const receiverName = receiver?.name ?? toPartner?.shortName ?? ''

  const header = (
    <>
      <button type="button" onClick={() => navigate('/app/tasks')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{s.id}</p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa19.title')}</h1>
      </div>
      <Card title={t('pa19.to')}>
        <p className="text-[18px] font-semibold">{place}</p>
        {toPartner && (
          <p className="text-muted-foreground">
            {receiver ? `${receiver.name} · ` : ''}
            {toPartner.shortName}
          </p>
        )}
        {!receiver && <p className="mt-1 text-[13px] font-medium text-status-warning">{t('pa19.receiverMissing', { partner: toPartner?.shortName })}</p>}
      </Card>
    </>
  )

  // Done: the receiver confirmed
  if (received || leg.status === 'handedOver') {
    const exceptions = Object.values(data.exceptions).filter((x) => x.legId === leg.id && x.status !== 'resolved')
    return (
      <div className="flex flex-col gap-4 p-4">
        {header}
        <section className="flex flex-col items-center gap-2 rounded-2xl border-2 border-status-success bg-status-success-bg p-6 text-center" role="status">
          <CheckCircle2 className="size-12 text-status-success" aria-hidden />
          <p className="font-heading text-[22px] font-bold">{t('pa19.done')}</p>
          {received && <p className="tabular">{t('pa19.doneLine', { name: data.fieldStaff[received.by]?.name ?? receiverName, partner: toPartner?.shortName, time: formatTime(received.at) })}</p>}
          <p className="text-[13px] text-muted-foreground">{t('pa19.doneLiability', { partner: toPartner?.shortName })}</p>
        </section>
        {exceptions.length > 0 && (
          <section className="rounded-2xl border-2 border-status-warning bg-status-warning-bg p-4">
            <p className="mb-1 flex items-center gap-2 font-bold">
              <TriangleAlert className="size-5 text-status-warning" aria-hidden /> {t('pa19.withException')}
            </p>
            <ProblemList problems={exceptions.map((x) => ({ kind: x.type, count: receivedCount(x.type, received?.pieceIds?.length ?? 0, given?.pieceIds?.length ?? 0) }))} />
            <p className="mt-1 text-[13px]">{t('pa19.investigate', { partner: data.partners[leg.partnerId].shortName, time: formatTime(exceptions[0].actionDueAt) })}</p>
          </section>
        )}
        <Link to="/app/tasks" className="flex min-h-14 items-center justify-center rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
          {t('pa19.backToTasks')}
        </Link>
      </div>
    )
  }

  // Waiting: code shown, receiver to confirm
  if (given) {
    const code = given.handoverCode!
    return (
      <div className="flex flex-col gap-4 p-4">
        {header}
        <section className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center">
          <h2 className="font-bold">{t('pa19.codeTitle')}</h2>
          <QrCode value={handoverQrValue(leg.id, code)} label={t('pa19.qrLabel', { code })} className="w-44" />
          <p className="tabular text-[32px] font-bold tracking-widest" data-testid="handover-code">
            {spacedCode(code)}
          </p>
          <p className="text-muted-foreground">{t('pa19.codeHelp', { name: receiverName })}</p>
          <SimulatedTag />
        </section>
        <p className="flex items-center justify-center gap-2 font-semibold" role="status">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> {t('pa19.waiting', { name: receiverName })}
        </p>
        {receiver && to && (
          <button
            type="button"
            onClick={() => window.open(`/app/as/${receiver.id}?to=${encodeURIComponent(`/app/tasks/${to.id}`)}`, '_blank')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-amber font-semibold"
          >
            <ExternalLink className="size-4" aria-hidden /> {t('pa19.openReceiver', { name: receiver.name })} <SimulatedTag />
          </button>
        )}
        <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa19.liability')}
        </p>
      </div>
    )
  }

  // Scan out
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {header}
      <Card title={t('pa19.items')}>
        <Scanner expected={expected} scanned={scanned} onScan={(c) => setScanned((x) => [...x, c])} />
      </Card>
      {needsSeal && (
        <Card title={t('pa19.seal')}>
          <input aria-label={t('pa19.seal')} value={seal} onChange={(e) => setSeal(e.target.value.toUpperCase())} className="tabular h-12 w-full rounded-lg border border-input px-3 text-[16px]" />
        </Card>
      )}
      {needsVehicle && (
        <Card title={t('pa19.vehicle')}>
          <input aria-label={t('pa19.vehicle')} value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} className="tabular h-12 w-full rounded-lg border border-input px-3 text-[16px]" />
        </Card>
      )}
      <Card title={t('pa19.photoTitle')}>
        <PhotoCapture label={t('pa19.photo')} caption={t('pa19.photoCaption', { count: scanned.length })} value={photo} onChange={setPhoto} idBase={`${s.id}-handover-${leg.id.slice(-2)}`} required />
      </Card>
      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => useDemoStore.getState().giveHandover({ legId: leg.id, staffId: staff.id, pieceIds: scanned, sealNos: seal.trim() ? [seal.trim()] : [], vehicleNo: needsVehicle ? vehicle.trim() : undefined, photos: [photo] })}
          className="min-h-14 w-full rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40"
        >
          {t('pa19.showCode')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa19.todo')}</p>}
      </div>
    </div>
  )
}

/** How many pieces a problem is about, for the giver's summary. */
function receivedCount(kind: string, received: number, expected: number) {
  if (kind === 'short') return Math.max(expected - received, 0)
  if (kind === 'excess') return Math.max(received - expected, 0)
  return 0
}
