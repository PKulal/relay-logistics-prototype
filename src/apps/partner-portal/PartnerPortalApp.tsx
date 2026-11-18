import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useData } from '@shared/hooks/useDemo'
import { visibleNav } from '@shared/nav'
import { navRoutes } from '@shared/shell/routes'
import { WebShell } from '@shared/shell/WebShell'
import { useSessionUser } from '@shared/store/session'
import { AccessDenied, NotFound } from '@shared/ui/Page'
import { TierBadge } from '@shared/ui/TierBadge'
import { partnerNav, type PartnerCtx } from './nav'
import PP11Dashboard from './PP11Dashboard'
import PP12JobInbox from './PP12JobInbox'
import PP13JobDetail from './PP13JobDetail'
import PP14Assign from './PP14Assign'

/** Built screens, by spec screen id. Unlisted screens show their placeholder. */
const SCREENS = { 'PP-11': PP11Dashboard, 'PP-12': PP12JobInbox }

/** Partner Portal (/partner) — partner company office. Spec: docs/02-partner-portal.md */
export default function PartnerPortalApp() {
  const { t } = useTranslation()
  const userId = useSessionUser('partnerPortal')
  const user = useData((d) => (userId ? d.partnerUsers[userId] : undefined))
  const partner = useData((d) => (user ? d.partners[user.partnerId] : undefined))

  if (!user || !partner) return <Navigate to="/launch/partner-portal" replace />

  const ctx: PartnerCtx = { role: user.role, partner }

  return (
    <Routes>
      <Route
        element={
          <WebShell
            app="partnerPortal"
            nav={visibleNav(partnerNav, ctx)}
            orgName={partner.shortName}
            // "Type B · Gold 86" (PP spec §4.1)
            orgBadge={
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <span className="text-caption text-muted-foreground">{t('partner.typeShort', { type: partner.type })}</span>
                <TierBadge tier={partner.tier} score={partner.score} />
              </span>
            }
            user={{ name: user.name, roleLabel: t(`roles.partner.${user.role}`) }}
            searchPlaceholderKey="search.placeholder.partner"
          />
        }
      >
        {navRoutes(partnerNav, ctx, SCREENS)}
        {/* Screens outside the menu (PP spec §4.3): job detail and assignment, for Admin and Operations */}
        <Route path="jobs/assign" element={user.role === 'finance' ? <AccessDenied /> : <PP14Assign />} />
        <Route path="jobs/:jobId" element={<PP13JobDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
