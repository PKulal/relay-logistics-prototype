import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { PartnerStatus } from '@shared/types'
import { Chip } from '@shared/ui/StatusChip'
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
import PP22Claims, { PP22ClaimDetail } from './PP22Claims'
import PP05Status from './onboarding/PP05Status'
import PP06Documents from './onboarding/PP06Documents'
import PP07Verification from './onboarding/PP07Verification'
import PP08Agreement from './onboarding/PP08Agreement'
import PP09Setup from './onboarding/PP09Setup'
import PP10Tracker from './onboarding/PP10Tracker'

/** Built screens, by spec screen id. Unlisted screens show their placeholder. */
const SCREENS = { 'PP-10': PP10Tracker, 'PP-11': PP11Dashboard, 'PP-12': PP12JobInbox, 'PP-22': PP22Claims }

/** Before the monitored trial the partner sees only its onboarding (no jobs yet). */
const PRE_TRIAL: PartnerStatus[] = ['applied', 'kyc', 'agreement', 'integration']

/** Partner Portal (/partner) — partner company office. Spec: docs/02-partner-portal.md */
export default function PartnerPortalApp() {
  const { t } = useTranslation()
  const userId = useSessionUser('partnerPortal')
  const user = useData((d) => (userId ? d.partnerUsers[userId] : undefined))
  const partner = useData((d) => (user ? d.partners[user.partnerId] : undefined))

  if (!user || !partner) return <Navigate to="/launch/partner-portal" replace />

  const ctx: PartnerCtx = { role: user.role, partner }
  const preTrial = PRE_TRIAL.includes(partner.status)
  const nav = visibleNav(partnerNav, ctx)
  const shellNav = preTrial ? nav.map((g) => ({ ...g, items: g.items.filter((i) => i.screenId === 'PP-10') })).filter((g) => g.items.length) : nav

  return (
    <Routes>
      <Route
        element={
          <WebShell
            app="partnerPortal"
            nav={shellNav}
            orgName={partner.shortName}
            // "Type B · Gold 86" (PP spec §4.1)
            orgBadge={
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <span className="text-caption text-muted-foreground">{t('partner.typeShort', { type: partner.type })}</span>
                {preTrial ? <Chip tone="info">{t(`ponb.partnerStatus.${partner.status}`)}</Chip> : <TierBadge tier={partner.tier} score={partner.score} />}
              </span>
            }
            user={{ name: user.name, roleLabel: t(`roles.partner.${user.role}`) }}
            searchPlaceholderKey="search.placeholder.partner"
          />
        }
      >
        {/* Onboarding screens (PP-05 to PP-09): outside the menu, reached from the PP-10 tracker and the step bar */}
        <Route path="onboarding/application" element={<PP05Status />} />
        <Route path="onboarding/documents" element={<PP06Documents />} />
        <Route path="onboarding/verification" element={<PP07Verification />} />
        <Route path="onboarding/agreement" element={<PP08Agreement />} />
        <Route path="onboarding/setup" element={<PP09Setup />} />
        {preTrial ? (
          <>
            <Route path="onboarding" element={<PP10Tracker />} />
            <Route path="*" element={<Navigate to="/partner/onboarding" replace />} />
          </>
        ) : (
          navRoutes(partnerNav, ctx, SCREENS)
        )}
        {/* Screens outside the menu (PP spec §4.3): job detail and assignment, for Admin and Operations */}
        <Route path="jobs/assign" element={user.role === 'finance' ? <AccessDenied /> : <PP14Assign />} />
        <Route path="jobs/:jobId" element={<PP13JobDetail />} />
        <Route path="claims/:id" element={<PP22ClaimDetail />} />
        {!preTrial && <Route path="*" element={<NotFound />} />}
      </Route>
    </Routes>
  )
}
