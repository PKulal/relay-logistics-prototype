import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { handoverState } from '@shared/store/handoverActions'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerAppApp from './PartnerAppApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const HERO = 'LGS-DEL-000781'
const TRIP = 'TRP-2026-0931'
const st = () => useDemoStore.getState()

/** Hero through pickup and NCR CrossDock; Basavaraj has taken the load (PA-14 to PA-29). */
function heroOnTheTruck() {
  st().resetDemo()
  st().bookShipment({
    customerId: 'C-SHARMA',
    bookedByUserId: 'CU-PRIYA',
    pickupLocationId: 'PL-OKHLA',
    consigneeId: 'CN-HED',
    serviceKind: 'ptl',
    service: 'expressPtl',
    paymentMode: 'tbb',
    addOns: { appointment: true, insurance: true, specialHandling: false },
    invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000 },
    hsn: '8537',
    goodsDescription: 'LT switchgear panels',
    pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20, skuCode: 'SG-LT-400' })),
    pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
  })
  st().acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
  st().assignLegs(['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', 'PU-NEHA')
  const pieceIds = st().data.shipments[HERO].pieces.map((p) => p.id)
  st().confirmPickup({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, verified: [], photos: ['invoice'], handedOverBy: 'Ramesh Kumar', confirmation: 'otp', packagingDamaged: false, labelledBy: 'shipper' })
  st().giveHandover({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, photos: ['p'] })
  st().receiveHandover({ legId: 'JOB-000781-L2', staffId: 'FS-POOJA', code: handoverState(st().data, 'JOB-000781-L1').given!.handoverCode!, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
  st().inScan({ hubId: 'HUB-GGN', legIds: ['JOB-000781-L2'], pieceIds, staffId: 'FS-POOJA' })
  for (const p of pieceIds) st().sortPiece('HUB-GGN', p)
  st().sealBag({ bagId: 'BAG-GGN-07', sealNo: 'SL-44817', photo: 'bag', manifestId: 'MAN-GGN-1123', staffId: 'FS-POOJA' })
  st().dispatchManifest({ manifestId: 'MAN-GGN-1123', vehicleNo: 'KA25AB1234', doorSeal: 'SL-44822', photo: 'door', staffId: 'FS-POOJA' })
  st().receiveManifest({ manifestId: 'MAN-GGN-1123', staffId: 'FS-BASAVARAJ', code: st().data.manifests['MAN-GGN-1123'].handoverCode!, bagIds: ['BAG-GGN-07'], brokenSeals: [], photos: [] })
}

function phone(staffId: string, path: string) {
  cleanup()
  useSession.setState({ sessions: {}, language: 'en' })
  useSession.getState().login('partnerApp', staffId)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/app/*" element={<PartnerAppApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Partner App — Basavaraj drives TRP-2026-0931 to Hubballi (PA-21 to PA-24)', () => {
  beforeEach(heroOnTheTruck)

  it('PA-21 → PA-22 → PA-23 (halt) → PA-24 → Hubballi hub receives: At Destination Hub', () => {
    // PA-21 Trip detail
    phone('FS-BASAVARAJ', '/app/trip')
    expect(screen.getByRole('heading', { name: 'NCR CrossDock, Gurugram → Hubli Warehousing, Hubballi' })).toBeInTheDocument()
    expect(screen.getByText('1 shipment · 1 bag · 162 kg')).toBeInTheDocument()
    expect(screen.getByText('SL-44822 · SL-44817')).toBeInTheDocument()
    expect(screen.getByText('Part B is updated when you start the trip')).toBeInTheDocument()

    // PA-22 Start trip: wrong truck blocks, then the right one with the door seal
    fireEvent.click(screen.getByRole('link', { name: /Start trip/ }))
    expect(screen.getByRole('heading', { name: 'Start trip' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Vehicle number' }), { target: { value: 'KA25AB9999' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Not the truck assigned (KA25AB1234)')
    tap('Scan plate')
    tap('Scan seal')
    expect(screen.getByText('Matches the manifest')).toBeInTheDocument()
    tap(/Take photo/)
    tap('Start trip')
    expect(st().data.shipments[HERO].status).toBe('inTransit')
    expect(st().data.shipments[HERO].ewb?.partBUpdated).toBe(true)

    // PA-23 On the way: the truck moves with the clock; a 3-hour traffic halt revises the ETA
    expect(screen.getByTestId('trip-km')).toHaveTextContent('0 of 1,880 km')
    act(() => st().advanceTime(10 * 60))
    expect(screen.getByTestId('trip-km')).toHaveTextContent(/^40\d of 1,880 km$/)
    const etaBefore = screen.getByTestId('trip-eta').textContent
    tap('Report halt')
    fireEvent.click(screen.getByRole('radio', { name: 'Traffic' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Expected duration' }), { target: { value: '180' } })
    tap('Send report')
    expect(screen.getByText('ETA (revised)')).toBeInTheDocument()
    expect(screen.getByTestId('trip-eta').textContent).not.toBe(etaBefore)
    expect(screen.getByRole('status')).toHaveTextContent('Stopped: Traffic')
    expect(screen.getByRole('button', { name: "I've arrived" })).toBeDisabled()

    // Arrive at Hubballi
    act(() => st().advanceTime(2 * 24 * 60))
    tap("I've arrived")
    expect(screen.getByRole('heading', { name: 'Arrival and seal check' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'SL-44822 intact' })).toHaveAttribute('aria-checked', 'true')
    tap('Hand over to hub')
    expect(screen.getByText('Waiting for Shivakumar B. to confirm…')).toBeInTheDocument()
    const code = screen.getByTestId('handover-code').textContent!.replace(' ', '')

    // Shivakumar at Hubballi receives with the existing PA-20
    phone('FS-HWH-SHIVA', '/app/tasks/JOB-000781-L4')
    expect(screen.getByRole('heading', { name: 'Receive hand-over' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Hand-over code' }), { target: { value: code } })
    for (let i = 0; i < 6; i++) tap('Tap to scan')
    tap('Accept')
    expect(st().data.shipments[HERO].status).toBe('atDestinationHub')

    // Basavaraj's Trip tab shows it handed over
    phone('FS-BASAVARAJ', '/app/trip')
    expect(screen.getByText('Handed over')).toBeInTheDocument()
    expect(screen.getByText(/To Shivakumar B\. at \d\d:\d\d/)).toBeInTheDocument()
    expect(st().data.trips[TRIP].status).toBe('arrived')
  })

  it('PA-23 breakdown: needs a photo, raises an exception on Deccan Roadlines', () => {
    st().startTrip({ tripId: TRIP, staffId: 'FS-BASAVARAJ', vehicleNo: 'KA25AB1234', sealNos: ['SL-44822'], photo: 'door' })
    phone('FS-BASAVARAJ', '/app/trip')
    tap('Report breakdown')
    fireEvent.click(screen.getByRole('radio', { name: 'Tyre puncture' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Expected time to fix' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Need a backup vehicle' }))
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled()
    tap(/Take photo/)
    tap('Send report')
    const ex = Object.values(st().data.exceptions).find((x) => x.shipmentId === HERO && x.type === 'breakdown')
    expect(ex).toMatchObject({ ownerPartnerId: 'P-DECCAN', status: 'open' })
    expect(Object.values(st().data.events).find((e) => e.type === 'haltReported' && e.shipmentId === HERO)?.note).toBe('Breakdown: Tyre puncture · 120 min · backup vehicle needed')
  })
})
