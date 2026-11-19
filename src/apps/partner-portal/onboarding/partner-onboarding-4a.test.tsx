import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import PP04PartnerApply from '@apps/public/PP04PartnerApply'
import { AutoApprover } from '@shared/sim/AutoApprover'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import type { PartnerApplyInput } from '@shared/store/partnerOnboardingActions'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerPortalApp from '../PartnerPortalApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/partner/apply" element={<PP04PartnerApply />} />
          <Route path="/partner/*" element={<PartnerPortalApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
        <AutoApprover />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const upload = (doc: string, name = 'file.pdf') => fireEvent.change(screen.getByLabelText(`Upload ${doc}`), { target: { files: [new File(['x'], name, { type: 'application/pdf' })] } })
const docRow = (name: string) => screen.getByRole('listitem', { name })

describe('Partner onboarding, Part 4a (PP-04 to PP-07; ERP-11, ERP-12)', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('a line-haul transporter applies, is invited automatically, submits KYC with an expired policy and clears the condition', async () => {
    app('/partner/apply')
    // Step 1: type D pre-ticks line-haul and PTL
    fireEvent.click(screen.getByRole('radio', { name: /^D · Mid-mile/ }))
    expect(within(screen.getByRole('group', { name: 'Legs you can serve' })).getByRole('checkbox', { name: 'Line-haul' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    // Step 2: duplicate check on SwiftCity's phone, then the sample applicant
    fireEvent.change(screen.getByLabelText(/^Mobile/), { target: { value: '98111 22334' } })
    expect(screen.getByRole('alert')).toHaveTextContent('An application or account already exists')
    fireEvent.click(screen.getByRole('button', { name: /Fill sample/ }))
    expect(screen.getByLabelText(/Company name/)).toHaveValue('Vindhya Freight Carriers Pvt Ltd')
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }))
    await tick(700)
    fireEvent.change(screen.getByLabelText(/^OTP/), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    // Step 3: coverage (lane from the sample) with the map preview
    expect(screen.getByLabelText('From city')).toHaveValue('New Delhi')
    expect(screen.getByTestId('map')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    // Step 4: fleet, capacity, rates → submit
    expect(screen.getByLabelText(/Daily capacity \(kg \/ day\)/)).toHaveValue(80000)
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    await tick(600)
    const a = Object.values(st().data.applications).find((x) => x.ref === 'APP-2026-0413')!
    expect(a).toMatchObject({ status: 'new', fitScore: 88 })
    const partnerId = a.partnerId

    // PP-05: under review → invited automatically; only onboarding in the menu
    expect(screen.getByTestId('under-review')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Jobs' })).not.toBeInTheDocument()
    await tick(4500)
    expect(screen.getByTestId('fit-reason')).toHaveTextContent('Logisco needs line-haul capacity on New Delhi → Bengaluru: only one partner runs it')
    expect(screen.getByText('Meera Iyer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Start onboarding' }))

    // PP-06: only Type D documents
    expect(screen.queryByRole('listitem', { name: 'Hub lease, fire NOC, trade licence' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Fetch from DigiLocker/ }))
    await tick(1100)
    expect(within(docRow('GST registration (GSTIN)')).getByText('From DigiLocker')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Account number'), { target: { value: '912020012345678' } })
    fireEvent.change(screen.getByLabelText('Confirm account number'), { target: { value: '912020012345678' } })
    fireEvent.change(screen.getByLabelText('IFSC'), { target: { value: 'UTIB0000123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify (penny-drop)' }))
    await tick(1000)
    expect(screen.getByTestId('check-pennyDrop')).toHaveTextContent('name match 100%')
    // Vahan: SwiftCity's van is a duplicate; a new number passes
    fireEvent.change(screen.getByLabelText('Vehicle registration no.'), { target: { value: 'DL01LT4521' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify on Vahan' }))
    await tick(1000)
    expect(screen.getByTestId('check-vahan')).toHaveTextContent('already registered with SwiftCity')
    fireEvent.change(screen.getByLabelText('Vehicle registration no.'), { target: { value: 'DL01LAB4521' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify on Vahan' }))
    await tick(1000)
    expect(screen.getByTestId('check-vahan')).toHaveTextContent('DL01LAB4521')
    fireEvent.change(screen.getByLabelText('Driving licence no.'), { target: { value: 'DL-0420190012345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify on Sarathi' }))
    await tick(1000)
    for (const d of ['Transport licence', 'Bank account (cancelled cheque)', 'Vehicle RC, fitness, permit, insurance', 'Driver / rider licence and ID', 'Police verification of field staff']) upload(d)
    expect(screen.getByRole('button', { name: 'Submit for verification' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Policy no.'), { target: { value: 'GIT/DL/2026/118' } })
    fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2026-12-10' } })
    upload('Goods-in-transit / liability insurance', 'git.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }))
    await tick(1000)
    expect(screen.getByTestId('kyc-summary')).toHaveTextContent('1 document flagged.')
    expect(screen.getByTestId('flag-insurance')).toHaveTextContent('Policy expires before the agreement start')

    // Manual desk decided by the rules: conditionally approved, condition to re-upload
    await tick(4500)
    expect(st().data.partners[partnerId].status).toBe('agreement')
    fireEvent.click(screen.getByRole('link', { name: 'See the outcome' }))
    expect(screen.getByTestId('outcome')).toHaveTextContent('Conditionally approved')
    expect(screen.getByTestId('outcome')).toHaveTextContent('Upload a valid Goods-in-transit / liability insurance')
    fireEvent.click(screen.getByRole('link', { name: 'Upload evidence' }))
    fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2027-12-31' } })
    upload('Goods-in-transit / liability insurance', 'git_renewed.pdf')
    expect(st().data.applications[a.id].outcome!.conditions[0].closedAt).toBeDefined()
    expect(within(docRow('Goods-in-transit / liability insurance')).getByText('Verified')).toBeInTheDocument()
  })

  it('manual approvals: Meera invites a hub operator on ERP-11, Kiran records the hub audit on ERP-12', async () => {
    st().setFlag('manualApprovals', true)
    const input: PartnerApplyInput = {
      type: 'F',
      legs: ['originHub', 'destHub'],
      services: ['parcel'],
      companyName: 'Belgaum Cargo Hub Pvt Ltd',
      gstin: '29AAKCB7710F1Z2',
      pan: 'AAKCB7710F',
      constitution: 'privateLtd',
      contact: { name: 'Vinayak Patil', designation: 'Director', mobile: '94481 22007', email: 'v@bch.in' },
      address: 'Udyambag, Belagavi',
      source: 'sales',
      gstRegistered: true,
      states: ['Karnataka'],
      cities: ['Belagavi'],
      pincodes: [],
      lanes: [],
      hubs: [{ name: 'Udyambag hub', address: 'Udyambag', pincode: '590001', areaSqft: 30000, docks: 6 }],
      fleet: {},
      capacity: 3000,
      indicativeRates: [{ leg: 'originHub', rate: 6 }, { leg: 'destHub', rate: 6 }],
    }
    const { applicationId: id, userId } = st().applyAsPartner(input)

    useSession.getState().login('erp', 'LS-MEERA')
    app('/erp/partners/applications')
    const table = screen.getByTestId('applications')
    expect(within(table).getByText('Logisco has no hub in Belagavi')).toBeInTheDocument()
    fireEvent.click(within(table).getByRole('button', { name: id }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByText('Give a reason')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
    expect(st().data.applications[id].status).toBe('invited')

    // The partner's KYC (store actions), then the audit slot on PP-07
    st().runPartnerCheck(id, { kind: 'digilocker' })
    st().runPartnerCheck(id, { kind: 'pennyDrop', holder: 'Belgaum Cargo Hub Pvt Ltd', account: '123456789012', ifsc: 'CNRB0001234' })
    for (const k of ['bank', 'policeVerification', 'hubDocs'] as const) st().uploadPartnerDoc(id, k, { file: `${k}.pdf` })
    st().uploadPartnerDoc(id, 'premisesInsurance', { file: 'p.pdf', number: 'P/1', expiry: '2027-12-31' })
    st().submitPartnerKyc(id, userId)
    useSession.getState().login('partnerPortal', userId)
    app('/partner/onboarding/verification')
    expect(screen.getByTestId('outcome')).toHaveTextContent('Approved')
    fireEvent.click(screen.getByRole('button', { name: 'Book audit slot' }))
    expect(screen.getByTestId('audit-slot')).toHaveTextContent('26-Nov-2026, Morning, with Kiran P.')

    // ERP-12: Kiran records five checks with geo-tagged photos
    useSession.getState().login('erp', 'LS-KIRAN')
    app(`/erp/partners/kyc?app=${id}`)
    expect(screen.getByTestId('checklist-count')).toHaveTextContent('7 of 7 required verified')
    const panel = screen.getByTestId('audit-panel')
    expect(within(panel).getByRole('button', { name: 'Save audit' })).toBeDisabled()
    for (const item of ['Security', 'CCTV', 'Fire safety', 'Docks', 'Scale calibration']) {
      const row = within(panel).getByRole('listitem', { name: item })
      fireEvent.click(within(row).getByRole('radio', { name: 'Pass' }))
      fireEvent.click(within(row).getByRole('button', { name: /Geo-tagged photo/ }))
    }
    fireEvent.click(within(panel).getByRole('button', { name: 'Save audit' }))
    expect(st().data.applications[id]).toMatchObject({ status: 'agreement', hubAudit: { result: 'approved', auditorId: 'LS-KIRAN' } })

    useSession.getState().login('partnerPortal', userId)
    app('/partner/onboarding/verification')
    expect(screen.getByTestId('hub-audit')).toHaveTextContent('5 of 5 passed')
  })

  it('Deccan Roadlines: the flagged insurance is an open condition; Prakash re-uploads it', () => {
    useSession.getState().login('partnerPortal', 'PU-PRAKASH')
    app('/partner/onboarding/verification')
    expect(screen.getByTestId('outcome')).toHaveTextContent('Conditionally approved')
    expect(screen.getByTestId('outcome')).toHaveTextContent('due 26-Nov-2026')
    app('/partner/onboarding/documents')
    expect(screen.getByTestId('flag-insurance')).toHaveTextContent('Policy expires before the agreement start')
    fireEvent.change(screen.getByLabelText('Policy no.'), { target: { value: 'GIT/KA/2026/9020' } })
    fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2027-11-30' } })
    upload('Goods-in-transit / liability insurance', 'git_policy_2026.pdf')
    expect(st().data.applications['APP-2026-0412'].outcome!.conditions[0].closedAt).toBeDefined()

    // ERP-12 shows the history: Deccan's checks and NCR CrossDock's completed audit
    useSession.getState().login('erp', 'LS-MEERA')
    app('/erp/partners/kyc?app=APP-2026-0118')
    expect(screen.getByTestId('audit-panel')).toHaveTextContent('Scale calibration')
    expect(screen.getByTestId('audit-panel')).toHaveTextContent('Approved')
  })
})
