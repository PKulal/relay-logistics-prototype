/**
 * Partner App (/app) — riders, drivers and hub staff, inside a phone frame.
 * Spec: docs/03-partner-app.md. App shell = PA-04 (top bar, offline banner, bottom tabs by role).
 */
import { CloudOff, RefreshCw, Siren } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { useData, useFlags } from '@shared/hooks/useDemo'
import { useSessionUser } from '@shared/store/session'
import type { FieldStaff } from '@shared/types'
import { LanguageToggle } from '@shared/ui/LanguageToggle'
import { AccessDenied, ScreenPlaceholder } from '@shared/ui/Page'
import { PhoneFrame } from '@shared/ui/PhoneFrame'
import { SOS_SCREEN, SYNC_SCREEN, TABS, type Tab } from './nav'
import PA05Home from './PA05Home'
import PA06Tasks from './PA06Tasks'
import PA07ScanTab from './PA07ScanTab'
import HubExceptions from './HubExceptions'
import PA20ReceiveManifest from './PA20ReceiveManifest'
import PA25HubHome from './PA25HubHome'
import PA26InScan from './PA26InScan'
import PA27Sort from './PA27Sort'
import PA28Bags from './PA28Bags'
import PA29OutScan from './PA29OutScan'
import TaskScreen from './TaskScreen'

/** Built tab screens by screen id. Trip (PA-21) opens the task list (PA-06) until its own screen arrives. */
const BUILT: Record<string, React.ReactNode> = {
  'PA-05': <PA05Home />,
  'PA-06': <PA06Tasks />,
  'PA-07': <PA07ScanTab />,
  'PA-21': <PA06Tasks />,
  'PA-25': <PA25HubHome />,
  'PA-26': <PA26InScan />,
  'PA-29': <PA29OutScan />,
}

export default function PartnerAppApp() {
  const { t } = useTranslation()
  const userId = useSessionUser('partnerApp')
  const staff = useData((d) => (userId ? d.fieldStaff[userId] : undefined))
  const partner = useData((d) => (staff ? d.partners[staff.partnerId] : undefined))

  if (!staff || !partner) return <Navigate to="/launch/partner-app" replace />

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
          <Route element={<PhoneShell staff={staff} tabs={tabs} />}>
            {tabs.map((tab) =>
              tab.path === '' ? <Route key="home" index element={BUILT[tab.screenId] ?? screen(tab)} /> : <Route key={tab.path} path={tab.path} element={BUILT[tab.screenId] ?? screen(tab)} />,
            )}
            <Route path="tasks/:legId" element={<TaskScreen />} />
            <Route path="tasks/:legId/pickup" element={<TaskScreen flow="pickup" />} />
            {staff.role === 'hub' && (
              <>
                <Route path="hub/sort" element={<PA27Sort />} />
                <Route path="hub/bags" element={<PA28Bags />} />
                <Route path="hub/exceptions" element={<HubExceptions />} />
                <Route path="outbound/:manifestId" element={<PA29OutScan />} />
              </>
            )}
            {staff.role === 'driver' && <Route path="receive/:manifestId" element={<ReceiveManifestRoute />} />}
            <Route path={SOS_SCREEN.path} element={screen(SOS_SCREEN)} />
            <Route path={SYNC_SCREEN.path} element={screen(SYNC_SCREEN)} />
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

function PhoneShell({ staff, tabs }: { staff: FieldStaff; tabs: Tab[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { offline } = useFlags()

  return (
    <>
      {/* Top bar: duty status · sync · language · SOS (PA-04) */}
      <header className="flex h-14 shrink-0 items-center gap-2 bg-primary px-3 pt-2 text-primary-foreground sm:pt-3">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold', staff.onDuty ? 'bg-white/20' : 'bg-black/20')}>
          <span className={cn('size-2 rounded-full', staff.onDuty ? 'bg-brand-amber' : 'bg-gray-500')} aria-hidden />
          {staff.onDuty ? t('pa.onDuty') : t('pa.offDuty')}
        </span>
        <button
          type="button"
          onClick={() => navigate('/app/sync')}
          className="inline-flex min-h-12 items-center gap-1 px-1 text-caption font-medium"
          aria-label={t('pa.syncQueue')}
        >
          {offline ? <CloudOff className="size-4" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {offline ? t('pa.offline') : t('pa.synced')}
        </button>
        <LanguageToggle compact className="ml-auto min-h-12 min-w-12 justify-center text-primary-foreground hover:bg-white/15" />
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
