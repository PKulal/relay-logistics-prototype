import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { handoverState } from '@shared/store/handoverActions'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerAppApp from './PartnerAppApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()

/** Hero booked, picked up by Ravi and received by Pooja (PA-14 to PA-20). */
function heroReceivedAtHub() {
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
  const pieceIds = st().data.shipments['LGS-DEL-000781'].pieces.map((p) => p.id)
  st().confirmPickup({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, verified: [], photos: ['invoice'], handedOverBy: 'Ramesh Kumar', confirmation: 'otp', packagingDamaged: false, labelledBy: 'shipper' })
  st().giveHandover({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, photos: ['p'] })
  const code = handoverState(st().data, 'JOB-000781-L1').given!.handoverCode!
  st().receiveHandover({ legId: 'JOB-000781-L2', staffId: 'FS-POOJA', code, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
}

/** One phone, through the real Partner App shell. */
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

describe('Partner App — the hero through NCR CrossDock (PA-25 to PA-29)', () => {
  beforeEach(heroReceivedAtHub)

  it('Pooja in-scans, sorts to BAG 07, seals SL-44817, loads KA25AB1234; Basavaraj accepts', () => {
    // PA-25 Hub home
    phone('FS-POOJA', '/app')
    expect(screen.getByText('NCR CrossDock, Gurugram · 24×7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /To in-scan/ })).toHaveTextContent('6')
    expect(screen.getByText('HUBBALLI · 23:00')).toBeInTheDocument()

    // PA-26 Inbound
    fireEvent.click(screen.getByRole('link', { name: /To in-scan/ }))
    expect(screen.getByRole('heading', { name: 'Inbound', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Arrived from' })).toHaveDisplayValue(/Ravi Kumar · SwiftCity.* · 6 pcs/)
    tap('Tap to scan', 6)
    tap('Finish inbound')
    expect(st().data.shipments['LGS-DEL-000781'].status).toBe('atOriginHub')

    // PA-27 Sort (opened after finishing inbound)
    expect(screen.getByRole('heading', { name: 'Sort to bag' })).toBeInTheDocument()
    for (let i = 0; i < 6; i++) {
      tap('Tap to scan')
      expect(screen.getByTestId('sort-bag')).toHaveTextContent('BAG 07')
      expect(screen.getByText('HUBBALLI')).toBeInTheDocument()
      if (i === 0) {
        tap('Wrong bag')
        expect(screen.getByRole('alert')).toHaveTextContent('Wrong bag: this is BAG 99. Put it in BAG 07.')
      }
      tap('Scan bag label')
      expect(screen.getByText('In BAG 07 ✓')).toBeInTheDocument()
      tap('Next piece')
    }
    expect(screen.getByText('Nothing to sort.')).toBeInTheDocument()
    expect(st().data.bags['BAG-GGN-07'].pieceIds).toHaveLength(6)

    // PA-28 Close bag
    phone('FS-POOJA', '/app/hub/bags')
    tap(/Scan bag/)
    expect(screen.getByText('Contents · 6 pieces')).toBeInTheDocument()
    tap('Scan seal')
    expect(screen.getByRole('textbox', { name: 'Seal number' })).toHaveValue('SL-44817')
    tap(/Take photo/)
    expect(screen.getByRole('combobox', { name: 'Manifest' })).toHaveDisplayValue(/MAN-GGN-1123 · HUBBALLI · KA25AB1234 · 23:00/)
    tap('Seal and add')
    expect(screen.getByText('BAG 07 sealed')).toBeInTheDocument()
    expect(screen.getByText('Seal SL-44817 · on MAN-GGN-1123')).toBeInTheDocument()

    // PA-29 Out-scan
    phone('FS-POOJA', '/app/outbound')
    tap('Scan plate')
    expect(screen.getByText('Matches the trip')).toBeInTheDocument()
    tap('Tap to scan')
    expect(screen.getByTestId('scan-counter')).toHaveTextContent('1 / 1')
    tap('Scan seal')
    expect(screen.getByRole('textbox', { name: 'Door seal' })).toHaveValue('SL-44822')
    tap(/Take photo/)
    tap('Hand over to driver')
    expect(screen.getByText('Waiting for Basavaraj H. to confirm…')).toBeInTheDocument()
    const code = screen.getByTestId('handover-code').textContent!.replace(' ', '')

    // Basavaraj: the Trip tab lists a Receive task; PA-20 for the manifest
    phone('FS-BASAVARAJ', '/app/trip')
    expect(document.querySelector('a[href="/app/tasks/JOB-000781-L3"]')!.closest('article')).toHaveTextContent('Receive')
    phone('FS-BASAVARAJ', '/app/tasks/JOB-000781-L3')
    expect(screen.getByText('NCR CrossDock, Gurugram')).toBeInTheDocument()
    tap('Scan QR')
    expect(screen.getByRole('textbox', { name: 'Hand-over code' })).toHaveValue(code)
    tap('Tap to scan')
    expect(within(screen.getByRole('heading', { name: 'Seal check' }).parentElement!).getByText('SL-44822 intact')).toBeInTheDocument()
    tap('Accept')

    const { data } = st()
    expect(data.legs['JOB-000781-L2'].status).toBe('handedOver')
    expect(data.trips['TRP-2026-0931'].status).toBe('loading')

    // Pooja's screen shows the confirmation
    phone('FS-POOJA', '/app/outbound/MAN-GGN-1123')
    expect(screen.getByText('Handed over')).toBeInTheDocument()
    expect(screen.getByText(/To Basavaraj H\. at \d\d:\d\d/)).toBeInTheDocument()
  })

  it('PA-26: finishing with a piece missing asks why, then raises a short exception', () => {
    phone('FS-POOJA', '/app/inbound')
    tap('Tap to scan', 5)
    tap('Finish with 1 short')
    expect(screen.getByRole('button', { name: 'Finish inbound' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Not in the load' }))
    tap('Finish inbound')
    expect(st().data.exceptions['EXC-000781-1']).toMatchObject({ type: 'short', legId: 'JOB-000781-L2', rootCause: 'Not in the load' })
    phone('FS-POOJA', '/app')
    expect(screen.getByRole('link', { name: /Exceptions/ })).toHaveTextContent('1')
  })
})
