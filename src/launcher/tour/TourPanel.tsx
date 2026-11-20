/**
 * Guided tour (build plan Phase 6; ERP spec §11.3 end-to-end demo script).
 * A floating card that follows the reviewer across the four apps. Each step can
 * open the right screen as the right persona, or be done by the tour itself.
 * Styled like the demo toolbar (dark with amber) so it reads as demo tooling.
 */
import { Check, ChevronLeft, ChevronRight, Compass, ExternalLink, Pause, Wand2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { appByKey } from '@shared/apps'
import { useData } from '@shared/hooks/useDemo'
import { personasFor } from '@shared/personas'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TOUR_STEPS } from './steps'
import { useTour } from './tourStore'

export function TourPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tour = useTour()
  const data = useData((d) => d)
  if (!tour.active) return null

  const total = TOUR_STEPS.length
  const i = Math.min(tour.step, total - 1)
  const step = TOUR_STEPS[i]
  const n = i + 1
  const k = `tour.s${n}`
  const persona = personasFor(step.app, data).find((p) => p.id === step.userId)
  const done = tour.done.includes(i) || step.done(data)
  const ready = !step.needs || step.needs(data)

  if (tour.paused) {
    return (
      <button
        type="button"
        onClick={() => tour.pause(false)}
        className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-caption font-semibold text-white shadow-lg hover:bg-gray-700 focus-visible:outline-brand-amber"
      >
        <Compass className="size-4 text-brand-amber" aria-hidden /> {t('tour.resume', { n, total })}
      </button>
    )
  }

  const get = useDemoStore.getState
  const show = (to: { app: typeof step.app; userId: string; path: string }) => {
    useSession.getState().login(to.app, to.userId)
    navigate(to.path)
  }
  const open = () => {
    step.prepare?.(get)
    show(step)
  }
  const doIt = () => {
    step.prepare?.(get)
    step.run?.(get)
    tour.markDone(i)
    toast.success(t('tour.ran', { n }))
    show(step.after ?? step)
  }
  const next = () => (n === total ? (toast.success(t('tour.finished')), tour.exit()) : tour.go(i + 1))

  return (
    <section
      aria-label={t('tour.region')}
      className="fixed right-4 bottom-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl bg-gray-900 text-white shadow-2xl [&_:focus-visible]:outline-brand-amber"
      data-testid="tour"
    >
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Compass className="size-4 text-brand-amber" aria-hidden />
        <span className="text-caption font-semibold text-brand-amber">{t('tour.step', { n, total })}</span>
        <button type="button" onClick={() => tour.pause(true)} className="ml-auto rounded p-1 hover:bg-white/10" aria-label={t('tour.pause')} title={t('tour.pause')}>
          <Pause className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={tour.exit} className="rounded p-1 hover:bg-white/10" aria-label={t('tour.exit')} title={t('tour.exit')}>
          <X className="size-4" aria-hidden />
        </button>
      </header>
      <ol className="flex gap-1 px-4 pt-3" aria-hidden>
        {TOUR_STEPS.map((s, j) => (
          <li key={s.id} className={cn('h-1 flex-1 rounded-full', j < i || tour.done.includes(j) ? 'bg-brand-amber' : j === i ? 'bg-white' : 'bg-white/20')} />
        ))}
      </ol>
      <div className="flex flex-col gap-2 px-4 py-3">
        <h2 className="flex items-start gap-2 font-semibold">
          {done && <Check className="mt-0.5 size-4 shrink-0 text-status-success" aria-label={t('tour.done')} />}
          {t(`${k}.title`)}
        </h2>
        <p className="text-caption text-white/80">{t(`${k}.body`)}</p>
        <p className="text-caption">
          <span className="font-semibold text-brand-amber">{t('tour.look')}: </span>
          {t(`${k}.look`)}
        </p>
        <p className="text-caption text-white/60">{t('tour.appIn', { app: t(`${appByKey(step.app).i18nKey}.name`), name: persona?.name ?? step.userId })}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
        <button type="button" onClick={open} className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-caption font-semibold text-gray-900 hover:bg-white/90">
          <ExternalLink className="size-3.5" aria-hidden /> {t('tour.open')}
        </button>
        {step.run && !done && ready && (
          <button type="button" onClick={doIt} className="inline-flex items-center gap-1.5 rounded-md border border-white/30 px-3 py-1.5 text-caption font-semibold hover:bg-white/10">
            <Wand2 className="size-3.5" aria-hidden /> {t('tour.doIt')}
          </button>
        )}
        <span className="ml-auto flex gap-1">
          <button type="button" disabled={i === 0} onClick={() => tour.go(i - 1)} className="rounded p-1.5 hover:bg-white/10 disabled:opacity-40" aria-label={t('tour.back')}>
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={next} className="inline-flex items-center gap-1 rounded-md bg-brand-amber px-3 py-1.5 text-caption font-semibold text-gray-900 hover:opacity-90">
            {n === total ? t('tour.finish') : t('tour.next')} {n < total && <ChevronRight className="size-3.5" aria-hidden />}
          </button>
        </span>
      </div>
    </section>
  )
}
