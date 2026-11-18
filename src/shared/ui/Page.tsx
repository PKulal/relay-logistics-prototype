import { Construction, Lock, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from './EmptyState'

/** Standard page title row: title, optional subtitle and actions on the right. */
export function PageHeader({ title, subtitle, actions, className }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        <h1 className="text-page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Where a spec screen will go, until it is built (shows the screen id and build-plan phase). */
export function ScreenPlaceholder({ screenId, title, phase }: { screenId: string; title: string; phase?: number }) {
  const { t } = useTranslation()
  return (
    <div>
      <PageHeader title={title} subtitle={<span className="tabular font-medium">{screenId}</span>} />
      <div className="rounded-xl border border-dashed bg-card">
        <EmptyState icon={Construction} title={t('placeholder.title')} body={phase ? t('placeholder.bodyPhase', { phase }) : t('placeholder.body')} />
      </div>
    </div>
  )
}

/** Shown when a hidden screen is opened by URL (CP spec §3.4). */
export function AccessDenied() {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState icon={Lock} title={t('access.deniedTitle')} body={t('access.deniedBody')} />
    </div>
  )
}

/** Unknown URL inside an app. */
export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState icon={SearchX} title={t('access.notFoundTitle')} body={t('access.notFoundBody')} />
    </div>
  )
}
