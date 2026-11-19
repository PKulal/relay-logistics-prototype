import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import ErpApp from './ErpApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
const L1 = 'JOB-000790-L1'

function app(path: string, userId = 'LS-SANJAY') {
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

describe('Control Tower: ERP-06 to ERP-10', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('ERP-06: Sanjay applies "Reassign to QuickLink" on 000790; the leg is offered to QuickLink', () => {
    app('/erp/control-tower/at-risk')
    const row = screen.getByRole('row', { name: 'LGS-DEL-000790 L1' })
    expect(within(screen.getByTestId('risks')).getAllByRole('row')[1]).toBe(row)
    expect(row).toHaveTextContent('78%')
    expect(row).toHaveTextContent('Ravi Kumar has 7 pending jobs in this window')
    fireEvent.click(within(row).getByRole('button', { name: 'Reassign to QuickLink Express' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply' }))
    expect(st().data.legs[L1]).toMatchObject({ partnerId: 'P-QUICKLINK', status: 'offered' })
    // Dismiss another one with a reason
    const other = screen.getByRole('row', { name: 'LGS-DEL-000720 L1' })
    fireEvent.click(within(other).getByRole('button', { name: 'Dismiss' }))
    fireEvent.change(within(other).getByLabelText('Why dismiss?'), { target: { value: 'Second rider joins at 12:00' } })
    fireEvent.click(within(other).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('row', { name: 'LGS-DEL-000720 L1' })).not.toBeInTheDocument()
  })

  it('ERP-03 → ERP-08: reassign from Shipment 360 with reason and notifications', () => {
    app('/erp/shipments/LGS-DEL-000790')
    fireEvent.click(screen.getByRole('button', { name: /Reassign leg/ }))
    expect(screen.getByTestId('current-partner')).toHaveTextContent('SwiftCity Couriers Pvt Ltd')
    const options = screen.getByTestId('options')
    expect(within(options).getByRole('row', { name: 'MetroDash' })).toHaveTextContent('At capacity')
    expect(within(options).getByRole('row', { name: 'QuickLink Express' })).toHaveTextContent('-₹30.00')
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'capacity' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Customer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reassign' }))
    expect(st().data.legs[L1]).toMatchObject({ partnerId: 'P-QUICKLINK', cost: 220 })
    expect(Object.values(st().data.notifications).some((n) => n.audience.customerId === 'C-SHARMA' && n.title === 'Partner changed for your shipment')).toBe(false)
    expect(screen.getByRole('heading', { name: /LGS-DEL-000790/ })).toBeInTheDocument()
  })

  it('ERP-07: pickup missed auto-ticket after the window → reassign; NDR ticket closes only after confirmation', () => {
    act(() => st().advanceTime(4.5 * 60))
    app('/erp/control-tower/exceptions')
    const ndr = screen.getByRole('row', { name: 'EXC-000776-1' })
    expect(ndr).toHaveTextContent('NK Express + CT desk')
    fireEvent.click(within(ndr).getByRole('button', { name: 'EXC-000776-1' }))
    const detail = screen.getByTestId('ticket-detail')
    expect(within(detail).getByRole('button', { name: 'Close ticket' })).toBeDisabled()
    fireEvent.click(within(detail).getByRole('button', { name: 'Resend WhatsApp buttons' }))
    fireEvent.click(within(detail).getByRole('button', { name: /Record customer confirmation/ }))
    fireEvent.click(within(detail).getByRole('button', { name: 'Close ticket' }))
    expect(st().data.exceptions['EXC-000776-1']).toMatchObject({ status: 'resolved', customerConfirmed: true })

    const missed = Object.values(st().data.exceptions).find((x) => x.legId === L1 && x.type === 'pickupMissed')!
    expect(missed.aiCause).toBe('partnerCapacity')
    fireEvent.click(within(screen.getByRole('row', { name: missed.id })).getByRole('button', { name: missed.id }))
    expect(screen.getByTestId('ticket-detail')).toHaveTextContent('AI root cause: Partner capacity')
    expect(within(screen.getByTestId('ticket-detail')).getByRole('link', { name: 'Reassign to backup' })).toHaveAttribute('href', `/erp/control-tower/reassign/${L1}?reason=capacity`)
  })

  it('ERP-09 and ERP-10 render the live picture and the 22-Nov pack', () => {
    act(() => st().advanceTime(5 * 60))
    app('/erp/control-tower/partner-health')
    // Ravi's other pickups move on in the background; 000790 (live demo shipment) is still waiting
    expect(within(screen.getByTestId('pickups')).getByRole('row', { name: 'SwiftCity Couriers' })).toHaveTextContent(/late/)
    expect(screen.getByTestId('sos')).toHaveTextContent('No SOS alerts.')
    app('/erp/control-tower/daily-review')
    expect(screen.getAllByRole('heading', { name: 'Daily review · 22-Nov-2026' })[0]).toBeInTheDocument()
    expect(screen.getAllByTestId('ai-summary')[0]).toHaveTextContent(/shipments delivered, \d+% on time/)
  })
})
