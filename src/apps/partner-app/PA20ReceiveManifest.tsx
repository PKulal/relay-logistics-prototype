/**
 * PA-20 Receive hand-over for a driver taking a manifest from a hub
 * (docs/03-partner-app.md §6.3): code, bag count, door and bag seals, then
 * accept — or accept with an exception (missing bag, broken seal).
 */
import { ArrowLeft, Check, QrCode as QrIcon, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { bagLabel, destinationName } from '@shared/engines/hub'
import { useData } from '@shared/hooks/useDemo'
import { beep, vibrate } from '@shared/sim/feedback'
import { useDemoStore } from '@shared/store'
import { INVESTIGATE_WITHIN_HOURS } from '@shared/store/handoverActions'
import type { ExceptionKind } from '@shared/types'
import { NotFound } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card, Choice } from './FieldUi'
import { ProblemList } from './PA20Receive'
import { LIST_PATH } from './nav'
import { useFieldSession } from './useFieldSession'

export default function PA20ReceiveManifest({ manifestId }: { manifestId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const manifest = data.manifests[manifestId]
  const [code, setCode] = useState(params.get('code') ?? '')
  const [scanned, setScanned] = useState<string[]>([])
  const [countFinished, setCountFinished] = useState(false)
  const [broken, setBroken] = useState<Record<string, string>>({})

  if (!manifest) return <div className="p-4"><NotFound /></div>
  const hub = data.hubs[manifest.hubId]
  const dispatched = manifest.status === 'dispatched'
  const giver = Object.values(data.events).find((e) => e.type === 'handoverGiven' && e.note === manifest.id)
  const giverName = giver ? data.fieldStaff[giver.by]?.name : undefined
  const bags = manifest.bagIds.map((id) => data.bags[id])
  const seals = [manifest.doorSeal, ...bags.map((b) => b.sealNo)].filter((s): s is string => !!s)
  const codeOk = dispatched && code === manifest.handoverCode
  const counted = scanned.length >= bags.length || countFinished
  const missingBags = bags.filter((b) => !scanned.includes(b.id))
  const problems: { kind: ExceptionKind; count: number }[] = []
  if (counted && missingBags.length) problems.push({ kind: 'short', count: missingBags.reduce((n, b) => n + b.pieceIds.length, 0) })
  if (Object.keys(broken).length) problems.push({ kind: 'sealMismatch', count: 0 })
  const todo = !codeOk ? 'code' : !counted ? 'count' : Object.values(broken).some((p) => !p) ? 'photos' : undefined

  const scanQr = () => {
    // SIMULATED camera: reads the code on the hub's screen
    if (!dispatched || !manifest.handoverCode) {
      toast.info(t('pa20.noCodeYet', { name: hub.name }))
      return
    }
    beep(true)
    vibrate(true)
    setCode(manifest.handoverCode)
  }

  const accept = () => {
    navigate(LIST_PATH[staff.role])
    useDemoStore.getState().receiveManifest({ manifestId, staffId: staff.id, code, bagIds: scanned, brokenSeals: Object.keys(broken), photos: Object.values(broken).filter(Boolean) })
    if (problems.length) toast.warning(t('pa20.doneException', { partner: data.partners[hub.partnerId].shortName }))
    else toast.success(t('pa20m.done', { count: scanned.length, hub: hub.name }))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate(LIST_PATH[staff.role])} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">
          {manifest.id} · {destinationName(data, manifest.destination, manifest.hubId)}
        </p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa20.title')}</h1>
      </div>
      <Card title={t('pa20.from')}>
        <p className="text-[18px] font-semibold">{hub.name}</p>
        <p className="text-muted-foreground">
          {giverName ? `${giverName} · ` : ''}
          {t('pa25.bags', { count: bags.length })}
        </p>
      </Card>

      <Card title={t('pa20.code')}>
        {!dispatched && <p className="mb-2 text-[13px] font-medium text-status-warning">{t('pa20m.waitingHub', { hub: hub.name })}</p>}
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
          <Card title={t('pa20m.count')}>
            <Scanner expected={bags.map((b) => b.id)} scanned={scanned} onScan={(c) => setScanned((x) => [...x, c])} shortLabel={(c) => bagLabel({ id: c })} unit="bag" continuousDefault />
            {scanned.length < bags.length && <Choice checkbox checked={countFinished} onClick={() => setCountFinished(!countFinished)} label={t('pa20m.countFinished', { count: bags.length - scanned.length })} />}
          </Card>

          <Card title={t('pa20.seals')}>
            {seals.map((seal) => (
              <div key={seal} className="border-b py-2 last:border-0">
                <p className="tabular text-[13px] text-muted-foreground">{seal === manifest.doorSeal ? t('pa20m.doorSeal') : bagLabel(bags.find((b) => b.sealNo === seal)!)}</p>
                <Choice checked={!(seal in broken)} onClick={() => setBroken((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== seal)))} label={t('pa20.sealIntact', { seal })} />
                <Choice checked={seal in broken} onClick={() => setBroken((b) => ({ ...b, [seal]: b[seal] ?? '' }))} label={t('pa20.sealBroken')} />
                {seal in broken && <PhotoCapture label={t('pa20.sealPhoto')} caption={seal} value={broken[seal]} onChange={(v) => setBroken((b) => ({ ...b, [seal]: v }))} idBase={`${manifest.id}-seal`} required />}
              </div>
            ))}
          </Card>

          {problems.length > 0 && (
            <section className="rounded-2xl border-2 border-status-warning bg-status-warning-bg p-4" aria-live="polite">
              <p className="mb-1 flex items-center gap-2 font-bold">
                <TriangleAlert className="size-5 text-status-warning" aria-hidden /> {t('pa20.problems')}
              </p>
              <ProblemList problems={problems} />
              <p className="mt-1 text-[13px]">{t('pa20.hold', { partner: data.partners[hub.partnerId].shortName, hours: INVESTIGATE_WITHIN_HOURS })}</p>
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
        {todo && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t(todo === 'count' ? 'pa20m.todoCount' : `pa20.todo.${todo}`)}</p>}
      </div>
    </div>
  )
}
