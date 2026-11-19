import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ErpApp from '@apps/erp/ErpApp'
import PartnerAppApp from '@apps/partner-app/PartnerAppApp'
import PartnerPortalApp from '@apps/partner-portal/PartnerPortalApp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from './CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))
vi.mock('@shared/ui/QrCode', () => ({ QrCode: ({ label }: { label: string }) => <div aria-label={label} /> }))

const st = () => useDemoStore.getState()
const LR = 'LGS-DEL-000786'

function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
          <Route path="/erp/*" element={<ErpApp />} />
          <Route path="/app/*" element={<PartnerAppApp />} />
          <Route path="/partner/*" element={<PartnerPortalApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Customer money: CP-23, CP-24, CP-25, PA-34, PA-36, ERP-31, ERP-34', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
  })

  it('CP-24: Kavita sees the credit summary, pays the October invoice, and the ledger shows it', () => {
    useSession.getState().login('customer', 'CU-KAVITA')
    app('/customer/billing/invoices')
    expect(screen.getByTestId('credit')).toHaveTextContent('₹5,00,000.00 / ₹3,44,200.00 / ₹1,55,800.00')
    expect(screen.getByTestId('credit')).toHaveTextContent('30 days')
    const oct = screen.getByRole('row', { name: 'LGS/DL/25-26/04417' })
    expect(oct).toHaveTextContent('₹2,04,915.00 / ₹36,885.00 / ₹2,41,800.00')
    expect(oct).toHaveTextContent('Unpaid')
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeDisabled()
    fireEvent.click(within(oct).getByRole('checkbox'))
    tap('Pay now')
    expect(screen.getByTestId('pay-amount')).toHaveTextContent('₹2,41,800.00')
    fireEvent.click(screen.getByRole('radio', { name: 'Net banking' }))
    tap('Pay ₹2,41,800.00')
    expect(st().data.invoices['LGS/DL/25-26/04417']).toMatchObject({ status: 'paid', payment: { method: 'netBanking', by: 'CU-KAVITA' } })
    expect(screen.getByRole('row', { name: 'LGS/DL/25-26/04417' })).toHaveTextContent('Paid')
    expect(screen.getByTestId('credit')).toHaveTextContent('₹1,02,400.00 / ₹3,97,600.00')
    fireEvent.click(screen.getByRole('tab', { name: 'Ledger' }))
    expect(within(screen.getByTestId('ledger')).getAllByRole('row').at(-1)).toHaveTextContent('Payment')
    fireEvent.click(screen.getByRole('tab', { name: 'Credit notes' }))
    expect(screen.getByRole('row', { name: 'CN-2026-0088' })).toHaveTextContent('₹30,000.00')
  })

  it('CP-24: Triveni gets the overdue banner; a failed payment changes nothing', () => {
    useSession.getState().login('customer', 'CU-TRIVENI')
    app('/customer/billing/invoices')
    expect(screen.getByRole('alert')).toHaveTextContent('₹3,10,000.00 is overdue')
    expect(screen.getByRole('row', { name: 'LGS/DL/25-26/03518' })).toHaveTextContent('Overdue')
    fireEvent.click(within(screen.getByRole('row', { name: 'LGS/DL/25-26/03518' })).getByRole('checkbox'))
    tap('Pay now')
    tap('Simulate failure')
    expect(st().data.invoices['LGS/DL/25-26/03518'].status).toBe('overdue')
  })

  it('CP-23: Suresh recharges ₹10,000; Dispatch-only views and credit customers have no wallet', () => {
    useSession.getState().login('customer', 'CU-SURESH')
    app('/customer/billing/wallet')
    expect(screen.getByTestId('balance')).toHaveTextContent('₹8,450.00')
    expect(screen.getByRole('row', { name: 'LGS-MYS-000112' })).toHaveTextContent('Booking debit')
    fireEvent.change(screen.getByLabelText(/Recharge amount/), { target: { value: '500' } })
    expect(screen.getByText('At least ₹1,000.00')).toBeInTheDocument()
    tap('₹10,000')
    tap('Recharge ₹10,000.00')
    tap('Pay ₹10,000.00')
    expect(screen.getByTestId('balance')).toHaveTextContent('₹18,450.00')
    expect(within(screen.getByTestId('wallet-txns')).getAllByRole('row')[1]).toHaveTextContent('Recharge')
  })

  it('PA-34 → PA-36 → ERP-34 → CP-25: Manju collects ₹4,200 on 000786, deposits, Lakshmi batches, Rahul approves', async () => {
    const legId = st().data.shipments[LR].legIds.at(-1)!
    useSession.getState().login('partnerApp', 'FS-MANJU')
    app(`/app/run/${legId}/deliver`)
    expect(screen.getByTestId('cod-due')).toHaveTextContent('₹4,200.00')
    tap('Tap to scan')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    tap('Send OTP to the consignee')
    await act(() => vi.advanceTimersByTimeAsync(700))
    vi.useRealTimers()
    fireEvent.change(screen.getByRole('textbox', { name: 'Delivery OTP' }), { target: { value: '1234' } })
    tap(/Take photo/)
    expect(screen.getByRole('button', { name: 'Complete delivery' })).toBeDisabled() // COD not collected
    fireEvent.change(screen.getByLabelText('Amount received (₹)'), { target: { value: '4000' } })
    expect(screen.getByText('Must be exactly ₹4,200.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm collected' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Amount received (₹)'), { target: { value: '4200' } })
    tap('Confirm collected')
    expect(screen.getByTestId('cod-collected')).toHaveTextContent('Cash · receipt sent to the consignee by SMS')
    tap('Complete delivery')
    expect(st().data.shipments[LR].status).toBe('delivered')
    expect(st().data.codRecords['COD-000786']).toMatchObject({ status: 'collected', amount: 4200 })

    // PA-05 banner → PA-36
    app('/app')
    fireEvent.click(screen.getByTestId('cod-banner'))
    expect(screen.getByTestId('cash-total')).toHaveTextContent('₹4,200.00')
    fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '4200' } })
    fireEvent.change(screen.getByLabelText('Cashier OTP'), { target: { value: '1234' } })
    tap('Submit deposit')
    expect(st().data.codRecords['COD-000786'].status).toBe('atOffice')

    // PP-28: NK Express deposits the office cash to Logisco
    useSession.getState().login('partnerPortal', 'PU-NAVEEN')
    app('/partner/finance/cod')
    expect(within(screen.getByTestId('cod-collections')).getByRole('row', { name: LR })).toHaveTextContent('At office')
    fireEvent.click(screen.getByRole('checkbox', { name: LR }))
    expect(screen.getByLabelText(/^Amount/)).toHaveValue(4200)
    fireEvent.change(screen.getByLabelText(/^UTR/), { target: { value: 'axisn2026112309911' } })
    tap('Submit deposit')
    expect(st().data.codRecords['COD-000786']).toMatchObject({ status: 'deposited', partnerDeposit: { method: 'bankTransfer', ref: 'AXISN2026112309911' } })

    // ERP-34: Lakshmi makes the batch, can't approve it
    useSession.getState().login('erp', 'LS-LAKSHMI')
    app('/erp/finance/cod')
    expect(within(screen.getByTestId('not-deposited')).getByRole('row', { name: 'SwiftCity Couriers' })).toHaveTextContent('₹21,600.00')
    expect(within(screen.getByTestId('not-deposited')).getByRole('row', { name: 'MetroDash' })).toHaveTextContent('41 h')
    const sharma = within(screen.getByTestId('deposited')).getByRole('row', { name: 'Sharma Electricals' })
    expect(sharma).toHaveTextContent('₹42,600.00')
    fireEvent.click(within(sharma).getByRole('button', { name: 'Create remittance batch' }))
    const row = () => within(screen.getByTestId('batches')).getByRole('row', { name: 'REM-2026-1104' })
    expect(row()).toHaveTextContent('Waiting for Leadership approval')
    expect(within(row()).queryByRole('button', { name: 'Approve and remit' })).toBeNull()

    useSession.getState().login('erp', 'LS-RAHUL')
    app('/erp/finance/cod')
    fireEvent.click(within(row()).getByRole('button', { name: 'Approve and remit' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and remit' }))
    expect(st().data.codRemittances['REM-2026-1104']).toMatchObject({ status: 'remitted', makerId: 'LS-LAKSHMI', checkerId: 'LS-RAHUL' })

    // CP-25
    useSession.getState().login('customer', 'CU-PRIYA')
    app('/customer/billing/cod')
    expect(screen.getByTestId('cod-summary')).toHaveTextContent('₹0.00')
    expect(screen.getByTestId('cod-summary')).toHaveTextContent('₹2,55,200.00')
    fireEvent.click(screen.getByRole('button', { name: 'REM-2026-1104' }))
    expect(screen.getByRole('row', { name: LR })).toHaveTextContent('₹4,200.00')
  })

  it('ERP-34: a shortage needs evidence; ERP-31: invoice run and collections priority', () => {
    useSession.getState().login('erp', 'LS-LAKSHMI')
    app('/erp/finance/cod')
    fireEvent.click(within(screen.getByRole('row', { name: 'MetroDash' })).getByRole('button', { name: 'Raise shortage' }))
    const dlg = within(screen.getByRole('dialog'))
    expect(dlg.getByRole('button', { name: 'Raise shortage' })).toBeDisabled()
    fireEvent.change(dlg.getByLabelText(/^Evidence/), { target: { value: 'No deposit 41 h after delivery' } })
    fireEvent.click(dlg.getByRole('button', { name: 'Raise shortage' }))
    expect(within(screen.getByTestId('shortages')).getByRole('row', { name: 'LGS-DEL-000571' })).toHaveTextContent('In the next payout')

    app('/erp/finance/invoicing')
    const preview = screen.getByTestId('run-preview')
    expect(within(preview).getByRole('row', { name: 'Sharma Electricals' })).toHaveTextContent('All attached')
    tap('Generate invoices')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Generate invoices' }))
    expect(Object.values(st().data.invoices).filter((i) => i.period === '2026-11').length).toBeGreaterThan(1)
    expect(within(screen.getByTestId('recent-invoices')).getByRole('row', { name: 'LGS/DL/25-26/04418' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Collections' }))
    const first = within(screen.getByTestId('priority')).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('Triveni Auto · ₹3,15,980.83') // ₹3.1 lakh overdue + the November invoice just generated
    expect(first).toHaveTextContent('38 days overdue')
    fireEvent.click(within(first).getByRole('button', { name: 'WhatsApp reminder' }))
    expect(st().data.invoices['LGS/DL/25-26/03518'].reminders).toMatchObject([{ channel: 'whatsapp', by: 'LS-LAKSHMI' }])
    expect(within(screen.getByTestId('ageing')).getByRole('row', { name: 'Triveni Auto' })).toHaveTextContent('₹3,10,000.00')
  })
})
