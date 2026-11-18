import { Building2, Network, Smartphone, Truck, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { APPS, type AppId } from '@shared/apps'

const ICONS: Record<AppId, LucideIcon> = {
  customer: Building2,
  'partner-portal': Truck,
  'partner-app': Smartphone,
  erp: Network,
}

/** Placeholder launcher (Phase 0). Persona picker and mock login come in Phase 1. */
export default function Launcher() {
  const { t } = useTranslation()

  return (
    <div data-app="launcher" className="min-h-screen bg-gray-50">
      <header className="h-14 border-b bg-background">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-6">
          <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-9 w-auto" />
          <span className="text-caption text-muted-foreground">{t('common.tagline')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-page-title">{t('launcher.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t('launcher.subtitle')}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {APPS.map((app) => {
            const Icon = ICONS[app.id]
            return (
              <Link
                key={app.id}
                to={app.path}
                data-app={app.id}
                className="group flex flex-col rounded-xl border border-t-4 border-t-accent bg-card p-6 shadow-card transition-shadow hover:shadow-md"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h2 className="mt-4 text-section">{t(`${app.i18nKey}.name`)}</h2>
                <p className="mt-1 flex-1 text-muted-foreground">{t(`${app.i18nKey}.description`)}</p>
                <span className="mt-6 inline-flex w-fit items-center rounded-md bg-accent px-4 py-2 font-semibold text-accent-foreground group-hover:bg-[var(--accent-hover)]">
                  {t('launcher.open')}
                </span>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
