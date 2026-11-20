/**
 * Partner App (/app) — riders, drivers and hub staff, inside a phone frame.
 * Spec: docs/03-partner-app.md. App shell = PA-04 (top bar, offline banner, bottom tabs by role).
 */
import { Bell, CloudOff, RefreshCw, Siren } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { queueOf } from '@shared/engines/fieldDay'
import { unreadCount } from '@shared/engines/notifications'
import { useData, useFlags } from '@shared/hooks/useDemo'
import { useSessionUser } from '@shared/store/session'
import { LanguageToggle } from '@shared/ui/LanguageToggle'
import { AccessDenied, ScreenPlaceholder } from '@shared/ui/Page'
import { PhoneFrame } from '@shared/ui/PhoneFrame'
import { SOS_SCREEN, SYNC_SCREEN, TABS, type Tab } from './nav'
import PA05Home from './PA05Home'
import PA06Tasks from './PA06Tasks'
import PA07ScanTab from './PA07ScanTab'
import HubExceptions from './HubExceptions'
import PA12Sos from './PA12Sos'
import PA18PickupFailed from './PA18PickupFailed'
import PA20ReceiveManifest from './PA20ReceiveManifest'
import PA30HubReport from './PA30HubReport'
import PA21Trip from './PA21Trip'
import PA22StartTrip from './PA22StartTrip'
import PA31DeliveryRun from './PA31DeliveryRun'
import PA32Stop from './PA32Stop'
import PA35Ndr from './PA35Ndr'
import PA33Deliver from './PA33Deliver'
import PA36CodDeposit from './PA36CodDeposit'
import RiderHandover from './RiderHandover'
import PA25HubHome from './PA25HubHome'
import PA26InScan from './PA26InScan'
import PA27Sort from './PA27Sort'
import PA28Bags from './PA28Bags'
import PA29OutScan from './PA29OutScan'
import TaskScreen from './TaskScreen'
import PA08Notifications from './PA08Notifications'
import PA09MyDay from './PA09MyDay'
import PA10Training, { PA10Practice } from './PA10Training'
import PA13Settings from './PA13Settings'
import PAMore from './PAMore'

/** Built tab screens by screen id. */
const BUILT: Record<string, React.ReactNode> = {
  'PA-05': <PA05Home />,
  'PA-06': <PA06Tasks />,
  'PA-07': <PA07ScanTab />,
  'PA-21': <PA21Trip />,
  'PA-25': <PA25HubHome />,
  'PA-26': <PA26InScan />,
  'PA-29': <PA29OutScan />,
  'PA-09': <PA09MyDay />,
  'PA-08, PA-10 to PA-13': <PAMore />,
}

export default function PartnerAppApp() {
  const { t } = useTranslation()
  const userId = useSessionUser('partnerApp')
  const staff = useData((d) => (userId ? d.fieldStaff[userId] : undefined))
  const partner = useData((d) => (staff ? d.partners[staff.partnerId] : undefined))

  // PP-29: deactivated or blocked staff have no app access
  if (!staff || !partner || (staff.status ?? 'active') !== 'active') return <Navigate to="/launch/partner-app" replace />

  const tabs = TABS[staff.role]
  const screen = (s: Pick<Tab, 'screenId' | 'labelKey' | 'phase'>) => (
    <div className="p-4">
      <ScreenPlaceholder screenId={s.screenId} title={t(s.labelKey)} phase={s.phase} />
    </div>
  )

  return (
    <div data-app="partner-app" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-gray-100 sm:py-6">
      <div className="hidden items-center gap-3 text-caption text-muted-foreground sm:flex">
        <span>
          <span className="font-semibold text-foreground">{staff.name}</span> · {t(`roles.field.${staff.role}`)} · {partner.shortName}
        </span>
        <Link to="/launch/partner-app" className="font-medium text-primary hover:underline">
          {t('header.switchPersona')}
        </Link>
        <Link to="/" className="font-medium text-primary hover:underline">
          {t('header.launcher')}
        </Link>
      </div>
      <PhoneFrame>
        <Routes>
          <Route element={<PhoneShell tabs={tabs} staffId={staff.id} />}>
            {tabs.map((tab) =>
              tab.path === '' ? <Route key="home" index element={BUILT[tab.screenId] ?? screen(tab)} /> : <Route key={tab.path} path={tab.path} element={BUILT[tab.screenId] ?? screen(tab)} />,
            )}
            <Route path="tasks/:legId" element={<TaskScreen />} />
            <Route path="tasks/:legId/pickup" element={<TaskScreen flow="pickup" />} />
            <Route path="tasks/:legId/cannot" element={<PA18PickupFailed />} />
            {staff.role === 'hub' && (
              <>
                <Route path="hub/sort" element={<PA27Sort />} />
                <Route path="hub/bags" element={<PA28Bags />} />
                <Route path="hub/exceptions" element={<HubExceptions />} />
                <Route path="hub/exceptions/new" element={<PA30HubReport />} />
                <Route path="outbound/:manifestId" element={<PA29OutScan />} />
                <Route path="outbound/rider/:riderId" element={<RiderHandover />} />
              </>
            )}
            {staff.role === 'rider' && (
              <>
                <Route path="run" element={<PA31DeliveryRun />} />
                <Route path="run/:legId" element={<PA32Stop />} />
                <Route path="run/:legId/deliver" element={<PA33Deliver />} />
                <Route path="run/:legId/ndr" element={<PA35Ndr />} />
                <Route path="cod" element={<PA36CodDeposit />} />
              </>
            )}
            {staff.role === 'driver' && (
              <>
                <Route path="receive/:manifestId" element={<ReceiveManifestRoute />} />
                <Route path="trip/start" element={<PA22StartTrip />} />
              </>
            )}
            <Route path={SOS_SCREEN.path} element={<PA12Sos />} />
            <Route path={SYNC_SCREEN.path} element={<PA13Settings />} />
            <Route path="notifications" element={<PA08Notifications />} />
            <Route path="training" element={<PA10Training />} />
            <Route path="training/:taskId" element={<PA10Practice />} />
            {staff.role === 'hub' && <Route path="my-day" element={<PA09MyDay />} />}
            {/* Another role's tab opened by URL */}
            <Route
              path="*"
              element={
                <div className="p-4">
                  <AccessDenied />
                </div>
              }
            />
          </Route>
        </Routes>
      </PhoneFrame>
    </div>
  )
}

function PhoneShell({ tabs, staffId }: { tabs: Tab[]; staffId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { offline } = useFlags()
  const data = useData((d) => d)
  const pending = queueOf(data, staffId).length
  const unread = unreadCount(data.notifications, { app: 'partnerApp', userId: staffId })

  return (
    <>
      {/* Top bar: sync · language · SOS (PA-04) */}
      <header className="flex h-14 shrink-0 items-center gap-2 bg-primary px-3 pt-2 text-primary-foreground sm:pt-3">
        <button
          type="button"
          onClick={() => navigate('/app/sync')}
          className="inline-flex min-h-12 items-center gap-1 px-1 text-caption font-medium"
          aria-label={t('pa.syncQueue')}
        >
          {offline ? <CloudOff className="size-4" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {pending > 0 ? t('pa13.pending', { count: pending }) : offline ? t('pa.offline') : t('pa.synced')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/app/notifications')}
          className="relative ml-auto inline-flex min-h-12 min-w-12 items-center justify-center"
          aria-label={unread ? t('header.notificationsUnread', { count: unread }) : t('header.notifications')}
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span className="tabular absolute top-2 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-bold text-white" aria-hidden>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <LanguageToggle compact className="min-h-12 min-w-12 justify-center text-primary-foreground hover:bg-white/15" />
        <button
          type="button"
          onClick={() => navigate('/app/sos')}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-status-danger px-3 text-caption font-bold text-white"
        >
          <Siren className="size-4" aria-hidden />
          {t('pa.sos')}
        </button>
      </header>

      {offline && (
        <div role="status" className="flex items-center gap-2 bg-brand-amber px-3 py-2 text-caption font-medium text-ink">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          {t('pa.offlineBanner')}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </div>

      {/* Bottom tabs by role (PA §4.1), 64 px, 48 px touch targets */}
      <nav className="grid h-16 shrink-0 grid-cols-5 border-t bg-background" aria-label={t('nav.label')}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path ? `/app/${tab.path}` : '/app'}
            end
            className={({ isActive }) =>
              cn('flex min-h-12 flex-col items-center justify-center gap-0.5 text-[12px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')
            }
          >
            <tab.icon className="size-5" aria-hidden />
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

function ReceiveManifestRoute() {
  const { manifestId = '' } = useParams()
  return <PA20ReceiveManifest manifestId={manifestId} />
}
