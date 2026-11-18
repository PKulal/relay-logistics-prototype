import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PA05Home from './PA05Home'
import PA06Tasks from './PA06Tasks'
import TaskScreen from './TaskScreen'

// Leaflet needs a real browser layout; the map is not under test here
vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

function heroAssignedToRavi() {
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
    pickupInstructions: 'Use Gate 2',
  })
  useDemoStore.getState().acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
  useDemoStore.getState().assignLegs(['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', 'Use Gate 2', 'PU-NEHA')
}

function renderApp(path: string) {
  sessionStorage.clear()
  useSession.setState({ sessions: {}, language: 'en' })
  useSession.getState().login('partnerApp', 'FS-RAVI')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/app" element={<PA05Home />} />
          <Route path="/app/tasks" element={<PA06Tasks />} />
          <Route path="/app/tasks/:legId" element={<TaskScreen />} />
          <Route path="/app/tasks/:legId/pickup" element={<TaskScreen flow="pickup" />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('Partner App — Ravi picks up the hero shipment', () => {
  beforeEach(heroAssignedToRavi)

  it('PA-05 Home: on duty since 09:02, 8 pickups today, the office note', () => {
    renderApp('/app')
    expect(screen.getByText('On duty since 09:02')).toBeInTheDocument()
    expect(screen.getByText('0/8')).toBeInTheDocument()
    expect(screen.getByText('Use Gate 2')).toBeInTheDocument()
  })

  it('PA-06 Tasks: the hero pickup is listed with a New badge', () => {
    renderApp('/app/tasks')
    const card = document.querySelector('a[href="/app/tasks/JOB-000781-L1"]')!.closest('article')!
    expect(card).toHaveTextContent('Sharma Electricals, Okhla Industrial Area Phase II')
    expect(card).toHaveTextContent('New')
    expect(card).toHaveTextContent('14:00–16:00')
    expect(card).toHaveTextContent('E-way bill')
  })

  it('PA-14 → PA-17: scan 6, measure larger, confirm with OTP → Picked Up and a + ₹145.38 weight revision', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderApp('/app/tasks/JOB-000781-L1')

    // PA-14
    expect(screen.getByText('Use Gate 2')).toBeInTheDocument()
    expect(screen.getByText('NCR CrossDock, Gurugram by 21:00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'I’ve arrived' }))

    // PA-15: scan all 6, invoice photo, e-way bill matches
    expect(await screen.findByRole('heading', { name: 'Scan and documents' })).toBeInTheDocument()
    const next = () => screen.getByRole('button', { name: 'Next' })
    expect(next()).toBeDisabled()
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Tap to scan' }))
    expect(screen.getByTestId('scan-counter')).toHaveTextContent('6 / 6')
    fireEvent.click(screen.getByRole('button', { name: 'Wrong label' }))
    expect(screen.getByRole('status')).toHaveTextContent('Not part of this task')
    fireEvent.click(within(screen.getByRole('heading', { name: '3. Invoice copy' }).parentElement!).getByRole('button', { name: /Take photo/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /e-way bill number on the papers matches/ }))
    fireEvent.click(next())

    // PA-16: as booked first, then the demo "measure larger"
    expect(await screen.findByRole('heading', { name: 'Weight and size' })).toBeInTheDocument()
    expect(screen.getByTestId('verified')).toHaveTextContent('Booked 162 kg · Verified 162 kg ✓')
    fireEvent.click(screen.getByRole('button', { name: /measure two boxes larger/ }))
    expect(screen.getByTestId('verified')).toHaveTextContent('Booked 162 kg · Verified 170 kg')
    expect(screen.getByText(/The customer will be asked to accept the new weight: \+ ₹145.38/)).toBeInTheDocument()
    fireEvent.click(next())

    // PA-17: OTP confirmation
    expect(await screen.findByRole('heading', { name: 'Confirm pickup' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Handed over by' })).toHaveValue('Ramesh Kumar')
    fireEvent.click(screen.getByRole('button', { name: 'OTP' }))
    fireEvent.click(screen.getByRole('button', { name: /Send OTP/ }))
    await act(() => vi.advanceTimersByTimeAsync(700))
    fireEvent.change(screen.getByRole('textbox', { name: 'One-time password' }), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pickup' }))
    vi.useRealTimers()

    // Back on the task list; the hero is now an in-progress hand-over
    expect(await screen.findByRole('tablist', { name: 'Tasks' })).toBeInTheDocument()

    const { data } = useDemoStore.getState()
    expect(data.shipments['LGS-DEL-000781'].status).toBe('pickedUp')
    expect(data.legs['JOB-000781-L1'].status).toBe('inProgress')
    expect(data.weightRevisions['WR-000781']).toMatchObject({ verified: 170, amountDiff: 145.38, status: 'pending' })
    const pickup = Object.values(data.events).find((e) => e.shipmentId === 'LGS-DEL-000781' && e.type === 'pickupConfirmed')!
    expect(pickup.pieceIds).toHaveLength(6)
    expect(pickup.note).toContain('Handed over by Ramesh Kumar · OTP verified')
    expect(pickup.photos!.length).toBeGreaterThanOrEqual(8) // invoice + 6 scale + 2 tape
  })
})
