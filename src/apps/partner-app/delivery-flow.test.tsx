import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

/** Hero through pickup, NCR CrossDock and the trip; in-scanned at Hubli Warehousing. */
function heroAtHubballi() {
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
  st().startTrip({ tripId: TRIP, staffId: 'FS-BASAVARAJ', vehicleNo: 'KA25AB1234', sealNos: ['SL-44822'], photo: 'door' })
  st().advanceTime(2 * 24 * 60)
  st().arriveTrip(TRIP, 'FS-BASAVARAJ')
  st().handOverAtArrival({ tripId: TRIP, staffId: 'FS-BASAVARAJ', broken: [] })
  st().receiveHandover({ legId: 'JOB-000781-L4', staffId: 'FS-HWH-SHIVA', code: st().data.trips[TRIP].handoverCode!, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
  st().inScan({ hubId: 'HUB-HBL', legIds: ['JOB-000781-L4'], pieceIds, staffId: 'FS-HWH-SHIVA' })
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

const tap = (name: string | RegExp, times = 1) => {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole('button', { name }))
}

/** Shivakumar hands Manju her load; Manju takes it and starts the run. */
function loadAndStartRun() {
  phone('FS-HWH-SHIVA', '/app/outbound')
  fireEvent.click(screen.getByRole('link', { name: /Manju R\./ }))
  expect(screen.getByRole('heading', { name: 'Hand over to Manju R.' })).toBeInTheDocument()
  tap('Tap to scan', 6)
  tap(/Take photo/)
  tap('Show code')
  expect(screen.getByText('Waiting for Manju R. to confirm…')).toBeInTheDocument()

  phone('FS-MANJU', '/app/run')
  expect(screen.getByRole('heading', { name: 'Load check at the hub' })).toBeInTheDocument()
  tap('Scan QR')
  expect(screen.getByText('Code matches')).toBeInTheDocument()
  tap('Tap to scan', 6)
  tap('Take the load')
  expect(st().data.legs['JOB-000781-L4'].status).toBe('handedOver')
  tap(/Start run/)
  expect(st().data.shipments[HERO].status).toBe('outForDelivery')
}

describe('Partner App — Manju delivers the hero (PA-31 to PA-33)', () => {
  beforeEach(heroAtHubballi)

  it('load check → start run → stop → OTP, GRN, photo → Delivered; e-POD shows in the ERP data', async () => {
    loadAndStartRun()
    st().advanceTime(60) // 26-Nov 11:00
    fireEvent.click(document.querySelector('a[href="/app/run/JOB-000781-L5"]')!)

    // PA-32
    expect(screen.getByRole('heading', { name: 'Hubli Electric Distributors' })).toBeInTheDocument()
    expect(screen.getByText(/has not booked a slot yet/)).toBeInTheDocument()
    expect(screen.getByText('Mahesh Patil')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /I've arrived/ }))

    // PA-33
    expect(screen.getByRole('heading', { name: 'Deliver' })).toBeInTheDocument()
    const complete = () => screen.getByRole('button', { name: 'Complete delivery' })
    expect(complete()).toBeDisabled()
    tap('Tap to scan', 6)
    expect(screen.getByRole('textbox', { name: '3. Received by' })).toHaveValue('Mahesh Patil')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    tap('Send OTP to the consignee')
    await act(() => vi.advanceTimersByTimeAsync(700))
    vi.useRealTimers()
    fireEvent.change(screen.getByRole('textbox', { name: 'Delivery OTP' }), { target: { value: '1234' } })
    fireEvent.change(screen.getByRole('textbox', { name: '5. GRN number' }), { target: { value: 'grn-hed-55120' } })
    tap(/Take photo/)
    tap('Complete delivery')

    const { data } = st()
    expect(data.shipments[HERO].status).toBe('delivered')
    expect(Object.values(data.events).find((e) => e.shipmentId === HERO && e.type === 'delivered')).toMatchObject({ receivedBy: 'Mahesh Patil', grn: 'GRN-HED-55120', note: 'OTP verified' })
    expect(screen.getByRole('heading', { name: 'Delivery run' })).toBeInTheDocument()
  })

  it('a damaged piece needs a photo and remark → Delivered with Exception', async () => {
    loadAndStartRun()
    phone('FS-MANJU', '/app/run/JOB-000781-L5/deliver')
    tap('Tap to scan', 6)
    const piece3 = screen.getByRole('radiogroup', { name: 'Piece 03' })
    fireEvent.click(within(piece3).getByRole('radio', { name: 'Damaged' }))
    expect(screen.getByText('1 piece short or damaged: Delivered with Exception')).toBeInTheDocument()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    tap('Send OTP to the consignee')
    await act(() => vi.advanceTimersByTimeAsync(700))
    vi.useRealTimers()
    fireEvent.change(screen.getByRole('textbox', { name: 'Delivery OTP' }), { target: { value: '1234' } })
    for (const b of screen.getAllByRole('button', { name: /Take photo/ })) fireEvent.click(b)
    expect(screen.getByRole('button', { name: 'Complete delivery' })).toBeDisabled() // remark missing
    fireEvent.change(screen.getByRole('textbox', { name: 'Remark' }), { target: { value: 'Corner crushed' } })
    tap('Complete delivery')
    expect(st().data.shipments[HERO].status).toBe('deliveredWithException')
  })
})
