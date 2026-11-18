/**
 * PA-15 Pickup scan and documents → PA-16 Weight and dimensions → PA-17 Pickup
 * confirmation (docs/03-partner-app.md §6.2), as one guided flow. Progress is
 * kept for this tab (sessionStorage) so a reload doesn't lose scans or photos.
 */
import { AlertTriangle, ArrowLeft, Check, ShieldCheck, Ruler } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatINR, formatKg } from '@shared/lib/format'
import { DEMO_LOGIN_OTP, sendOtp, verifyLoginOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { verifiedOutcome, type VerifiedPiece } from '@shared/store/pickupActions'
import type { Leg } from '@shared/types'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { SignaturePad } from '@shared/ui/SignaturePad'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card, Choice } from './FieldUi'
import { useFieldSession } from './useFieldSession'

type Step = 'scan' | 'weigh' | 'confirm'
const STEPS: Step[] = ['scan', 'weigh', 'confirm']

interface PieceRow extends VerifiedPiece {
  scalePhoto: string
  tapePhoto: string
}

interface FlowState {
  step: Step
  labels: 'shipper' | 'rider'
  scanned: string[]
  invoicePhoto: string
  ewbMatches: boolean
  condition: 'good' | 'damaged'
  damagePhoto: string
  sameForAll: boolean
  pieces: PieceRow[]
  handedBy: string
  method: 'signature' | 'otp'
  signed: boolean
  otpSent: boolean
  otp: string
}

function usePersistentState<T>(key: string, initial: () => T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      /* storage blocked */
    }
    return initial()
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* storage blocked: progress lives in memory only */
    }
  }, [key, state])
  return [state, setState]
}

export default function PickupFlow({ leg }: { leg: Leg }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const s = data.shipments[leg.shipmentId]
  const loc = data.pickupLocations[s.pickupLocationId]
  const key = `logisco-pickup-${leg.id}`

  const [f, setF] = usePersistentState<FlowState>(key, () => ({
    step: 'scan',
    labels: 'shipper',
    scanned: [],
    invoicePhoto: '',
    ewbMatches: false,
    condition: 'good',
    damagePhoto: '',
    sameForAll: true,
    pieces: s.pieces.map((p) => ({ id: p.id, l: p.l, b: p.b, h: p.h, weight: p.weight, scalePhoto: '', tapePhoto: '' })),
    handedBy: (s.pickupContact ?? loc.contact).name,
    method: 'signature',
    signed: false,
    otpSent: false,
    otp: '',
  }))
  const set = <K extends keyof FlowState>(k: K, v: FlowState[K]) => setF((x) => ({ ...x, [k]: v }))

  // "Same for all remaining pieces": the first piece's values apply to identical pieces
  const pieces: PieceRow[] = f.sameForAll ? f.pieces.map((p, i) => (i === 0 ? p : { ...p, l: f.pieces[0].l, b: f.pieces[0].b, h: f.pieces[0].h, weight: f.pieces[0].weight })) : f.pieces
  const outcome = useMemo(() => verifiedOutcome(data, s.id, pieces), [data, s.id, pieces])
  const booked = (id: string) => s.pieces.find((p) => p.id === id)!
  const dimsDiffer = (p: PieceRow) => {
    const b = booked(p.id)
    return p.l !== b.l || p.b !== b.b || p.h !== b.h
  }
  const photos = [f.invoicePhoto, f.damagePhoto, ...f.pieces.flatMap((p) => [p.scalePhoto, p.tapePhoto])].filter(Boolean)

  const stepOk: Record<Step, boolean> = {
    scan: f.scanned.length === s.pieces.length && !!f.invoicePhoto && (!s.ewb || f.ewbMatches) && (f.condition === 'good' || !!f.damagePhoto),
    weigh: pieces.every((p) => p.weight > 0 && p.l > 0 && p.b > 0 && p.h > 0) && (f.sameForAll ? !!f.pieces[0].scalePhoto : f.pieces.every((p) => p.scalePhoto)) && pieces.every((p, i) => !dimsDiffer(p) || (f.sameForAll ? i > 0 || !!p.tapePhoto : !!p.tapePhoto)),
    confirm: !!f.handedBy.trim() && (f.method === 'signature' ? f.signed : verifyLoginOtp(f.otp)),
  }

  const setPiece = (i: number, patch: Partial<PieceRow>) => setF((x) => ({ ...x, pieces: x.pieces.map((p, j) => (j === i ? { ...p, ...patch } : p)) }))

  /** Demo button (PA-16 prototype note): two boxes measured larger → 170 kg. */
  const measureLarger = () =>
    setF((x) => ({
      ...x,
      sameForAll: false,
      pieces: x.pieces.map((p, i) => ({
        ...p,
        scalePhoto: p.scalePhoto || `${p.id}-scale:${t('pa16.scaleCaption', { kg: p.weight })}`,
        ...(i >= x.pieces.length - 2 ? { l: 62, b: 42, h: 42, tapePhoto: `${p.id}-tape:${t('pa16.tapeCaption', { dims: '62×42×42' })}` } : {}),
      })),
    }))

  const confirm = () => {
    // Leave this screen first: once the leg is in progress, the pickup route would
    // redirect to the (next) hand-over task and override this navigation.
    navigate('/app/tasks')
    useDemoStore.getState().confirmPickup({
      legId: leg.id,
      staffId: staff.id,
      pieceIds: f.scanned,
      verified: pieces.map(({ id, l, b, h, weight }) => ({ id, l, b, h, weight })),
      photos,
      handedOverBy: f.handedBy.trim(),
      confirmation: f.method,
      packagingDamaged: f.condition === 'damaged',
      labelledBy: f.labels,
    })
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    toast.success(t('pa17.done', { lr: s.id }))
    if (outcome.revision) toast.info(t('pa17.revisionSent', { amount: formatINR(outcome.amountDiff) }))
  }

  const stepIndex = STEPS.indexOf(f.step)

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <button type="button" onClick={() => (stepIndex === 0 ? navigate(`/app/tasks/${leg.id}`) : set('step', STEPS[stepIndex - 1]))} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">
          {s.id} · {t('pa15.stepOf', { n: stepIndex + 1, total: STEPS.length })}
        </p>
        <h1 className="font-heading text-[22px] font-bold">{t(`pa15.title.${f.step}`)}</h1>
      </div>
      <ol className="grid grid-cols-3 gap-1" aria-hidden>
        {STEPS.map((st, i) => (
          <li key={st} className={cn('h-1.5 rounded-full', i <= stepIndex ? 'bg-primary' : 'bg-gray-100')} />
        ))}
      </ol>

      {f.step === 'scan' && (
        <>
          <Card title={t('pa15.labels')}>
            {(['shipper', 'rider'] as const).map((v) => (
              <Choice key={v} checked={f.labels === v} onClick={() => set('labels', v)} label={t(`pa15.labelsBy.${v}`)} />
            ))}
          </Card>
          <Card title={t('pa15.scan')}>
            <Scanner expected={s.pieces.map((p) => p.id)} scanned={f.scanned} onScan={(c) => setF((x) => ({ ...x, scanned: [...x.scanned, c] }))} />
          </Card>
          <Card title={t('pa15.invoice')}>
            <PhotoCapture label={t('pa15.invoicePhoto')} caption={s.invoice.no} value={f.invoicePhoto} onChange={(v) => set('invoicePhoto', v)} idBase={`${s.id}-invoice`} required />
          </Card>
          {s.ewb && (
            <Card title={t('pa15.ewb')}>
              <p className="tabular mb-2">{s.ewb.no}</p>
              <Choice checked={f.ewbMatches} onClick={() => set('ewbMatches', !f.ewbMatches)} label={t('pa15.ewbMatches')} checkbox />
            </Card>
          )}
          <Card title={t('pa15.condition')}>
            <Choice checked={f.condition === 'good'} onClick={() => set('condition', 'good')} label={t('pa15.allGood')} />
            <Choice checked={f.condition === 'damaged'} onClick={() => set('condition', 'damaged')} label={t('pa15.damaged')} />
            {f.condition === 'damaged' && <PhotoCapture className="mt-2" label={t('pa15.damagePhoto')} caption={t('pa15.damaged')} value={f.damagePhoto} onChange={(v) => set('damagePhoto', v)} idBase={`${s.id}-damage`} required />}
          </Card>
          <p className="text-center text-[13px] text-muted-foreground">{t('pa15.cannotLater')}</p>
        </>
      )}

      {f.step === 'weigh' && (
        <>
          <button type="button" onClick={measureLarger} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-amber font-semibold">
            <Ruler className="size-4" aria-hidden /> {t('pa16.measureLarger')} <SimulatedTag />
          </button>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-card px-4">
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={f.sameForAll} onChange={(e) => set('sameForAll', e.target.checked)} />
            {t('pa16.sameForAll', { count: s.pieces.length })}
          </label>
          {(f.sameForAll ? f.pieces.slice(0, 1) : f.pieces).map((p, i) => {
            const b = booked(p.id)
            return (
              <Card key={p.id} title={f.sameForAll ? t('pa16.allPieces', { count: s.pieces.length }) : t('pa16.piece', { n: i + 1, total: s.pieces.length })}>
                {b.skuCode && data.skus[`SKU-${b.skuCode}`]?.status === 'frozen' && <p className="mb-2 text-[13px] text-muted-foreground">{t('pa16.frozen', { sku: b.skuCode, kg: data.skus[`SKU-${b.skuCode}`].weight })}</p>}
                <div className="grid grid-cols-4 gap-2">
                  <Num label={t('pa16.weight')} value={p.weight} onChange={(v) => setPiece(i, { weight: v })} />
                  <Num label="L" value={p.l} onChange={(v) => setPiece(i, { l: v })} />
                  <Num label="B" value={p.b} onChange={(v) => setPiece(i, { b: v })} />
                  <Num label="H" value={p.h} onChange={(v) => setPiece(i, { h: v })} />
                </div>
                <PhotoCapture className="mt-3" label={t('pa16.scalePhoto')} caption={t('pa16.scaleCaption', { kg: p.weight })} value={p.scalePhoto} onChange={(v) => setPiece(i, { scalePhoto: v })} idBase={`${p.id}-scale`} required />
                {dimsDiffer(p) && <PhotoCapture className="mt-3" label={t('pa16.tapePhoto')} caption={t('pa16.tapeCaption', { dims: `${p.l}×${p.b}×${p.h}` })} value={p.tapePhoto} onChange={(v) => setPiece(i, { tapePhoto: v })} idBase={`${p.id}-tape`} required />}
              </Card>
            )
          })}
          {/* Booked vs verified */}
          <section className={cn('rounded-2xl border-2 p-4', outcome.revision ? 'border-status-warning bg-status-warning-bg' : 'border-status-success bg-status-success-bg')} aria-live="polite">
            <p className="tabular text-[18px] font-bold" data-testid="verified">
              {t('pa16.bookedVsVerified', { booked: formatKg(outcome.booked), verified: formatKg(outcome.verified) })} {outcome.revision ? '' : '✓'}
            </p>
            <p className="tabular text-[13px]">
              {t('weight.actual')} {formatKg(outcome.weights.actual)} · {s.serviceKind === 'ptl' ? t('pa16.cft') : t('weight.volumetric')} {formatKg(outcome.weights.volumetricOrCft)}
            </p>
            {outcome.revision && (
              <p className="mt-2 flex items-start gap-2 font-semibold text-status-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa16.revision', { amount: formatINR(outcome.amountDiff) })}
              </p>
            )}
          </section>
        </>
      )}

      {f.step === 'confirm' && (
        <>
          <Card title={t('pa17.summary')}>
            <p className="tabular">{t('pa17.summaryLine', { lr: s.id, pieces: f.scanned.length, kg: formatKg(outcome.verified), photos: photos.length })}</p>
            {outcome.revision && <p className="mt-1 text-[13px] font-semibold text-status-warning">{t('pa16.revision', { amount: formatINR(outcome.amountDiff) })}</p>}
          </Card>
          <Card title={t('pa17.handedBy')}>
            <input aria-label={t('pa17.handedBy')} value={f.handedBy} onChange={(e) => set('handedBy', e.target.value)} className="h-12 w-full rounded-lg border border-input px-3 text-[16px]" />
          </Card>
          <Card title={t('pa17.shipperConfirms')}>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(['signature', 'otp'] as const).map((m) => (
                <button key={m} type="button" onClick={() => set('method', m)} aria-pressed={f.method === m} className={cn('min-h-12 rounded-xl border-2 font-semibold', f.method === m ? 'border-primary bg-primary-soft text-primary' : '')}>
                  {t(`pa17.method.${m}`)}
                </button>
              ))}
            </div>
            {f.method === 'signature' ? (
              <SignaturePad label={t('pa17.signHere', { name: f.handedBy })} onChange={(v) => set('signed', v)} />
            ) : !f.otpSent ? (
              <button
                type="button"
                onClick={async () => {
                  await sendOtp((s.pickupContact ?? loc.contact).mobile)
                  set('otpSent', true)
                }}
                className="min-h-12 w-full rounded-xl border-2 border-primary font-semibold text-primary"
              >
                {t('pa17.sendOtp', { mobile: (s.pickupContact ?? loc.contact).mobile })}
              </button>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-[13px]">
                  {t('login.otpHint', { otp: DEMO_LOGIN_OTP })} <SimulatedTag />
                </span>
                <input inputMode="numeric" maxLength={6} aria-label={t('login.otp')} value={f.otp} onChange={(e) => set('otp', e.target.value.replace(/\D/g, ''))} className="tabular h-12 rounded-lg border border-input px-3 text-[20px] tracking-[0.4em]" />
                {f.otp.length === 6 && !verifyLoginOtp(f.otp) && <span className="text-[13px] font-medium text-status-danger">{t('login.wrongOtp')}</span>}
              </label>
            )}
          </Card>
          <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa17.liability')}
          </p>
        </>
      )}

      {/* Sticky action bar (thumb reach) */}
      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        {f.step === 'confirm' ? (
          <button type="button" disabled={!stepOk.confirm} onClick={confirm} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
            <Check className="size-5" aria-hidden /> {t('pa17.confirm')}
          </button>
        ) : (
          <button type="button" disabled={!stepOk[f.step]} onClick={() => set('step', STEPS[stepIndex + 1])} className="min-h-14 w-full rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
            {t('pa15.next')}
          </button>
        )}
        {!stepOk[f.step] && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t(`pa15.todo.${f.step}`)}</p>}
      </div>
    </div>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium">{label}</span>
      <input type="number" inputMode="decimal" step="0.1" min="0" value={Number.isFinite(value) && value > 0 ? value : ''} onChange={(e) => onChange(e.target.valueAsNumber || 0)} className="tabular h-12 w-full rounded-lg border border-input px-2 text-center text-[16px]" />
    </label>
  )
}
