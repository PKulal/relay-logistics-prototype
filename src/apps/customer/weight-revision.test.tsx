import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from './CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
const LR = 'LGS-DEL-000784'
const WR = 'WR-000784'

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('Weight revision: CP-19 → CP-20 → ERP-31', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('Priya disputes (frozen SKU); Lakshmi accepts the booked weight; Priya sees the outcome', () => {
    useSession.getState().login('customer', 'CU-PRIYA')
    app('/customer/exceptions')
    fireEvent.click(screen.getByRole('tab', { name: /Weight disputes/ }))
    const row = screen.getByRole('row', { name: `${LR} Weight revision` })
    expect(row).toHaveTextContent('Revised by ₹81.77')
    fireEvent.click(within(row).getByRole('button', { name: /Take action/ }))

    // CP-20: comparison, evidence and the AI check
    expect(screen.getByTestId('difference')).toHaveTextContent('+ ₹81.77 incl. GST')
    expect(screen.getByTestId('evidence').querySelectorAll('li')).toHaveLength(6)
    expect(screen.getByTestId('ai-check')).toHaveTextContent('Frozen SKU dimensions differ from the measurement: SG-LT-400 60 × 40 × 40 cm')

    // Raise dispute: reason and remarks required
    fireEvent.click(screen.getByRole('button', { name: 'Raise dispute' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit dispute' }))
    expect(st().data.weightRevisions[WR].status).toBe('pending')
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'skuFrozen' } })
    fireEvent.change(screen.getByLabelText(/^Remarks/), { target: { value: 'SG-LT-400 is frozen at 60 × 40 × 40 in our SKU master' } })
    fireEvent.change(screen.getByLabelText(/Supporting files/), { target: { files: [new File(['x'], 'spec_sheet.pdf')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit dispute' }))
    expect(st().data.weightRevisions[WR]).toMatchObject({ status: 'disputed', dispute: { reason: 'skuFrozen', files: ['spec_sheet.pdf'] } })
    expect(screen.getByTestId('outcome')).toHaveTextContent('Logisco Finance is reviewing your dispute.')

    // ERP-31: Lakshmi reverses with a note (confirm step)
    useSession.getState().login('erp', 'LS-LAKSHMI')
    app('/erp/finance/invoicing?tab=weight')
    expect(screen.getByTestId('customer-dispute')).toHaveTextContent('SKU weight is frozen')
    fireEvent.click(screen.getByRole('radio', { name: /Accept the customer's booked weight/ }))
    expect(screen.getByRole('button', { name: 'Save decision' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Note to the customer/), { target: { value: 'Frozen SKU confirmed; booked weight stands.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save decision' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save decision' }))
    expect(st().data.weightRevisions[WR]).toMatchObject({ status: 'reversed', resolution: { by: 'LS-LAKSHMI' } })
    expect(st().data.shipments[LR].weights.verifiedChargeable).toBe(st().data.weightRevisions[WR].booked)

    // CP-20: the outcome; the queue is clear
    useSession.getState().login('customer', 'CU-PRIYA')
    app(`/customer/exceptions/weight/${LR}`)
    expect(screen.getByTestId('resolution')).toHaveTextContent('your booked weight is accepted; nothing extra to pay. Frozen SKU confirmed')
    app('/customer/exceptions')
    fireEvent.click(screen.getByRole('tab', { name: /Weight disputes/ }))
    expect(screen.queryByRole('row', { name: new RegExp(LR) })).not.toBeInTheDocument()
  })

  it('accept from the dashboard link (credit: added to the invoice); the 48-hour rule handles the rest', () => {
    const credit = st().data.customers['C-SHARMA'].creditUsed
    useSession.getState().login('customer', 'CU-PRIYA')
    app(`/customer/exceptions?lr=${LR}&screen=CP-20`)
    fireEvent.click(screen.getByRole('button', { name: /Accept revised rate/ }))
    expect(within(screen.getByRole('dialog')).getByText('The amount is added to your next invoice.')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Accept' }))
    expect(st().data.weightRevisions[WR]).toMatchObject({ status: 'accepted', chargedTo: 'invoice' })
    expect(st().data.customers['C-SHARMA'].creditUsed).toBeCloseTo(credit + 81.77, 2)
    expect(screen.getByTestId('outcome')).toHaveTextContent('Accepted by Priya Sharma')

    // A fresh revision left unanswered: the demo clock passes 48 hours
    st().resetDemo()
    act(() => st().advanceTime(24 * 60))
    expect(st().data.weightRevisions[WR]).toMatchObject({ status: 'autoAccepted', respondedBy: 'system' })
  })
})
