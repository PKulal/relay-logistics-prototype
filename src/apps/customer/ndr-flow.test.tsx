import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PartnerAppApp from '@apps/partner-app/PartnerAppApp'
import CP18Track from '@apps/public/CP18Track'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from './CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
const LR = 'LGS-DEL-000776'
const LEG = 'JOB-000776-L5'

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/app/*" element={<PartnerAppApp />} />
          <Route path="/track/:lr" element={<CP18Track />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('NDR: CP-19 → CP-21 → reattempt in the Partner App → PA-35 → CP-18 consignee', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('Priya books a reattempt; Manju fails again on PA-35; the consignee changes the slot on WhatsApp', () => {
    // CP-19 → CP-21
    useSession.getState().login('customer', 'CU-PRIYA')
    app('/customer/exceptions')
    fireEvent.click(screen.getByRole('tab', { name: /NDR/ }))
    const row = screen.getByRole('row', { name: `${LR} NDR` })
    expect(row).toHaveTextContent('Premises closed')
    fireEvent.click(within(row).getByRole('button', { name: /Take action/ }))
    expect(screen.getByTestId('attempt-1')).toHaveTextContent('Premises closed')
    expect(screen.getByTestId('attempt-1')).toHaveTextContent('Shutter down')
    // RTO shows the charge first
    fireEvent.click(screen.getByRole('radio', { name: 'Return to origin (RTO)' }))
    expect(screen.getByTestId('rto-charge')).toHaveTextContent('Added to your invoice.')
    fireEvent.click(screen.getByRole('radio', { name: 'Reattempt' }))
    expect(screen.getByLabelText(/Reattempt date/)).toHaveValue('2026-11-24')
    fireEvent.change(screen.getByLabelText(/Instructions for the rider/), { target: { value: 'Call before arriving' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(st().data.legs[LEG]).toMatchObject({ status: 'assigned', window: { from: '2026-11-24T11:00:00+05:30' } })
    expect(screen.getByTestId('choice')).toHaveTextContent('Reattempt · 24-Nov-2026 11:00–13:00 · “Call before arriving”')

    // Next day: Manju is back on the stop, sees the instruction, and can't deliver again
    act(() => st().advanceTime(24 * 60))
    act(() => st().startRun([LEG], 'FS-MANJU'))
    useSession.getState().login('partnerApp', 'FS-MANJU')
    app(`/app/run/${LEG}`)
    expect(screen.getByTestId('reattempt')).toHaveTextContent('Attempt 2: reattempt')
    expect(screen.getByTestId('reattempt')).toHaveTextContent('Call before arriving')
    fireEvent.click(screen.getByRole('link', { name: 'Cannot deliver' }))
    const submit = screen.getByRole('button', { name: 'Submit failed attempt' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Consignee not available' }))
    fireEvent.click(screen.getByRole('button', { name: /Call .* \(masked\)/ }))
    expect(screen.getByTestId('call-log')).toHaveTextContent('Called at 10:00')
    fireEvent.click(screen.getByRole('button', { name: /Take photo/ }))
    fireEvent.click(submit)
    expect(st().data.shipments[LR].status).toBe('undelivered')
    expect(st().data.ndrs['NDR-000776-2']).toMatchObject({ attempt: 2, reason: 'notAvailable', calledAt: '2026-11-24T10:00:00+05:30' })

    // CP-18: the consignee answers first from WhatsApp → change slot
    cleanup()
    app(`/track/${LR}`)
    const wa = screen.getAllByTestId('wa-ndr').at(-1)!
    expect(wa).toHaveTextContent("We couldn't deliver LGS-DEL-000776 today: Consignee not available")
    fireEvent.click(within(wa).getByRole('button', { name: 'Change slot' }))
    fireEvent.change(screen.getByLabelText('Time slot'), { target: { value: '14:00' } })
    fireEvent.click(within(screen.getByTestId('cp18-ndr')).getByRole('button', { name: 'Confirm' }))
    expect(st().data.ndrs['NDR-000776-2']).toMatchObject({ customerChoice: 'changeSlot', choiceBy: 'consignee', newSlot: { date: '2026-11-25', from: '14:00', to: '16:00' } })
    expect(screen.getByTestId('cp18-ndr-outcome')).toHaveTextContent('You chose: delivery on 25-Nov-2026, 14:00–16:00.')

    // CP-21: the shipper sees the consignee's choice; no form
    useSession.getState().login('customer', 'CU-PRIYA')
    app(`/customer/exceptions/ndr/${LR}`)
    expect(within(screen.getByTestId('attempt-2')).getByTestId('choice')).toHaveTextContent('Chosen by the consignee')
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
  })
})
