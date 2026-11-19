/**
 * PA-33 Deliver and capture e-POD — docs/03-partner-app.md §6.6.
 * Piece scan, piece-level short / damage with photos, received by, OTP or
 * e-signature, GRN, photo, geo-tag (source §7 Step 9), COD (PA-34) → Delivered, or
 * Delivered with Exception. SIMULATED: OTP (1234), camera, GPS.
 */
import { AlertTriangle, ArrowLeft, Check, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatTime } from '@shared/lib/format'
import { DEMO_DELIVERY_OTP, sendOtp, verifyDeliveryOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import type { PieceCondition } from '@shared/store/deliveryActions'
import type { CodCollection } from '@shared/store/moneyActions'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { SignaturePad } from '@shared/ui/SignaturePad'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card } from './FieldUi'
import { PA34CodCollect } from './PA34CodCollect'
import { useFieldSession } from './useFieldSession'

type Mark = { state: 'ok' | 'short' | 'damaged'; photo: string; remark: string }

export default function PA33Deliver() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { legId = '' } = useParams()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const leg = data.legs[legId]
  const s = leg ? data.shipments[leg.shipmentId] : undefined
  const c = s ? data.consignees[s.consigneeId] : undefined
  // Pieces on the run: as taken from the hub, else all
  const onBoard =
    Object.values(data.events)
      .filter((e) => e.legId === legId && e.type === 'handoverReceived')
      .at(-1)?.pieceIds ??
    s?.pieces.map((p) => p.id) ??
    []
  const [scanned, setScanned] = useState<string[]>([])
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [receivedBy, setReceivedBy] = useState(c?.contact ?? '')
  const [method, setMethod] = useState<'otp' | 'signature'>('otp')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [signed, setSigned] = useState(false)
  const [grn, setGrn] = useState('')
  const [photo, setPhoto] = useState('')
  const [codCollected, setCodCollected] = useState<CodCollection>()

  if (!leg || !s || !c || leg.staffId !== staff.id || leg.status !== 'inProgress') return <Navigate to="/app/run" replace />
  const pin = data.pincodes[s.destPincode]
  const cod = s.paymentMode === 'cod' ? s.codAmount : undefined

  // A scanned piece is OK unless marked damaged; an unscanned one must be marked short
  const stateOf = (p: string): Mark['state'] | 'missing' => marks[p]?.state ?? (scanned.includes(p) ? 'ok' : 'missing')
  const mark = (p: string, state: Mark['state']) => setMarks((m) => ({ ...m, [p]: { ...(m[p] ?? { photo: '', remark: '' }), state } }))
  const piecesOk = onBoard.every((p) => {
    const st = stateOf(p)
    if (st === 'missing') return false
    return st === 'ok' || (!!marks[p]?.photo && !!marks[p]?.remark.trim())
  })
  const verified = method === 'otp' ? verifyDeliveryOtp(otp) : signed
  const ready = piecesOk && !!receivedBy.trim() && verified && !!photo && (!cod || !!codCollected)
  const exceptions = onBoard.filter((p) => stateOf(p) === 'short' || stateOf(p) === 'damaged').length

  const complete = () => {
    const pieces: Record<string, PieceCondition> = Object.fromEntries(
      onBoard.map((p) => {
        const st = stateOf(p)
        return [p, st === 'ok' ? { state: 'ok' } : { state: st as 'short' | 'damaged', photo: marks[p].photo, remark: marks[p].remark.trim() }]
      }),
    )
    navigate('/app/run')
    useDemoStore.getState().completeDelivery({ legId, staffId: staff.id, pieces, receivedBy: receivedBy.trim(), verification: method, grn: grn.trim() || undefined, photo, cod: cod ? codCollected : undefined })
    if (exceptions) toast.warning(t('pa33.doneException', { lr: s.id }))
    else toast.success(t('pa33.doneToast', { lr: s.id }))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate(`/app/run/${legId}`)} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{s.id}</p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa33.title')}</h1>
        <p className="text-muted-foreground">{c.company || c.contact}</p>
      </div>

      <Card title={t('pa33.step.scan')}>
        <Scanner expected={onBoard} scanned={scanned} onScan={(p) => setScanned((x) => [...x, p])} />
      </Card>

      <Card title={t('pa33.step.condition')}>
        <ul className="flex flex-col divide-y">
          {onBoard.map((p) => {
            const st = stateOf(p)
            return (
              <li key={p} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="tabular w-12 font-semibold">{p.slice(-2)}</span>
                  <div className="grid flex-1 grid-cols-3 gap-1" role="radiogroup" aria-label={t('pa33.pieceN', { n: p.slice(-2) })}>
                    {(['ok', 'short', 'damaged'] as const).map((v) => {
                      const disabled = (v === 'ok' && !scanned.includes(p)) || (v === 'short' && scanned.includes(p))
                      return (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={st === v}
                          disabled={disabled}
                          onClick={() => mark(p, v)}
                          className={cn('min-h-10 rounded-lg border-2 text-[13px] font-semibold disabled:opacity-30', st === v ? (v === 'ok' ? 'border-status-success bg-status-success-bg text-status-success' : 'border-status-danger bg-status-danger-bg text-status-danger') : '')}
                        >
                          {t(`pa33.cond.${v}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {st === 'missing' && <p className="mt-1 text-[13px] text-muted-foreground">{t('pa33.scanOrShort')}</p>}
                {(st === 'short' || st === 'damaged') && (
                  <div className="mt-2 flex flex-col gap-2">
                    <PhotoCapture label={t('pa33.piecePhoto')} caption={`${p.slice(-2)} · ${t(`pa33.cond.${st}`)}`} value={marks[p].photo} onChange={(v) => setMarks((m) => ({ ...m, [p]: { ...m[p], photo: v } }))} idBase={`${p}-pod`} required />
                    <input aria-label={t('pa33.remark')} placeholder={t('pa33.remark')} value={marks[p].remark} onChange={(e) => setMarks((m) => ({ ...m, [p]: { ...m[p], remark: e.target.value } }))} className="h-12 rounded-lg border border-input px-3 text-[16px]" />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card title={t('pa33.step.receivedBy')}>
        <input aria-label={t('pa33.step.receivedBy')} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="h-12 w-full rounded-lg border border-input px-3 text-[16px]" />
      </Card>

      <Card title={t('pa33.step.verify')}>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['otp', 'signature'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m} className={cn('min-h-12 rounded-xl border-2 font-semibold', method === m ? 'border-primary bg-primary-soft text-primary' : '')}>
              {t(`pa33.method.${m}`)}
            </button>
          ))}
        </div>
        {method === 'signature' ? (
          <SignaturePad label={t('pa17.signHere', { name: receivedBy })} onChange={setSigned} />
        ) : !otpSent ? (
          <button
            type="button"
            onClick={async () => {
              await sendOtp(c.mobile)
              setOtpSent(true)
            }}
            className="min-h-12 w-full rounded-xl border-2 border-primary font-semibold text-primary"
          >
            {t('pa33.sendOtp')}
          </button>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[13px]">
              {t('pa33.otpHint', { otp: DEMO_DELIVERY_OTP })} <SimulatedTag />
            </span>
            <input inputMode="numeric" maxLength={4} aria-label={t('pa33.otp')} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tabular h-12 rounded-lg border border-input px-3 text-[20px] tracking-[0.4em]" />
            {otp.length === 4 && !verifyDeliveryOtp(otp) && <span className="text-[13px] font-medium text-status-danger">{t('login.wrongOtp')}</span>}
          </label>
        )}
      </Card>

      {c.type === 'business' && (
        <Card title={t('pa33.step.grn')}>
          <input aria-label={t('pa33.step.grn')} placeholder="GRN-" value={grn} onChange={(e) => setGrn(e.target.value.toUpperCase())} className="tabular h-12 w-full rounded-lg border border-input px-3 text-[16px]" />
          <p className="mt-1 text-[13px] text-muted-foreground">{t('pa33.grnHint')}</p>
        </Card>
      )}

      <Card title={t('pa33.step.photo')}>
        <PhotoCapture label={t('pa33.podPhoto')} caption={c.company || c.contact} value={photo} onChange={setPhoto} idBase={`${s.id}-pod`} required />
        <p className="tabular mt-2 flex items-center gap-1 text-[13px] text-muted-foreground">
          <MapPin className="size-4" aria-hidden /> {t('pa33.geo', { lat: pin.lat.toFixed(2), lng: pin.lng.toFixed(2), time: formatTime(now) })} <SimulatedTag />
        </p>
      </Card>

      {cod ? <PA34CodCollect lr={s.id} due={cod} at={now} value={codCollected} onChange={setCodCollected} /> : null}

      {exceptions > 0 && (
        <p className="flex items-start gap-2 text-[13px] font-semibold text-status-warning" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa33.withException', { count: exceptions })}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={complete} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          <Check className="size-5" aria-hidden /> {t('pa33.complete')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{cod && !codCollected ? t('pa34.todo') : t('pa33.todo')}</p>}
      </div>
    </div>
  )
}
