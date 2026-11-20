import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Partner settings: PP-29, PP-32, PP-33, PP-38', () => {
  beforeEach(() => {
    st().resetDemo()
    useSession.setState({ sessions: {}, language: 'en' })
    useSession.getState().login('partnerPortal', 'PU-VIKRAM')
  })

  it('PP-29: Ravi is listed as assignable; deactivating removes access', () => {
    app('/partner/staff')
    const ravi = screen.getByRole('row', { name: /Ravi Kumar/ })
    expect(within(ravi).getByText('Police verified')).toBeInTheDocument()
    fireEvent.click(within(ravi).getByRole('button', { name: 'Deactivate' }))
    expect(st().data.fieldStaff['FS-RAVI'].status).toBe('inactive')
  })

  it('PP-32: the insurance renewal goes under review', () => {
    app('/partner/compliance')
    const row = screen.getByRole('row', { name: 'Insurance · SwiftCity Couriers' })
    expect(within(row).getByText('Expires within 15 days')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: /Upload renewal/ }))
    fireEvent.change(screen.getByLabelText(/^File/), { target: { files: [new File(['x'], 'git-2027.pdf')] } })
    fireEvent.change(screen.getByLabelText(/New expiry date/), { target: { value: '2027-12-08' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Upload renewal/ }))
    expect(within(screen.getByRole('row', { name: 'Insurance · SwiftCity Couriers' })).getByText('Under review')).toBeInTheDocument()
  })

  it('PP-33: request exit opens the case and the menu shows it', () => {
    app('/partner/settings/company')
    tap('Request exit')
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Moving to own network' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Request exit' }))
    expect(screen.getByText(/Case SUS-\d{4} open/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View case' })).toBeInTheDocument()
  })

  it('PP-38: bell opens the partner notifications', () => {
    app('/partner')
    tap('Notifications, 1 unread')
    expect(screen.getByText('Goods-in-transit insurance expires 08-Dec-2026')).toBeInTheDocument()
  })
})
