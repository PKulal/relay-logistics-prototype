import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import CP04SignUp from '@apps/public/CP04SignUp'
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
          <Route path="/signup" element={<CP04SignUp />} />
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
        <AutoApprover />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const type = (name: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } })
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('Customer onboarding, Part 3a (CP-04 to CP-07)', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('sign up → qualification → KYC → credit (automatic approval) → contract step', async () => {
    app('/signup')
    // CP-04: Sharma's GSTIN is taken
    type(/^GSTIN/, '07AABCS1234F1Z5')
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))
    expect(screen.getByText(/An account already exists for this GSTIN/)).toBeInTheDocument()
    type(/Company legal name/, 'Vardhman Wires Pvt Ltd')
    type(/^GSTIN/, '27AAGCV4321K1Z2')
    expect(screen.getByText('Registered in Maharashtra')).toBeInTheDocument()
    type(/Business type/, 'manufacturer')
    type(/^Industry/, 'electricals')
    type(/^City/, 'Pune')
    type(/Full name/, 'Anita Kulkarni')
    type(/Work email/, 'anita@vardhmanwires.in')
    type(/Mobile number/, '98220 11223')
    fireEvent.click(screen.getByRole('button', { name: /Send OTP/ }))
    await tick(700)
    type(/^OTP/, '123456')
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    type(/How did you hear about us/, 'salesVisit')
    fireEvent.click(screen.getByRole('checkbox', { name: /Privacy Notice/ }))
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))
    await tick(600)
    const customerId = Object.values(st().data.customers).find((c) => c.gstin === '27AAGCV4321K1Z2')!.id
    expect(Object.values(st().data.leads).find((l) => l.customerId === customerId)).toMatchObject({ stage: 'new', source: 'salesVisit' })

    // CP-05 (the app opens there after sign-up)
    app('/customer/onboarding/qualification')
    expect(screen.getByRole('heading', { name: 'Your shipping profile' })).toBeInTheDocument()
    type(/Expected shipments per month/, '450')
    type(/Expected monthly freight spend/, '2lTo10l')
    type(/Origin pincode/, '411001')
    type(/Destination city/, 'Bengaluru')
    type(/Shipments a month/, '60')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Credit (TBB)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check my lanes' }))
    const result = screen.getByTestId('cp05-result')
    expect(result).toHaveTextContent('Serviceable')
    expect(result).toHaveTextContent('Inside sales')
    expect(result).toHaveTextContent('Arjun Mehta')

    // CP-06
    fireEvent.click(screen.getByRole('button', { name: /Continue to KYC/ }))
    expect(screen.getByRole('heading', { name: 'KYC verification' })).toBeInTheDocument()
    type(/^CIN/, 'U27100MH2009PTC123456')
    fireEvent.click(screen.getByRole('button', { name: /Verify GSTIN/ }))
    await tick(2000)
    expect(screen.getByTestId('gst-result')).toHaveTextContent('Active')
    fireEvent.click(screen.getByRole('button', { name: 'Verify PAN' }))
    await tick(2000)
    type(/Signatory name/, 'Rohan Shah')
    fireEvent.change(screen.getAllByLabelText(/^Designation/)[0], { target: { value: 'Director' } })
    fireEvent.change(screen.getAllByLabelText(/Work email/)[0], { target: { value: 'rohan@vardhmanwires.in' } })
    fireEvent.change(screen.getAllByLabelText(/Mobile number/)[0], { target: { value: '98220 44556' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save signatory' }))
    type(/^IFSC/, 'ICIC0000456')
    type(/^Account number/, '123456789012')
    type(/Confirm account number/, '123456789012')
    fireEvent.click(screen.getByRole('button', { name: /penny-drop/ }))
    await tick(2000)
    expect(screen.getByTestId('bank-result')).toHaveTextContent('ICICI Bank')
    type(/Location name/, 'Bhosari Plant')
    type(/^Pincode/, '411001')
    type(/^Address/, 'Plot 7, MIDC Bhosari')
    fireEvent.click(screen.getByRole('switch', { name: 'Confirm the pin' }))
    fireEvent.change(screen.getAllByLabelText(/^Pickup contact/)[0], { target: { value: 'Sunil Patil' } })
    type(/Pickup contact mobile/, '98220 77889')
    fireEvent.click(screen.getByRole('button', { name: /Add pickup address/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit KYC' }))
    expect(screen.getByText('KYC verified')).toBeInTheDocument()

    // CP-07
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    expect(screen.getByRole('heading', { name: 'Credit (TBB)' })).toBeInTheDocument()
    type(/Requested credit limit/, '500000')
    expect(screen.getByLabelText(/Years in business/)).toHaveValue(17)
    fireEvent.click(screen.getByRole('radio', { name: 'Willing' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /GST filing data to assess credit/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(within(screen.getByTestId('credit-decision')).getByText('Under review')).toBeInTheDocument()
    await tick(4500) // automatic decision
    expect(within(screen.getByTestId('credit-decision')).getByText('Approved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept terms' }))
    expect(st().data.customers[customerId]).toMatchObject({ status: 'contract', billing: 'credit', creditLimit: 500000, creditTermsDays: 30, securityDeposit: 50000 })
  })

  it('with manual approvals, Finance decides on ERP-30 and Sales sees the lead move on ERP-26', async () => {
    st().setFlag('manualApprovals', true)
    const { customerId, userId } = st().signUp({ legalName: 'Vardhman Wires Pvt Ltd', gstin: '27AAGCV4321K1Z2', businessType: 'manufacturer', industry: 'electricals', city: 'Pune', contact: { name: 'Anita', email: 'a@v.in', mobile: '98220 11223' }, source: 'tender', privacyConsent: true, gstConsent: true, language: 'en' })
    st().saveQualification(customerId, { shipmentsPerMonth: 450, spendBand: '2lTo10l', parcelPct: 30, lanes: [{ originPincode: '411001', destCity: 'Bengaluru', perMonth: 60 }], specialHandling: [], payment: ['tbb'] }, userId)
    st().verifyGstin(customerId, 'U27100MH2009PTC123456')
    st().verifyPan(customerId, 'AAGCV4321K')
    st().verifyBank(customerId, { holder: 'Vardhman Wires Pvt Ltd', account: '123456789012', ifsc: 'ICIC0000456', type: 'current' })
    st().saveSignatory(customerId, { name: 'Rohan', designation: 'Director', email: 'r@v.in', mobile: '98220 44556' })
    st().savePickupLocation(customerId, { name: 'Plant', address: 'MIDC', pincode: '411001', lat: 18.6, lng: 73.8, contact: { name: 'S', mobile: '98220 77889' }, window: { from: '10:00', to: '17:00' }, days: 'Mon–Sat' })
    st().submitKyc(customerId, userId)
    st().submitCredit(customerId, { requestedLimit: 500000, termsDays: 30, yearsInBusiness: 17, gstConsent: true, depositWilling: true }, userId)

    useSession.getState().login('erp', 'LS-LAKSHMI')
    app('/erp/finance/credit')
    await tick(5000) // nothing decides on its own
    expect(st().data.customers[customerId].onboarding!.credit!.status).toBe('underReview')
    expect(screen.getByTestId('credit-score')).toHaveTextContent(/\d+/)
    type(/Approved limit/, '300000')
    fireEvent.click(screen.getByRole('button', { name: 'Approve lower' }))
    expect(st().data.customers[customerId].onboarding!.credit).toMatchObject({ status: 'approvedLower', approvedLimit: 300000, decidedBy: 'LS-LAKSHMI' })

    useSession.getState().login('erp', 'LS-ARJUN')
    app('/erp/sales/leads')
    const col = screen.getByRole('heading', { name: /^Credit/ }).closest('section')!
    expect(col).toHaveTextContent('Vardhman Wires Pvt Ltd')
    expect(col).toHaveTextContent('Arjun')
  })
})
