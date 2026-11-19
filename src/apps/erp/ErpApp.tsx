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
import ERP26Leads from './ERP26Leads'
import ERP27OnboardingReview from './ERP27OnboardingReview'
import ERP30CreditReview from './ERP30CreditReview'
import { erpNav, type ErpCtx } from './nav'

/** Built screens, by spec screen id. Unlisted screens show their placeholder. */
const SCREENS = { 'ERP-05': ERP05JobBoard, 'ERP-26': ERP26Leads, 'ERP-27': ERP27OnboardingReview, 'ERP-30': ERP30CreditReview }

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
        <Route path="sales/onboarding/:customerId" element={<ERP27OnboardingReview />} />
        {navRoutes(erpNav, ctx, SCREENS)}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
