import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import ErpApp from './ErpApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))
vi.mock('recharts', async (orig) => {
  const m = await orig<typeof import('recharts')>()
  return { ...m, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 200 }}>{children}</div> }
})

const st = () => useDemoStore.getState()
function app(path: string, userId: string) {
  cleanup()
  useSession.getState().login('erp', userId)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Leadership, Sales and the light departments', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('ERP-04: Rahul lands on the command dashboard; snapshot tiles, briefing, heat map, scenario', () => {
    app('/erp', 'LS-RAHUL')
    expect(screen.getByRole('heading', { name: 'Command dashboard' })).toBeInTheDocument()
    const kpis = screen.getByTestId('kpis')
    expect(kpis).toHaveTextContent('₹1.92 Cr')
    expect(kpis).toHaveTextContent('Gross margin 17.6%')
    expect(kpis).toHaveTextContent('93.1%')
    expect(kpis).toHaveTextContent('214 / 86')
    expect(screen.getByTestId('briefing')).toHaveTextContent('Triveni Auto: ₹3.1 L overdue for 38 days')
    expect(within(screen.getByTestId('heatmap')).getByText('9.8%')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: 'Fuel price' }), { target: { value: '5' } })
    expect(screen.getByTestId('scenario-result')).toHaveTextContent('gross margin 16.8% (-0.8 pt)')
    fireEvent.click(screen.getByRole('tab', { name: 'Quarter to date' }))
    expect(screen.getByTestId('kpis')).toHaveTextContent('₹5.48 Cr')
  })

  it('ERP-45: a planned department shows its modules and AI features', () => {
    app('/erp/sustainability', 'LS-RAHUL')
    expect(screen.getByRole('heading', { name: 'Sustainability (ESG)' })).toBeInTheDocument()
    expect(screen.getByTestId('department')).toHaveTextContent('CO2 per shipment')
    expect(screen.getByTestId('department')).toHaveTextContent('Planned for a later phase')
  })

  it('ERP-28 and ERP-29: Arjun opens Triveni (high churn risk), schedules a QBR; drafts and submits an RFQ', () => {
    app('/erp/sales/accounts', 'LS-ARJUN')
    expect(screen.getByRole('row', { name: 'Triveni Auto' })).toHaveTextContent('High')
    fireEvent.click(screen.getByRole('button', { name: 'Triveni Auto' }))
    expect(screen.getByTestId('health')).toHaveTextContent('Overdue invoice')
    expect(screen.getByTestId('commercials')).toHaveTextContent('Outstanding invoices ₹3,10,000.00')
    fireEvent.change(screen.getByLabelText('Agenda'), { target: { value: 'Collections and Pune lane' } })
    tap('Schedule QBR')
    expect(Object.values(st().data.qbrs).some((q) => q.customerId === 'C-TRIVENI')).toBe(true)

    app('/erp/sales/rfq', 'LS-ARJUN')
    fireEvent.click(screen.getByRole('button', { name: 'RFQ-2026-014' }))
    tap('Draft proposal with AI')
    expect(screen.getByTestId('proposal')).toHaveTextContent('Delhi NCR → Pune')
    tap('Mark submitted')
    expect(st().data.rfqs['RFQ-2026-014'].status).toBe('submitted')
  })

  it('ERP-39: Farah resolves the high-priority pickup ticket', () => {
    app('/erp/customer-success', 'LS-FARAH')
    const row = screen.getByRole('row', { name: 'TKT-2026-3381' })
    expect(row).toHaveTextContent('High')
    fireEvent.click(within(row).getByRole('button', { name: 'TKT-2026-3381' }))
    fireEvent.change(screen.getByLabelText('Reply to the customer'), { target: { value: 'Pickup moved to QuickLink, by 12:00' } })
    tap('Send and resolve')
    expect(st().data.tickets['TKT-2026-3381'].status).toBe('resolved')
    expect(within(screen.getByTestId('account-health')).getByRole('row', { name: 'Triveni Auto' })).toHaveTextContent('38')
  })

  it('ERP-40 and ERP-41: hub board and appointment desk; e-way bill extend and DPDP request', () => {
    app('/erp/hub-ops', 'LS-POOJA')
    expect(within(screen.getByTestId('hub-board')).getAllByRole('row').length).toBeGreaterThan(1)
    expect(screen.getByRole('heading', { name: /Load planning/ })).toBeInTheDocument()

    app('/erp/compliance', 'LS-NEETA')
    expect(within(screen.getByTestId('contracts')).getByLabelText('Hubli Warehousing')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('row', { name: 'DPR-0004' })).getByRole('button', { name: 'Mark done' }))
    expect(st().data.dpdpRequests['DPR-0004'].status).toBe('done')
    const ewbRows = within(screen.getByTestId('ewbs')).getAllByRole('row').slice(1)
    const lr = ewbRows[0].getAttribute('aria-label')!
    const before = st().data.shipments[lr].ewb!.validTill
    fireEvent.click(within(ewbRows[0]).getByRole('button', { name: 'Extend' }))
    expect(st().data.shipments[lr].ewb!.validTill > before).toBe(true)
  })
})
