import { PackagePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { unreadCount } from '@shared/engines/notifications'
import { useData } from '@shared/hooks/useDemo'
import { visibleNav } from '@shared/nav'
import { navRoutes } from '@shared/shell/routes'
import { WebShell } from '@shared/shell/WebShell'
import { useSessionUser } from '@shared/store/session'
import { Button } from '@shared/ui/button'
import { AssistantLauncher } from '@shared/ui/Assistant'
import { NotificationCentre } from '@shared/ui/NotificationCentre'
import { AccessDenied, NotFound } from '@shared/ui/Page'
import CP11Dashboard from './CP11Dashboard'
import CP12GetQuote from './CP12GetQuote'
import CP13BookShipment from './CP13BookShipment'
import CP14Confirmation from './CP14Confirmation'
import CP16Shipments from './CP16Shipments'
import CP19Exceptions from './CP19Exceptions'
import CP20WeightDiscrepancy from './CP20WeightDiscrepancy'
import CP21Ndr from './CP21Ndr'
import CP22Claims, { CP22ClaimDetail, CP22RaiseClaim } from './CP22Claims'
import CP17Shipment from './CP17Shipment'
import CP23Wallet from './CP23Wallet'
import CP24Invoices from './CP24Invoices'
import CP25Cod from './CP25Cod'
import CP28Users from './CP28Users'
import CP29Locations from './CP29Locations'
import CP30AddressBook from './CP30AddressBook'
import CP31Skus from './CP31Skus'
import CP32Integrations from './CP32Integrations'
import CP33Company from './CP33Company'
import CP34Preferences from './CP34Preferences'
import CP37Help from './CP37Help'
import CP05Qualification from './onboarding/CP05Qualification'
import CP06Kyc from './onboarding/CP06Kyc'
import CP07Credit from './onboarding/CP07Credit'
import OnboardingHome from './onboarding/OnboardingHome'
import { canBookNow, isOnboarding } from './onboarding/steps'
import CP08Contract from './onboarding/CP08Contract'
import CP09Integration from './onboarding/CP09Integration'
import CP10Tracker from './onboarding/CP10Tracker'
import { customerNav, type CustomerCtx } from './nav'

/** Built screens, by spec screen id. Unlisted screens show their placeholder. */
const SCREENS = { 'CP-11': CP11Dashboard, 'CP-12': CP12GetQuote, 'CP-13': CP13BookShipment, 'CP-16': CP16Shipments, 'CP-19': CP19Exceptions, 'CP-22': CP22Claims, 'CP-23': CP23Wallet, 'CP-24': CP24Invoices, 'CP-25': CP25Cod, 'CP-28': CP28Users, 'CP-29': CP29Locations, 'CP-30': CP30AddressBook, 'CP-31': CP31Skus, 'CP-32': CP32Integrations, 'CP-33': CP33Company, 'CP-37': CP37Help }

/** Customer Portal (/customer) — B2B shippers. Spec: docs/01-customer-portal.md */
export default function CustomerApp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useSessionUser('customer')
  const user = useData((d) => (userId ? d.customerUsers[userId] : undefined))
  const customer = useData((d) => (user ? d.customers[user.customerId] : undefined))
  const notifications = useData((d) => d.notifications)

  // CP-28: a disabled user is signed out
  if (!user || !customer || user.status === 'disabled') return <Navigate to="/customer/login" replace />
  const viewer = { app: 'customer' as const, customerId: customer.id, userId: user.id }

  const ctx: CustomerCtx = { role: user.role, customer }
  // Until the account is in pilot (CP-10), the dashboard and booking lead to the current onboarding step
  const onboarding = isOnboarding(customer)
  const canBook = (user.role === 'admin' || user.role === 'dispatch') && canBookNow(customer)
  const screens = { ...SCREENS, ...(onboarding ? { 'CP-11': OnboardingHome } : {}), ...(canBookNow(customer) ? {} : { 'CP-13': OnboardingHome }) }

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
            unread={unreadCount(notifications, viewer)}
            preferencesPath="preferences"
            assistant={<AssistantLauncher ctx={{ app: 'customer', userId: user.id, role: user.role, customerId: customer.id }} />}
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
        <Route path="exceptions/weight/:lr" element={<CP20WeightDiscrepancy />} />
        <Route path="exceptions/ndr/:lr" element={<CP21Ndr />} />
        <Route path="claims/new" element={<CP22RaiseClaim />} />
        <Route path="claims/:id" element={<CP22ClaimDetail />} />
        <Route path="notifications" element={<NotificationCentre viewer={viewer} />} />
        <Route path="preferences" element={<CP34Preferences />} />
        <Route path="onboarding" element={<CP10Tracker />} />
        <Route path="onboarding/qualification" element={<CP05Qualification />} />
        <Route path="onboarding/kyc" element={<CP06Kyc />} />
        <Route path="onboarding/credit" element={<CP07Credit />} />
        <Route path="onboarding/contract" element={<CP08Contract />} />
        <Route path="onboarding/integration" element={<CP09Integration />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
