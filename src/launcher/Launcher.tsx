import { Building2, CircleUserRound, Compass, Network, Smartphone, Truck, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { APPS, type AppId } from '@shared/apps'
import { useData } from '@shared/hooks/useDemo'
import { personasFor } from '@shared/personas'
import { useSession } from '@shared/store/session'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { LanguageToggle } from '@shared/ui/LanguageToggle'
import { TOUR_STEPS } from './tour/steps'
import { useTour } from './tour/tourStore'

const ICONS: Record<AppId, LucideIcon> = {
  customer: Building2,
  'partner-portal': Truck,
  'partner-app': Smartphone,
  erp: Network,
}

/** Launcher: four app cards. A card opens the persona picker, or the app if someone is already logged in to it in this tab. */
export default function Launcher() {
  const { t } = useTranslation()
  const sessions = useSession((s) => s.sessions)
  const data = useData((d) => d)
  const navigate = useNavigate()
  const tour = useTour()
  const startTour = (fresh: boolean) => {
    if (fresh) useDemoStore.getState().resetDemo()
    tour.start()
    navigate('/')
  }

  return (
    <div data-app="launcher" className="min-h-dvh bg-gray-50">
      <header className="h-14 border-b bg-background">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-6">
          <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-9 w-auto" />
          <span className="hidden text-caption text-muted-foreground sm:inline">{t('common.tagline')}</span>
          <LanguageToggle className="ml-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-page-title">{t('launcher.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t('launcher.subtitle')}</p>

        {/* Guided tour: the ERP spec §11.3 demo script */}
        <section aria-labelledby="tour-h" className="mt-8 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card sm:flex-row sm:items-center">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Compass className="size-6" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 id="tour-h" className="text-card-title">
              {t('tour.cardTitle')}
            </h2>
            <p className="mt-1 text-caption text-muted-foreground">{t('tour.cardBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tour.active ? (
              <Button onClick={() => tour.pause(false)}>{t('tour.resume', { n: tour.step + 1, total: TOUR_STEPS.length })}</Button>
            ) : (
              <Button onClick={() => startTour(false)}>{t('tour.start')}</Button>
            )}
            <Button variant="outline" onClick={() => startTour(true)}>
              {t('tour.startFresh')}
            </Button>
          </div>
        </section>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {APPS.map((app) => {
            const Icon = ICONS[app.id]
            const session = sessions[app.key]
            const persona = session && personasFor(app.key, data).find((p) => p.id === session.userId)
            return (
              <Link
                key={app.id}
                to={persona ? app.path : `/launch/${app.id}`}
                data-app={app.id}
                className="group flex flex-col rounded-xl border border-t-4 border-t-primary bg-card p-6 shadow-card transition-shadow hover:shadow-md"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h2 className="mt-4 text-section">{t(`${app.i18nKey}.name`)}</h2>
                <p className="mt-1 flex-1 text-muted-foreground">{t(`${app.i18nKey}.description`)}</p>
                {persona && (
                  <p className="mt-4 flex items-center gap-1.5 text-caption text-muted-foreground">
                    <CircleUserRound className="size-4" aria-hidden />
                    {t('launcher.signedInAs', { name: persona.name })}
                  </p>
                )}
                <span className="mt-4 inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground group-hover:bg-primary-hover">
                  {persona ? t('launcher.continue') : t('launcher.open')}
                </span>
              </Link>
            )
          })}
        </div>
        {/* Public pages: no login */}
        <div className="mt-8 flex flex-wrap gap-4 text-body">
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            {t('launcher.signUp')}
          </Link>
          <Link to="/partner/apply" className="font-semibold text-primary hover:underline">
            {t('launcher.partnerApply')}
          </Link>
          <Link to="/track" className="font-semibold text-primary hover:underline">
            {t('launcher.track')}
          </Link>
        </div>
      </main>
    </div>
  )
}
