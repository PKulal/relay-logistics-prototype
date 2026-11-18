import { Building2, CircleUserRound, Network, Smartphone, Truck, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { APPS, type AppId } from '@shared/apps'
import { useData } from '@shared/hooks/useDemo'
import { personasFor } from '@shared/personas'
import { useSession } from '@shared/store/session'
import { LanguageToggle } from '@shared/ui/LanguageToggle'

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
      </main>
    </div>
  )
}
