import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { buildSeed, DEMO_START } from '@data/seed'
import { cashForecast, itcReconciliation } from '@shared/engines/accounting'
import { approvals } from '@shared/engines/erpHome'
import { directory, partnerChurn } from '@shared/engines/partnerDirectory'
import { useDemoStore } from '@shared/store'
import { advanceInsurerClaim } from '@shared/store/insurerActions'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import ErpApp from './ErpApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('ERP-02, ERP-15, ERP-35, ERP-38 engines', () => {
  it('directory, churn, accounting and insurer claim flow', () => {
    const d = buildSeed()
    const rows = directory(d, DEMO_START)
    expect(rows.find((r) => r.partner.id === 'P-SWIFTCITY')).toMatchObject({ status: 'live' })
    expect(['low', 'medium', 'high']).toContain(partnerChurn(d, 'P-FASTTRACK', DEMO_START).level)
    expect(cashForecast(d, DEMO_START)).toHaveLength(30)
    expect(itcReconciliation(d).length).toBeGreaterThan(0)
    let x = advanceInsurerClaim(d, 'INS-88213', 'underSurvey', '', 'LS-FARHAN', DEMO_START)
    x = advanceInsurerClaim(x, 'INS-88213', 'approved', '', 'LS-FARHAN', DEMO_START, 18000)
    x = advanceInsurerClaim(x, 'INS-88213', 'paid', '', 'LS-FARHAN', DEMO_START)
    expect(x.insurerClaims['INS-88213']).toMatchObject({ status: 'paid', approvedAmount: 18000 })
    expect(x.insurerClaims['INS-88213'].utr).toBeTruthy()
    expect(advanceInsurerClaim(d, 'INS-88213', 'paid', '', 'LS-FARHAN', DEMO_START)).toBe(d) // must be surveyed and approved first
    expect(approvals(d, 'superAdmin').length).toBeGreaterThanOrEqual(approvals(d, 'finance').length)
  })
})

describe('ERP screens', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('ERP-02 home for Finance with cards and approvals', () => {
    useSession.getState().login('erp', Object.values(st().data.staff).find((s) => s.role === 'finance')!.id)
    app('/erp')
    expect(screen.getByTestId('home-cards')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Approvals waiting' })).toBeInTheDocument()
  })

  it('ERP-15 directory opens Partner 360', () => {
    useSession.getState().login('erp', Object.values(st().data.staff).find((s) => s.role === 'partnerManagement')!.id)
    app('/erp/partners/directory')
    fireEvent.click(within(screen.getByTestId('partner-directory')).getByRole('button', { name: 'SwiftCity Couriers' }))
    expect(screen.getByRole('heading', { name: /SwiftCity Couriers Pvt Ltd/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Money' }))
    expect(screen.getByTestId('partner-money')).toBeInTheDocument()
  })

  it('ERP-38 shows INS-88213 filed for CLM-2026-0142', () => {
    useSession.getState().login('erp', 'LS-FARHAN')
    app('/erp/claims/insurer')
    const row = within(screen.getByTestId('insurer-claims')).getByRole('row', { name: 'INS-88213' })
    expect(row).toHaveTextContent('CLM-2026-0142')
    expect(row).toHaveTextContent('₹20,000.00')
  })

  it('ERP-35 accounting renders P&L and ITC', () => {
    useSession.getState().login('erp', Object.values(st().data.staff).find((s) => s.role === 'finance')!.id)
    app('/erp/finance/accounts')
    expect(screen.getByTestId('pnl')).toBeInTheDocument()
    expect(screen.getByTestId('itc')).toBeInTheDocument()
  })
})
