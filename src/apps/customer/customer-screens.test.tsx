import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CP11Dashboard from './CP11Dashboard'
import CP12GetQuote from './CP12GetQuote'

function renderAs(userId: string, ui: React.ReactElement) {
  useSession.setState({ sessions: {} })
  useSession.getState().login('customer', userId)
  return render(
    <MemoryRouter>
      <TooltipProvider>{ui}</TooltipProvider>
    </MemoryRouter>,
  )
}

const result = () => screen.getByRole('complementary', { name: 'Your quote' })

describe('CP-12 Get quote', () => {
  beforeAll(() => useDemoStore.getState().resetDemo())

  it('hero inputs: 162 kg chargeable, total ₹3,628.26, delivery Thu, 26-Nov-2026', () => {
    renderAs('CU-PRIYA', <CP12GetQuote />)
    fireEvent.click(screen.getByRole('button', { name: /Fill sample/ }))
    expect(screen.getByLabelText('Destination pincode')).toHaveValue('580030')
    expect(screen.getByText('Amargol, Hubballi, Karnataka')).toBeInTheDocument()
    expect(within(result()).getByTestId('price-total')).toHaveTextContent('₹3,628.26')
    expect(within(result()).getByTestId('eta')).toHaveTextContent('Thu, 26-Nov-2026')
    expect(result()).toHaveTextContent('Actual 120 kg|CFT (20.3 cu ft) 162 kg→Chargeable 162 kg')
    expect(within(result()).getByText(/e-way bill will be generated automatically \(valid 10 days\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Book this/ })).toBeEnabled()
  })

  it('reacts to inputs: dropping the appointment removes ₹300 (+ GST)', () => {
    renderAs('CU-PRIYA', <CP12GetQuote />)
    fireEvent.click(screen.getByRole('button', { name: /Fill sample/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Appointment delivery' }))
    // (3,074.80 − 300) × 1.18 = 3,274.26
    expect(within(result()).getByTestId('price-total')).toHaveTextContent('₹3,274.26')
  })

  it('Kaveri parcel: ₹561.09, with a tier comparison', () => {
    renderAs('CU-SURESH', <CP12GetQuote />)
    fireEvent.click(screen.getByRole('button', { name: /Fill sample/ }))
    expect(within(result()).getByTestId('price-total')).toHaveTextContent('₹561.09')
    expect(within(result()).getByRole('button', { name: /Economy/ })).toBeInTheDocument()
    expect(within(result()).getByRole('button', { name: /Standard/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a pincode we do not serve disables Book with the spec message', () => {
    renderAs('CU-PRIYA', <CP12GetQuote />)
    fireEvent.click(screen.getByRole('button', { name: /Fill sample/ }))
    fireEvent.change(screen.getByLabelText('Destination pincode'), { target: { value: '600032' } })
    expect(screen.getAllByText('We don’t serve this pincode yet.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Book this/ })).toBeDisabled()
  })

  it('COD cannot exceed the goods value', () => {
    renderAs('CU-PRIYA', <CP12GetQuote />)
    fireEvent.click(screen.getByRole('button', { name: /Fill sample/ }))
    fireEvent.change(screen.getByLabelText('Payment mode'), { target: { value: 'cod' } })
    fireEvent.change(screen.getByLabelText('COD amount'), { target: { value: '200000' } })
    expect(screen.getByText('COD amount cannot be more than the goods value.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Book this/ })).toBeDisabled()
  })

  it('Finance can quote but not book; prepaid customers are not offered TBB', () => {
    renderAs('CU-KAVITA', <CP12GetQuote />)
    expect(screen.queryByRole('button', { name: /Book this/ })).not.toBeInTheDocument()
    renderAs('CU-SURESH', <CP12GetQuote />)
    const pay = screen.getAllByLabelText('Payment mode').at(-1)!
    expect(within(pay).queryByRole('option', { name: /TBB/ })).not.toBeInTheDocument()
  })
})

describe('CP-11 Dashboard', () => {
  beforeAll(() => useDemoStore.getState().resetDemo())

  it('Admin sees status tiles, the exceptions needing action, spend and COD', async () => {
    renderAs('CU-PRIYA', <CP11Dashboard />)
    const actions = await screen.findByRole('region', { name: 'Exceptions needing action' }, { timeout: 3000 })
    expect(await within(actions).findByText('LGS-DEL-000784', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(within(actions).getByText(/LGS-DEL-000776/)).toHaveTextContent('Premises closed')
    expect(screen.getByRole('region', { name: 'Shipments by status' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Spend this month' })).toHaveTextContent('₹1,02,400.00')
    expect(screen.getByRole('region', { name: 'Spend this month' })).toHaveTextContent('Credit used ₹3,44,200.00 of ₹5,00,000.00')
    expect(screen.getByText('₹38,400.00')).toBeInTheDocument()
    expect(screen.getByText('Next remittance 24-Nov-2026')).toBeInTheDocument()
  })

  it('Dispatch sees operations widgets but not money', async () => {
    renderAs('CU-RAMESH', <CP11Dashboard />)
    expect(await screen.findByRole('region', { name: 'Shipments by status' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Spend this month' })).not.toBeInTheDocument()
  })

  it('Finance sees money widgets but not status tiles, and no Book button', async () => {
    renderAs('CU-KAVITA', <CP11Dashboard />)
    expect(await screen.findByRole('region', { name: 'Spend this month' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Shipments by status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Book shipment/ })).not.toBeInTheDocument()
  })

  it('prepaid customers see their wallet balance', async () => {
    renderAs('CU-SURESH', <CP11Dashboard />)
    expect(await screen.findByText('Wallet balance ₹8,450.00', {}, { timeout: 3000 })).toBeInTheDocument()
  })
})
