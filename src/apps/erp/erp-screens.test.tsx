import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import ERP03Shipment360 from './ERP03Shipment360'
import ERP05JobBoard from './ERP05JobBoard'

function bookHero() {
  useDemoStore.getState().bookShipment({
    customerId: 'C-SHARMA',
    bookedByUserId: 'CU-PRIYA',
    pickupLocationId: 'PL-OKHLA',
    consigneeId: 'CN-HED',
    serviceKind: 'ptl',
    service: 'expressPtl',
    paymentMode: 'tbb',
    addOns: { appointment: true, insurance: true, specialHandling: false },
    invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000, fileUrl: 'INV_1187.pdf' },
    hsn: '8537',
    goodsDescription: 'LT switchgear panels',
    pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20 })),
    pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
  })
}

function renderErp(userId: string, path: string) {
  useSession.setState({ sessions: {} })
  useSession.getState().login('erp', userId)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/erp/control-tower/jobs" element={<ERP05JobBoard />} />
          <Route path="/erp/shipments/:lr" element={<ERP03Shipment360 />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('ERP-05 Live job board', () => {
  beforeEach(() => {
    useDemoStore.getState().resetDemo()
    bookHero()
  })

  it('shows the new booking’s legs with partners, and opens Shipment 360 from a row', async () => {
    renderErp('LS-SANJAY', '/erp/control-tower/jobs')
    fireEvent.change(screen.getByRole('textbox', { name: 'Search LR' }), { target: { value: '000781' } })
    const table = await screen.findByRole('table', {}, { timeout: 3000 })
    await within(table).findByText('LGS-DEL-000781 · L1', {}, { timeout: 3000 })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('SwiftCity Couriers')
    expect(rows[0]).toHaveTextContent('Offered')
    expect(rows[2]).toHaveTextContent('Deccan Roadlines')
    expect(rows[2]).toHaveTextContent('Delhi NCR → Hubballi')

    fireEvent.click(rows[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'LGS-DEL-000781' })).toBeInTheDocument()
  })

  it('switches to the shipments view and filters by SLA state', async () => {
    renderErp('LS-SANJAY', '/erp/control-tower/jobs')
    fireEvent.click(screen.getByRole('radio', { name: /Shipments/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'SLA' }), { target: { value: 'breached' } })
    const table = await screen.findByRole('table', {}, { timeout: 3000 })
    await within(table).findAllByText(/Breached/, {}, { timeout: 3000 })
    within(table)
      .getAllByRole('row')
      .slice(1)
      .forEach((r) => expect(r).toHaveTextContent('Breached'))
  })
})

describe('ERP-03 Shipment 360', () => {
  beforeEach(() => {
    useDemoStore.getState().resetDemo()
    bookHero()
  })

  it('header, 5 legs with partners and costs, and the timeline', () => {
    renderErp('LS-SANJAY', '/erp/shipments/LGS-DEL-000781')
    expect(screen.getByRole('heading', { level: 1, name: 'LGS-DEL-000781' })).toBeInTheDocument()
    const legs = screen.getByRole('region', { name: '5 legs' })
    const rows = within(legs).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/L1 First mile.*SwiftCity Couriers.*₹250\.00/),
      expect.stringMatching(/L2 Origin hub.*NCR CrossDock.*₹162\.00/),
      expect.stringMatching(/L3 Line-haul.*Deccan Roadlines.*In trial.*₹1,458\.00/),
      expect.stringMatching(/L4 Destination hub.*Hubli Warehousing.*₹162\.00/),
      expect.stringMatching(/L5 Last mile.*NK Express.*₹300\.00/),
    ])
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Booked')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Priya Sharma')
  })

  it('Control Tower does not see the Money tab; Finance sees the 18.3% margin', () => {
    renderErp('LS-SANJAY', '/erp/shipments/LGS-DEL-000781')
    expect(screen.queryByRole('tab', { name: 'Money' })).not.toBeInTheDocument()
  })

  it('Finance: Money tab shows ₹562.80 (18.3%) and ₹501.30 (16.3%) after the buffer', () => {
    renderErp('LS-LAKSHMI', '/erp/shipments/LGS-DEL-000781')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Money' }))
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('Gross margin (18.3%)₹562.80')
    expect(panel).toHaveTextContent('Margin after buffer (16.3%)₹501.30')
    expect(panel).toHaveTextContent('Above the 15% target')
  })

  it('Sales sees the legs without their costs', () => {
    renderErp('LS-ARJUN', '/erp/shipments/LGS-DEL-000781')
    expect(screen.queryByRole('columnheader', { name: 'Leg cost' })).not.toBeInTheDocument()
  })

  it('AI decisions explain the first-mile choice', () => {
    renderErp('LS-SANJAY', '/erp/shipments/LGS-DEL-000781')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'AI decisions' }))
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('L1 assigned to SwiftCity Couriers')
    expect(panel).toHaveTextContent('MetroDash')
    expect(panel).toHaveTextContent('At capacity')
  })
})
