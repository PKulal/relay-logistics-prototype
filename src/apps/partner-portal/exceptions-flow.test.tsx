import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import PartnerAppApp from '@apps/partner-app/PartnerAppApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerPortalApp from './PartnerPortalApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
const L1 = 'JOB-000790-L1'

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/partner/*" element={<PartnerPortalApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
          <Route path="/app/*" element={<PartnerAppApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Exceptions: PA-18, PA-30, PP-20, PP-21, PA-12', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('Ravi reports a failed pickup → SwiftCity acknowledges and resolves in PP-20 → the Control Tower sees the response', () => {
    useSession.getState().login('partnerApp', 'FS-RAVI')
    app(`/app/tasks/${L1}`)
    fireEvent.click(screen.getByRole('link', { name: 'Cannot pick up' }))
    expect(screen.getByRole('button', { name: 'Submit: pickup failed' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Goods not ready' }))
    fireEvent.click(screen.getByRole('button', { name: /^Call / }))
    tap(/Take photo/)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ready at 17:00' } })
    tap('Submit: pickup failed')
    expect(st().data.legs[L1].status).toBe('exception')
    const ticket = Object.values(st().data.exceptions).find((x) => x.legId === L1 && x.type === 'pickupMissed')!

    useSession.getState().login('partnerPortal', 'PU-NEHA')
    app('/partner/escalations')
    const row = screen.getByRole('row', { name: ticket.id })
    expect(row).toHaveTextContent('Missed pickup')
    expect(row).toHaveTextContent('Partner App')
    expect(row).toHaveTextContent('Ack in 2 h')
    expect(row).toHaveTextContent('New')
    fireEvent.click(within(row).getByRole('button', { name: ticket.id }))
    expect(screen.getByTestId('report')).toHaveTextContent('Ravi Kumar · Goods not ready')
    tap('Acknowledge')
    expect(st().data.exceptions[ticket.id].partner).toMatchObject({ ackBy: 'PU-NEHA' })
    tap('Resolve')
    expect(screen.getAllByText('This field is required.').length).toBe(2)
    fireEvent.change(screen.getByLabelText(/^Response/), { target: { value: 'Shipper asked for 17:00; Ravi will return' } })
    fireEvent.change(screen.getByLabelText(/^Root cause/), { target: { value: 'customerNotReady' } })
    tap('Resolve')
    expect(screen.getByTestId('our-response')).toHaveTextContent('Customer not ready')

    useSession.getState().login('erp', 'LS-SANJAY')
    app('/erp/control-tower/exceptions')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(ticket.id) }))
    expect(screen.getByTestId('partner-response')).toHaveTextContent('SwiftCity Couriers: Shipper asked for 17:00')
    expect(screen.getByTestId('field-report')).toHaveTextContent('Reported in the app by Ravi Kumar · 1 photos')
  })

  it('Pooja reports a short piece at the hub: the ticket goes to the previous leg', () => {
    useSession.getState().login('partnerApp', 'FS-POOJA')
    app('/app/hub/exceptions')
    fireEvent.click(screen.getByRole('link', { name: /Report short, excess or damage/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Short' }))
    const legId = (screen.getByRole('combobox', { name: 'Shipment' }) as HTMLSelectElement).value
    fireEvent.click(within(screen.getByRole('group', { name: 'Pieces affected' })).getAllByRole('checkbox')[0])
    tap(/Take photo/)
    tap('Submit report')
    const t = Object.values(st().data.exceptions).find((x) => x.type === 'short' && x.report?.by === 'FS-POOJA')!
    const leg = st().data.legs[legId]
    expect(t.legId).toBe(st().data.shipments[leg.shipmentId].legIds[leg.seq - 2])
    expect(screen.getByRole('heading', { name: 'Exceptions' })).toBeInTheDocument()
  })

  it('PP-21: NK Express sees the 000776 NDR; after the customer picks a slot, assigns the reattempt', () => {
    useSession.getState().login('partnerPortal', 'PU-NAVEEN')
    app('/partner/delivery-exceptions')
    const row = () => screen.getByRole('row', { name: 'JOB-000776-L5' })
    expect(row()).toHaveTextContent('1 · Premises closed')
    expect(row()).toHaveTextContent('Awaiting')
    act(() => st().respondNdr('LGS-DEL-000776', { kind: 'changeSlot', date: '2026-11-27', from: '11:00', to: '13:00' }, 'CU-PRIYA'))
    expect(row()).toHaveTextContent('New slot / address')
    expect(row()).toHaveTextContent('27-Nov-2026 11:00–13:00')
    fireEvent.change(within(row()).getByRole('combobox'), { target: { value: 'FS-NK-PRAKASH' } })
    fireEvent.click(within(row()).getByRole('button', { name: 'Assign reattempt' }))
    expect(st().data.legs['JOB-000776-L5'].staffId).toBe('FS-NK-PRAKASH')
  })

  it('Manju holds SOS for 3 s → the partner dashboard and ERP-09 show it → the Control Tower closes it', async () => {
    useSession.getState().login('partnerApp', 'FS-MANJU')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    app('/app/sos')
    const hold = screen.getByRole('button', { name: 'Hold for SOS' })
    fireEvent.pointerDown(hold)
    await act(() => vi.advanceTimersByTimeAsync(1500))
    fireEvent.pointerUp(hold) // released too early
    expect(Object.keys(st().data.sosAlerts)).toHaveLength(0)
    fireEvent.pointerDown(hold)
    await act(() => vi.advanceTimersByTimeAsync(3200))
    vi.useRealTimers()
    expect(screen.getByText('Help is being contacted')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Accident' }))
    const [sos] = Object.values(st().data.sosAlerts)
    expect(sos).toMatchObject({ staffId: 'FS-MANJU', status: 'active', kind: 'accident' })

    useSession.getState().login('partnerPortal', 'PU-NAVEEN')
    app('/partner')
    expect(screen.getByTestId('sos-banner')).toHaveTextContent('SOS from Manju R. (94486 40213)')

    useSession.getState().login('erp', 'LS-SANJAY')
    app('/erp/control-tower/partner-health')
    const panel = screen.getByTestId('sos-alerts')
    expect(panel).toHaveTextContent('Manju R. · NK Express')
    expect(panel).toHaveTextContent('Accident')
    fireEvent.click(within(panel).getByRole('button', { name: 'Mark resolved' }))
    expect(st().data.sosAlerts[sos.id]).toMatchObject({ status: 'resolved', resolvedBy: 'LS-SANJAY' })
    expect(screen.getByTestId('sos-alerts')).toHaveTextContent('None')
  })
})
