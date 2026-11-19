import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import PartnerPortalApp from './PartnerPortalApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/partner/*" element={<PartnerPortalApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Partner money: PP-25 to PP-28, ERP-32, ERP-33', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('Deccan uploads DR/0099 with an overbilled line → disputes → Lakshmi pays matched and approves', () => {
    useSession.getState().login('partnerPortal', 'PU-PRAKASH')
    app('/partner/finance/invoices')
    tap('Upload invoice')
    tap('Fill sample')
    const line = within(screen.getByTestId('upload-lines'))
      .getAllByRole('row')
      .find((r) => within(r).queryByRole('checkbox', { checked: true }))!
    const legId = line.getAttribute('aria-label')!
    expect(screen.getByText('Weights differ from the verified weight: these lines will be flagged')).toBeInTheDocument()
    tap('Submit invoice')
    const inv = st().data.partnerInvoices['DR/0099']
    expect(inv).toMatchObject({ mode: 'uploaded', status: 'submitted' })
    const l = inv.lines[0]
    expect(l.billed - l.matched).toBe(72)
    const row = screen.getByRole('row', { name: legId })
    expect(row).toHaveTextContent(/Mismatch: weight \d+ vs \d+ kg/)
    fireEvent.click(within(row).getByRole('button', { name: 'Dispute line' }))
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'Weighed at our dock' } })
    tap('Send to dispute desk')
    expect(st().data.partnerInvoices['DR/0099'].status).toBe('disputed')

    useSession.getState().login('erp', 'LS-LAKSHMI')
    app('/erp/finance/payables')
    const d = within(screen.getByTestId('disputes')).getByRole('row', { name: `DR/0099 ${legId}` })
    expect(d).toHaveTextContent('₹72.00')
    expect(d).toHaveTextContent('48 h left')
    fireEvent.click(within(d).getByRole('button', { name: 'DR/0099' }))
    fireEvent.change(screen.getByLabelText(/Note to the partner/), { target: { value: 'Pickup verification stands' } })
    tap('Resolve dispute')
    expect(st().data.partnerInvoices['DR/0099']).toMatchObject({ status: 'matched', lines: [{ final: l.matched, dispute: { decision: 'matched' } }] })
    tap('Approve for payout')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve for payout' }))
    expect(st().data.partnerInvoices['DR/0099'].status).toBe('approved')

    useSession.getState().login('partnerPortal', 'PU-PRAKASH')
    app('/partner/finance/invoices')
    expect(screen.getByRole('row', { name: 'DR/0099' })).toHaveTextContent('Approved for payout')
  })

  it('ERP-32 self-billing run; ERP-33: Lakshmi submits the 27-Nov batch, Rahul releases; SwiftCity sees the UTR', () => {
    useSession.getState().login('partnerPortal', 'PU-ANIL')
    app('/partner/finance/payouts')
    expect(screen.getByTestId('next-payout')).toHaveTextContent('27-Nov-2026')
    expect(screen.getByTestId('next-payout')).toHaveTextContent('₹1,84,063.00')
    expect(screen.getByTestId('next-payout')).toHaveTextContent('Penalty · JOB-000604-L1')
    expect(screen.getByRole('row', { name: 'PO-2026-0412' })).toHaveTextContent('₹1,71,880.00')

    useSession.getState().login('erp', 'LS-LAKSHMI')
    app('/erp/finance/payables')
    const sb = within(screen.getByTestId('self-billing'))
    expect(sb.getByRole('row', { name: 'NCR CrossDock' })).toBeInTheDocument()
    expect(sb.queryByRole('row', { name: 'Deccan Roadlines' })).toBeNull()
    tap(/^Generate \d+ self-billed invoices$/)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Generate/ }))
    const ncr = Object.values(st().data.partnerInvoices).find((i) => i.partnerId === 'P-NCRXD')!
    expect(ncr.status).toBe('matched')
    fireEvent.click(screen.getByRole('button', { name: ncr.id }))
    tap('Approve for payout')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve for payout' }))

    app('/erp/finance/payouts')
    const lines = within(screen.getByTestId('batch-lines'))
    expect(lines.getByRole('row', { name: /SwiftCity Couriers/ })).toHaveTextContent('₹1,84,063.00')
    expect(lines.getByRole('row', { name: /NCR CrossDock/ })).toBeInTheDocument()
    tap('Submit for approval')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit for approval' }))
    expect(st().data.payoutBatches['PB-2026-1127']).toMatchObject({ status: 'pendingApproval', makerId: 'LS-LAKSHMI' })
    expect(screen.queryByRole('button', { name: 'Approve and release' })).toBeNull()

    useSession.getState().login('erp', 'LS-RAHUL')
    app('/erp/finance/payouts')
    tap('Approve and release')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and release' }))
    expect(st().data.payoutBatches['PB-2026-1127']).toMatchObject({ status: 'released', checkerId: 'LS-RAHUL' })
    const utr = st().data.payouts['PO-SWC-2026-1127'].utr!

    useSession.getState().login('partnerPortal', 'PU-ANIL')
    app('/partner/finance/payouts')
    expect(screen.getByRole('row', { name: 'PO-SWC-2026-1127' })).toHaveTextContent(utr)
  })

  it('PP-27 early pay with OTP → ERP-33 release by IMPS; PP-25 shows the day with COD', () => {
    useSession.getState().login('partnerPortal', 'PU-ANIL')
    app('/partner/finance/payouts')
    expect(screen.getByTestId('early-available')).toHaveTextContent('₹1,84,363.00')
    fireEvent.change(screen.getByLabelText(/Request amount/), { target: { value: '50000' } })
    expect(screen.getByText('Fee ₹500.00 · you receive ₹49,500.00 by IMPS')).toBeInTheDocument()
    tap('Request early pay')
    fireEvent.change(screen.getByLabelText('OTP'), { target: { value: '123456' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const ep = Object.values(st().data.payouts).find((p) => p.kind === 'earlyPay')!
    expect(ep).toMatchObject({ gross: 50000, fee: 500, status: 'pendingApproval' })

    useSession.getState().login('erp', 'LS-RAHUL')
    app('/erp/finance/payouts')
    fireEvent.click(within(screen.getByRole('row', { name: ep.id })).getByRole('button', { name: 'Release by IMPS' }))
    expect(st().data.payouts[ep.id].status).toBe('paid')

    useSession.getState().login('partnerPortal', 'PU-ANIL')
    app('/partner/finance/daily')
    const sun = screen.getByRole('row', { name: '22-Nov-2026' })
    expect(sun).toHaveTextContent('₹21,600.00 / ₹0.00')
    fireEvent.click(within(sun).getByRole('button', { name: /22-Nov-2026/ }))
    expect(within(screen.getByTestId('day-legs')).getAllByRole('row').length).toBeGreaterThan(1)
  })
})
