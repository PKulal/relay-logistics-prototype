/**
 * Notification centre (CP-36, PP-38 notifications, ERP bell): the viewer's
 * in-app alerts with All / Unread / Action needed tabs and Mark all as read.
 * Tapping a row marks it read and opens the related screen.
 */
import { Bell, BellDot, CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { actionNeeded, notificationsFor, type Viewer } from '@shared/engines/notifications'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'

type Filter = 'all' | 'unread' | 'action'

export function NotificationCentre({ viewer, children }: { viewer: Viewer; children?: React.ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const all = useData((d) => d.notifications)
  const [filter, setFilter] = useState<Filter>('all')
  const list = notificationsFor(all, viewer)
  const unread = list.filter((n) => !n.read)
  const shown = filter === 'unread' ? unread : filter === 'action' ? list.filter(actionNeeded) : list

  const open = (id: string, link?: string) => {
    useDemoStore.getState().markNotificationsRead([id])
    if (link) navigate(link)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('notif.title')}
        subtitle={t('notif.subtitle', { count: unread.length })}
        actions={
          <Button variant="outline" disabled={!unread.length} onClick={() => useDemoStore.getState().markNotificationsRead(unread.map((n) => n.id))}>
            {t('notif.markAll')}
          </Button>
        }
        className="mb-0"
      />
      <div role="tablist" aria-label={t('notif.filter')} className="flex w-fit rounded-lg border bg-card p-0.5">
        {(['all', 'unread', 'action'] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('rounded-md px-3 py-1 text-caption font-medium', filter === f && 'bg-primary text-primary-foreground')}>
            {t(`notif.f.${f}`)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Bell} title={t(`notif.empty.${filter}`)} />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card shadow-card" data-testid="notifications">
          {shown.map((n) => {
            const act = actionNeeded(n)
            const Icon = act ? CircleAlert : n.read ? Bell : BellDot
            return (
              <li key={n.id}>
                <button type="button" onClick={() => open(n.id, n.link)} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent', !n.read && 'bg-primary-soft')} aria-label={n.title}>
                  <Icon className={cn('mt-0.5 size-5 shrink-0', act ? 'text-status-warning' : n.read ? 'text-muted-foreground' : 'text-primary')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block', !n.read && 'font-semibold')}>{n.title}</span>
                    <span className="block text-caption text-muted-foreground">{n.body}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular text-caption text-muted-foreground">{formatDateTime(n.at)}</span>
                    {act && <Chip tone="warning">{t('notif.action')}</Chip>}
                    {!n.read && !act && <span className="sr-only">{t('notif.unread')}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {children}
    </div>
  )
}
