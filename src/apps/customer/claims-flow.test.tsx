import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import PartnerPortalApp from '@apps/partner-portal/PartnerPortalApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from './CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
          <Route path="/partner/*" element={<PartnerPortalApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('Claims: CP-22 → ERP-36 / ERP-37 → PP-22', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('Priya raises a damage claim from CP-17; Farhan sees it on the desk with the liable leg', () => {
    useSession.getState().login('customer', 'CU-PRIYA')
    app('/customer/shipments/LGS-DEL-000657')
    fireEvent.click(screen.getByRole('button', { name: /Raise claim/ }))
    expect(screen.getByLabelText(/^LR number/)).toHaveValue('LGS-DEL-000657')
    fireEvent.change(screen.getByLabelText(/^Claim type/), { target: { value: 'damage' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Affected pieces' })).getByRole('checkbox', { name: /Piece 2 of 8/ }))
    expect(screen.getByText(/Up to ₹15,200.00 \(invoice value of these pieces; insured\)/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Claim amount/), { target: { value: '15200' } })
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Carton 2 crushed at delivery; GRN remark' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit claim' }))
    expect(screen.getByText('Add at least one file')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Evidence/), { target: { files: [new File(['x'], 'crushed.jpg')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit claim' }))
    expect(st().data.claims['CLM-2026-0152']).toMatchObject({ status: 'raised', amountClaimed: 15200, files: ['crushed.jpg'] })
    // Customer view: custody timeline without partner names
    expect(screen.getByTestId('custody')).not.toHaveTextContent(/SwiftCity|NCR CrossDock/)

    useSession.getState().login('erp', 'LS-FARHAN')
    app('/erp/claims/desk')
    const row = screen.getByRole('row', { name: 'CLM-2026-0152' })
    expect(row).toHaveTextContent('L5')
    expect(row).toHaveTextContent('Repeated claims')
  })

  it('Farhan settles CLM-2026-0151 by credit note with the partner share; NCR CrossDock accepts in PP-22; Priya confirms', () => {
    useSession.getState().login('erp', 'LS-FARHAN')
    app('/erp/claims/CLM-2026-0151')
    expect(screen.getByTestId('liability')).toHaveTextContent('Liable: L2 · NCR CrossDock · 3 in, 2 handed on')
    expect(within(screen.getByTestId('custody')).getByRole('row', { name: 'L2' })).toHaveTextContent('Pooja S.')
    expect(screen.getByLabelText(/^Approved amount/)).toHaveValue(1500)
    expect(screen.getByLabelText(/^Partner payout/)).toHaveValue(1500)
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'Approved; capped at carrier liability (not insured)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve settlement' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve settlement' }))
    expect(st().data.claims['CLM-2026-0151']).toMatchObject({ status: 'settled', creditNoteId: 'CN-2026-0089', partner: { status: 'notified', payoutDate: '2026-11-27' } })
    expect(screen.getByTestId('outcome')).toHaveTextContent('Credit note CN-2026-0089')

    useSession.getState().login('partnerPortal', 'PU-DEEPAK')
    app('/partner/claims')
    expect(within(screen.getByTestId('partner-claims')).getByRole('row', { name: 'CLM-2026-0142' })).toHaveTextContent('Deducted')
    fireEvent.click(screen.getByRole('link', { name: 'CLM-2026-0151' }))
    expect(screen.getByTestId('evidence')).toHaveTextContent('your leg')
    expect(screen.getByTestId('deduction')).toHaveTextContent('Deducted in the payout of 27-Nov-2026')
    fireEvent.click(screen.getByRole('button', { name: 'Send response' }))
    expect(st().data.claims['CLM-2026-0151'].partner!.status).toBe('accepted')

    useSession.getState().login('customer', 'CU-PRIYA')
    app('/customer/claims/CLM-2026-0151')
    expect(screen.getByTestId('decision')).toHaveTextContent('₹1,500.00 · Approved; capped at carrier liability')
    fireEvent.click(screen.getByRole('button', { name: /Confirm resolution/ }))
    expect(st().data.claims['CLM-2026-0151'].status).toBe('closed')
    app('/customer/claims')
    expect(within(screen.getByTestId('claims')).getByRole('row', { name: 'CLM-2026-0142' })).toHaveTextContent('₹30,000.00 / ₹30,000.00')
  })
})
