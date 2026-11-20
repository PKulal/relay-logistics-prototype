/** Frame for the web login screens (CP-01/03, PP-01/03, ERP-01): logo, card, language, way back to the launcher. */
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@shared/store/session'
import type { Language } from '@shared/i18n'

export function LanguageSelect({ className }: { className?: string }) {
  const { t } = useTranslation()
  const language = useSession((s) => s.language)
  const setLanguage = useSession((s) => s.setLanguage)
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-caption font-medium">{t('auth.language')}</span>
      <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="h-9 rounded-md border border-input bg-background px-2 text-body">
        <option value="en">English</option>
        <option value="hi">हिन्दी (Hindi)</option>
      </select>
    </label>
  )
}

export function AuthShell({ app, title, subtitle, children, aside }: { app: 'customer' | 'partner-portal' | 'erp'; title: string; subtitle?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div data-app={app} className={cn('flex min-h-dvh flex-col', app === 'erp' ? 'bg-charcoal' : 'bg-gray-50')}>
      <header className="flex h-14 items-center gap-3 px-6">
        <Link to="/" className={cn('inline-flex items-center gap-1.5 text-caption font-medium hover:underline', app === 'erp' ? 'text-gray-100' : 'text-muted-foreground')}>
          <ArrowLeft className="size-4" aria-hidden /> {t('common.backToLauncher')}
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <div className="grid w-full max-w-4xl gap-6 md:grid-cols-[1fr_minmax(0,22rem)]">
          <section className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
            <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="mb-6 h-9 w-auto" />
            <h1 className="text-page-title">{title}</h1>
            {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </section>
          {aside && <aside className="flex flex-col gap-3">{aside}</aside>}
        </div>
      </main>
    </div>
  )
}
