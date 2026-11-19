import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CP13BookShipment from './CP13BookShipment'
import CP14Confirmation from './CP14Confirmation'

function renderBooking(userId = 'CU-PRIYA') {
  useSession.setState({ sessions: {} })
  useSession.getState().login('customer', userId)
  return render(
    <MemoryRouter initialEntries={['/customer/book']}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/book" element={<CP13BookShipment />} />
          <Route path="/customer/book/done/:lr" element={<CP14Confirmation />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
const stepTitle = () => screen.getByRole('heading', { level: 2, name: /Step \d of 6/ }).textContent

describe('CP-13 → CP-14 booking flow', () => {
  beforeEach(() => useDemoStore.getState().resetDemo())

  it('books the hero shipment end to end and shows LGS-DEL-000781 with 6 labels', async () => {
    renderBooking()
    fireEvent.click(screen.getByRole('button', { name: /Fill sample/ }))

    expect(stepTitle()).toContain('Pickup')
    expect(screen.getByLabelText(/Pickup slot/)).toHaveValue('14:00')
    next()
    expect(stepTitle()).toContain('Consignee')
    expect(screen.getByLabelText(/Company name/)).toHaveValue('Hubli Electric Distributors')
    next()
    expect(stepTitle()).toContain('Shipment')
    expect(screen.getByText(/Totals · 6 pieces/)).toBeInTheDocument()
    next()
    expect(stepTitle()).toContain('Invoice')
    expect(screen.getByText(/e-way bill is needed for this shipment \(valid 10 days\)/)).toBeInTheDocument()
    next()
    expect(stepTitle()).toContain('Payment')
    expect(screen.getByText('Available credit ₹1,55,800.00', { selector: 'p.tabular.rounded-lg' })).toBeInTheDocument()
    next()
    expect(stepTitle()).toContain('Review')
    expect(screen.getByTestId('price-total')).toHaveTextContent('₹3,628.26')
    expect(screen.getByTestId('review-eta')).toHaveTextContent('Thu, 26-Nov-2026')

    fireEvent.click(screen.getByRole('button', { name: /Confirm booking/ }))

    expect(await screen.findByTestId('lr', {}, { timeout: 15000 })).toHaveTextContent('LGS-DEL-000781')
    expect(screen.getByRole('heading', { name: '6 labels' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getByText('EWB 3410 2256 7781')).toBeInTheDocument()
    expect(screen.getByText(/₹3,628.26/).closest('div')).toHaveTextContent('(TBB (credit))')

    // In the shared store: booked, with credit used and spend updated
    const { data } = useDemoStore.getState()
    expect(data.shipments['LGS-DEL-000781'].status).toBe('booked')
    expect(data.customers['C-SHARMA'].creditUsed).toBe(347828.26)
  })

  it('does not move on while a step has errors', () => {
    renderBooking()
    next() // Pickup is valid by default
    expect(stepTitle()).toContain('Consignee')
    next()
    expect(stepTitle()).toContain('Consignee')
    expect(screen.getByText('Enter a 10-digit mobile number.')).toBeInTheDocument()
    expect(screen.getAllByText('This field is required.').length).toBeGreaterThan(0)
  })

  it('filling the consignee from the address book', () => {
    renderBooking()
    next()
    const search = screen.getByRole('combobox', { name: /Search address book/ })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'Belgaum' } })
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: /Belgaum Power Controls/ }))
    expect(screen.getByLabelText(/Pincode/)).toHaveValue('590001')
    expect(screen.getByLabelText(/Contact person/)).toHaveValue('Sunil Desai')
  })
})
