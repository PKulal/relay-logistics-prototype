/**
 * More tab — the Partner App menu for PA-08, PA-09 (hub staff), PA-10 and
 * PA-13 (PA spec §4.1). The AI assistant (PA-11) is added with the AI item.
 */
import { Bell, CalendarCheck, ChevronRight, GraduationCap, RefreshCw, Siren } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { trainingStatus, queueOf } from '@shared/engines/fieldDay'
import { unreadCount } from '@shared/engines/notifications'
import { useData } from '@shared/hooks/useDemo'
import { Chip } from '@shared/ui/StatusChip'
import { useFieldSession } from './useFieldSession'

export default function PAMore() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const unread = unreadCount(data.notifications, { app: 'partnerApp', userId: staff.id })
  const pending = queueOf(data, staff.id).length
  const training = trainingStatus(staff)
  const items = [
    { to: '/app/notifications', icon: Bell, label: t('pa08.title'), badge: unread ? <Chip tone="danger">{unread}</Chip> : null },
    ...(staff.role === 'hub' ? [{ to: '/app/my-day', icon: CalendarCheck, label: t('pa09.title'), badge: null }] : []),
    { to: '/app/training', icon: GraduationCap, label: t('pa10.title'), badge: <Chip tone={training === 'done' ? 'success' : 'warning'}>{t(`pa10.status.${training}`)}</Chip> },
    { to: '/app/sync', icon: RefreshCw, label: t('pa13.title'), badge: pending ? <Chip tone="warning">{t('pa13.pending', { count: pending })}</Chip> : null },
    { to: '/app/sos', icon: Siren, label: t('nav.pa.sos'), badge: null },
  ]
  return (
    <nav className="flex flex-col gap-2 p-4" aria-label={t('nav.pa.more')}>
      <h1 className="font-heading text-[22px] font-bold">{t('nav.pa.more')}</h1>
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="flex min-h-12 items-center gap-3 rounded-2xl border bg-card p-3">
          <i.icon className="size-6 text-primary" aria-hidden />
          <span className="flex-1 font-medium">{i.label}</span>
          {i.badge}
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
        </Link>
      ))}
    </nav>
  )
}
