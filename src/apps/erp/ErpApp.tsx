import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@shared/hooks/useDemo'
import { visibleNav } from '@shared/nav'
import { navRoutes } from '@shared/shell/routes'
import { WebShell } from '@shared/shell/WebShell'
import { useSessionUser } from '@shared/store/session'
import { NotFound, ScreenPlaceholder } from '@shared/ui/Page'
import ERP03Shipment360 from './ERP03Shipment360'
import ERP05JobBoard from './ERP05JobBoard'
import ERP06AtRisk from './ERP06AtRisk'
import ERP07Exceptions from './ERP07Exceptions'
import ERP08Reassign from './ERP08Reassign'
import ERP09PartnerHealth from './ERP09PartnerHealth'
import ERP10DailyPack from './ERP10DailyPack'
import ERP11Applications from './ERP11Applications'
import ERP12KycDesk from './ERP12KycDesk'
import ERP13Commercials from './ERP13Commercials'
import ERP14Trials from './ERP14Trials'
import ERP22RateCards from './ERP22RateCards'
import ERP23Approvals from './ERP23Approvals'
import ERP26Leads from './ERP26Leads'
import ERP27OnboardingReview from './ERP27OnboardingReview'
import ERP30CreditReview from './ERP30CreditReview'
import ERP31Invoicing from './ERP31Invoicing'
import ERP34CodRecon from './ERP34CodRecon'
import ERP36ClaimsDesk, { ERP37Claim } from './ERP36Claims'
import { erpNav, type ErpCtx } from './nav'

/** Built screens, by spec screen id. Unlisted screens show their placeholder. */
const SCREENS = { 'ERP-05': ERP05JobBoard, 'ERP-06': ERP06AtRisk, 'ERP-07': ERP07Exceptions, 'ERP-09': ERP09PartnerHealth, 'ERP-10': ERP10DailyPack, 'ERP-11': ERP11Applications, 'ERP-12': ERP12KycDesk, 'ERP-13': ERP13Commercials, 'ERP-14': ERP14Trials, 'ERP-22': ERP22RateCards, 'ERP-23': ERP23Approvals, 'ERP-26': ERP26Leads, 'ERP-27': ERP27OnboardingReview, 'ERP-30': ERP30CreditReview, 'ERP-31': ERP31Invoicing, 'ERP-34': ERP34CodRecon, 'ERP-36': ERP36ClaimsDesk }

/** Logisco ERP + Control Tower (/erp) — Logisco staff. Spec: docs/04-erp-control-tower.md */
export default function ErpApp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useSessionUser('erp')
  const user = useData((d) => (userId ? d.staff[userId] : undefined))
  const shipments = useData((d) => d.shipments)

  if (!user) return <Navigate to="/launch/erp" replace />

  const ctx: ErpCtx = { role: user.role }

  return (
    <Routes>
      <Route
        element={
          <WebShell
            app="erp"
            dark
            nav={visibleNav(erpNav, ctx)}
            orgName={t('apps.erp.short')}
            user={{ name: user.name, roleLabel: user.title }}
            searchPlaceholderKey="search.placeholder.erp"
            onSearch={(q) => {
              // Global search → Shipment 360 (ERP-03). An exact LR, or the only LR containing the text.
              const query = q.toUpperCase()
              const hits = Object.keys(shipments).filter((id) => id === query || id.includes(query))
              const hit = hits.includes(query) ? query : hits.length === 1 ? hits[0] : undefined
              if (hit) navigate(`/erp/shipments/${hit}`)
              else toast.info(hits.length > 1 ? t('search.many', { count: hits.length }) : t('search.none', { q }))
            }}
            helpPath=""
          />
        }
      >
        {/* ERP-02 home (not built yet): Control Tower roles start on the live job board (ERP-05 "home for CT roles") */}
        <Route
          index
          element={user.role === 'controlTower' ? <Navigate to="control-tower/jobs" replace /> : <ScreenPlaceholder screenId="ERP-02" title={t('nav.erp.home')} phase={2} />}
        />
        {/* ERP-03 Shipment 360 is opened from search and lists, not the menu; every role can open it */}
        <Route path="shipments/:lr" element={<ERP03Shipment360 />} />
        <Route path="control-tower/reassign/:legId" element={<ERP08Reassign />} />
        <Route path="claims/:id" element={<ERP37Claim />} />
        <Route path="sales/onboarding/:customerId" element={<ERP27OnboardingReview />} />
        <Route path="pricing/rate-cards/:cardId" element={<ERP22RateCards />} />
        {navRoutes(erpNav, ctx, SCREENS)}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
