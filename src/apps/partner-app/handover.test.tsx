import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PA06Tasks from './PA06Tasks'
import PA07ScanTab from './PA07ScanTab'
import PA26InScan from './PA26InScan'
import TaskScreen from './TaskScreen'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

function heroPickedUpByRavi() {
  const store = useDemoStore.getState()
  store.resetDemo()
  store.bookShipment({
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
  const s = useDemoStore.getState()
  s.acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
  s.assignLegs(['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', '', 'PU-NEHA')
  useDemoStore.getState().confirmPickup({
    legId: 'JOB-000781-L1',
    staffId: 'FS-RAVI',
    pieceIds: useDemoStore.getState().data.shipments['LGS-DEL-000781'].pieces.map((p) => p.id),
    verified: [],
    photos: ['invoice'],
    handedOverBy: 'Ramesh Kumar',
    confirmation: 'otp',
    packagingDamaged: false,
    labelledBy: 'shipper',
  })
}

/** One phone: the given field staff member at a path. */
function phone(staffId: string, path: string) {
  cleanup()
  useSession.setState({ sessions: {}, language: 'en' })
  useSession.getState().login('partnerApp', staffId)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/app/scan" element={<PA07ScanTab />} />
          <Route path="/app/tasks" element={<PA06Tasks />} />
          <Route path="/app/inbound" element={<PA26InScan />} />
          <Route path="/app/tasks/:legId" element={<TaskScreen />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const scanAll = (n: number) => {
  for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole('button', { name: 'Tap to scan' }))
}

/** Ravi scans 6 out, takes the photo and shows the code. */
function raviShowsCode() {
  phone('FS-RAVI', '/app/tasks/JOB-000781-L1')
  expect(screen.getByRole('heading', { name: 'Hand over' })).toBeInTheDocument()
  expect(screen.getByText('NCR CrossDock, Gurugram')).toBeInTheDocument()
  expect(screen.getByText(/Pooja S\./)).toBeInTheDocument()
  const showCode = screen.getByRole('button', { name: 'Show code' })
  expect(showCode).toBeDisabled()
  scanAll(6)
  fireEvent.click(screen.getByRole('button', { name: /Take photo/ }))
  fireEvent.click(showCode)
  expect(screen.getByText('Waiting for Pooja S. to confirm…')).toBeInTheDocument()
  return screen.getByTestId('handover-code').textContent!.replace(' ', '')
}

describe('Partner App — Ravi hands the hero over to Pooja at NCR CrossDock', () => {
  beforeEach(heroPickedUpByRavi)

  it('PA-19 → PA-20: code, 6 / 6, all good → Handed over on both phones, At Origin Hub', () => {
    const code = raviShowsCode()
    expect(code).toMatch(/^\d{6}$/)

    // Pooja: the task list shows a Receive task; the Scan tab reads the QR
    phone('FS-POOJA', '/app/tasks') // (Pooja's list via the shared task list screen)
    expect(document.querySelector('a[href="/app/tasks/JOB-000781-L2"]')!.closest('article')).toHaveTextContent('Receive')
    phone('FS-POOJA', '/app/scan')
    fireEvent.click(screen.getByRole('button', { name: /Scan hand-over QR from Ravi Kumar/ }))
    expect(screen.getByRole('heading', { name: 'Receive hand-over' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Hand-over code' })).toHaveValue(code)
    expect(screen.getByText('Code matches')).toBeInTheDocument()
    scanAll(6)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    // Hub staff go on to in-scan what they received (PA-26)
    expect(screen.getByRole('heading', { name: 'Inbound' })).toBeInTheDocument()

    const { data } = useDemoStore.getState()
    expect(data.legs['JOB-000781-L1'].status).toBe('handedOver')
    expect(data.legs['JOB-000781-L2'].status).toBe('inProgress')
    expect(data.shipments['LGS-DEL-000781'].status).toBe('atOriginHub')

    // Ravi's phone now shows the confirmation
    phone('FS-RAVI', '/app/tasks/JOB-000781-L1')
    expect(screen.getByText('Handed over')).toBeInTheDocument()
    expect(screen.getByText(/To Pooja S\., NCR CrossDock at \d\d:\d\d/)).toBeInTheDocument()
  })

  it('PA-20: a short count is accepted with an exception and the giver sees it', () => {
    const code = raviShowsCode()
    phone('FS-POOJA', '/app/tasks/JOB-000781-L2')
    fireEvent.change(screen.getByRole('textbox', { name: 'Hand-over code' }), { target: { value: code } })
    scanAll(5)
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Count finished: 1 piece missing' }))
    expect(screen.getByText('Short: 1 piece missing')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept with exception' }))

    const { data } = useDemoStore.getState()
    expect(data.legs['JOB-000781-L2'].status).toBe('exception')
    expect(data.exceptions['EXC-000781-1']).toMatchObject({ type: 'short', legId: 'JOB-000781-L1', status: 'open' })

    phone('FS-RAVI', '/app/tasks/JOB-000781-L1')
    expect(screen.getByText('Accepted with an exception')).toBeInTheDocument()
    expect(screen.getByText('Short: 1 piece missing')).toBeInTheDocument()
  })
})
