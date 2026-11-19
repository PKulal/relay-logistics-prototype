import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CP18Track from '@apps/public/CP18Track'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from './CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const HERO = 'LGS-DEL-000781'
const st = () => useDemoStore.getState()

function bookHero() {
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
}

function open(path: string) {
  cleanup()
  useSession.setState({ sessions: {}, language: 'en' })
  useSession.getState().login('customer', 'CU-PRIYA')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/track/:lr" element={<CP18Track />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('Customer tracking (CP-16 to CP-18)', () => {
  beforeEach(bookHero)

  it('CP-16: 41 shipments; search by invoice number finds the hero', () => {
    open('/customer/shipments')
    expect(screen.getByRole('heading', { name: 'Shipments' })).toBeInTheDocument()
    expect(screen.getByText('41 shipments')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search shipments' }), { target: { value: 'SE/25-26/1187' } })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent(HERO)
    expect(rows[0]).toHaveTextContent('Hubli Electric Distributors')
    expect(rows[0]).toHaveTextContent('₹3,628.26')
  })

  it('CP-16 from the dashboard Exceptions tile: only shipments with exceptions', () => {
    open('/customer/shipments?status=exceptions')
    expect(screen.getByRole('switch', { name: 'Exceptions only' })).toBeChecked()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r) => r.textContent?.includes(HERO))).toBe(false)
  })

  it('CP-17: the timeline updates live when Ravi picks up (no partner names)', () => {
    open(`/customer/shipments/${HERO}`)
    expect(screen.getByRole('heading', { name: HERO })).toBeInTheDocument()
    const timeline = () => screen.getByTestId('cp17-timeline')
    expect(within(timeline()).getByText('Booked')).toBeInTheDocument()
    act(() => {
      st().acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
      st().assignLegs(['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', 'PU-NEHA')
      const pieceIds = st().data.shipments[HERO].pieces.map((p) => p.id)
      st().confirmPickup({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, verified: [], photos: ['invoice'], handedOverBy: 'Ramesh Kumar', confirmation: 'otp', packagingDamaged: false, labelledBy: 'shipper' })
    })
    expect(within(timeline()).getByText('Picked up')).toBeInTheDocument()
    expect(timeline()).toHaveTextContent('New Delhi · 6 pcs · Logisco network')
    expect(timeline()).not.toHaveTextContent(/SwiftCity|Ravi/)
  })

  it('CP-18: the consignee books 11:00–13:00 at Dock 2; the shipper sees it on CP-17', () => {
    open(`/track/${HERO}`)
    expect(screen.getByText('for Sharma Electricals')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('₹') // no prices on the public page
    expect(screen.getByRole('combobox', { name: 'Time slot' })).toHaveValue('11:00')
    fireEvent.change(screen.getByRole('textbox', { name: 'Gate / dock' }), { target: { value: 'Dock 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm slot' }))
    expect(st().data.shipments[HERO].appointment).toMatchObject({ date: '2026-11-26', from: '11:00', to: '13:00', dock: 'Dock 2', confirmed: true })
    expect(screen.getByTestId('cp18-slot')).toHaveTextContent('Slot 26-Nov-2026 11:00–13:00 · Dock 2')
    expect(screen.getByText(/Delivery slot confirmed/)).toBeInTheDocument()

    open(`/customer/shipments/${HERO}`)
    expect(screen.getByText(/Slot 26-Nov-2026 11:00–13:00/)).toHaveTextContent('Dock 2')
  })
})
