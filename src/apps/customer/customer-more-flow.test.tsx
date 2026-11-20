import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import CustomerApp from './CustomerApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))
vi.mock('recharts', async (orig) => {
  const m = await orig<typeof import('recharts')>()
  return { ...m, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 300 }}>{children}</div> }
})

const st = () => useDemoStore.getState()
function app(path: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Routes>
          <Route path="/customer/*" element={<CustomerApp />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('CP-15, CP-26, CP-27', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    useSession.getState().login('customer', 'CU-PRIYA')
  })

  it('CP-15: the sample has 2 error rows; booking the rest never takes the hero LR', () => {
    app('/customer/book/bulk')
    tap('Use sample file')
    expect(screen.getByTestId('bulk-summary')).toHaveTextContent('Errors2')
    tap('Book 8 valid rows')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Book' }))
    const batch = Object.values(st().data.bulkBatches)[0]
    expect(batch).toMatchObject({ booked: 8, errors: 2, rows: 10 })
    expect(batch.lrs).not.toContain('LGS-DEL-000781')
    expect(within(screen.getByTestId('bulk-history')).getAllByRole('row')).toHaveLength(2)
    // The next single booking still gets the hero LR
    expect(st().data.shipments['LGS-DEL-000781']).toBeUndefined()
  })

  it('CP-26: e-PODs filter and a month ZIP', () => {
    app('/customer/documents')
    expect(screen.getByTestId('documents')).toBeInTheDocument()
    for (const name of ['LR', 'Label', 'E-way bill', 'Invoice', 'Credit note', 'GRN', 'Photos']) fireEvent.click(screen.getByRole('button', { name, pressed: true }))
    const rows = within(screen.getByTestId('documents')).getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((r) => expect(r).toHaveTextContent('e-POD'))
  })

  it('CP-27: Delhi → Hubballi 3.2 vs 3.5 days at ₹19.0 / kg', () => {
    app('/customer/analytics')
    const row = within(screen.getByTestId('lanes')).getByRole('row', { name: /Delhi NCR → Hubballi/ })
    expect(row).toHaveTextContent('3.2 vs 3.5')
    expect(row).toHaveTextContent('₹19.0')
  })
})
