import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { APPS, type AppId } from '@shared/apps'

/** Stand-in for an app until its shell is built in Phase 1. Sets the app accent. */
export function AppPlaceholder({ app }: { app: AppId }) {
  const { t } = useTranslation()
  const meta = APPS.find((a) => a.id === app)!

  return (
    <div data-app={app} className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center gap-3 border-b border-b-accent bg-background px-6">
        <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-8 w-auto" />
        <span className="font-heading font-semibold text-accent">{t(`${meta.i18nKey}.name`)}</span>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-page-title">{t(`${meta.i18nKey}.name`)}</h1>
        <p className="mt-2 text-muted-foreground">{t('common.comingSoon')}</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-semibold text-accent-foreground hover:bg-[var(--accent-hover)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('common.backToLauncher')}
        </Link>
      </main>
    </div>
  )
}
