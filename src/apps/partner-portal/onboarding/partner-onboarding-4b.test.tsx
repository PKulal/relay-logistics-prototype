import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import { AutoApprover } from '@shared/sim/AutoApprover'
import { useDemoStore } from '@shared/store'
import { recordTripForTrial } from '@shared/store/partnerAgreementActions'
import type { PartnerApplyInput } from '@shared/store/partnerOnboardingActions'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerPortalApp from '../PartnerPortalApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))
vi.mock('@shared/ui/QrCode', () => ({ QrCode: () => <div data-testid="qr" /> }))

const st = () => useDemoStore.getState()
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 })

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/partner/*" element={<PartnerPortalApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
        <AutoApprover />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

/** Vindhya Freight (Type D, Delhi → Bengaluru) through KYC: clean documents → approved → agreement step. */
function atAgreement() {
  const x: PartnerApplyInput = {
    type: 'D',
    legs: ['lineHaul'],
    services: ['expressPtl', 'standardPtl'],
    companyName: 'Vindhya Freight Carriers Pvt Ltd',
    gstin: '07AAHCV5521R1Z3',
    pan: 'AAHCV5521R',
    constitution: 'privateLtd',
    contact: { name: 'Harish Tiwari', designation: 'Director', mobile: '98990 31245', email: 'h@v.in' },
    address: 'New Delhi',
    source: 'website',
    gstRegistered: true,
    states: ['Delhi', 'Karnataka'],
    cities: ['New Delhi', 'Bengaluru'],
    pincodes: [],
    lanes: [{ origin: 'New Delhi', dest: 'Bengaluru', frequency: 'daily', transitHours: 60 }],
    hubs: [],
    fleet: { truck32: 12 },
    capacity: 80000,
    indicativeRates: [{ leg: 'lineHaul', rate: 8.5 }],
  }
  const { applicationId: id, partnerId, userId } = st().applyAsPartner(x)
  st().decideFit(id, 'invite', {}, 'LS-MEERA')
  st().runPartnerCheck(id, { kind: 'digilocker' })
  st().runPartnerCheck(id, { kind: 'pennyDrop', holder: 'Vindhya Freight Carriers Pvt Ltd', account: '912020012345678', ifsc: 'UTIB0000123' })
  st().runPartnerCheck(id, { kind: 'vahan', regNo: 'DL01LAB4521' })
  st().runPartnerCheck(id, { kind: 'sarathi', dl: 'DL-0420190012345' })
  for (const k of ['transportLicence', 'bank', 'vehicles', 'driverLicence', 'policeVerification'] as const) st().uploadPartnerDoc(id, k, { file: `${k}.pdf` })
  st().uploadPartnerDoc(id, 'insurance', { file: 'git.pdf', number: 'G/1', expiry: '2027-12-31' })
  st().submitPartnerKyc(id, userId)
  return { id, partnerId, userId }
}

describe('Partner onboarding, Part 4b (PP-08 to PP-10; ERP-13, ERP-14)', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('manual: Meera drafts, Pricing approves below target, the partner e-signs, adds a driver, runs the trial and goes live at Bronze', async () => {
    st().setFlag('manualApprovals', true)
    const { id, partnerId, userId } = atAgreement()
    expect(st().data.applications[id].status).toBe('agreement')

    // PP-08 before issue
    useSession.getState().login('partnerPortal', userId)
    app('/partner/onboarding/agreement')
    expect(screen.getByTestId('preparing')).toHaveTextContent('Your coordinator is preparing')

    // ERP-13: Meera drafts from the indicative rates; the line is just below target
    useSession.getState().login('erp', 'LS-MEERA')
    app(`/erp/partners/commercials?app=${id}`)
    fireEvent.click(screen.getByRole('button', { name: 'Draft rate card' }))
    const line = () => screen.getByRole('row', { name: 'Delhi NCR → Bengaluru' })
    expect(line()).toHaveTextContent('Below target · 14.9%')
    expect(line()).toHaveTextContent('Needs Pricing approval')

    // Divya (Pricing) approves; Meera issues
    useSession.getState().login('erp', 'LS-DIVYA')
    app(`/erp/partners/commercials?app=${id}`)
    fireEvent.click(within(line()).getByRole('button', { name: 'Approve below target' }))
    expect(line()).toHaveTextContent('Approved by Divya')
    useSession.getState().login('erp', 'LS-MEERA')
    app(`/erp/partners/commercials?app=${id}`)
    fireEvent.click(screen.getByRole('button', { name: 'Issue agreement' }))
    expect(st().data.applications[id].agreement).toMatchObject({ status: 'issued', lines: [{ status: 'accepted', rate: 8.5 }] })

    // PP-08: terms, then Aadhaar OTP e-sign; the rate card goes into the rate engine
    useSession.getState().login('partnerPortal', userId)
    app('/partner/onboarding/agreement')
    expect(within(screen.getByRole('row', { name: 'Delhi NCR → Bengaluru' })).getByText('Accepted')).toBeInTheDocument()
    tab('Operations terms')
    expect(screen.getByTestId('terms')).toHaveTextContent('Fortnightly (Bronze)')
    expect(screen.getByTestId('terms')).toHaveTextContent('₹100.00 / kg, max ₹10,000.00')
    tab('Agreement')
    expect(screen.getByRole('region', { name: 'Agreement preview' })).toHaveTextContent('Vindhya Freight Carriers Pvt Ltd')
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and e-sign' }))
    fireEvent.change(screen.getByLabelText(/^OTP sent/), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign' }))
    await tick(1000)
    expect(screen.getByTestId('signed')).toHaveTextContent('Aadhaar OTP')
    expect(Object.values(st().data.partnerRates).some((r) => r.partnerId === partnerId && r.laneOrCluster === 'LN-DEL-BLR' && r.rate === 8.5)).toBe(true)

    // PP-09 (Type D → Partner App): add a driver with photo and ID, then start the trial
    fireEvent.click(screen.getByRole('link', { name: 'Continue to go-live setup' }))
    expect(screen.getByRole('button', { name: 'Mark ready for trial' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Raju Yadav' } })
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '98990 11122' } })
    fireEvent.change(screen.getByLabelText('ID last 4 digits'), { target: { value: '2345' } })
    fireEvent.click(screen.getByRole('button', { name: /Take photo|Photo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(within(screen.getByTestId('staff')).getByText('Raju Yadav')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mark completed/ }))
    expect(screen.getByTestId('practice-count')).toHaveTextContent('1 of 1')
    fireEvent.click(screen.getByRole('button', { name: 'Mark ready for trial' }))
    expect(st().data.partners[partnerId]).toMatchObject({ status: 'trial', laneIds: ['LN-DEL-BLR'] })

    // PP-10: the tracker shows the trial; operations screens are open now
    app('/partner/onboarding')
    expect(within(screen.getByRole('listitem', { name: 'Monitored trial' })).getByText('In progress')).toBeInTheDocument()
    expect(screen.getByTestId('trial-panel')).toHaveTextContent('0 of 3 trips')

    // ERP-14: go live needs a complete trial ≥ 80; three demo jobs, then Go live
    useSession.getState().login('erp', 'LS-MEERA')
    app(`/erp/partners/trials?partner=${partnerId}`)
    expect(screen.getByRole('radio', { name: 'Go live (Bronze)' })).toBeDisabled()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Simulate a trial job/ }))
    expect(screen.getByTestId('trial-score')).toHaveTextContent('91')
    fireEvent.click(screen.getByRole('radio', { name: 'Go live (Bronze)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
    expect(st().data.partners[partnerId]).toMatchObject({ status: 'live', tier: 'bronze', score: 91 })
    expect(screen.getByTestId('trial-decision')).toHaveTextContent('Went live at Bronze: Meera Iyer')
  })

  it('Deccan: Belagavi counter-proposal is accepted by the rules; the hero trip completes the trial → live at Bronze', async () => {
    useSession.getState().login('partnerPortal', 'PU-PRAKASH')
    app('/partner/onboarding')
    expect(within(screen.getByRole('listitem', { name: 'Rate card and agreement' })).getByText('Action needed')).toBeInTheDocument()
    expect(screen.getByTestId('trial-panel')).toHaveTextContent('2 of 3 trips')
    expect(screen.getByTestId('trial-score')).toHaveTextContent('84')
    expect(within(screen.getByTestId('trial-jobs')).getByText('TRP-2026-0904')).toBeInTheDocument()

    app('/partner/onboarding/agreement')
    const belagavi = () => screen.getByRole('row', { name: 'Delhi NCR → Belagavi' })
    expect(belagavi()).toHaveTextContent('Rate not accepted on this lane, please revise')
    expect(within(screen.getByRole('row', { name: 'Delhi NCR → Hubballi' })).getByText('Accepted')).toBeInTheDocument()
    fireEvent.change(within(belagavi()).getByLabelText(/Your proposed rate/), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Propose changes' }))
    expect(belagavi()).toHaveTextContent('You proposed ₹9.00')
    await tick(4500)
    expect(within(belagavi()).getByText('Accepted')).toBeInTheDocument()
    expect(Object.values(st().data.partnerRates).find((r) => r.partnerId === 'P-DECCAN' && r.destCity === 'Belagavi')?.rate).toBe(9)

    // The hero trip arrives on time: third trial trip → the rules put Deccan live at Bronze
    act(() => useDemoStore.setState((s) => ({ data: recordTripForTrial(s.data, { ...s.data.trips['TRP-2026-0931'], status: 'arrived', arrivedAt: '2026-11-26T05:10:00+05:30' }, s.demoNow) })))
    await tick(4500)
    expect(st().data.partners['P-DECCAN']).toMatchObject({ status: 'live', tier: 'bronze', score: 89 })
    useSession.getState().login('erp', 'LS-MEERA')
    app('/erp/partners/trials?partner=P-DECCAN')
    expect(screen.getByTestId('trial-panel')).toHaveTextContent('Passed · live')
    expect(screen.getByTestId('trial-decision')).toHaveTextContent('Went live at Bronze: automatic rules')
  })
})
