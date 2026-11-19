import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import { AutoApprover } from '@shared/sim/AutoApprover'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from '../CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
        <AutoApprover />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 })

/** Vardhman Wires through KYC and credit (Part 3a), now at the contract step. */
function atContract() {
  const { customerId, userId } = st().signUp({ legalName: 'Vardhman Wires Pvt Ltd', gstin: '27AAGCV4321K1Z2', businessType: 'manufacturer', industry: 'electricals', city: 'Pune', contact: { name: 'Anita', email: 'a@v.in', mobile: '98220 11223' }, source: 'salesVisit', privacyConsent: true, gstConsent: true, language: 'en' })
  st().saveQualification(customerId, { shipmentsPerMonth: 450, spendBand: '2lTo10l', parcelPct: 30, lanes: [{ originPincode: '411001', destCity: 'Bengaluru', perMonth: 60 }], specialHandling: [], payment: ['tbb'] }, userId)
  st().verifyGstin(customerId, 'U27100MH2009PTC123456')
  st().verifyPan(customerId, 'AAGCV4321K')
  st().verifyBank(customerId, { holder: 'Vardhman Wires Pvt Ltd', account: '123456789012', ifsc: 'ICIC0000456', type: 'current' })
  st().saveSignatory(customerId, { name: 'Rohan Shah', designation: 'Director', email: 'r@v.in', mobile: '98220 44556' })
  st().savePickupLocation(customerId, { name: 'Plant', address: 'MIDC', pincode: '411001', lat: 18.6, lng: 73.8, contact: { name: 'S', mobile: '98220 77889' }, window: { from: '10:00', to: '17:00' }, days: 'Mon–Sat' })
  st().submitKyc(customerId, userId)
  st().submitCredit(customerId, { requestedLimit: 500000, termsDays: 30, yearsInBusiness: 17, gstConsent: true, depositWilling: true }, userId)
  st().autoDecide(customerId, 'credit')
  st().acceptCredit(customerId, userId)
  return { customerId, userId }
}

describe('Customer onboarding, Part 3b (ERP-22/23/27, CP-08 to CP-10)', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('negotiated card → Pricing Head approves → Sales issues → customer e-signs → integration → pilot → live', async () => {
    st().setFlag('manualApprovals', true)
    const { customerId, userId } = atContract()

    // ERP-22: Divya drafts a negotiated card; the margin check flags lines below target
    useSession.getState().login('erp', 'LS-DIVYA')
    app('/erp/pricing/rate-cards')
    fireEvent.click(screen.getByRole('button', { name: /New negotiated card/ }))
    expect(screen.getByLabelText('Customer')).toHaveValue(customerId)
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }))
    const cardId = Object.values(st().data.rateCards).find((r) => r.customerId === customerId)!.id
    expect(screen.getByTestId('margin-summary')).toHaveTextContent(/below the 15% target margin/)
    const perKg = within(screen.getByTestId('ptl-lines')).getAllByRole('spinbutton')[0]
    fireEvent.change(perKg, { target: { value: '30' } })
    expect(st().data.rateCards[cardId].ptl[0].perKg).toBe(30)
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))
    expect(st().data.rateCards[cardId].status).toBe('pendingApproval')

    // ERP-23: send back needs a comment; approve
    app('/erp/pricing/approvals')
    const card = screen.getByRole('region', { name: st().data.rateCards[cardId].name })
    expect(within(card).getByTestId('below-target').querySelectorAll('tbody tr').length).toBeGreaterThan(0)
    fireEvent.click(within(card).getByRole('radio', { name: 'Send back' }))
    expect(within(card).getByRole('button', { name: 'Record decision' })).toBeDisabled()
    fireEvent.click(within(card).getByRole('radio', { name: 'Approve' }))
    fireEvent.change(within(card).getByLabelText(/Comment/), { target: { value: 'Strategic account' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Record decision' }))
    expect(st().data.rateCards[cardId]).toMatchObject({ status: 'live', approval: { decision: 'approve', decidedBy: 'LS-DIVYA' } })

    // CP-08 before the contract is issued: waiting
    useSession.getState().login('customer', userId)
    app('/customer/onboarding/contract')
    expect(screen.getByText(/is preparing your rate card and contract/)).toBeInTheDocument()

    // ERP-27: Arjun offers the negotiated card and issues the contract
    useSession.getState().login('erp', 'LS-ARJUN')
    app(`/erp/sales/onboarding/${customerId}`)
    expect(screen.getByLabelText('Rate card to offer')).toHaveValue(cardId)
    fireEvent.click(screen.getByRole('button', { name: 'Issue contract' }))
    expect(st().data.customers[customerId].onboarding!.contract).toMatchObject({ rateCardId: cardId, status: 'issued', effectiveDate: '2026-12-01' })

    // CP-08: review and Aadhaar e-sign
    app('/customer/onboarding/contract')
    tab('Contract')
    expect(screen.getByRole('region', { name: 'Preview contract' })).toHaveTextContent('Vardhman Wires Pvt Ltd')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Accept and e-sign/ }))
    fireEvent.change(screen.getByLabelText(/^OTP/), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign' }))
    expect(st().data.customers[customerId]).toMatchObject({ status: 'integration', rateCardId: cardId })

    // CP-09: sample SKUs (one outlier), fix it, complete integration
    fireEvent.click(screen.getByRole('button', { name: /Continue to integration/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Use sample SKUs' }))
    const flagged = Object.values(st().data.skus).filter((s) => s.customerId === customerId && s.status === 'flagged')
    expect(flagged).toHaveLength(1)
    fireEvent.change(screen.getByLabelText(`${flagged[0].code} Weight (kg)`), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Re-check' }))
    expect(st().data.skus[flagged[0].id].status).toBe('frozen')
    fireEvent.click(screen.getByRole('button', { name: 'Mark integration complete' }))
    expect(st().data.customers[customerId].status).toBe('pilot')

    // CP-10: tracker with the pilot plan; booking is open
    expect(screen.getByTestId('tracker')).toHaveTextContent('Pilot day 1 of 14 · 23-Nov-2026 – 06-Dec-2026')
    expect(screen.getByRole('button', { name: /Book first shipment/ })).toBeEnabled()
    expect(screen.getByTestId('pilot-report')).toBeInTheDocument()

    // ERP-27: Mark live only after the pilot
    app(`/erp/sales/onboarding/${customerId}`)
    expect(screen.getByRole('button', { name: 'Mark live' })).toBeDisabled()
    act(() => st().advanceTime(14 * 24 * 60))
    expect(screen.getByRole('button', { name: 'Mark live' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Mark live' }))
    expect(st().data.customers[customerId].status).toBe('live')
    expect(screen.getByText(/Live since/)).toBeInTheDocument()
  })

  it('automatic approvals: the contract is issued on its own with the standard card', async () => {
    const { customerId, userId } = atContract()
    useSession.getState().login('customer', userId)
    app('/customer/onboarding/contract')
    await tick(4500)
    expect(st().data.customers[customerId].onboarding!.contract).toMatchObject({ rateCardId: 'RC-STANDARD', status: 'issued', issuedBy: 'system' })
    expect(screen.queryByText(/is preparing your rate card/)).not.toBeInTheDocument()
  })
})
