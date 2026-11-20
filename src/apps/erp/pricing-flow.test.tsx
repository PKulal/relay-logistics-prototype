import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { TooltipProvider } from '@shared/ui/tooltip'
import ErpApp from './ErpApp'

vi.mock('@shared/ui/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

const st = () => useDemoStore.getState()
function app(path: string) {
  cleanup()
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

describe('Pricing: ERP-24, ERP-25', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    useSession.getState().login('erp', 'LS-DIVYA')
  })

  it('ERP-25: hero sample → ₹562.80 (18.3%) → ₹501.30 (16.3%); another first-mile partner recalculates', () => {
    app('/erp/pricing/simulator')
    expect(screen.getByText('Fill in the route, pieces and value to see the price and margin.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fill hero sample' }))
    const m = screen.getByTestId('sim-margin')
    expect(m).toHaveTextContent('₹3,074.80')
    expect(m).toHaveTextContent('₹562.80 (18.3%)')
    expect(m).toHaveTextContent('₹61.50')
    expect(m).toHaveTextContent('₹501.30 (16.3%)')
    expect(screen.getByText('Above the 15% target')).toBeInTheDocument()
    const fm = screen.getByRole('combobox', { name: 'Partner for First mile' }) as HTMLSelectElement
    const other = [...fm.options].find((o) => o.value !== 'P-SWIFTCITY')!
    fireEvent.change(fm, { target: { value: other.value } })
    expect(screen.getByTestId('sim-margin')).not.toHaveTextContent('₹562.80 (18.3%)')
    fireEvent.change(screen.getByLabelText('Destination pincode'), { target: { value: '600032' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('ERP-24: lanes with margin, alerts, quote checks; open a lane', () => {
    app('/erp/pricing/margin')
    const lanes = within(screen.getByTestId('lanes'))
    expect(lanes.getByRole('row', { name: 'Delhi NCR → Hubballi' })).toBeInTheDocument()
    expect(within(screen.getByTestId('alerts')).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('quote-checks')).getAllByRole('row').length).toBeGreaterThan(1)
    expect(screen.getByRole('switch', { name: 'Lane demand' })).toBeDisabled()
    fireEvent.click(lanes.getByRole('button', { name: 'Delhi NCR → Hubballi' }))
    expect(screen.getByRole('heading', { name: 'Delhi NCR → Hubballi' })).toBeInTheDocument()
    expect(within(screen.getByTestId('lane-shipments')).getAllByRole('row').length).toBeGreaterThan(1)
  })
})
