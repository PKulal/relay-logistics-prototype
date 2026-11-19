import { PackagePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useData } from '@shared/hooks/useDemo'
import { visibleNav } from '@shared/nav'
import { navRoutes } from '@shared/shell/routes'
import { WebShell } from '@shared/shell/WebShell'
import { useSessionUser } from '@shared/store/session'
import { Button } from '@shared/ui/button'
import { AccessDenied, NotFound } from '@shared/ui/Page'
import CP11Dashboard from './CP11Dashboard'
import CP12GetQuote from './CP12GetQuote'
import CP13BookShipment from './CP13BookShipment'
import CP14Confirmation from './CP14Confirmation'
import CP16Shipments from './CP16Shipments'
import CP17Shipment from './CP17Shipment'
import CP05Qualification from './onboarding/CP05Qualification'
import CP06Kyc from './onboarding/CP06Kyc'
import CP07Credit from './onboarding/CP07Credit'
import OnboardingNext from './onboarding/OnboardingNext'
import OnboardingHome from './onboarding/OnboardingHome'
import { isOnboarding } from './onboarding/steps'
import { customerNav, type CustomerCtx } from './nav'

/** Built screens, by spec screen id. Unlisted screens show their placeholder. */
const SCREENS = { 'CP-11': CP11Dashboard, 'CP-12': CP12GetQuote, 'CP-13': CP13BookShipment, 'CP-16': CP16Shipments }

/** Customer Portal (/customer) — B2B shippers. Spec: docs/01-customer-portal.md */
export default function CustomerApp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useSessionUser('customer')
  const user = useData((d) => (userId ? d.customerUsers[userId] : undefined))
  const customer = useData((d) => (user ? d.customers[user.customerId] : undefined))

  if (!user || !customer) return <Navigate to="/launch/customer" replace />

  const ctx: CustomerCtx = { role: user.role, customer }
  // Until the account is in pilot (CP-10), the dashboard and booking lead to the current onboarding step
  const onboarding = isOnboarding(customer)
  const canBook = (user.role === 'admin' || user.role === 'dispatch') && !onboarding
  const screens = onboarding ? { ...SCREENS, 'CP-11': OnboardingHome, 'CP-13': OnboardingHome } : SCREENS

  return (
    <Routes>
      <Route
        element={
          <WebShell
            app="customer"
            nav={visibleNav(customerNav, ctx)}
            orgName={customer.shortName}
            user={{ name: user.name, roleLabel: t(`roles.customer.${user.role}`) }}
            searchPlaceholderKey="search.placeholder.customer"
            headerActions={
              canBook && (
                <Button size="sm" className="mr-1 hidden sm:inline-flex" onClick={() => navigate('/customer/book')}>
                  <PackagePlus /> {t('header.bookShipment')}
                </Button>
              )
            }
          />
        }
      >
        {navRoutes(customerNav, ctx, screens)}
        {/* Screens outside the menu (CP spec §4.3) */}
        <Route path="book/done/:lr" element={canBook ? <CP14Confirmation /> : <AccessDenied />} />
        <Route path="shipments/:lr" element={<CP17Shipment />} />
        <Route path="onboarding" element={<OnboardingHome />} />
        <Route path="onboarding/qualification" element={<CP05Qualification />} />
        <Route path="onboarding/kyc" element={<CP06Kyc />} />
        <Route path="onboarding/credit" element={<CP07Credit />} />
        <Route path="onboarding/next" element={<OnboardingNext />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
