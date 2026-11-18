/**
 * PA-20 Receive hand-over (take) — docs/03-partner-app.md §6.3.
 * Check the code, count, seals and condition, then accept — or accept with an
 * exception, which puts the goods on hold and opens an investigation on the
 * previous leg (source §10).
 */
import { ArrowLeft, Check, QrCode as QrIcon, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { prevLegOf } from '@shared/engines/fieldTasks'
import { useData } from '@shared/hooks/useDemo'
import { beep, vibrate } from '@shared/sim/feedback'
import { useDemoStore } from '@shared/store'
import { handoverState, INVESTIGATE_WITHIN_HOURS, receiveExceptions } from '@shared/store/handoverActions'
import type { ExceptionKind, Leg } from '@shared/types'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card, Choice } from './FieldUi'
import { useFieldSession } from './useFieldSession'

export default function PA20Receive({ leg }: { leg: Leg }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const s = data.shipments[leg.shipmentId]
  const prev = prevLegOf(data, leg)!
  const giver = prev.staffId ? data.fieldStaff[prev.staffId] : undefined
  const prevPartner = data.partners[prev.partnerId]
  const { given } = handoverState(data, prev.id)

  const [code, setCode] = useState(params.get('code') ?? '')
  const [scanned, setScanned] = useState<string[]>([])
  const [countFinished, setCountFinished] = useState(false)
  const [broken, setBroken] = useState<Record<string, string>>({}) // seal → photo id ('' until taken)
  const [damaged, setDamaged] = useState(false)
  const [damagedIds, setDamagedIds] = useState<string[]>([])
  const [damagePhoto, setDamagePhoto] = useState('')

  const giverName = giver?.name ?? prevPartner.shortName
  const codeOk = !!given && code === given.handoverCode
  const expected = given?.pieceIds ?? []
  const seals = given?.sealNos ?? []
  const counted = scanned.length >= expected.length || countFinished
  // Missing pieces count as short only once the count is finished
  const problems = receiveExceptions(expected, { pieceIds: scanned, brokenSeals: Object.keys(broken), damagedPieceIds: damaged ? damagedIds : [] }).filter((p) => counted || p.kind !== 'short')

  const todo = !codeOk ? 'code' : !counted ? 'count' : (damaged && (!damagedIds.length || !damagePhoto)) || Object.values(broken).some((p) => !p) ? 'photos' : undefined

  const scanQr = () => {
    // SIMULATED camera: reads the code on the giver's screen
    if (!given?.handoverCode) {
      toast.info(t('pa20.noCodeYet', { name: giverName }))
      return
    }
    beep(true)
    vibrate(true)
    setCode(given.handoverCode)
  }

  const accept = () => {
    const photos = [damagePhoto, ...Object.values(broken)].filter(Boolean)
    navigate('/app/tasks')
    useDemoStore.getState().receiveHandover({ legId: leg.id, staffId: staff.id, code, pieceIds: scanned, brokenSeals: Object.keys(broken), damagedPieceIds: damaged ? damagedIds : [], photos })
    if (problems.length) toast.warning(t('pa20.doneException', { partner: prevPartner.shortName }))
    else toast.success(t('pa20.done', { count: scanned.length, name: giverName }))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate('/app/tasks')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{s.id}</p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa20.title')}</h1>
      </div>
      <Card title={t('pa20.from')}>
        <p className="text-[18px] font-semibold">{giverName}</p>
        <p className="text-muted-foreground">
          {prevPartner.shortName} · {t('pa20.pieces', { count: s.pieces.length })}
        </p>
      </Card>

      <Card title={t('pa20.code')}>
        {!given && <p className="mb-2 text-[13px] font-medium text-status-warning">{t('pa20.waitingGiver', { name: giverName })}</p>}
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            maxLength={6}
            aria-label={t('pa20.code')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="tabular h-12 min-w-0 flex-1 rounded-lg border border-input px-3 text-[20px] tracking-[0.3em]"
          />
          <button type="button" onClick={scanQr} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary px-3 font-semibold text-primary">
            <QrIcon className="size-5" aria-hidden /> {t('pa20.scanQr')}
          </button>
        </div>
        <SimulatedTag className="mt-1" />
        {code.length === 6 && (
          <p className={cn('mt-1 text-[13px] font-semibold', codeOk ? 'text-status-success' : 'text-status-danger')} role="status">
            {codeOk ? t('pa20.codeOk') : t('pa20.codeWrong')}
          </p>
        )}
      </Card>

      {codeOk && (
        <>
          <Card title={t('pa20.count')}>
            <Scanner expected={expected} scanned={scanned} onScan={(c) => setScanned((x) => [...x, c])} continuousDefault />
            {scanned.length < expected.length && <Choice checkbox checked={countFinished} onClick={() => setCountFinished(!countFinished)} label={t('pa20.countFinished', { count: expected.length - scanned.length })} />}
          </Card>

          {seals.length > 0 && (
            <Card title={t('pa20.seals')}>
              {seals.map((seal) => (
                <div key={seal} className="border-b py-2 last:border-0">
                  <Choice checked={!(seal in broken)} onClick={() => setBroken((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== seal)))} label={t('pa20.sealIntact', { seal })} />
                  <Choice checked={seal in broken} onClick={() => setBroken((b) => ({ ...b, [seal]: b[seal] ?? '' }))} label={t('pa20.sealBroken')} />
                  {seal in broken && <PhotoCapture label={t('pa20.sealPhoto')} caption={seal} value={broken[seal]} onChange={(v) => setBroken((b) => ({ ...b, [seal]: v }))} idBase={`${s.id}-seal`} required />}
                </div>
              ))}
            </Card>
          )}

          <Card title={t('pa20.condition')}>
            <Choice checked={!damaged} onClick={() => setDamaged(false)} label={t('pa20.allGood')} />
            <Choice checked={damaged} onClick={() => setDamaged(true)} label={t('pa20.damaged')} />
            {damaged && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-[13px] font-medium">{t('pa20.pickDamaged')}</p>
                <div className="flex flex-wrap gap-2">
                  {scanned.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={damagedIds.includes(id)}
                      onClick={() => setDamagedIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))}
                      className={cn('tabular min-h-12 min-w-12 rounded-xl border-2 px-3 font-semibold', damagedIds.includes(id) ? 'border-status-danger bg-status-danger-bg text-status-danger' : '')}
                    >
                      {id.slice(-2)}
                    </button>
                  ))}
                </div>
                <PhotoCapture label={t('pa20.damagePhoto')} caption={t('pa20.damaged')} value={damagePhoto} onChange={setDamagePhoto} idBase={`${s.id}-recv-damage`} required />
              </div>
            )}
          </Card>

          {problems.length > 0 && (
            <section className="rounded-2xl border-2 border-status-warning bg-status-warning-bg p-4" aria-live="polite">
              <p className="mb-1 flex items-center gap-2 font-bold">
                <TriangleAlert className="size-5 text-status-warning" aria-hidden /> {t('pa20.problems')}
              </p>
              <ProblemList problems={problems.map((p) => ({ kind: p.kind, count: p.pieceIds.length }))} />
              <p className="mt-1 text-[13px]">{t('pa20.hold', { partner: prevPartner.shortName, hours: INVESTIGATE_WITHIN_HOURS })}</p>
            </section>
          )}
        </>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button
          type="button"
          disabled={!!todo}
          onClick={accept}
          className={cn('flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-[18px] font-bold disabled:opacity-40', problems.length ? 'bg-brand-amber text-ink' : 'bg-primary text-primary-foreground')}
        >
          <Check className="size-5" aria-hidden /> {problems.length ? t('pa20.acceptException') : t('pa20.accept')}
        </button>
        {todo && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t(`pa20.todo.${todo}`)}</p>}
      </div>
    </div>
  )
}

/** Short / excess / seal / damage lines, shared with the giver's "Handed over" screen. */
export function ProblemList({ problems }: { problems: { kind: ExceptionKind; count: number }[] }) {
  const { t } = useTranslation()
  return (
    <ul className="list-inside list-disc">
      {problems.map((p) => (
        <li key={p.kind}>{t(`pa20.problem.${p.kind}`, { count: p.count })}</li>
      ))}
    </ul>
  )
}
