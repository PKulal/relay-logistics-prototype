/**
 * PA-08 Notifications — docs/03-partner-app.md. New task, task changed (slot),
 * task removed, customer chose reattempt, sync failed. Tapping opens the task.
 * "Office message" is not built: messages from the office were removed in the
 * scope check (CLAUDE.md).
 */
import { Bell, BellDot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { notificationsFor } from '@shared/engines/notifications'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { fieldTitle, LEG_ID } from './fieldText'
import { useFieldSession } from './useFieldSession'

export default function PA08Notifications() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const all = useData((d) => d.notifications)
  const list = notificationsFor(all, { app: 'partnerApp', userId: staff.id })
  const unread = list.filter((n) => !n.read)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-[22px] font-bold">{t('pa08.title')}</h1>
        <Button variant="outline" size="sm" disabled={!unread.length} onClick={() => useDemoStore.getState().markNotificationsRead(unread.map((n) => n.id))}>
          {t('notif.markAll')}
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa08.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="pa-notifications">
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  useDemoStore.getState().markNotificationsRead([n.id])
                  if (n.link) navigate(n.link)
                }}
                className={cn('flex min-h-12 w-full items-start gap-3 rounded-2xl border p-3 text-left', n.read ? 'bg-card' : 'border-primary bg-primary-soft')}
              >
                {n.read ? <Bell className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden /> : <BellDot className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className={cn('block', !n.read && 'font-bold')}>{fieldTitle(n, t)}</span>
                  <span className="tabular block text-caption text-muted-foreground">{LEG_ID.test(n.title) ? n.title : n.body}</span>
                  <span className="tabular block text-caption text-muted-foreground">{formatDateTime(n.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
