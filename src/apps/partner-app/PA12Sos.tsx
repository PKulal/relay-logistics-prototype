/**
 * PA-12 SOS — docs/03-partner-app.md. Source §5.1 "SOS button". Hold for 3
 * seconds → alert to the partner admin and Logisco Control Tower with live
 * location; the emergency contact is called. Cancel within 10 seconds
 * (assumed). The non-emergency "Report a problem" is not in the client
 * document (drivers report halts and breakdowns in PA-23).
 * SIMULATED: GPS sharing, the emergency call, SMS fallback when offline.
 */
import { MapPin, PhoneCall, Siren } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { useData, useFlags } from '@shared/hooks/useDemo'
import { formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { SOS_CANCEL_SECONDS } from '@shared/store/exceptionActions'
import type { SosAlert } from '@shared/types'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useFieldSession } from './useFieldSession'

const SOS_HOLD_MS = 3000
const KINDS: NonNullable<SosAlert['kind']>[] = ['accident', 'theft', 'medical', 'threat', 'other']

export default function PA12Sos() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const { offline } = useFlags()
  const alert = useData((d) =>
    Object.values(d.sosAlerts)
      .filter((a) => a.staffId === staff.id && a.status !== 'cancelled')
      .sort((a, b) => b.at.localeCompare(a.at))[0],
  )
  const [progress, setProgress] = useState(0)
  const [cancelLeft, setCancelLeft] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  const stop = () => {
    clearInterval(timer.current)
    setProgress(0)
  }
  const start = () => {
    const began = Date.now()
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - began) / SOS_HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        clearInterval(timer.current)
        setProgress(0)
        if (useDemoStore.getState().triggerSos(staff.id)) setCancelLeft(SOS_CANCEL_SECONDS)
      }
    }, 100)
  }
  useEffect(() => () => clearInterval(timer.current), [])
  // Real-time cancel window (the demo clock doesn't tick by itself)
  useEffect(() => {
    if (cancelLeft <= 0) return
    const id = setTimeout(() => setCancelLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cancelLeft])

  if (alert?.status === 'active')
    return (
      <div className="flex flex-col gap-4 p-4" role="alert">
        <section className="flex flex-col items-center gap-2 rounded-2xl bg-status-danger p-6 text-center text-white">
          <Siren className="size-12 animate-pulse" aria-hidden />
          <h1 className="font-heading text-[24px] font-bold">{t('pa12.helpComing')}</h1>
          <p className="text-[14px]">{t('pa12.sharedWith')}</p>
        </section>
        <p className="tabular flex items-center gap-2 text-[14px]" data-testid="sos-location">
          <MapPin className="size-5 text-status-danger" aria-hidden /> {t('pa12.location', { lat: alert.lat.toFixed(4), lng: alert.lng.toFixed(4), time: formatTime(alert.at) })} <SimulatedTag />
        </p>
        <p className="flex items-center gap-2 text-[14px]">
          <PhoneCall className="size-5 text-primary" aria-hidden /> {t('pa12.calling')} <SimulatedTag />
        </p>
        {offline && <p className="rounded-xl bg-status-warning-bg p-3 text-[13px] font-medium text-status-warning">{t('pa12.offline')}</p>}
        <section>
          <h2 className="mb-2 font-bold">{t('pa12.kind')}</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pa12.kind')}>
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={alert.kind === k} onClick={() => useDemoStore.getState().setSosKind(alert.id, k)} className={cn('min-h-12 rounded-full border-2 px-4 font-semibold', alert.kind === k && 'border-status-danger bg-status-danger-bg text-status-danger')}>
                {t(`pa12.k.${k}`)}
              </button>
            ))}
          </div>
        </section>
        {cancelLeft > 0 && (
          <button
            type="button"
            onClick={() => {
              useDemoStore.getState().cancelSos(alert.id)
              setCancelLeft(0)
            }}
            className="min-h-14 rounded-2xl border-2 font-bold"
          >
            {t('pa12.cancel', { s: cancelLeft })}
          </button>
        )}
      </div>
    )

  return (
    <div className="flex flex-col items-center gap-4 p-4 text-center">
      <h1 className="font-heading text-[22px] font-bold">{t('pa12.title')}</h1>
      <p className="text-muted-foreground">{t('pa12.hint')}</p>
      <button
        type="button"
        aria-label={t('pa12.hold')}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start()}
        onKeyUp={stop}
        className="relative flex size-48 items-center justify-center overflow-hidden rounded-full bg-status-danger text-white shadow-lg select-none"
      >
        <span className="absolute inset-x-0 bottom-0 bg-foreground/25" style={{ height: `${progress * 100}%` }} aria-hidden />
        <span className="relative flex flex-col items-center gap-1 font-heading text-[28px] font-bold">
          <Siren className="size-10" aria-hidden /> {t('pa.sos')}
        </span>
      </button>
      <p className="text-[13px] text-muted-foreground">{t('pa12.holdHint', { s: SOS_HOLD_MS / 1000 })}</p>
      {alert?.status === 'resolved' && <p className="rounded-xl bg-status-success-bg p-3 text-[14px] font-medium text-status-success">{t('pa12.closed', { time: formatTime(alert.resolvedAt!) })}</p>}
    </div>
  )
}
