import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useData } from '@shared/hooks/useDemo'
import { visibleNav } from '@shared/nav'
import { navRoutes } from '@shared/shell/routes'
import { WebShell } from '@shared/shell/WebShell'
import { useSessionUser } from '@shared/store/session'
import { NotFound, ScreenPlaceholder } from '@shared/ui/Page'
import { erpNav, type ErpCtx } from './nav'

/** Logisco ERP + Control Tower (/erp) — Logisco staff. Spec: docs/04-erp-control-tower.md */
export default function ErpApp() {
  const { t } = useTranslation()
  const userId = useSessionUser('erp')
  const user = useData((d) => (userId ? d.staff[userId] : undefined))

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
            helpPath=""
          />
        }
      >
        {/* ERP-02 home: role-specific cards and AI briefing */}
        <Route index element={<ScreenPlaceholder screenId="ERP-02" title={t('nav.erp.home')} phase={2} />} />
        {/* ERP-03 Shipment 360 is opened from search and lists, not the menu; every role can open it */}
        <Route path="shipments/:lr" element={<ScreenPlaceholder screenId="ERP-03" title={t('nav.erp.shipment360')} phase={2} />} />
        {navRoutes(erpNav, ctx)}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
