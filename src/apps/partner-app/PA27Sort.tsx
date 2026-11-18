/**
 * PA-27 Sort to bag / cage — docs/03-partner-app.md §6.5.
 * Scan a piece: the bag it goes in shows in very large text and colour. Scan
 * the bag label to confirm; a wrong bag is a red alert and the voice says so.
 * SIMULATED: the bag-label buttons stand in for scanning the label on the bag.
 */
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { bagLabel, nextBagId, openBagFor, piecesToSort, type HubItem } from '@shared/engines/hub'
import { beep, speak, vibrate } from '@shared/sim/feedback'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { AccessDenied } from '@shared/ui/Page'
import { Scanner } from '@shared/ui/Scanner'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card } from './FieldUi'
import { TONE_CLASS, useHub } from './useHub'

type Current = { pieceId: string; item: HubItem }

export default function PA27Sort() {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const { data, hubId, items } = useHub()
  const [done, setDone] = useState<string[]>([])
  const [current, setCurrent] = useState<Current>()
  const [placed, setPlaced] = useState<string>()
  const [wrongBag, setWrongBag] = useState<string>()

  if (!hubId) return <div className="p-4"><AccessDenied /></div>
  const toSort = piecesToSort(items, data, hubId)
  const bag = current ? (openBagFor(data, hubId, current.item.dest.key) ?? { id: nextBagId(data, hubId) }) : undefined
  const label = bag ? bagLabel(bag) : ''

  const scanBag = (right: boolean) => {
    if (!current || !bag) return
    if (!right) {
      // Another bag on the floor: an open bag for a different destination, or the next number
      const other = Object.values(data.bags).find((b) => b.hubId === hubId && b.status === 'open' && b.id !== bag.id)
      setWrongBag(other ? bagLabel(other) : 'BAG 99')
      beep(false)
      vibrate(false)
      speak(t('pa27.voiceWrongBag'), language)
      return
    }
    const bagId = useDemoStore.getState().sortPiece(hubId, current.pieceId)
    setWrongBag(undefined)
    setPlaced(bagId)
    beep(true)
    vibrate(true)
    speak(t('pa27.voicePlaced', { bag: label }), language)
  }

  const next = () => {
    if (current) setDone((d) => [...d, current.pieceId])
    setCurrent(undefined)
    setPlaced(undefined)
    setWrongBag(undefined)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa27.title')}</h1>

      {!current && toSort.length === 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-muted-foreground">{t('pa27.empty')}</p>
          <Link to="/app/hub/bags" className="mt-2 inline-flex min-h-12 items-center font-semibold text-primary">
            {t('pa27.toBags')}
          </Link>
        </div>
      )}

      {!current && toSort.length > 0 && (
        <Card title={t('pa27.scanPiece', { count: toSort.length })}>
          <Scanner
            expected={[...done, ...toSort.map((x) => x.pieceId)]}
            scanned={done}
            shortLabel={(c) => c.slice(-9)}
            onScan={(code) => {
              const hit = toSort.find((x) => x.pieceId === code)
              if (hit) setCurrent(hit)
            }}
          />
        </Card>
      )}

      {current && (
        <>
          <section className={cn('flex flex-col items-center gap-1 rounded-2xl border-4 p-6 text-center', TONE_CLASS[current.item.dest.tone])} aria-live="polite">
            <p className="tabular text-[14px] font-medium">{current.pieceId}</p>
            <p className="font-heading text-[44px] leading-none font-bold" data-testid="sort-bag">
              {label}
            </p>
            <p className="font-heading text-[28px] font-bold tracking-wide">{current.item.dest.key === 'LOCAL' ? t('pa27.local', { city: current.item.dest.name }) : current.item.dest.name}</p>
          </section>

          {placed ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center justify-center gap-2 rounded-2xl bg-status-success-bg p-4 text-[20px] font-bold text-status-success" role="status">
                <CheckCircle2 className="size-6" aria-hidden /> {t('pa27.placed', { bag: label })}
              </p>
              <button type="button" onClick={next} className="min-h-14 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
                {t('pa27.next')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {wrongBag && (
                <p className="flex items-start gap-2 rounded-2xl border-2 border-status-danger bg-status-danger-bg p-4 font-bold text-status-danger" role="alert">
                  <XCircle className="mt-0.5 size-6 shrink-0" aria-hidden /> {t('pa27.wrongBag', { scanned: wrongBag, bag: label })}
                </p>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button type="button" onClick={() => scanBag(true)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
                  <ScanLine className="size-5" aria-hidden /> {t('pa27.scanBag')}
                </button>
                <button type="button" onClick={() => scanBag(false)} className="min-h-14 rounded-2xl border-2 px-3 text-[14px] font-semibold">
                  {t('pa27.wrongBagDemo')}
                </button>
              </div>
              <SimulatedTag className="self-center" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
